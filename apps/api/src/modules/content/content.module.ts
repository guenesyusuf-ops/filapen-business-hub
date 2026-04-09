import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { TemplateService } from './template.service';
import { BrandVoiceService } from './brand-voice.service';
import { AiGeneratorService } from './ai-generator.service';
import { AdLibraryService } from './ad-library.service';
import { ContentController } from './content.controller';

@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    TemplateService,
    BrandVoiceService,
    AiGeneratorService,
    AdLibraryService,
  ],
  exports: [
    ContentService,
    TemplateService,
    BrandVoiceService,
    AiGeneratorService,
    AdLibraryService,
  ],
})
export class ContentModule {}
