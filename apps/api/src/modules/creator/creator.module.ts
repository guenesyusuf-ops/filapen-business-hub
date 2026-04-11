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
import { CreatorController } from './creator.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [CreatorController, DashboardController],
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
  ],
})
export class CreatorModule {}
