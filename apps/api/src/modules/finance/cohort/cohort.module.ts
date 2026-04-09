import { Module } from '@nestjs/common';
import { CohortService } from './cohort.service';

@Module({
  providers: [CohortService],
  exports: [CohortService],
})
export class CohortModule {}
