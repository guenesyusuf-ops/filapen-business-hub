import { Controller, Get, Patch, Body, Headers, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import {
  DailyDataService, Channel, ChannelSalesPatch, AdsPatch, ShippingPatch,
} from './daily-data.service';
import { CalculationService } from './calculation.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis')
export class DailyDataController {
  constructor(
    private readonly auth: AuthService,
    private readonly daily: DailyDataService,
    private readonly calc: CalculationService,
    private readonly audit: PaAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  /** Alle Rohdaten + Berechnungen fuer einen Monat. */
  @Get('months/:year/:month')
  async getMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') yearStr: string,
    @Param('month') monthStr: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const { year, month } = this.parseYearMonth(yearStr, monthStr);
    const [raw, computed] = await Promise.all([
      this.daily.getMonthRaw(orgId, year, month),
      this.calc.computeMonth(orgId, year, month),
    ]);
    return { raw, computed };
  }

  /** Nur die Berechnung eines einzelnen Tages (Autosave-Response). */
  @Get('days/:date/computed')
  async getComputedDay(
    @Headers('authorization') authHeader: string,
    @Param('date') date: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    this.assertIsoDate(date);
    const computed = await this.calc.computeDay(orgId, date);
    return { computed };
  }

  // ---------------------------------------------------------------------------
  // WRITE — feld-granular, Autosave-freundlich
  // ---------------------------------------------------------------------------

  @Patch('days/:date/sales/:channel')
  async patchSales(
    @Headers('authorization') authHeader: string,
    @Param('date') date: string,
    @Param('channel') channel: string,
    @Body() body: ChannelSalesPatch,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertIsoDate(date);
    this.assertChannel(channel);
    const updated = await this.daily.upsertChannelSales(orgId, role, date, channel as Channel, body ?? {});
    await this.audit.log({ orgId, userId, action: 'sales.patch', entityType: 'pa.channel_sales', entityId: `${date}/${channel}`, changes: body });
    const computed = await this.calc.computeDay(orgId, date);
    return { updated, computed };
  }

  @Patch('days/:date/ads')
  async patchAds(
    @Headers('authorization') authHeader: string,
    @Param('date') date: string,
    @Body() body: AdsPatch,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertIsoDate(date);
    const updated = await this.daily.upsertAds(orgId, role, date, body ?? {});
    await this.audit.log({ orgId, userId, action: 'ads.patch', entityType: 'pa.ads', entityId: date, changes: body });
    const computed = await this.calc.computeDay(orgId, date);
    return { updated, computed };
  }

  @Patch('days/:date/shipping')
  async patchShipping(
    @Headers('authorization') authHeader: string,
    @Param('date') date: string,
    @Body() body: ShippingPatch,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertIsoDate(date);
    const updated = await this.daily.upsertShipping(orgId, role, date, body ?? {});
    await this.audit.log({ orgId, userId, action: 'shipping.patch', entityType: 'pa.shipping', entityId: date, changes: body });
    const computed = await this.calc.computeDay(orgId, date);
    return { updated, computed };
  }

  @Patch('days/:date/product-sales/:channel/:productId')
  async patchProductSale(
    @Headers('authorization') authHeader: string,
    @Param('date') date: string,
    @Param('channel') channel: string,
    @Param('productId') productId: string,
    @Body() body: { quantity: number },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertIsoDate(date);
    this.assertChannel(channel);
    const q = Number(body?.quantity);
    if (!Number.isFinite(q)) throw new BadRequestException('quantity fehlt oder ungueltig');
    const updated = await this.daily.upsertProductSale(orgId, role, date, channel as Channel, productId, q);
    await this.audit.log({
      orgId, userId, action: 'product_sale.patch',
      entityType: 'pa.product_sale', entityId: `${date}/${channel}/${productId}`,
      changes: { quantity: q },
    });
    const computed = await this.calc.computeDay(orgId, date);
    return { updated, computed };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parseYearMonth(y: string, m: string) {
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException(`Jahr ungueltig: ${y}`);
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException(`Monat ungueltig: ${m}`);
    return { year, month };
  }

  private assertIsoDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Datum muss YYYY-MM-DD sein');
  }

  private assertChannel(channel: string) {
    if (!['shopify', 'amazon', 'tiktok'].includes(channel)) {
      throw new BadRequestException(`Unbekannter Kanal: ${channel}`);
    }
  }
}
