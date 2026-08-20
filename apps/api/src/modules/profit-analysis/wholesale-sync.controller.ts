import { Controller, Get, Put, Delete, Body, Headers, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { WholesaleSyncService } from './wholesale-sync.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/wholesale-sync')
export class WholesaleSyncController {
  constructor(
    private readonly auth: AuthService,
    private readonly sync: WholesaleSyncService,
    private readonly audit: PaAuditService,
  ) {}

  /** Automatisch aggregierte Grosshandelsaufraege eines Monats aus /sales. */
  @Get('months/:year/:month')
  async listForMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.sync.listForMonth(orgId, this.n(y), this.n(m));
  }

  /** Alle nicht-gematchten Positionen im Monat (fuer die Match-Warnung). */
  @Get('months/:year/:month/unmatched')
  async listUnmatched(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.sync.listUnmatched(orgId, this.n(y), this.n(m)) };
  }

  /** Alle Positionen im Monat (auch bereits gematchte), fuer "Match aendern". */
  @Get('months/:year/:month/all-line-items')
  async listAllLineItems(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.sync.listAllLineItems(orgId, this.n(y), this.n(m)) };
  }

  /** Match einer Line-Position entfernen. */
  @Delete('line-items/:lineItemId/match')
  async unmatchLineItem(
    @Headers('authorization') authHeader: string,
    @Param('lineItemId') lineItemId: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    try {
      const result = await this.sync.unmatchLineItem(orgId, lineItemId);
      await this.audit.log({
        orgId, userId,
        action: 'wholesale.unmatch_line_item',
        entityType: 'pa.sales_line_item', entityId: lineItemId,
        changes: {},
      });
      return result;
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? 'Unmatch fehlgeschlagen');
    }
  }

  /** Sales-Line-Position mit Filapen-Produkt matchen. */
  @Put('line-items/:lineItemId/match')
  async matchLineItem(
    @Headers('authorization') authHeader: string,
    @Param('lineItemId') lineItemId: string,
    @Body() body: { productId: string },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.productId) throw new BadRequestException('productId fehlt');
    try {
      const result = await this.sync.matchLineItem(orgId, lineItemId, body.productId);
      await this.audit.log({
        orgId, userId,
        action: 'wholesale.match_line_item',
        entityType: 'pa.sales_line_item', entityId: lineItemId,
        changes: { productId: body.productId, variantId: result.matchedProductVariantId },
      });
      return result;
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? 'Match fehlgeschlagen');
    }
  }

  private n(s: string) {
    const v = parseInt(s, 10);
    if (!Number.isInteger(v)) throw new BadRequestException('Ungueltig');
    return v;
  }
}
