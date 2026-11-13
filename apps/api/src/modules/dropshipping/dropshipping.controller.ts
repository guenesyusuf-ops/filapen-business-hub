import {
  Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './ds-auth-context';
import { DropshippingService, DsRuleSkuInput } from './dropshipping.service';
import { DropshippingSyncService } from './dropshipping-sync.service';

/**
 * Owner-/Hub-interne Endpunkte des Dropshipping-Moduls (Deutsch-UI).
 * Externes Partner-Portal (englisch, eigener Login) kommt in Phase 2.
 */
@Controller('dropshipping')
export class DropshippingController {
  constructor(
    private readonly auth: AuthService,
    private readonly ds: DropshippingService,
    private readonly sync: DropshippingSyncService,
  ) {}

  // ---- Katalog ----
  @Get('skus')
  async listSkus(@Headers('authorization') authHeader: string, @Query('q') q?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.listSkus(orgId, q);
  }

  // ---- Regeln ----
  @Get('rules')
  async listRules(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.listRules(orgId);
  }

  @Post('rules')
  async createRule(
    @Headers('authorization') authHeader: string,
    @Body() body: { name?: string; mode?: string; active?: boolean; skus?: DsRuleSkuInput[] },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!Array.isArray(body?.skus)) throw new BadRequestException('skus erforderlich');
    return this.ds.createRule(orgId, { ...body, skus: body.skus });
  }

  @Patch('rules/:id')
  async updateRule(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { name?: string; mode?: string; active?: boolean; skus?: DsRuleSkuInput[] },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.ds.updateRule(orgId, id, body ?? {});
  }

  @Delete('rules/:id')
  async deleteRule(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.ds.deleteRule(orgId, id);
  }

  // ---- Bestellungen ----
  @Get('orders')
  async listOrders(@Headers('authorization') authHeader: string, @Query('status') status?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.ds.listOrders(orgId, status);
  }

  @Get('orders/export')
  async exportOrders(
    @Headers('authorization') authHeader: string,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const csv = await this.ds.exportCsv(orgId, status);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dropshipping-${date}.csv"`);
    res.send(csv);
  }

  @Post('orders/import')
  async importOrder(
    @Headers('authorization') authHeader: string,
    @Body() body: { orderNumber?: string },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.orderNumber) throw new BadRequestException('orderNumber erforderlich');
    return this.sync.importByOrderNumber(orgId, body.orderNumber);
  }

  // ---- Stats / Sync ----
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
