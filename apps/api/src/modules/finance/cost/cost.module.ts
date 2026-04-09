import { Module } from '@nestjs/common';
import { CostService } from './cost.service';

@Module({
  providers: [CostService],
  exports: [CostService],
})
export class CostModule {}
