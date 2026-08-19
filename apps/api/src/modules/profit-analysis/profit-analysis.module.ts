import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ProductCostController } from './product-cost.controller';
import { ProductCostService } from './product-cost.service';
import { DailyDataController } from './daily-data.controller';
import { DailyDataService } from './daily-data.service';
import { CalculationService } from './calculation.service';
import { WholesaleController } from './wholesale.controller';
import { WholesaleService } from './wholesale.service';
import { OverheadController } from './overhead.controller';
import { OverheadService } from './overhead.service';
import { MonthCloseController } from './month-close.controller';
import { MonthCloseService } from './month-close.service';
import { ExportService } from './export.service';

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
  controllers: [
    SettingsController, ProductCostController, DailyDataController,
    WholesaleController, OverheadController, MonthCloseController,
  ],
  providers: [
    SettingsService, ProductCostService, DailyDataService, CalculationService,
    WholesaleService, OverheadService, MonthCloseService, ExportService,
  ],
  exports: [
    SettingsService, ProductCostService, DailyDataService, CalculationService,
    WholesaleService, OverheadService, MonthCloseService, ExportService,
  ],
})
export class ProfitAnalysisModule {}
