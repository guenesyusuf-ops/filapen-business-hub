import { Module } from '@nestjs/common';
import { InfluencerService } from './influencer.service';
import { WatchlistService } from './watchlist.service';
import { BrandService } from './brand.service';
import { InfluencerController } from './influencer.controller';

@Module({
  controllers: [InfluencerController],
  providers: [InfluencerService, WatchlistService, BrandService],
  exports: [InfluencerService, WatchlistService, BrandService],
})
export class InfluencerModule {}
