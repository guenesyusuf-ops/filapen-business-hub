import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AggregationService } from './aggregation.service';
import { CacheService } from '../cache/cache.service';

interface AggregationJobData {
  orgId: string;
  date: string; // ISO date string YYYY-MM-DD
}

@Processor('aggregation', {
  concurrency: 5,
  limiter: {
    max: 20,
    duration: 1000,
  },
})
export class AggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AggregationProcessor.name);

  constructor(
    private readonly aggregationService: AggregationService,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  async process(job: Job<AggregationJobData>): Promise<void> {
    const { orgId, date } = job.data;

    this.logger.log(`Processing aggregation job ${job.id}: org=${orgId} date=${date}`);

    try {
      await this.aggregationService.recalculate(orgId, new Date(date));

      // Invalidate cached P&L data for this org since aggregates changed
      await this.cacheService.invalidateForOrg(orgId);

      this.logger.log(`Aggregation job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Aggregation job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Let BullMQ handle retries
    }
  }
}
