import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShopifyRateLimiter } from './shopify-rate-limiter';
import {
  ShopifyOrder,
  ShopifyRefundPayload,
  ShopifyProduct,
  ShopifyOAuthTokenResponse,
  ShopifyPaginationInfo,
} from './shopify.types';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly rateLimiters = new Map<string, ShopifyRateLimiter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------------------

  /**
   * Generate the Shopify OAuth authorization URL.
   * The `state` parameter is a signed JWT containing the orgId so we can
   * attribute the callback to the correct organization.
   */
  getAuthUrl(orgId: string, shopDomain: string): string {
    const clientId = this.configService.getOrThrow<string>('SHOPIFY_API_KEY');
    const apiUrl = this.configService.getOrThrow<string>('API_URL');
    const secret =
      this.configService.get<string>('API_SECRET') ||
      this.configService.get<string>('SHOPIFY_API_SECRET');
    if (!secret) {
      throw new BadRequestException(
        'Missing API_SECRET or SHOPIFY_API_SECRET environment variable',
      );
    }

    const normalizedShop = this.normalizeShopDomain(shopDomain);

    const state = jwt.sign({ orgId, shop: normalizedShop }, secret, {
      expiresIn: '10m',
    });

    const scopes = 'read_orders,read_products,read_inventory';
    const redirectUri = `${apiUrl}/api/auth/shopify/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
    });

    return `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback: verify state, exchange code for token,
   * persist the integration, register webhooks, and kick off backfill.
   */
  async handleCallback(
    code: string,
    shop: string,
    state: string,
  ): Promise<{ integrationId: string }> {
    const secret = this.configService.getOrThrow<string>('API_SECRET');

    // 1. Verify state JWT
    let payload: { orgId: string; shop: string };
    try {
      payload = jwt.verify(state, secret) as { orgId: string; shop: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired state token');
    }

    const orgId = payload.orgId;
    const normalizedShop = this.normalizeShopDomain(shop);

    // 2. Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken(normalizedShop, code);

    // 3. Encrypt credentials and create/update Integration record
    const encryptedCredentials = this.encryptCredentials({
      accessToken: tokenResponse.access_token,
      scope: tokenResponse.scope,
      shopDomain: normalizedShop,
    });

    const integration = await this.prisma.integration.upsert({
      where: {
        orgId_type: { orgId, type: 'shopify' },
      },
      update: {
        status: 'connected',
        credentials: encryptedCredentials,
        scopes: tokenResponse.scope.split(','),
        updatedAt: new Date(),
      },
      create: {
        orgId,
        type: 'shopify',
        status: 'connected',
        credentials: encryptedCredentials,
        scopes: tokenResponse.scope.split(','),
      },
    });

    // 4. Create/update Shop record
    await this.prisma.shop.upsert({
      where: {
        orgId_domain: { orgId, domain: normalizedShop },
      },
      update: {
        name: normalizedShop.replace('.myshopify.com', ''),
        integrationId: integration.id,
      },
      create: {
        orgId,
        integrationId: integration.id,
        platform: 'shopify',
        name: normalizedShop.replace('.myshopify.com', ''),
        domain: normalizedShop,
      },
    });

    // 5. Register webhooks with Shopify
    await this.registerWebhooks(normalizedShop, tokenResponse.access_token);

    // 6. Start initial backfill (synchronous for now — no Redis queue)
    this.logger.log(`Starting backfill for integration ${integration.id}`);
    this.backfill(integration.id).catch((err) => {
      this.logger.error(`Backfill failed for ${integration.id}: ${err.message}`);
    });
    // Previously queued via BullMQ:
    // await this.syncQueue.add('backfill', { integrationId: integration.id }, {
    this.logger.log(
      `Shopify integration created for org ${orgId}, shop ${normalizedShop}`,
    );

    return { integrationId: integration.id };
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  /**
   * Register all required webhook subscriptions with Shopify.
   * Deletes existing hooks first to avoid duplicates, then creates fresh ones.
   */
  async registerWebhooks(
    shopDomain: string,
    accessToken: string,
  ): Promise<void> {
    const apiUrl = this.configService.getOrThrow<string>('API_URL');
    const webhookAddress = `${apiUrl}/webhooks/shopify`;

    const topics = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'refunds/create',
      'products/update',
      'app/uninstalled',
    ];

    // Delete all existing webhooks
    const existingWebhooks = await this.shopifyApiGet<{
      webhooks: Array<{ id: number }>;
    }>(shopDomain, accessToken, '/admin/api/2024-01/webhooks.json');

    for (const wh of existingWebhooks.webhooks || []) {
      await this.shopifyApiDelete(
        shopDomain,
        accessToken,
        `/admin/api/2024-01/webhooks/${wh.id}.json`,
      );
    }

    // Create new webhooks
    for (const topic of topics) {
      await this.shopifyApiPost(
        shopDomain,
        accessToken,
        '/admin/api/2024-01/webhooks.json',
        {
          webhook: {
            topic,
            address: webhookAddress,
            format: 'json',
          },
        },
      );
    }

    this.logger.log(
      `Registered ${topics.length} webhooks for ${shopDomain}`,
    );
  }

  /**
   * Verify the HMAC signature on an incoming Shopify webhook.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookHmac(rawBody: Buffer, hmacHeader: string): boolean {
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(hmacHeader),
      );
    } catch {
      // Lengths differ
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Order processing
  // ---------------------------------------------------------------------------

  /**
   * Upsert a Shopify order into the local database.
   * Handles line items, COGS lookup, first-order detection, and reaggregation.
   */
  async upsertOrder(
    orgId: string,
    integrationId: string,
    shopifyOrder: ShopifyOrder,
  ): Promise<{ orderId: string; action: 'created' | 'updated' }> {
    const externalId = String(shopifyOrder.id);

    // Find the shop for this integration
    const shop = await this.prisma.shop.findFirst({
      where: { orgId, integration: { id: integrationId } },
    });

    if (!shop) {
      throw new BadRequestException(
        `No shop found for integration ${integrationId}`,
      );
    }

    // Determine if this is the customer's first order
    let isFirstOrder = false;
    if (shopifyOrder.customer?.id) {
      const priorOrderCount = await this.prisma.order.count({
        where: {
          orgId,
          customerId: String(shopifyOrder.customer.id),
        },
      });
      isFirstOrder = priorOrderCount === 0;
    }

    // Map Shopify financial status
    const financialStatusMap: Record<string, string> = {
      paid: 'paid',
      partially_paid: 'partially_paid',
      refunded: 'refunded',
      partially_refunded: 'partially_refunded',
      pending: 'pending',
      authorized: 'pending',
      voided: 'pending',
    };

    // Map Shopify fulfillment status
    const fulfillmentStatusMap: Record<string, string> = {
      fulfilled: 'fulfilled',
      partial: 'partial',
      null: 'unfulfilled',
    };

    // Map order status
    let orderStatus: 'open' | 'closed' | 'cancelled' = 'open';
    if (shopifyOrder.cancelled_at) {
      orderStatus = 'cancelled';
    } else if (shopifyOrder.closed_at) {
      orderStatus = 'closed';
    }

    const emailHash = shopifyOrder.email
      ? crypto.createHash('sha256').update(shopifyOrder.email.toLowerCase()).digest('hex')
      : null;

    const totalShipping = shopifyOrder.total_shipping_price_set?.shop_money?.amount
      ? parseFloat(shopifyOrder.total_shipping_price_set.shop_money.amount)
      : 0;

    const discountCodes = (shopifyOrder.discount_codes || []).map((dc) => ({
      code: dc.code,
      amount: dc.amount,
      type: dc.type,
    }));

    const tags = shopifyOrder.tags
      ? shopifyOrder.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const placedAt = new Date(
      shopifyOrder.processed_at || shopifyOrder.created_at,
    );

    const countryCode =
      shopifyOrder.billing_address?.country_code ??
      shopifyOrder.shipping_address?.country_code ??
      null;

    const provinceCode =
      shopifyOrder.billing_address?.province_code ??
      shopifyOrder.shipping_address?.province_code ??
      null;

    // Execute in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if order already exists
      const existingOrder = await tx.order.findUnique({
        where: {
          orgId_externalId: { orgId, externalId },
        },
        select: { id: true },
      });

      const action: 'created' | 'updated' = existingOrder
        ? 'updated'
        : 'created';

      // Upsert the order
      const order = await tx.order.upsert({
        where: {
          orgId_externalId: { orgId, externalId },
        },
        update: {
          orderNumber: String(shopifyOrder.order_number),
          status: orderStatus,
          financialStatus:
            (financialStatusMap[shopifyOrder.financial_status] as any) ??
            'pending',
          fulfillmentStatus:
            (fulfillmentStatusMap[
              shopifyOrder.fulfillment_status ?? 'null'
            ] as any) ?? 'unfulfilled',
          customerId: shopifyOrder.customer?.id
            ? String(shopifyOrder.customer.id)
            : null,
          emailHash,
          currency: shopifyOrder.currency,
          subtotalPrice: parseFloat(shopifyOrder.subtotal_price) || 0,
          totalDiscounts: parseFloat(shopifyOrder.total_discounts) || 0,
          totalShipping: totalShipping,
          totalTax: parseFloat(shopifyOrder.total_tax) || 0,
          totalPrice: parseFloat(shopifyOrder.total_price) || 0,
          paymentGateway: shopifyOrder.payment_gateway_names?.[0] ?? null,
          isFirstOrder,
          sourceName: shopifyOrder.source_name ?? null,
          tags,
          landingSite: shopifyOrder.landing_site ?? null,
          referringSite: shopifyOrder.referring_site ?? null,
          discountCodes,
          countryCode,
          provinceCode,
          placedAt,
          updatedAt: new Date(),
        },
        create: {
          orgId,
          shopId: shop.id,
          externalId,
          orderNumber: String(shopifyOrder.order_number),
          status: orderStatus,
          financialStatus:
            (financialStatusMap[shopifyOrder.financial_status] as any) ??
            'pending',
          fulfillmentStatus:
            (fulfillmentStatusMap[
              shopifyOrder.fulfillment_status ?? 'null'
            ] as any) ?? 'unfulfilled',
          customerId: shopifyOrder.customer?.id
            ? String(shopifyOrder.customer.id)
            : null,
          emailHash,
          currency: shopifyOrder.currency,
          subtotalPrice: parseFloat(shopifyOrder.subtotal_price) || 0,
          totalDiscounts: parseFloat(shopifyOrder.total_discounts) || 0,
          totalShipping: totalShipping,
          totalTax: parseFloat(shopifyOrder.total_tax) || 0,
          totalPrice: parseFloat(shopifyOrder.total_price) || 0,
          paymentGateway: shopifyOrder.payment_gateway_names?.[0] ?? null,
          isFirstOrder,
          sourceName: shopifyOrder.source_name ?? null,
          tags,
          landingSite: shopifyOrder.landing_site ?? null,
          referringSite: shopifyOrder.referring_site ?? null,
          discountCodes,
          countryCode,
          provinceCode,
          placedAt,
        },
      });

      // Delete existing line items and recreate
      await tx.orderLineItem.deleteMany({
        where: { orderId: order.id, orgId },
      });

      // Build line items with COGS lookup
      for (const li of shopifyOrder.line_items) {
        let productVariantId: string | null = null;
        let unitCogs: number | null = null;
        let lineCogs: number | null = null;

        if (li.variant_id) {
          const variant = await tx.productVariant.findUnique({
            where: {
              orgId_externalId: {
                orgId,
                externalId: String(li.variant_id),
              },
            },
            select: { id: true, cogs: true },
          });

          if (variant) {
            productVariantId = variant.id;
            if (variant.cogs !== null) {
              unitCogs = Number(variant.cogs);
              lineCogs = unitCogs * li.quantity;
            }
          }
        }

        const lineTotal =
          parseFloat(li.price) * li.quantity -
          parseFloat(li.total_discount || '0');

        await tx.orderLineItem.create({
          data: {
            orgId,
            orderId: order.id,
            productVariantId,
            externalId: String(li.id),
            title: li.variant_title
              ? `${li.title} - ${li.variant_title}`
              : li.title,
            sku: li.sku ?? null,
            quantity: li.quantity,
            unitPrice: parseFloat(li.price) || 0,
            totalDiscount: parseFloat(li.total_discount || '0'),
            lineTotal,
            unitCogs,
            lineCogs,
            fulfillmentStatus: li.fulfillment_status ?? null,
          },
        });
      }

      return { orderId: order.id, action };
    });

    // Enqueue reaggregation for the affected date (outside transaction)
    await this.enqueueReaggregation(orgId, placedAt);

    return result;
  }

  // ---------------------------------------------------------------------------
  // Refund processing
  // ---------------------------------------------------------------------------

  /**
   * Process a Shopify refund: create the Refund record, update the order's
   * totalRefunded, and trigger reaggregation.
   */
  async processRefund(
    orgId: string,
    integrationId: string,
    shopifyRefund: ShopifyRefundPayload,
  ): Promise<void> {
    const externalOrderId = String(shopifyRefund.order_id);
    const externalRefundId = String(shopifyRefund.id);

    // Calculate total refund amount from transactions
    const refundAmount = (shopifyRefund.transactions || [])
      .filter((t) => t.kind === 'refund' && t.status === 'success')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    await this.prisma.$transaction(async (tx) => {
      // Find the order
      const order = await tx.order.findUnique({
        where: {
          orgId_externalId: { orgId, externalId: externalOrderId },
        },
        select: { id: true, totalRefunded: true, placedAt: true },
      });

      if (!order) {
        this.logger.warn(
          `Order ${externalOrderId} not found for refund ${externalRefundId}`,
        );
        return;
      }

      // Build refund line items JSON
      const refundLineItems = (shopifyRefund.refund_line_items || []).map(
        (rli) => ({
          lineItemExternalId: String(rli.line_item_id),
          quantity: rli.quantity,
          subtotal: parseFloat(rli.subtotal),
          totalTax: parseFloat(rli.total_tax),
          restockType: rli.restock_type,
        }),
      );

      // Upsert refund record
      await tx.refund.upsert({
        where: {
          orgId_externalId: { orgId, externalId: externalRefundId },
        },
        update: {
          amount: refundAmount,
          note: shopifyRefund.note ?? null,
          refundLineItems,
        },
        create: {
          orgId,
          orderId: order.id,
          externalId: externalRefundId,
          amount: refundAmount,
          reason: shopifyRefund.note ?? null,
          note: shopifyRefund.note ?? null,
          refundLineItems,
        },
      });

      // Recalculate total refunded for the order
      const allRefunds = await tx.refund.aggregate({
        where: { orderId: order.id, orgId },
        _sum: { amount: true },
      });

      const newTotalRefunded = Number(allRefunds._sum.amount ?? 0);

      await tx.order.update({
        where: { id: order.id },
        data: {
          totalRefunded: newTotalRefunded,
          financialStatus:
            newTotalRefunded > 0 ? 'partially_refunded' : undefined,
        },
      });

      // Trigger reaggregation
      await this.enqueueReaggregation(orgId, order.placedAt);
    });

    this.logger.log(
      `Processed refund ${externalRefundId} for order ${externalOrderId} ($${refundAmount})`,
    );
  }

  // ---------------------------------------------------------------------------
  // Product processing
  // ---------------------------------------------------------------------------

  /**
   * Upsert a Shopify product and its variants.
   * Preserves existing COGS values that were manually entered.
   */
  async upsertProduct(
    orgId: string,
    integrationId: string,
    shopifyProduct: ShopifyProduct,
  ): Promise<void> {
    const externalProductId = String(shopifyProduct.id);

    // Find the shop
    const shop = await this.prisma.shop.findFirst({
      where: { orgId, integration: { id: integrationId } },
    });

    if (!shop) {
      throw new BadRequestException(
        `No shop found for integration ${integrationId}`,
      );
    }

    const statusMap: Record<string, string> = {
      active: 'active',
      archived: 'archived',
      draft: 'draft',
    };

    const imageUrl =
      shopifyProduct.image?.src ?? shopifyProduct.images?.[0]?.src ?? null;

    await this.prisma.$transaction(async (tx) => {
      // Upsert product
      const product = await tx.product.upsert({
        where: {
          orgId_externalId: { orgId, externalId: externalProductId },
        },
        update: {
          title: shopifyProduct.title,
          handle: shopifyProduct.handle ?? null,
          imageUrl,
          status: (statusMap[shopifyProduct.status] as any) ?? 'active',
          category: shopifyProduct.product_type ?? null,
          vendor: shopifyProduct.vendor ?? null,
          updatedAt: new Date(),
        },
        create: {
          orgId,
          shopId: shop.id,
          externalId: externalProductId,
          title: shopifyProduct.title,
          handle: shopifyProduct.handle ?? null,
          imageUrl,
          status: (statusMap[shopifyProduct.status] as any) ?? 'active',
          category: shopifyProduct.product_type ?? null,
          vendor: shopifyProduct.vendor ?? null,
        },
      });

      // Upsert each variant, preserving existing COGS
      for (const sv of shopifyProduct.variants) {
        const externalVariantId = String(sv.id);

        // Check for existing variant to preserve COGS
        const existingVariant = await tx.productVariant.findUnique({
          where: {
            orgId_externalId: { orgId, externalId: externalVariantId },
          },
          select: { cogs: true, cogsCurrency: true, cogsUpdatedAt: true },
        });

        await tx.productVariant.upsert({
          where: {
            orgId_externalId: { orgId, externalId: externalVariantId },
          },
          update: {
            title: sv.title,
            sku: sv.sku ?? null,
            barcode: sv.barcode ?? null,
            price: parseFloat(sv.price) || 0,
            compareAtPrice: sv.compare_at_price
              ? parseFloat(sv.compare_at_price)
              : null,
            inventoryQuantity: sv.inventory_quantity ?? 0,
            // Preserve existing COGS - do not overwrite
            updatedAt: new Date(),
          },
          create: {
            orgId,
            productId: product.id,
            externalId: externalVariantId,
            title: sv.title,
            sku: sv.sku ?? null,
            barcode: sv.barcode ?? null,
            price: parseFloat(sv.price) || 0,
            compareAtPrice: sv.compare_at_price
              ? parseFloat(sv.compare_at_price)
              : null,
            inventoryQuantity: sv.inventory_quantity ?? 0,
            // No COGS on initial creation - user must supply manually or via CSV
            cogs: existingVariant?.cogs ?? null,
            cogsCurrency: existingVariant?.cogsCurrency ?? null,
            cogsUpdatedAt: existingVariant?.cogsUpdatedAt ?? null,
          },
        });
      }
    });

    this.logger.log(
      `Upserted product ${shopifyProduct.title} (${shopifyProduct.variants.length} variants)`,
    );
  }

  // ---------------------------------------------------------------------------
  // Backfill
  // ---------------------------------------------------------------------------

  /**
   * Initial backfill: fetch all products then 12 months of orders
   * using cursor-based pagination.
   */
  async backfill(
    integrationId: string,
  ): Promise<{ orders: number; products: number }> {
    const integration = await this.prisma.integration.findUniqueOrThrow({
      where: { id: integrationId },
      include: { shops: true },
    });

    const orgId = integration.orgId;
    const { accessToken, shopDomain } = this.decryptCredentials(
      integration.credentials as Record<string, string>,
    );
    const rateLimiter = this.getRateLimiter(shopDomain);

    // Create sync log
    const syncLog = await this.prisma.syncLog.create({
      data: {
        orgId,
        integrationId,
        syncType: 'backfill',
        status: 'started',
      },
    });

    const startTime = Date.now();
    let totalProducts = 0;
    let totalOrders = 0;

    try {
      // --- Products first ---
      let nextProductsUrl: string | null =
        `/admin/api/2024-01/products.json?limit=250&status=active`;

      while (nextProductsUrl) {
        await rateLimiter.waitIfNeeded();
        const response = await this.shopifyApiGetWithPagination<{
          products: ShopifyProduct[];
        }>(shopDomain, accessToken, nextProductsUrl);

        for (const product of response.data.products) {
          await this.upsertProduct(orgId, integrationId, product);
          totalProducts++;
        }

        nextProductsUrl = response.pagination.nextPageUrl;
      }

      // Also fetch archived products
      let nextArchivedUrl: string | null =
        `/admin/api/2024-01/products.json?limit=250&status=archived`;

      while (nextArchivedUrl) {
        await rateLimiter.waitIfNeeded();
        const response = await this.shopifyApiGetWithPagination<{
          products: ShopifyProduct[];
        }>(shopDomain, accessToken, nextArchivedUrl);

        for (const product of response.data.products) {
          await this.upsertProduct(orgId, integrationId, product);
          totalProducts++;
        }

        nextArchivedUrl = response.pagination.nextPageUrl;
      }

      // --- Orders: 12 months back ---
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const createdAtMin = twelveMonthsAgo.toISOString();

      let nextOrdersUrl: string | null =
        `/admin/api/2024-01/orders.json?limit=250&status=any&created_at_min=${encodeURIComponent(createdAtMin)}`;

      while (nextOrdersUrl) {
        await rateLimiter.waitIfNeeded();
        const response = await this.shopifyApiGetWithPagination<{
          orders: ShopifyOrder[];
        }>(shopDomain, accessToken, nextOrdersUrl);

        for (const order of response.data.orders) {
          await this.upsertOrder(orgId, integrationId, order);
          totalOrders++;
        }

        nextOrdersUrl = response.pagination.nextPageUrl;
      }

      // Mark sync as completed
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          recordsProcessed: totalProducts + totalOrders,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncedAt: new Date() },
      });

      this.logger.log(
        `Backfill completed: ${totalProducts} products, ${totalOrders} orders`,
      );

      return { orders: totalOrders, products: totalProducts };
    } catch (error) {
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          recordsProcessed: totalProducts + totalOrders,
          errors: [
            {
              message: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          ],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Scheduled reconciliation: compare orders updated in the last 7 hours
   * with what we have locally, and fix discrepancies.
   */
  async reconcile(
    integrationId: string,
  ): Promise<{ checked: number; fixed: number }> {
    const integration = await this.prisma.integration.findUniqueOrThrow({
      where: { id: integrationId },
    });

    const orgId = integration.orgId;
    const { accessToken, shopDomain } = this.decryptCredentials(
      integration.credentials as Record<string, string>,
    );
    const rateLimiter = this.getRateLimiter(shopDomain);

    const syncLog = await this.prisma.syncLog.create({
      data: {
        orgId,
        integrationId,
        syncType: 'scheduled',
        status: 'started',
      },
    });

    const startTime = Date.now();
    let checked = 0;
    let fixed = 0;

    try {
      const sevenHoursAgo = new Date();
      sevenHoursAgo.setHours(sevenHoursAgo.getHours() - 7);
      const updatedAtMin = sevenHoursAgo.toISOString();

      let nextUrl: string | null =
        `/admin/api/2024-01/orders.json?limit=250&status=any&updated_at_min=${encodeURIComponent(updatedAtMin)}`;

      while (nextUrl) {
        await rateLimiter.waitIfNeeded();
        const response = await this.shopifyApiGetWithPagination<{
          orders: ShopifyOrder[];
        }>(shopDomain, accessToken, nextUrl);

        for (const shopifyOrder of response.data.orders) {
          checked++;

          // Check if local data differs
          const localOrder = await this.prisma.order.findUnique({
            where: {
              orgId_externalId: {
                orgId,
                externalId: String(shopifyOrder.id),
              },
            },
            select: {
              totalPrice: true,
              financialStatus: true,
              status: true,
              updatedAt: true,
            },
          });

          // Upsert if missing or if key fields differ
          const needsUpdate =
            !localOrder ||
            Number(localOrder.totalPrice) !==
              parseFloat(shopifyOrder.total_price) ||
            localOrder.financialStatus !== shopifyOrder.financial_status;

          if (needsUpdate) {
            await this.upsertOrder(orgId, integrationId, shopifyOrder);
            fixed++;
          }
        }

        nextUrl = response.pagination.nextPageUrl;
      }

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          recordsProcessed: checked,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncedAt: new Date() },
      });

      this.logger.log(`Reconciliation: checked ${checked}, fixed ${fixed}`);

      return { checked, fixed };
    } catch (error) {
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          recordsProcessed: checked,
          errors: [
            {
              message: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          ],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers: Shopify HTTP client
  // ---------------------------------------------------------------------------

  private async shopifyApiGet<T>(
    shopDomain: string,
    accessToken: string,
    path: string,
  ): Promise<T> {
    const rateLimiter = this.getRateLimiter(shopDomain);
    await rateLimiter.waitIfNeeded();

    const url = path.startsWith('http')
      ? path
      : `https://${shopDomain}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    rateLimiter.updateFromHeaders(
      Object.fromEntries(response.headers.entries()),
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      rateLimiter.handleTooManyRequests(
        retryAfter ? parseFloat(retryAfter) : undefined,
      );
      // Retry once after waiting
      await rateLimiter.waitIfNeeded();
      return this.shopifyApiGet(shopDomain, accessToken, path);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Shopify API error ${response.status}: ${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async shopifyApiGetWithPagination<T>(
    shopDomain: string,
    accessToken: string,
    path: string,
  ): Promise<{ data: T; pagination: ShopifyPaginationInfo }> {
    const rateLimiter = this.getRateLimiter(shopDomain);
    await rateLimiter.waitIfNeeded();

    const url = path.startsWith('http')
      ? path
      : `https://${shopDomain}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    rateLimiter.updateFromHeaders(
      Object.fromEntries(response.headers.entries()),
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      rateLimiter.handleTooManyRequests(
        retryAfter ? parseFloat(retryAfter) : undefined,
      );
      await rateLimiter.waitIfNeeded();
      return this.shopifyApiGetWithPagination(shopDomain, accessToken, path);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Shopify API error ${response.status}: ${body}`,
      );
    }

    const pagination = this.parseLinkHeader(
      response.headers.get('Link') ?? '',
    );

    const data = (await response.json()) as T;
    return { data, pagination };
  }

  private async shopifyApiPost<T>(
    shopDomain: string,
    accessToken: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const rateLimiter = this.getRateLimiter(shopDomain);
    await rateLimiter.waitIfNeeded();

    const url = `https://${shopDomain}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    rateLimiter.updateFromHeaders(
      Object.fromEntries(response.headers.entries()),
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      rateLimiter.handleTooManyRequests(
        retryAfter ? parseFloat(retryAfter) : undefined,
      );
      await rateLimiter.waitIfNeeded();
      return this.shopifyApiPost(shopDomain, accessToken, path, body);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `Shopify API POST error ${response.status}: ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async shopifyApiDelete(
    shopDomain: string,
    accessToken: string,
    path: string,
  ): Promise<void> {
    const rateLimiter = this.getRateLimiter(shopDomain);
    await rateLimiter.waitIfNeeded();

    const url = `https://${shopDomain}${path}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    rateLimiter.updateFromHeaders(
      Object.fromEntries(response.headers.entries()),
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      rateLimiter.handleTooManyRequests(
        retryAfter ? parseFloat(retryAfter) : undefined,
      );
      await rateLimiter.waitIfNeeded();
      return this.shopifyApiDelete(shopDomain, accessToken, path);
    }

    // 200 or 204 are both OK for DELETE
    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Shopify API DELETE error ${response.status}: ${body}`,
      );
    }
  }

  private async exchangeCodeForToken(
    shopDomain: string,
    code: string,
  ): Promise<ShopifyOAuthTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('SHOPIFY_API_KEY');
    const clientSecret = this.configService.getOrThrow<string>(
      'SHOPIFY_API_SECRET',
    );

    const url = `https://${shopDomain}/admin/oauth/access_token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Failed to exchange Shopify OAuth code: ${response.status} ${body}`,
      );
    }

    return response.json() as Promise<ShopifyOAuthTokenResponse>;
  }

  // ---------------------------------------------------------------------------
  // Private helpers: encryption, aggregation, etc.
  // ---------------------------------------------------------------------------

  /**
   * Encrypt credentials before storing in the database.
   * Uses AES-256-GCM with a per-record random IV.
   */
  private encryptCredentials(
    data: Record<string, string>,
  ): Record<string, string> {
    const encryptionKey = this.configService.getOrThrow<string>(
      'CREDENTIALS_ENCRYPTION_KEY',
    );
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
      algorithm: 'aes-256-gcm',
    };
  }

  /**
   * Decrypt credentials retrieved from the database.
   */
  decryptCredentials(
    encryptedData: Record<string, string>,
  ): { accessToken: string; shopDomain: string; scope: string } {
    const encryptionKey = this.configService.getOrThrow<string>(
      'CREDENTIALS_ENCRYPTION_KEY',
    );
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Enqueue a DailyAggregate recalculation for the given date.
   * Uses a debounce key so rapid successive calls for the same date
   * get deduplicated by BullMQ.
   */
  private async enqueueReaggregation(orgId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    this.logger.log(`Reaggregation needed for org=${orgId} date=${dateStr}`);
  }

  /**
   * Parse Shopify's Link header for cursor-based pagination.
   * Format: <https://shop.myshopify.com/admin/api/...?page_info=abc>; rel="next"
   */
  private parseLinkHeader(header: string): ShopifyPaginationInfo {
    const result: ShopifyPaginationInfo = {
      nextPageUrl: null,
      previousPageUrl: null,
    };

    if (!header) return result;

    const parts = header.split(',');
    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="(next|previous)"/);
      if (match) {
        const [, url, rel] = match;
        if (rel === 'next') {
          result.nextPageUrl = url;
        } else if (rel === 'previous') {
          result.previousPageUrl = url;
        }
      }
    }

    return result;
  }

  /**
   * Normalize a shop domain to the canonical .myshopify.com form.
   */
  private normalizeShopDomain(shop: string): string {
    let domain = shop.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/\/$/, '');
    if (!domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }
    return domain;
  }

  /**
   * Get or create a rate limiter instance per shop domain.
   */
  private getRateLimiter(shopDomain: string): ShopifyRateLimiter {
    let limiter = this.rateLimiters.get(shopDomain);
    if (!limiter) {
      limiter = new ShopifyRateLimiter();
      this.rateLimiters.set(shopDomain, limiter);
    }
    return limiter;
  }
}
