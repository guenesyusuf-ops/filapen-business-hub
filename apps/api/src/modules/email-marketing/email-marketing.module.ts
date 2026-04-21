import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailModule } from '../../common/email/email.module';
import { EmailMarketingController } from './email-marketing.controller';
import { ContactSyncService } from './contact-sync.service';
import { MarketingEventService } from './marketing-event.service';

@Module({
  imports: [AuthModule, StorageModule, EmailModule],
  controllers: [EmailMarketingController],
  providers: [ContactSyncService, MarketingEventService],
  exports: [ContactSyncService, MarketingEventService],
})
export class EmailMarketingModule {}
