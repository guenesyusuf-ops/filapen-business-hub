import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Logger, BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingProductProfileService, ProfileInput } from './shipping-product-profile.service';

@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly orders: ShippingOrderService,
    private readonly profiles: ShippingProductProfileService,
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
    @Query('excluded') excluded?: string, // comma-separated variant IDs
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const excludedIds = excluded ? excluded.split(',').filter(Boolean) : undefined;
    return this.orders.list(orgId, {
      search, shopId, fromDate, toDate, hasShipment, excludedProductVariantIds: excludedIds,
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
}
