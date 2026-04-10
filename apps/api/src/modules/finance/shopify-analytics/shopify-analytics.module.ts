import { Module } from '@nestjs/common';
import { ShopifyAnalyticsController } from './shopify-analytics.controller';
import { ShopifyAnalyticsService } from './shopify-analytics.service';

/**
 * Shopify Analytics module — replicates Shopify Admin Analytics dashboard
 * (18 cards in 6 sections) using orders, line items, refunds, variants,
 * and products from the local DB. All queries anchored to Europe/Berlin.
 */
@Module({
  controllers: [ShopifyAnalyticsController],
  providers: [ShopifyAnalyticsService],
})
export class ShopifyAnalyticsModule {}
