import { Module } from '@nestjs/common';
import { ProfitEngineService } from './profit-engine.service';
import { AggregationService } from './aggregation.service';
import { CostModule } from '../cost/cost.module';

@Module({
  imports: [CostModule],
  providers: [ProfitEngineService, AggregationService],
  exports: [ProfitEngineService, AggregationService],
})
export class ProfitCalculationModule {}
