import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ProductCostController } from './product-cost.controller';
import { ProductCostService } from './product-cost.service';

/**
 * Gewinnanalyse-Modul.
 *
 * Phase 1: Fundament — historisierter Settings-Service (Gebuehren, Versand, USt).
 * Phase 2: Produktkosten + Amazon-Fulfillment historisiert (referenziert
 *          bestehende Product-Tabelle aus Shopify-Integration).
 * Weitere Phasen (Tagesdaten, Monatstabelle, Grosshandel, Gemeinkosten,
 * Vergleiche, Import/Export, Audit) folgen inkrementell.
 *
 * Bewusst getrennt vom bestehenden `finance/*` Modul — kein Konflikt.
 */
@Module({
  imports: [AuthModule],
  controllers: [SettingsController, ProductCostController],
  providers: [SettingsService, ProductCostService],
  exports: [SettingsService, ProductCostService],
})
export class ProfitAnalysisModule {}
