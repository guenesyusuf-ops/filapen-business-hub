import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShopifyService } from './shopify.service';
import { AggregationService } from '../../finance/profit/aggregation.service';

/**
 * ShopifySyncScheduler
 *
 * Runs background cron jobs to keep Shopify data in sync and
 * DailyAggregate tables up to date without requiring the user
 * to trigger a manual refresh.
 *
 * Two schedules:
 *   - Every 15 minutes: incremental reconcile + rebuild aggregates
 *     for yesterday/today (covers late-arriving orders & refunds).
 *   - Every night at 03:00: full reconcile of last 7 days and
 *     rebuild the corresponding aggregate range (drift correction).
 */
@Injectable()
export class ShopifySyncScheduler {
  private readonly logger = new Logger(ShopifySyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
    private readonly aggregationService: AggregationService,
  ) {}

  /**
   * Every 15 minutes: incremental sync + aggregate rebuild for
   * yesterday and today.
   */
  @Cron('*/15 * * * *')
  async incrementalSyncAll(): Promise<void> {
    const integrations = await this.prisma.integration.findMany({
      where: { type: 'shopify', status: 'connected' },
    });

    if (integrations.length === 0) {
      this.logger.debug('No connected Shopify integrations for incremental sync');
      return;
    }

    for (const integration of integrations) {
      try {
        this.logger.log(
          `Auto-sync starting for integration ${integration.id}`,
        );
        await this.shopifyService.reconcile(integration.id);

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.aggregationService.rebuildRange(
          integration.orgId,
          yesterday,
          today,
        );

        this.logger.log(
          `Auto-sync completed for integration ${integration.id}`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-sync failed for integration ${integration.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  /**
   * Every night at 03:00: full reconciliation of the last 7 days
   * and aggregate rebuild for the same range.
   */
  @Cron('0 3 * * *')
  async nightlyFullSync(): Promise<void> {
    const integrations = await this.prisma.integration.findMany({
      where: { type: 'shopify', status: 'connected' },
    });

    if (integrations.length === 0) {
      this.logger.debug('No connected Shopify integrations for nightly sync');
      return;
    }

    for (const integration of integrations) {
      try {
        this.logger.log(
          `Nightly sync starting for integration ${integration.id}`,
        );
        await this.shopifyService.reconcile(integration.id);

        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        await this.aggregationService.rebuildRange(
          integration.orgId,
          start,
          end,
        );

        this.logger.log(
          `Nightly sync completed for integration ${integration.id}`,
        );
      } catch (err) {
        this.logger.error(
          `Nightly sync failed for integration ${integration.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
