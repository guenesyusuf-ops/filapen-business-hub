import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShopifyService } from './shopify/shopify.service';
import { ShopifyAuthController } from './shopify/shopify-auth.controller';
import { ShopifyWebhookController } from './shopify/shopify-webhook.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ShopifyAuthController, ShopifyWebhookController],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class IntegrationModule {}
