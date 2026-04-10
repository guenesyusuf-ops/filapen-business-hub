import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ShopifyService } from './shopify/shopify.service';
import { ShopifyAuthController } from './shopify/shopify-auth.controller';
import { ShopifyWebhookController } from './shopify/shopify-webhook.controller';
import { WebhookProcessor } from './shopify/webhook.processor';
import { ShopifySyncProcessor } from './shopify/shopify-sync.processor';
import { ShopifySyncScheduler } from './shopify/shopify-sync.scheduler';
import { IntegrationController } from './integration.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProfitCalculationModule } from '../finance/profit/profit.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ProfitCalculationModule,
    BullModule.registerQueue(
      { name: 'webhook-process' },
      { name: 'shopify-sync' },
    ),
  ],
  controllers: [
    ShopifyAuthController,
    ShopifyWebhookController,
    IntegrationController,
  ],
  providers: [
    ShopifyService,
    WebhookProcessor,
    ShopifySyncProcessor,
    ShopifySyncScheduler,
  ],
  exports: [ShopifyService],
})
export class IntegrationModule {}
