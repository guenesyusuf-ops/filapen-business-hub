import { Body, Controller, Get, Headers, Post, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './ds-auth-context';
import { DropshippingService } from './dropshipping.service';
import { DropshippingSyncService } from './dropshipping-sync.service';

/**
 * Owner-/Hub-interne Endpunkte des Dropshipping-Moduls (Deutsch-UI).
 * Das externe Partner-Portal (englisch, eigener Login) kommt in Phase 2 als
 * separater Controller.
 */
@Controller('dropshipping')
export class DropshippingController {
  constructor(
    private readonly auth: AuthService,
    private readonly ds: DropshippingService,
    private readonly sync: DropshippingSyncService,
  ) {}

  @Get('skus')
  async listSkus(@Headers('authorization') authHeader: string, @Query('q') q?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.listSkus(orgId, q);
  }

  @Post('skus/toggle')
  async toggleSku(
    @Headers('authorization') authHeader: string,
    @Body() body: { sku?: string; title?: string | null; variantExternalId?: string | null; active?: boolean },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.sku || typeof body.active !== 'boolean') {
      throw new BadRequestException('sku und active (boolean) erforderlich');
    }
    return this.ds.toggleSku(orgId, {
      sku: body.sku,
      title: body.title ?? null,
      variantExternalId: body.variantExternalId ?? null,
      active: body.active,
    });
  }

  @Get('orders')
  async listOrders(@Headers('authorization') authHeader: string, @Query('status') status?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.listOrders(orgId, status);
  }

  @Get('stats')
  async stats(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.stats(orgId);
  }

  @Get('sync/status')
  async syncStatus(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.lastSync(orgId);
  }

  @Post('sync')
  async runSync(@Headers('authorization') authHeader: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const result = await this.sync.syncOrg(orgId, 'manual');
    return { ok: true, ...result };
  }
}
