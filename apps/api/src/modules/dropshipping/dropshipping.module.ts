import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DropshippingController } from './dropshipping.controller';
import { DropshippingService } from './dropshipping.service';
import { DropshippingSyncService } from './dropshipping-sync.service';
import { DropshippingScheduler } from './dropshipping.scheduler';

/**
 * Dropshipping-Modul — externes China-Partner-Portal.
 *
 * Phase 1 (Fundament): Datenmodell, stuendlicher Sync aus den lokal
 *   synchronisierten Shopify-Bestellungen, SKU-Auswahl + Owner-Bestelluebersicht.
 * Phase 2: externer Partner-Login + englisches Portal + Shipped/Arrived-Workflow.
 * Phase 3: DE-Tracking → Shopify-Fulfillment-Rueckschreibung + Kunden-Mail.
 *
 * Bewusst isoliert (ds_*-Tabellen), keine Eingriffe in bestehende Module.
 */
@Module({
  imports: [AuthModule],
  controllers: [DropshippingController],
  providers: [DropshippingService, DropshippingSyncService, DropshippingScheduler],
  exports: [DropshippingService, DropshippingSyncService],
})
export class DropshippingModule {}
