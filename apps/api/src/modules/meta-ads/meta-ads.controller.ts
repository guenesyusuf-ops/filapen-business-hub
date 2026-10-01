import {
  Controller, Get, Post, Put, Delete, Body, Headers, Param, Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import {
  MetaAdsService, AdInput, DailyMetricInputDto, PeriodRange,
} from './meta-ads.service';

/**
 * Meta Ads — Fundament. Alle Routen sind AUTHENTICATED und arbeiten
 * ausschliesslich mit der echten orgId aus dem Token (kein DEV_ORG_ID).
 */
@Controller('meta-ads')
export class MetaAdsController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: MetaAdsService,
  ) {}

  // --- Stammdaten-Referenzen (Product Switcher, Angles, Offers) ---

  @Get('products')
  async products(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.svc.listProducts(orgId) };
  }

  @Get('angles')
  async angles(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.svc.listAngles(orgId) };
  }

  @Post('angles')
  async createAngle(@Headers('authorization') authHeader: string, @Body() body: { name: string }) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createAngle(orgId, body?.name);
  }

  @Get('offers')
  async offers(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.svc.listOffers(orgId) };
  }

  @Post('offers')
  async createOffer(@Headers('authorization') authHeader: string, @Body() body: { name: string }) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createOffer(orgId, body?.name);
  }

  // --- Overview ---

  @Get('overview')
  async overview(
    @Headers('authorization') authHeader: string,
    @Query('productId') productId?: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.overview(orgId, { productId, range, start, end });
  }

  // --- Ads ---

  @Get('ads')
  async listAds(
    @Headers('authorization') authHeader: string,
    @Query('productId') productId?: string,
    @Query('format') format?: string,
    @Query('angleId') angleId?: string,
    @Query('offerId') offerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listAds(orgId, {
      productId, format, angleId, offerId, status, search, range, start, end,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('ads')
  async createAd(@Headers('authorization') authHeader: string, @Body() body: AdInput) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createAd(orgId, body);
  }

  @Get('ads/:id')
  async getAd(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getAd(orgId, id);
  }

  @Put('ads/:id')
  async updateAd(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<AdInput>) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.updateAd(orgId, id, body);
  }

  @Delete('ads/:id')
  async deleteAd(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.deleteAd(orgId, id);
  }

  // --- Daily Metrics (manuelle Eingabe) ---

  @Get('ads/:id/metrics')
  async listMetrics(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listDailyMetrics(orgId, id, range, start, end);
  }

  @Post('ads/:id/metrics')
  async upsertMetric(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: DailyMetricInputDto) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.upsertDailyMetric(orgId, id, body);
  }

  @Delete('ads/:id/metrics/:date')
  async deleteMetric(@Headers('authorization') authHeader: string, @Param('id') id: string, @Param('date') date: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.deleteDailyMetric(orgId, id, date);
  }
}
