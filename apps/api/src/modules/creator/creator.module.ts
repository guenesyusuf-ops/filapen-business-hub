import { Module } from '@nestjs/common';
import { CreatorService } from './creator.service';
import { DealService } from './deal.service';
import { BriefingService } from './briefing.service';
import { UploadService } from './upload.service';
import { CommentService } from './comment.service';
import { ProjectService } from './project.service';
import { ChatService } from './chat.service';
import { DashboardService } from './dashboard.service';
import { CalendarNoteService } from './calendar-note.service';
import { InvitationService } from './invitation.service';
import { InvitationScheduler } from './invitation.scheduler';
import { CreatorController } from './creator.controller';
import { DashboardController } from './dashboard.controller';
import { InvitationController } from './invitation.controller';

@Module({
  controllers: [CreatorController, DashboardController, InvitationController],
  providers: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
    DashboardService,
    CalendarNoteService,
    InvitationService,
    InvitationScheduler,
  ],
  exports: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
    DashboardService,
    CalendarNoteService,
    InvitationService,
  ],
})
export class CreatorModule {}
