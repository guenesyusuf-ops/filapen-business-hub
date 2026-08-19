import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ProductCostController } from './product-cost.controller';
import { ProductCostService } from './product-cost.service';
import { DailyDataController } from './daily-data.controller';
import { DailyDataService } from './daily-data.service';
import { CalculationService } from './calculation.service';

/**
 * Gewinnanalyse-Modul.
 *
 * Phase 1: Fundament — historisierter Settings-Service (Gebuehren, Versand, USt).
 * Phase 2: Produktkosten + Amazon-Fulfillment historisiert (referenziert
 *          bestehende Product-Tabelle aus Shopify-Integration).
 * Phase 3: Tages-Rohdaten (Umsatz je Kanal, Werbung, Versand, Produktverkaeufe)
 *          + Domain-Berechnungsengine (VAT 19/7, Kanal-Profit, Marge, ROAS)
 *          + CalculationService der Domain mit Kosten- und Settings-Historien
 *          orchestriert.
 * Weitere Phasen (Monatstabelle-UI, Grosshandel, Gemeinkosten, Vergleiche,
 * Import/Export, Audit) folgen inkrementell.
 *
 * Bewusst getrennt vom bestehenden `finance/*` Modul — kein Konflikt.
 */
@Module({
  imports: [AuthModule],
  controllers: [SettingsController, ProductCostController, DailyDataController],
  providers: [SettingsService, ProductCostService, DailyDataService, CalculationService],
  exports: [SettingsService, ProductCostService, DailyDataService, CalculationService],
})
export class ProfitAnalysisModule {}
