import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { TemplateService } from './template.service';
import { BrandVoiceService } from './brand-voice.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly templateService: TemplateService,
    private readonly brandVoiceService: BrandVoiceService,
  ) {}

  // =========================================================================
  // CONTENT PIECES
  // =========================================================================

  @Get('content')
  async listContent(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('campaign') campaign?: string,
    @Query('aiGenerated') aiGeneratedStr?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '25', 10) || 25));
    const aiGenerated =
      aiGeneratedStr === 'true' ? true : aiGeneratedStr === 'false' ? false : undefined;

    try {
      return await this.contentService.list(DEV_ORG_ID, {
        search,
        type,
        status,
        platform,
        campaign,
        aiGenerated,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list content', error);
      throw new HttpException('Failed to load content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('content/stats')
  async getContentStats() {
    try {
      return await this.contentService.getStats(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get content stats', error);
      throw new HttpException('Failed to load content stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('content/templates')
  async listTemplates(
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '50', 10) || 50));

    try {
      return await this.templateService.list(DEV_ORG_ID, {
        type,
        category,
        search,
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list templates', error);
      throw new HttpException('Failed to load templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('content/templates/by-product')
  async listTemplatesByProduct(@Query('productName') productName?: string) {
    if (!productName) {
      return [];
    }
    try {
      return await this.templateService.listByProduct(DEV_ORG_ID, productName);
    } catch (error) {
      this.logger.error('Failed to list templates by product', error);
      throw new HttpException('Failed to load templates by product', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('content/templates')
  async createTemplate(@Body() body: any) {
    try {
      return await this.templateService.create(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create template', error);
      throw new HttpException(
        error.message || 'Failed to create template',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('content/brand-voices')
  async listBrandVoices() {
    try {
      return await this.brandVoiceService.list(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to list brand voices', error);
      throw new HttpException('Failed to load brand voices', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('content/brand-voices')
  async createBrandVoice(@Body() body: any) {
    try {
      return await this.brandVoiceService.create(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create brand voice', error);
      throw new HttpException(
        error.message || 'Failed to create brand voice',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('content/brand-voices/:id')
  async updateBrandVoice(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.brandVoiceService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update brand voice', error);
      throw new HttpException('Failed to update brand voice', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('content/brand-voices/:id')
  async deleteBrandVoice(@Param('id') id: string) {
    try {
      return await this.brandVoiceService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete brand voice', error);
      throw new HttpException('Failed to delete brand voice', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('content/generate')
  async generateContent(@Body() body: any) {
    try {
      return await this.contentService.generate(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to generate content', error);
      throw new HttpException(
        error.message || 'Failed to generate content',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('content/:id')
  async getContent(@Param('id') id: string) {
    try {
      return await this.contentService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get content', error);
      throw new HttpException('Failed to load content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('content')
  async createContent(@Body() body: any) {
    try {
      return await this.contentService.create(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create content', error);
      throw new HttpException(
        error.message || 'Failed to create content',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('content/:id')
  async updateContent(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.contentService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update content', error);
      throw new HttpException('Failed to update content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('content/:id')
  async deleteContent(@Param('id') id: string) {
    try {
      return await this.contentService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete content', error);
      throw new HttpException('Failed to delete content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
