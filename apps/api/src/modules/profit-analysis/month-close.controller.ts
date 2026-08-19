import { Controller, Post, Get, Headers, Param, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite, assertIsOwner } from './auth-context';
import { MonthCloseService } from './month-close.service';
import { ExportService } from './export.service';

@Controller('profit-analysis/months/:year/:month')
export class MonthCloseController {
  constructor(
    private readonly auth: AuthService,
    private readonly close: MonthCloseService,
    private readonly exp: ExportService,
  ) {}

  @Post('close')
  async closeMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
    @Query('lock') lock?: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.close.close(orgId, userId, role, this.n(y), this.n(m), lock === 'true');
  }

  @Post('reopen')
  async reopenMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertIsOwner(role);
    return this.close.reopen(orgId, userId, role, this.n(y), this.n(m));
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
