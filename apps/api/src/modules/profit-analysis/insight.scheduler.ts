import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightService } from './insight.service';

/**
 * §36 Cron-basierter Insight-Refresh.
 * Master hat "Cron stuendlich + on-write" gewaehlt — on-write triggern die
 * PATCH-Endpoints (siehe DailyDataController).
 *
 * Muster: identisch zu creator/invitation.scheduler.ts + wm-scheduler.
 */
@Injectable()
export class InsightScheduler {
  private readonly logger = new Logger(InsightScheduler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'pa-insight-refresh' })
  async handleHourlyRefresh() {
    const start = Date.now();
    try {
      const orgs = await this.prisma.organization.findMany({ select: { id: true } });
      let total = 0;
      for (const org of orgs) {
        try {
          const result = await this.insights.detectAll(org.id);
          total += result.created + result.updated;
        } catch (err) {
          this.logger.warn(`Insight-Refresh fuer Org ${org.id} fehlgeschlagen: ${err}`);
        }
      }
      this.logger.log(`Insights hourly refresh done in ${Date.now() - start}ms — ${orgs.length} Orgs, ${total} Insights aktualisiert`);
    } catch (err) {
      this.logger.error('Insights hourly refresh failed', err);
    }
  }
}
