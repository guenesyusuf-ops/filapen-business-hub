import { Controller, Post, Get, Headers, Param, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite, assertIsOwner } from './auth-context';
import { MonthCloseService } from './month-close.service';
import { ExportService } from './export.service';
import { CalculationService } from './calculation.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/months/:year/:month')
export class MonthCloseController {
  constructor(
    private readonly auth: AuthService,
    private readonly close: MonthCloseService,
    private readonly exp: ExportService,
    private readonly calc: CalculationService,
    private readonly audit: PaAuditService,
  ) {}

  /** §73 Preflight — Zusammenfassung + Warnungen VOR dem eigentlichen Abschluss. */
  @Get('preflight')
  async preflight(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const computed = await this.calc.computeMonth(orgId, this.n(y), this.n(m));
    const allWarnings = computed.days.flatMap((d) => d.warnings.map((w) => ({ date: d.date, warning: w })));
    const uniqueWarnings = Array.from(new Set(allWarnings.map((w) => w.warning)));
    const dayCount = computed.days.length;
    return {
      status: computed.status,
      summary: {
        dayCount,
        grossSalesTotal: computed.totals.grossSalesTotal,
        netSalesTotal: computed.netSalesWithWholesale,
        profitBeforeOverhead: computed.profitBeforeOverheadWithWholesale,
        operatingProfit: computed.operatingProfit,
        marginBeforeOverhead: computed.totals.marginBeforeOverhead,
        operatingMargin: computed.operatingMargin,
        wholesaleOrderCount: computed.wholesale.orderCount,
        overheadEntryCount: computed.overhead.entries.length,
      },
      warnings: uniqueWarnings,
      warningsByDay: allWarnings,
    };
  }

  @Post('close')
  async closeMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
    @Query('lock') lock?: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const result = await this.close.close(orgId, userId, role, this.n(y), this.n(m), lock === 'true');
    await this.audit.log({ orgId, userId, action: 'month.close', entityType: 'pa.month', entityId: `${y}-${m}`, changes: { locked: lock === 'true' } });
    return result;
  }

  @Post('reopen')
  async reopenMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertIsOwner(role);
    const result = await this.close.reopen(orgId, userId, role, this.n(y), this.n(m));
    await this.audit.log({ orgId, userId, action: 'month.reopen', entityType: 'pa.month', entityId: `${y}-${m}` });
    return result;
  }

  @Get('snapshot')
  async getSnapshot(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.close.getSnapshot(orgId, this.n(y), this.n(m));
  }

  @Get('export.csv')
  async exportCsv(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const { filename, content } = await this.exp.exportMonthCsv(orgId, this.n(y), this.n(m));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  private n(s: string) { const v = parseInt(s, 10); if (!Number.isInteger(v)) throw new BadRequestException('Ungueltig'); return v; }
}
