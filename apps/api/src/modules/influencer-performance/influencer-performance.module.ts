import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfluencerPerformanceController } from './influencer-performance.controller';
import { InfluencerPerformanceService } from './influencer-performance.service';

@Module({
  imports: [AuthModule],
  controllers: [InfluencerPerformanceController],
  providers: [InfluencerPerformanceService],
  exports: [InfluencerPerformanceService],
})
export class InfluencerPerformanceModule {}
