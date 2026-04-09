import { Module } from '@nestjs/common';

/**
 * Alert module — threshold-based alerting for ROAS drops, refund spikes,
 * budget overruns, missing COGS, and sync failures.
 * Controllers and services will be registered here.
 */
@Module({
  providers: [],
  exports: [],
})
export class AlertModule {}
