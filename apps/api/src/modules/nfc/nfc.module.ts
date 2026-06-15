import { Module } from '@nestjs/common';
import { NfcController } from './nfc.controller';
import { NfcService } from './nfc.service';
import { NfcPublicService } from './nfc-public.service';
import { NfcCustomerDataService } from './nfc-customer-data.service';
import { NfcPreActivationService } from './nfc-preactivation.service';
import { NfcCronService } from './nfc-cron.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [NfcController],
  providers: [
    NfcService,
    NfcPublicService,
    NfcCustomerDataService,
    NfcPreActivationService,
    NfcCronService,
  ],
  exports: [NfcService],
})
export class NfcModule {}
