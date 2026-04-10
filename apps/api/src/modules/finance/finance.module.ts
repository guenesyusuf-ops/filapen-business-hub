import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FinanceCacheModule } from './cache/cache.module';
import { ProfitCalculationModule } from './profit/profit.module';
import { CostModule } from './cost/cost.module';
import { ProductModule } from './product/product.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AlertModule } from './alert/alert.module';
import { AttributionModule } from './attribution/attribution.module';
import { CohortModule } from './cohort/cohort.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { ShopifyAnalyticsModule } from './shopify-analytics/shopify-analytics.module';

@Module({
  imports: [
    ConfigModule,
    FinanceCacheModule,
    ProfitCalculationModule,
    CostModule,
    ProductModule,
    DashboardModule,
    AlertModule,
    AttributionModule,
    CohortModule,
    BenchmarkModule,
    ShopifyAnalyticsModule,
  ],
  exports: [
    ProfitCalculationModule,
    CostModule,
    ProductModule,
    AttributionModule,
    CohortModule,
    BenchmarkModule,
  ],
})
export class FinanceModule {}
