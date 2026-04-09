import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { TemplateService } from './template.service';
import { BrandVoiceService } from './brand-voice.service';
import { AiGeneratorService } from './ai-generator.service';
import { ContentController } from './content.controller';

@Module({
  controllers: [ContentController],
  providers: [ContentService, TemplateService, BrandVoiceService, AiGeneratorService],
  exports: [ContentService, TemplateService, BrandVoiceService, AiGeneratorService],
})
export class ContentModule {}
