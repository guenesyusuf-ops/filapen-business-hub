import { Controller, Get, Post, Body, Headers, Param, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { InsightService } from './insight.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/insights')
export class InsightController {
  constructor(
    private readonly auth: AuthService,
    private readonly insights: InsightService,
    private readonly audit: PaAuditService,
  ) {}

  /** Dashboard-Panel: Top-N wichtigste aktive Insights. */
  @Get('top')
  async top(@Headers('authorization') authHeader: string, @Query('n') n?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const count = n ? Math.min(20, Math.max(1, parseInt(n, 10))) : 5;
    return this.insights.topActive(orgId, count);
  }

  /** Alle Insights mit Filtern (Drawer-Ansicht). */
  @Get()
  async list(
    @Headers('authorization') authHeader: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.insights.list(orgId, {
      status: status as any, severity: severity as any, channel,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Manueller Refresh (nutzt auch der Cron). */
  @Post('refresh')
  async refresh(@Headers('authorization') authHeader: string) {
    const { orgId, userId } = extractAuthContext(authHeader, this.auth);
    const result = await this.insights.detectAll(orgId);
    await this.audit.log({ orgId, userId, action: 'insights.refresh', entityType: 'pa.insight', entityId: 'manual', changes: result });
    return result;
  }

  /** Insight explizit als "zur Kenntnis genommen" markieren. */
  @Post(':id/acknowledge')
  async acknowledge(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.insights.acknowledge(orgId, id, userId);
  }

  /** Insight dauerhaft ausblenden. */
  @Post(':id/dismiss')
  async dismiss(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.insights.dismiss(orgId, id);
  }

  /** §32 User-Feedback. */
  @Post(':id/feedback')
  async feedback(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { feedback: 'helpful' | 'not_helpful' },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!['helpful', 'not_helpful'].includes(body?.feedback)) {
      throw new BadRequestException('feedback muss helpful oder not_helpful sein');
    }
    return this.insights.setFeedback(orgId, id, body.feedback, userId);
  }

  /** §5 "Warum?" — Driver-Analyse. */
  @Get(':id/explain')
  async explain(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.insights.explain(orgId, id);
  }
}
