import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';
import { ShippingController } from './shipping.controller';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingProductProfileService } from './shipping-product-profile.service';

@Module({
  imports: [AuthModule, StorageModule, EmailMarketingModule],
  controllers: [ShippingController],
  providers: [
    ShippingOrderService,
    ShippingProductProfileService,
  ],
  exports: [
    ShippingOrderService,
    ShippingProductProfileService,
  ],
})
export class ShippingModule {}
