import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Logger, BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingProductProfileService, ProfileInput } from './shipping-product-profile.service';
import { CarrierAccountService, CarrierAccountInput } from './carrier-account.service';
import { OrderShipmentService, CreateShipmentInput } from './order-shipment.service';
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
    @Query('excluded') excluded?: string, // comma-separated variant IDs (not in)
    @Query('included') included?: string, // comma-separated variant IDs (must contain at least one)
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
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
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
