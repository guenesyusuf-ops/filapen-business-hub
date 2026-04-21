import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [AuthModule, StorageModule, EmailMarketingModule],
  controllers: [ShippingController],
  providers: [],
  exports: [],
})
export class ShippingModule {}
