import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShopifyService } from './shopify/shopify.service';
import { ShopifyAuthController } from './shopify/shopify-auth.controller';
import { IntegrationController } from './integration.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProfitCalculationModule } from '../finance/profit/profit.module';

@Module({
  imports: [ConfigModule, PrismaModule, ProfitCalculationModule],
  controllers: [ShopifyAuthController, IntegrationController],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class IntegrationModule {}
