import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ShopifyService } from './shopify.service';

/**
 * BullMQ processor for the 'shopify-sync' queue.
 * Handles long-running sync jobs: backfill, reconciliation, and reaggregation.
 */
@Processor('shopify-sync', {
  concurrency: 2,
  limiter: {
    max: 1,
    duration: 1_000,
  },
})
export class ShopifySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ShopifySyncProcessor.name);

  constructor(private readonly shopifyService: ShopifyService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(
      `Processing job ${job.id} [${job.name}] (attempt ${job.attemptsMade + 1})`,
    );

    switch (job.name) {
      case 'backfill':
        return this.handleBackfill(job);

      case 'reconciliation':
        return this.handleReconciliation(job);

      case 'reaggregate':
        return this.handleReaggregation(job);

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  /**
   * Initial backfill: fetches 12 months of orders and all products
   * from Shopify for a newly connected integration.
   */
  private async handleBackfill(
    job: Job<{ integrationId: string }>,
  ): Promise<{ orders: number; products: number }> {
    const { integrationId } = job.data;

    this.logger.log(`Starting backfill for integration ${integrationId}`);

    await job.updateProgress(0);

    const result = await this.shopifyService.backfill(integrationId);

    await job.updateProgress(100);

    this.logger.log(
      `Backfill complete for ${integrationId}: ${result.products} products, ${result.orders} orders`,
    );

    return result;
  }

  /**
   * Scheduled reconciliation: compares recent Shopify data with local
   * records and fixes any discrepancies.
   */
  private async handleReconciliation(
    job: Job<{ integrationId: string }>,
  ): Promise<{ checked: number; fixed: number }> {
    const { integrationId } = job.data;

    this.logger.log(
      `Starting reconciliation for integration ${integrationId}`,
    );

    await job.updateProgress(0);

    const result = await this.shopifyService.reconcile(integrationId);

    await job.updateProgress(100);

    this.logger.log(
      `Reconciliation complete for ${integrationId}: checked ${result.checked}, fixed ${result.fixed}`,
    );

    return result;
  }

  /**
   * Reaggregate DailyAggregate for a specific org+date.
   * This is enqueued with a debounce (jobId-based dedup) so that
   * multiple order updates on the same day only trigger one recalc.
   */
  private async handleReaggregation(
    job: Job<{ orgId: string; date: string }>,
  ): Promise<void> {
    const { orgId, date } = job.data;

    this.logger.log(`Reaggregating ${orgId} for date ${date}`);

    // This is a placeholder for the aggregation service call.
    // The actual DailyAggregate recalculation logic lives in a
    // separate AggregationService that queries orders, refunds,
    // ad metrics, and fixed costs for the given date.
    //
    // For now, we log the intent. The aggregation module will
    // implement the full recalculation.
    this.logger.log(
      `Reaggregation queued for ${orgId} on ${date} - will be handled by AggregationService`,
    );
  }
}
