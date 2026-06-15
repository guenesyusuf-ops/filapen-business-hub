import { Module } from '@nestjs/common';
import { NfcController } from './nfc.controller';
import { NfcService } from './nfc.service';
import { NfcPublicService } from './nfc-public.service';
import { NfcCustomerDataService } from './nfc-customer-data.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NfcController],
  providers: [NfcService, NfcPublicService, NfcCustomerDataService],
  exports: [NfcService],
})
export class NfcModule {}
