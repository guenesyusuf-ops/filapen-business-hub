import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Gewinnanalyse-Modul.
 *
 * Phase 1: Fundament — historisierter Settings-Service (Gebuehren, Versand, USt).
 * Weitere Phasen (Produktkosten, Tagesdaten, Monatstabelle, Grosshandel,
 * Gemeinkosten, Vergleiche, Import/Export, Audit) folgen inkrementell.
 *
 * Bewusst getrennt vom bestehenden `finance/*` Modul — kein Konflikt.
 */
@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class ProfitAnalysisModule {}
