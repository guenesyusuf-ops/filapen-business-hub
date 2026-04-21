import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailModule } from '../../common/email/email.module';
import { EmailMarketingController } from './email-marketing.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { ContactSyncService } from './contact-sync.service';
import { MarketingEventService } from './marketing-event.service';
import { EmailSettingsService } from './email-settings.service';

@Module({
  imports: [AuthModule, StorageModule, EmailModule],
  controllers: [EmailMarketingController, PublicTrackingController],
  providers: [ContactSyncService, MarketingEventService, EmailSettingsService],
  exports: [ContactSyncService, MarketingEventService, EmailSettingsService],
})
export class EmailMarketingModule {}
