import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailModule } from '../../common/email/email.module';
import { EmailMarketingController } from './email-marketing.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { ContactSyncService } from './contact-sync.service';
import { MarketingEventService } from './marketing-event.service';
import { EmailSettingsService } from './email-settings.service';
import { EmailRenderingService } from './email-rendering.service';
import { EmailSenderService } from './email-sender.service';
import { TrackingTokenService } from './tracking-token.service';
import { SegmentService } from './segment.service';

@Module({
  imports: [AuthModule, StorageModule, EmailModule],
  controllers: [EmailMarketingController, PublicTrackingController],
  providers: [
    ContactSyncService,
    MarketingEventService,
    EmailSettingsService,
    EmailRenderingService,
    EmailSenderService,
    TrackingTokenService,
    SegmentService,
  ],
  exports: [
    ContactSyncService,
    MarketingEventService,
    EmailSettingsService,
    EmailRenderingService,
    EmailSenderService,
    TrackingTokenService,
    SegmentService,
  ],
})
export class EmailMarketingModule {}
