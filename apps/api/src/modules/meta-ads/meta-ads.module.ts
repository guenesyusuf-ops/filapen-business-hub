import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsService } from './meta-ads.service';

/**
 * Meta Ads — Creative Intelligence & Production OS (Phase: Fundament).
 * Isoliertes Modul nach dem profit-analysis-Vorbild: eigenes Datenmodell
 * (ma_*), echte orgId aus dem Token, Produkt als zentrale Zuordnung.
 */
@Module({
  imports: [AuthModule],
  controllers: [MetaAdsController],
  providers: [MetaAdsService],
})
export class MetaAdsModule {}
