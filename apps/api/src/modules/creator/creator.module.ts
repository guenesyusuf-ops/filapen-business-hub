import { Module } from '@nestjs/common';
import { CreatorService } from './creator.service';
import { DealService } from './deal.service';
import { BriefingService } from './briefing.service';
import { UploadService } from './upload.service';
import { CommentService } from './comment.service';
import { ProjectService } from './project.service';
import { ChatService } from './chat.service';
import { NotificationService } from './notification.service';
import { DashboardService } from './dashboard.service';
import { CalendarNoteService } from './calendar-note.service';
import { InvitationService } from './invitation.service';
import { InvitationScheduler } from './invitation.scheduler';
import { ProjectDocumentService } from './project-document.service';
import { ProjectDocumentController } from './project-document.controller';
import { CreatorController } from './creator.controller';
import { DashboardController } from './dashboard.controller';
import { InvitationController } from './invitation.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CreatorController, DashboardController, InvitationController, ProjectDocumentController],
  providers: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
    NotificationService,
    DashboardService,
    CalendarNoteService,
    InvitationService,
    InvitationScheduler,
    ProjectDocumentService,
  ],
  exports: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
    NotificationService,
    DashboardService,
    CalendarNoteService,
    InvitationService,
    ProjectDocumentService,
  ],
})
export class CreatorModule {}
