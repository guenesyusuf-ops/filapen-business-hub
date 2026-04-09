import { Module } from '@nestjs/common';
import { ProfitCalculationModule } from '../profit/profit.module';
import { CostModule } from '../cost/cost.module';
import { ProductModule } from '../product/product.module';
import { AttributionModule } from '../attribution/attribution.module';
import { CohortModule } from '../cohort/cohort.module';
import { BenchmarkModule } from '../benchmark/benchmark.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard module — controllers and services for the finance dashboard
 * endpoints. Imports profit engine for P&L/time-series, cost module for
 * payment methods and fixed costs, product module for product data,
 * and analytics modules for attribution, cohorts, and benchmarks.
 */
@Module({
  imports: [
    ProfitCalculationModule,
    CostModule,
    ProductModule,
    AttributionModule,
    CohortModule,
    BenchmarkModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
