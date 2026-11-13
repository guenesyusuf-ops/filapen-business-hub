import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationModule } from '../integration/integration.module';
import { DropshippingController } from './dropshipping.controller';
import { DropshippingService } from './dropshipping.service';
import { DropshippingSyncService } from './dropshipping-sync.service';
import { DropshippingScheduler } from './dropshipping.scheduler';
import { DsPartnerAuthService } from './ds-partner-auth.service';
import { DsPortalService } from './ds-portal.service';
import { DsPortalController } from './ds-portal.controller';

/**
 * Dropshipping-Modul — externes China-Partner-Portal.
 *
 * Phase 1   (Fundament):   Datenmodell, stuendlicher Sync, Owner-Uebersicht.
 * Phase 1.5 (Regeln):      Einzel/Kombi-Matching, manueller Import, Bilder, CSV.
 * Phase 2   (Portal):      externer Partner-Login + englisches Portal +
 *                          Shipped/Arrived-Workflow + Audit.
 * Phase 3   (Rueckschreibung): DE-Tracking → Shopify-Fulfillment + Kunden-Mail.
 *
 * Bewusst isoliert (ds_*-Tabellen). IntegrationModule nur fuer ShopifyService
 * (Fulfillment-Rueckschreibung) importiert.
 */
@Module({
  imports: [AuthModule, IntegrationModule],
  controllers: [DropshippingController, DsPortalController],
  providers: [
    DropshippingService,
    DropshippingSyncService,
    DropshippingScheduler,
    DsPartnerAuthService,
    DsPortalService,
  ],
  exports: [DropshippingService, DropshippingSyncService],
})
export class DropshippingModule {}
