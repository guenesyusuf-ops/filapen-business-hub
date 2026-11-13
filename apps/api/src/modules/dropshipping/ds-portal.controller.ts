import { Body, Controller, Get, Headers, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { DsPartnerAuthService } from './ds-partner-auth.service';
import { DsPortalService } from './ds-portal.service';

/**
 * Externes Partner-Portal (englische UI, eigener Login).
 * Unter /api/dropshipping/portal. Eigene Partner-Authentifizierung
 * (Token-Typ 'ds_partner'), kein Hub-Login.
 */
@Controller('dropshipping/portal')
export class DsPortalController {
  constructor(
    private readonly auth: DsPartnerAuthService,
    private readonly portal: DsPortalService,
  ) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    if (!body?.email || !body?.password) throw new BadRequestException('email and password required');
    return this.portal.login(body.email, body.password);
  }

  @Get('orders')
  async orders(@Headers('authorization') authHeader: string, @Query('status') status?: string) {
    const { partnerId, orgId } = this.auth.extractContext(authHeader);
    return this.portal.listOrders(partnerId, orgId, status);
  }

  @Post('orders/:id/ship')
  async ship(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { cnTracking?: string },
  ) {
    const { partnerId, orgId } = this.auth.extractContext(authHeader);
    return this.portal.markShipped(partnerId, orgId, id, body?.cnTracking ?? '');
  }

  @Post('orders/:id/arrived')
  async arrived(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { deTracking?: string; carrier?: string },
  ) {
    const { partnerId, orgId } = this.auth.extractContext(authHeader);
    return this.portal.markArrived(partnerId, orgId, id, body?.deTracking ?? '', body?.carrier ?? '');
  }

  @Post('orders/:id/delivered')
  async delivered(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { partnerId, orgId } = this.auth.extractContext(authHeader);
    return this.portal.markDelivered(partnerId, orgId, id);
  }

  @Post('orders/:id/hold')
  async hold(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    const { partnerId, orgId } = this.auth.extractContext(authHeader);
    return this.portal.markHold(partnerId, orgId, id, body?.note ?? '');
  }
}
