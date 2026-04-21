import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';
import { ShippingController } from './shipping.controller';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingProductProfileService } from './shipping-product-profile.service';
import { CarrierAccountService } from './carrier-account.service';
import { OrderShipmentService } from './order-shipment.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { DhlCarrierAdapter } from './carriers/dhl-carrier.adapter';
import { ManualCarrierAdapter } from './carriers/manual-carrier.adapter';

@Module({
  imports: [AuthModule, StorageModule, EmailMarketingModule],
  controllers: [ShippingController],
  providers: [
    ShippingOrderService,
    ShippingProductProfileService,
    CarrierAccountService,
    OrderShipmentService,
    CarrierRegistry,
    DhlCarrierAdapter,
    ManualCarrierAdapter,
  ],
  exports: [
    ShippingOrderService,
    ShippingProductProfileService,
    CarrierAccountService,
    OrderShipmentService,
    CarrierRegistry,
  ],
})
export class ShippingModule {}
