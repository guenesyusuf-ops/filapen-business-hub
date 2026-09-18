import { Module } from '@nestjs/common';
import { ShopifyAnalyticsController } from './shopify-analytics.controller';
import { ShopifyAnalyticsService } from './shopify-analytics.service';
import { IntegrationModule } from '../../integration/integration.module';

/**
 * Shopify Analytics module — replicates Shopify Admin Analytics dashboard
 * (18 cards in 6 sections) using orders, line items, refunds, variants,
 * and products from the local DB. All queries anchored to Europe/Berlin.
 */
@Module({
  // IntegrationModule wegen ShopifyService: die Umsatz-Aufschluesselung kommt
  // aus Shopifys eigener Auswertung, nicht mehr aus eigener Rechnung.
  imports: [IntegrationModule],
  controllers: [ShopifyAnalyticsController],
  providers: [ShopifyAnalyticsService],
})
export class ShopifyAnalyticsModule {}
