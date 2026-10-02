import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsService } from './meta-ads.service';
import { MetaAdsImportController } from './meta-ads-import.controller';
import { MetaAdsImportService } from './meta-ads-import.service';
import { MetaAdsCreativeController } from './meta-ads-creative.controller';
import { MetaAdsCreativeService } from './meta-ads-creative.service';
import { MetaAdsIdeasController } from './meta-ads-ideas.controller';
import { MetaAdsIdeasService } from './meta-ads-ideas.service';
import { MetaAdsAiController } from './meta-ads-ai.controller';
import { MetaAdsAiService } from './meta-ads-ai.service';
import { MetaAdsLongTermController } from './meta-ads-longterm.controller';
import { MetaAdsLongTermService } from './meta-ads-longterm.service';

/**
 * Meta Ads — Creative Intelligence & Production OS (Phase: Fundament).
 * Isoliertes Modul nach dem profit-analysis-Vorbild: eigenes Datenmodell
 * (ma_*), echte orgId aus dem Token, Produkt als zentrale Zuordnung.
 */
@Module({
  imports: [AuthModule],
  controllers: [MetaAdsController, MetaAdsImportController, MetaAdsCreativeController, MetaAdsIdeasController, MetaAdsAiController, MetaAdsLongTermController],
  providers: [MetaAdsService, MetaAdsImportService, MetaAdsCreativeService, MetaAdsIdeasService, MetaAdsAiService, MetaAdsLongTermService],
})
export class MetaAdsModule {}
