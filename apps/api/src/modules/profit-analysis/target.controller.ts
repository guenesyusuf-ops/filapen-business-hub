import { Controller, Get, Put, Delete, Body, Headers, Param, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { TargetService, TARGET_KEYS, TargetKey } from './target.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/targets')
export class TargetController {
  constructor(
    private readonly auth: AuthService,
    private readonly targets: TargetService,
    private readonly audit: PaAuditService,
  ) {}

  /** Alle org-globalen Defaults (fuer die Einstellungen-Seite). */
  @Get()
  async list(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.targets.listDefaults(orgId) };
  }

  /** Ziele fuer einen konkreten Monat (mit Vererbung). */
  @Get('months/:year/:month')
  async listForMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.targets.listForMonth(orgId, this.n(y), this.n(m)) };
  }

  @Put(':key')
  async set(
    @Headers('authorization') authHeader: string,
    @Param('key') key: string,
    @Body() body: { value: string; year?: number | null; month?: number | null },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertKnownKey(key);
    if (!body?.value) throw new BadRequestException('value fehlt');
    const result = await this.targets.setValue(orgId, key as TargetKey, body.value, body.year ?? null, body.month ?? null);
    await this.audit.log({
      orgId, userId,
      action: 'target.set', entityType: 'pa.target', entityId: result.id,
      changes: { key, value: body.value, year: body.year ?? null, month: body.month ?? null },
    });
    return result;
  }

  @Delete(':id')
  async delete(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const result = await this.targets.delete(orgId, id);
    if (result.ok) await this.audit.log({ orgId, userId, action: 'target.delete', entityType: 'pa.target', entityId: id });
    return result;
  }

  private assertKnownKey(key: string) {
    const known: string[] = Object.values(TARGET_KEYS);
    if (!known.includes(key)) throw new BadRequestException(`Unbekannter Target-Key: ${key}`);
  }
  private n(s: string) { const v = parseInt(s, 10); if (!Number.isInteger(v)) throw new BadRequestException('Ungueltig'); return v; }
}
