import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfluencerService } from './influencer.service';
import { WatchlistService } from './watchlist.service';
import { BrandService } from './brand.service';
import { PhylloService } from './phyllo.service';
import { InfluencerController } from './influencer.controller';

@Module({
  imports: [ConfigModule],
  controllers: [InfluencerController],
  providers: [InfluencerService, WatchlistService, BrandService, PhylloService],
  exports: [InfluencerService, WatchlistService, BrandService, PhylloService],
})
export class InfluencerModule {}
