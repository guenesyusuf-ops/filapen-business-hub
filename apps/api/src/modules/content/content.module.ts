import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { TemplateService } from './template.service';
import { BrandVoiceService } from './brand-voice.service';
import { ContentController } from './content.controller';

@Module({
  controllers: [ContentController],
  providers: [ContentService, TemplateService, BrandVoiceService],
  exports: [ContentService, TemplateService, BrandVoiceService],
})
export class ContentModule {}
