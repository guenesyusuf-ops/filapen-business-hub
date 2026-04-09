import { Module } from '@nestjs/common';
import { CreatorService } from './creator.service';
import { DealService } from './deal.service';
import { BriefingService } from './briefing.service';
import { UploadService } from './upload.service';
import { CommentService } from './comment.service';
import { ProjectService } from './project.service';
import { ChatService } from './chat.service';
import { CreatorController } from './creator.controller';

@Module({
  controllers: [CreatorController],
  providers: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
  ],
  exports: [
    CreatorService,
    DealService,
    BriefingService,
    UploadService,
    CommentService,
    ProjectService,
    ChatService,
  ],
})
export class CreatorModule {}
