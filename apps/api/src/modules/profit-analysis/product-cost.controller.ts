import { Controller, Get, Put, Body, Headers, Param, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { ProductCostService, CostKind, Channel } from './product-cost.service';
import { PaAuditService } from './audit.service';

interface SetCostBody {
  value: string;
  effectiveFrom: string;
  note?: string;
}

@Controller('profit-analysis/product-costs')
export class ProductCostController {
  constructor(
    private readonly auth: AuthService,
    private readonly costs: ProductCostService,
    private readonly audit: PaAuditService,
  ) {}

  /** Produkt-Liste mit aktuellen Kosten (beide Historien geheftet). */
  @Get()
  async list(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('missingCosts') missingCosts?: string,
    @Query('missingFulfillment') missingFulfillment?: string,
    @Query('channel') channel?: string,
    @Query('includeDisabled') includeDisabled?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.costs.listProducts(orgId, {
      search,
      status: (status as any) || undefined,
      missingCosts: missingCosts === 'true',
      missingFulfillment: missingFulfillment === 'true',
      channel: (channel && ['shopify', 'amazon', 'tiktok'].includes(channel) ? channel : undefined) as Channel | undefined,
      includeDisabled: includeDisabled === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /** Produkt komplett ein/aus (Kill-Switch). */
  @Put(':productId/enabled')
  async setEnabled(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Body() body: { enabled: boolean },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (typeof body?.enabled !== 'boolean') throw new BadRequestException('enabled muss boolean sein');
    const result = await this.costs.setEnabled(orgId, productId, body.enabled);
    await this.audit.log({
      orgId, userId, action: 'product_enabled.set',
      entityType: 'pa.product_settings', entityId: productId,
      changes: { enabled: body.enabled },
    });
    return result;
  }

  /** Kanal-Zuordnung eines Produkts setzen (Checkbox-Save). */
  @Put(':productId/channels')
  async setChannels(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Body() body: { channels: Channel[] },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!Array.isArray(body?.channels)) throw new BadRequestException('channels muss ein Array sein');
    const result = await this.costs.setChannels(orgId, productId, body.channels);
    await this.audit.log({
      orgId, userId, action: 'product_channels.set',
      entityType: 'pa.product_channel', entityId: productId,
      changes: { channels: result },
    });
    return { channels: result };
  }

  /** Historie eines Produkts fuer eine der beiden Kostenarten. */
  @Get(':productId/:kind/history')
  async history(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Param('kind') kind: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    this.assertKind(kind);
    const items = await this.costs.history(orgId, productId, kind as CostKind);
    return { items };
  }

  /** Neuer Wert ab bestimmten Datum. */
  @Put(':productId/:kind')
  async set(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Param('kind') kind: string,
    @Body() body: SetCostBody,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertKind(kind);

    if (!body?.value) throw new BadRequestException('value fehlt');
    if (!body?.effectiveFrom) throw new BadRequestException('effectiveFrom fehlt');
    const effectiveFrom = new Date(body.effectiveFrom + 'T00:00:00.000Z');
    if (isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom ist kein gueltiges Datum (YYYY-MM-DD)');
    }
    return this.costs.setCost(orgId, productId, kind as CostKind, body.value, effectiveFrom, userId, body.note);
  }

  private assertKind(kind: string) {
    if (kind !== 'cost' && kind !== 'fulfillment') {
      throw new BadRequestException(`Unbekannter Kosten-Typ: ${kind} (erlaubt: cost, fulfillment)`);
    }
  }
}
