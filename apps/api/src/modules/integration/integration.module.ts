import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ShopifyService } from './shopify/shopify.service';
import { ShopifyAuthController } from './shopify/shopify-auth.controller';
import { ShopifyWebhookController } from './shopify/shopify-webhook.controller';
import { ShopifySyncProcessor } from './shopify/shopify-sync.processor';
import { WebhookProcessor } from './shopify/webhook.processor';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue(
      {
        name: 'shopify-sync',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10_000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
      {
        name: 'webhook-process',
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      },
    ),
  ],
  controllers: [ShopifyAuthController, ShopifyWebhookController],
  providers: [
    ShopifyService,
    ShopifySyncProcessor,
    WebhookProcessor,
  ],
  exports: [ShopifyService],
})
export class IntegrationModule {}
