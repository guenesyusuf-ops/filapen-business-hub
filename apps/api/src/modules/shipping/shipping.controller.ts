import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Logger, BadRequestException,
  HttpException, HttpStatus,
  StreamableFile, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingProductProfileService, ProfileInput } from './shipping-product-profile.service';
import { CarrierAccountService, CarrierAccountInput } from './carrier-account.service';
import { OrderShipmentService, CreateShipmentInput } from './order-shipment.service';
import { BulkJobService } from './bulk-job.service';
import { parseBillingNumber } from './carriers/dhl-billing';
import { ShippingRuleService, RuleInput } from './shipping-rule.service';
import { ShippingEmailAutomationService, AutomationInput } from './shipping-email-automation.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { ShopifyService } from '../integration/shopify/shopify.service';

@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly orders: ShippingOrderService,
    private readonly profiles: ShippingProductProfileService,
    private readonly accounts: CarrierAccountService,
    private readonly shipments: OrderShipmentService,
    private readonly rules: ShippingRuleService,
    private readonly emailAuto: ShippingEmailAutomationService,
    private readonly registry: CarrierRegistry,
    private readonly shopify: ShopifyService,
    private readonly bulkJobs: BulkJobService,
  ) {}

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [openOrders, activeShipments, labelsToday, deliveredThisMonth, carriers] = await Promise.all([
      this.prisma.order.count({
        where: {
          orgId,
          status: { not: 'cancelled' },
          fulfillmentStatus: { in: ['unfulfilled', 'partial'] },
          shipments: { none: {} },
        },
      }),
      this.prisma.orderShipment.count({
        where: {
          orgId,
          status: { in: ['label_created', 'handed_to_carrier', 'in_transit', 'out_for_delivery', 'ready_for_pickup'] },
        },
      }),
      this.prisma.orderShipmentLabel.count({
        where: {
          shipment: { orgId },
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.orderShipment.count({
        where: {
          orgId,
          status: 'delivered',
          deliveredAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.carrierAccount.count({ where: { orgId, status: 'active' } }),
    ]);
    return {
      counts: { openOrders, activeShipments, labelsToday, deliveredThisMonth, carriers },
    };
  }

  // ============================================================
  // ORDERS (to-be-shipped)
  // ============================================================

  @Get('orders')
  async listOrders(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('shopId') shopId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('hasShipment') hasShipment?: 'yes' | 'no',
    @Query('excluded') excluded?: string,
    @Query('included') included?: string,
    @Query('exclusiveVariantIds') exclusiveVariantIds?: string,
    @Query('exclusiveQuantityOp') exclusiveQuantityOp?: 'eq' | 'gte' | 'lte' | 'gt' | 'lt',
    @Query('exclusiveQuantity') exclusiveQuantity?: string,
    @Query('addressStatus') addressStatus?: 'error' | 'ok' | 'all',
    @Query('fulfillmentStatus') fulfillmentStatus?: 'all' | 'unfulfilled' | 'partial',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const excludedIds = excluded ? excluded.split(',').filter(Boolean) : undefined;
    const includedIds = included ? included.split(',').filter(Boolean) : undefined;
    return this.orders.list(orgId, {
      search, shopId, fromDate, toDate, hasShipment,
      excludedProductVariantIds: excludedIds,
      includedProductVariantIds: includedIds,
      exclusiveVariantIds: exclusiveVariantIds
        ? exclusiveVariantIds.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      exclusiveQuantityOp,
      exclusiveQuantity: exclusiveQuantity ? parseInt(exclusiveQuantity, 10) : undefined,
      addressStatus,
      fulfillmentStatus,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('orders/address-error-count')
  async addressErrorCount(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const count = await this.orders.countAddressErrors(orgId);
    return { count };
  }

  @Put('orders/:id/address')
  async updateOrderAddress(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: {
      name?: string; firstName?: string; lastName?: string; company?: string;
      address1: string; address2?: string | null; houseNumber?: string | null;
      zip: string; city: string; province?: string | null;
      country: string; phone?: string | null; email?: string | null;
    },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.address1?.trim() || !body.zip?.trim() || !body.city?.trim() || !body.country?.trim()) {
      throw new BadRequestException('Straße, PLZ, Stadt und Land sind Pflichtfelder');
    }
    return this.orders.updateAddress(orgId, id, body);
  }

  @Get('orders/:id')
  async getOrder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.get(orgId, id);
  }

  @Get('orders/:id/weight')
  async orderWeight(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.orders.computeOrderWeight(orgId, id);
  }

  /**
   * Refresh existing orders from Shopify — repopulates shipping_address,
   * customer_name/email/phone on orders that were imported before these
   * fields existed. Fires backfill asynchronously (returns immediately).
   */
  @Post('orders/refresh-from-shopify')
  async refreshOrdersFromShopify(@Headers('authorization') authHeader: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const integration = await this.prisma.integration.findFirst({
      where: { orgId, type: 'shopify', status: 'connected' },
    });
    if (!integration) throw new BadRequestException('Kein aktiver Shopify-Shop verbunden');
    // Fire-and-forget — backfill takes minutes
    this.shopify.backfill(integration.id).catch((err) => {
      this.logger.error(`Backfill failed: ${err?.message}`);
    });
    return {
      started: true,
      note: 'Backfill läuft im Hintergrund. Aktualisiere die Seite in 3-5 Minuten.',
    };
  }

  /**
   * Versand-spezifischer Sync: holt nur die Orders frisch die aktuell als
   * "noch zu versenden" gelten und checkt ob sie in Shopify inzwischen
   * fulfilled/cancelled/refunded sind. Schnell (~10s fuer ~100 Orders),
   * sicher als blockierender Call vor dem Listen aufrufbar.
   */
  @Post('orders/reconcile-shipping')
  async reconcileShippingOrders(@Headers('authorization') authHeader: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const integration = await this.prisma.integration.findFirst({
      where: { orgId, type: 'shopify', status: 'connected' },
    });
    if (!integration) {
      // Kein Shopify? Dann ist nichts zu syncen. Kein Fehler — UI nutzt
      // diesen Endpoint auch automatisch beim Oeffnen der Liste.
      return { checked: 0, fixed: 0, skipped: 0, note: 'Kein Shopify verbunden' };
    }
    try {
      // Schritt 1: neue Orders aus Shopify holen (60min-Fenster).
      // Faengt verlorene orders/create-Webhooks ab — bis vor diesem Fix
      // waren neu erstellte Bestellungen im Hub unsichtbar, wenn
      // Shopifys Webhook mal verpasst wurde. Fehler hier duerfen den
      // Reconcile nicht blocken, daher separat gefangen.
      let pulled = 0;
      try {
        const s = await this.shopify.syncRecentOrders(integration.id, 60);
        pulled = s.pulled;
      } catch (err: any) {
        this.logger.warn(`syncRecentOrders skipped: ${err?.message}`);
      }
      // Schritt 2: bestehende Orders auf Drift pruefen (fulfilled/cancelled/refunded)
      const result = await this.shopify.reconcileShippingOrders(integration.id);
      return { ...result, pulled };
    } catch (err: any) {
      this.logger.error(`reconcileShippingOrders failed: ${err?.message ?? err}`);
      throw new HttpException(
        'Versand-Sync fehlgeschlagen — bitte erneut versuchen',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================================
  // PRODUCT PROFILES (Gewicht/Maße pro Variante)
  // ============================================================

  @Get('product-profiles')
  async listProductProfiles(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.profiles.listWithProducts(orgId, search);
  }

  /**
   * Zieht die aktuellen Produkte + Varianten der ersten verbundenen
   * Shopify-Integration in den Hub. Wird vom Frontend-Button
   * "Aus Shopify nachladen" auf /shipping/products aufgerufen. Neue
   * Produkte (die zwischen Backfill + jetzt in Shopify angelegt wurden)
   * landen hierueber im Hub, ohne dass wir auf den `products/create`-
   * Webhook oder den naechtlichen Cron warten muessen.
   */
  @Post('product-profiles/sync-from-shopify')
  async syncProductsFromShopify(
    @Headers('authorization') authHeader: string,
  ): Promise<{ products: number; integrations: number }> {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const integrations = await this.prisma.integration.findMany({
      where: { orgId, type: 'shopify', status: 'connected' },
    });
    if (integrations.length === 0) {
      throw new BadRequestException('Keine verbundene Shopify-Integration gefunden.');
    }
    let total = 0;
    for (const integration of integrations) {
      const r = await this.shopify.syncProducts(integration.id);
      total += r.products;
    }
    return { products: total, integrations: integrations.length };
  }

  @Get('product-profiles/manual')
  async listManualProfiles(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.profiles.list(orgId);
  }

  @Post('product-profiles/variant/:variantId')
  async upsertVariantProfile(
    @Headers('authorization') authHeader: string,
    @Param('variantId') variantId: string,
    @Body() body: ProfileInput,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.profiles.upsertForVariant(orgId, variantId, body);
  }

  @Post('product-profiles')
  async createManualProfile(
    @Headers('authorization') authHeader: string,
    @Body() body: ProfileInput,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.profiles.createManual(orgId, body);
  }

  @Put('product-profiles/:id')
  async updateProfile(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<ProfileInput>,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.profiles.update(orgId, id, body);
  }

  @Delete('product-profiles/:id')
  async deleteProfile(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.profiles.remove(orgId, id);
  }

  // ============================================================
  // CARRIERS + CARRIER ACCOUNTS
  // ============================================================

  @Get('carriers')
  async listCarriers() {
    return this.registry.list();
  }

  @Get('carrier-accounts')
  async listCarrierAccounts(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.accounts.list(orgId);
  }

  @Get('carrier-accounts/:id')
  async getCarrierAccount(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.accounts.get(orgId, id);
  }

  /**
   * Volle Credentials fuer den Edit-Dialog. Enthaelt Klartext-EKPs,
   * API-Key, Sandbox/Prod-Mode. Passwoerter/API-Secrets werden aus
   * Sicherheitsgruenden trotzdem nicht mitgegeben — die bleiben nur
   * im Backend und der User traegt sie beim Aendern neu ein.
   */
  @Get('carrier-accounts/:id/edit')
  async getCarrierAccountForEdit(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const account = await this.accounts.get(orgId, id, true);
    const c = (account as any).credentials || {};
    // Nur nicht-sensitive Felder mitgeben. Passwoerter/Secrets bleiben leer.
    const safeCredentials = {
      mode: c.mode ?? null,
      billingNumber: c.billingNumber ?? null,
      billingNumberEu: c.billingNumberEu ?? null,
      billingNumberIntl: c.billingNumberIntl ?? null,
      apiKey: c.apiKey ?? null,
      username: c.username ?? null,
      hasPassword: !!c.password,
      hasApiSecret: !!c.apiSecret,
    };
    // Migrations-Hinweise: erkennen wenn eine Nummer im "falschen" Feld
    // gespeichert ist (z.B. billingNumberEu enthaelt Verfahren 53 =
    // Weltpaket, gehoert eigentlich in billingNumberIntl). UI kann diese
    // Hinweise anzeigen damit User es korrigieren kann.
    const hints: string[] = [];
    const check = (field: string, value: string | null, expectedProcedure: string, humanField: string) => {
      if (!value) return;
      const parsed = parseBillingNumber(value);
      if ('kind' in parsed) {
        hints.push(`${humanField}: Nummer hat ungueltiges Format (nicht 14 Zeichen).`);
        return;
      }
      if (parsed.procedure !== expectedProcedure) {
        const actualName =
          parsed.procedure === '01' ? 'Paket National'
          : parsed.procedure === '53' ? 'Weltpaket / Paket International'
          : parsed.procedure === '54' ? 'Europaket'
          : `Verfahren ${parsed.procedure}`;
        hints.push(
          `${humanField}: Verfahren ${parsed.procedure} (${actualName}) statt ${expectedProcedure}. ` +
          `Die Nummer wird trotzdem verwendet — sortiert wird nach Verfahren, nicht nach Feldname.`,
        );
      }
    };
    check('billingNumber', c.billingNumber, '01', 'Paket National');
    check('billingNumberEu', c.billingNumberEu, '54', 'Europaket');
    check('billingNumberIntl', c.billingNumberIntl, '53', 'Weltpaket');
    return { ...account, credentials: safeCredentials, migrationHints: hints };
  }

  /**
   * Diagnose: Fuehrt einen validate=true Aufruf gegen DHL fuer eine
   * konkrete Order aus. KEIN kostenpflichtiger Label-Kauf. Antwortet mit
   * der vollstaendigen DHL-Validation-Response (nur maskierte EKPs im
   * Debug-Info-Block, DHL Response bleibt originalgetreu).
   *
   * Wichtig: dieser Endpoint ist Admin-Only (assertCanWrite) und darf
   * nur temporaer verwendet werden. Er umgeht den ueblichen create-Pfad.
   */
  @Post('shipments/dry-run/:orderId')
  async dryRunShipment(
    @Headers('authorization') authHeader: string,
    @Param('orderId') orderId: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.dryRunDhl(orgId, userId, orderId);
  }

  @Post('carrier-accounts')
  async createCarrierAccount(
    @Headers('authorization') authHeader: string,
    @Body() body: CarrierAccountInput,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.accounts.create(orgId, userId, body);
  }

  @Put('carrier-accounts/:id')
  async updateCarrierAccount(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<CarrierAccountInput>,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.accounts.update(orgId, id, body);
  }

  @Delete('carrier-accounts/:id')
  async deleteCarrierAccount(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.accounts.remove(orgId, id);
  }

  // ============================================================
  // SHIPMENTS + LABELS
  // ============================================================

  @Get('shipments')
  async listShipments(
    @Headers('authorization') authHeader: string,
    @Query('status') status?: string,
    @Query('carrier') carrier?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.shipments.list(orgId, {
      status, carrier, search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('shipments/:id')
  async getShipment(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.shipments.get(orgId, id);
  }

  @Post('shipments')
  async createShipment(
    @Headers('authorization') authHeader: string,
    @Body() body: CreateShipmentInput,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.orderId || !body.carrier) throw new BadRequestException('orderId und carrier erforderlich');
    return this.shipments.create(orgId, userId, body);
  }

  /**
   * Legacy Sync-Endpoint — wartet bis alle Labels erstellt sind.
   * Bleibt fuer Rueckwaertskompatibilitaet + kleine Batches (<10).
   */
  @Post('shipments/bulk')
  async bulkCreateShipments(
    @Headers('authorization') authHeader: string,
    @Body() body: { orderIds: string[]; carrier: 'dhl' | 'custom'; carrierAccountId?: string | null },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.orderIds?.length || !body.carrier) throw new BadRequestException('orderIds und carrier erforderlich');
    return this.shipments.createBulk(orgId, userId, body.orderIds, body.carrier, body.carrierAccountId);
  }

  /**
   * Job-basierter Bulk-Endpoint: startet den Bulk asynchron, gibt sofort
   * eine jobId zurueck. Frontend polled GET /shipments/bulk-jobs/:jobId
   * fuer Fortschritt + Ergebnis. Verhindert HTTP-Timeouts am
   * Reverse-Proxy (waren die Ursache fuer Doppel-Labels) und ermoeglicht
   * eine Live-Progressbar.
   */
  @Post('shipments/bulk-async')
  async startBulkJob(
    @Headers('authorization') authHeader: string,
    @Body() body: { orderIds: string[]; carrier: 'dhl' | 'custom'; carrierAccountId?: string | null },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.orderIds?.length || !body.carrier) {
      throw new BadRequestException('orderIds und carrier erforderlich');
    }
    const job = this.bulkJobs.create(orgId, body.orderIds.length);
    // Fire-and-forget: der Job laeuft im Hintergrund weiter waehrend
    // der HTTP-Request sofort mit der jobId antwortet. Kein await.
    this.shipments
      .createBulk(
        orgId,
        userId,
        body.orderIds,
        body.carrier,
        body.carrierAccountId,
        () => this.bulkJobs.incrementProgress(job.id),
      )
      .then((result) => this.bulkJobs.finish(job.id, result))
      .catch((err) => this.bulkJobs.fail(job.id, err?.message ?? String(err)));
    return { jobId: job.id, total: body.orderIds.length };
  }

  @Get('shipments/bulk-jobs/:jobId')
  async getBulkJob(
    @Headers('authorization') authHeader: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.bulkJobs.get(orgId, jobId);
  }

  // ==========================================================
  // BULK LABEL ACTIONS
  // ==========================================================

  @Post('labels/bulk-download')
  async bulkDownloadLabels(
    @Headers('authorization') authHeader: string,
    @Body() body: { labelIds?: string[]; shipmentIds?: string[]; markPrinted?: boolean },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    let labelIds = body.labelIds ?? [];
    if (!labelIds.length && body.shipmentIds?.length) {
      const labels = await this.prisma.orderShipmentLabel.findMany({
        where: { shipmentId: { in: body.shipmentIds }, shipment: { orgId } },
        select: { id: true },
      });
      labelIds = labels.map((l) => l.id);
    }
    if (!labelIds.length) throw new BadRequestException('labelIds erforderlich');
    try {
      const result = await this.shipments.bulkDownloadLabels(
        orgId,
        labelIds,
        body.markPrinted ?? false,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Expose merge stats so the frontend can show the user exactly how many
      // labels landed in the PDF (vs how many were skipped).
      res.setHeader('X-Requested-Count', String(labelIds.length));
      res.setHeader('X-Label-Count', String(result.labelCount));
      res.setHeader('X-Skipped-Count', String(labelIds.length - result.labelCount));
      if (result.errors.length) {
        // Header values must be ASCII-safe — encode the reasons.
        res.setHeader('X-Skipped-Reasons', encodeURIComponent(result.errors.join(' | ')));
      }
      res.setHeader('Access-Control-Expose-Headers', 'X-Requested-Count, X-Label-Count, X-Skipped-Count, X-Skipped-Reasons');
      return new StreamableFile(result.buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="labels-${timestamp}.pdf"`,
      });
    } catch (err: any) {
      this.logger.error(`bulkDownloadLabels failed: ${err?.message}`, err?.stack);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Bulk-Download fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('labels/bulk-delivery-notes')
  async bulkDeliveryNotes(
    @Headers('authorization') authHeader: string,
    @Body() body: { labelIds?: string[]; shipmentIds?: string[] },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    let labelIds = body.labelIds ?? [];
    if (!labelIds.length && body.shipmentIds?.length) {
      const labels = await this.prisma.orderShipmentLabel.findMany({
        where: { shipmentId: { in: body.shipmentIds }, shipment: { orgId } },
        select: { id: true },
      });
      labelIds = labels.map((l) => l.id);
    }
    if (!labelIds.length) throw new BadRequestException('labelIds erforderlich');
    try {
      const result = await this.shipments.bulkGenerateDeliveryNotes(orgId, labelIds);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('X-Page-Count', String(result.pageCount));
      res.setHeader('Access-Control-Expose-Headers', 'X-Page-Count');
      return new StreamableFile(result.buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="lieferscheine-${timestamp}.pdf"`,
      });
    } catch (err: any) {
      this.logger.error(`bulkDeliveryNotes failed: ${err?.message}`, err?.stack);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Lieferschein-Erstellung fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('labels/:labelId/mark-printed')
  async markLabelPrinted(
    @Headers('authorization') authHeader: string,
    @Param('labelId') labelId: string,
    @Body() body: { printed?: boolean },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.setLabelPrinted(orgId, labelId, body.printed ?? true);
  }

  @Post('labels/cleanup-stubs')
  async cleanupStubLabels(@Headers('authorization') authHeader: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.cleanupStubShipments(orgId);
  }

  @Post('shipments/:id/status')
  async setShipmentStatus(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.setStatus(orgId, id, body.status, body.note);
  }

  @Post('shipments/:id/tracking')
  async setTracking(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { trackingNumber: string; trackingUrl?: string },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.trackingNumber) throw new BadRequestException('trackingNumber fehlt');
    return this.shipments.updateTracking(orgId, id, body.trackingNumber, body.trackingUrl);
  }

  @Post('shipments/:id/regenerate-label')
  async regenerateLabel(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.regenerateLabel(orgId, id);
  }

  @Delete('shipments/:id')
  async deleteShipment(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.shipments.delete(orgId, id);
  }

  // ============================================================
  // SHIPPING RULES
  // ============================================================

  @Get('rules')
  async listRules(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.rules.list(orgId);
  }

  @Get('rules/:id')
  async getRule(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.rules.get(orgId, id);
  }

  @Post('rules')
  async createRule(@Headers('authorization') authHeader: string, @Body() body: RuleInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.rules.create(orgId, userId, body);
  }

  @Put('rules/:id')
  async updateRule(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<RuleInput>,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.rules.update(orgId, id, body);
  }

  @Delete('rules/:id')
  async deleteRule(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.rules.remove(orgId, id);
  }

  // ============================================================
  // EMAIL AUTOMATIONS
  // ============================================================

  @Get('email-automations')
  async listAutomations(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.emailAuto.list(orgId);
  }

  @Post('email-automations')
  async upsertAutomation(
    @Headers('authorization') authHeader: string,
    @Body() body: AutomationInput,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.emailAuto.upsert(orgId, body);
  }

  @Get('shipments/:id/email-logs')
  async emailLogs(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.emailAuto.logsForShipment(orgId, id);
  }
}
