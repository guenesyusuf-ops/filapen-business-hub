import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailModule } from '../../common/email/email.module';
import { EmailMarketingController } from './email-marketing.controller';

@Module({
  imports: [AuthModule, StorageModule, EmailModule],
  controllers: [EmailMarketingController],
  providers: [],
  exports: [],
})
export class EmailMarketingModule {}
