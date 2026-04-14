import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../../common/storage/storage.service';
import { ProjectDocumentService } from './project-document.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class ProjectDocumentController {
  private readonly logger = new Logger(ProjectDocumentController.name);

  constructor(
    private readonly docService: ProjectDocumentService,
    private readonly storage: StorageService,
  ) {}

  // POST /api/creator-projects/:projectId/documents?type=briefing
  @Post('creator-projects/:projectId/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    }),
  )
  async uploadDocument(
    @Param('projectId') projectId: string,
    @Query('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!type || !['briefing', 'skript', 'sonstige'].includes(type)) {
      throw new BadRequestException('type must be one of: briefing, skript, sonstige');
    }
    if (!file.buffer) {
      throw new HttpException('File buffer missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `project-documents/${projectId}/${timestamp}-${safeName}`;

      const fileUrl = await this.storage.upload(key, file.buffer, file.mimetype);

      const doc = await this.docService.create({
        projectId,
        orgId: DEV_ORG_ID,
        type,
        fileName: file.originalname,
        fileUrl,
        storageKey: key,
        fileSize: file.size,
      });

      return doc;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to upload project document', error);
      throw new HttpException(
        error?.message || 'Failed to upload document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/creator-projects/:projectId/documents
  @Get('creator-projects/:projectId/documents')
  async listDocuments(@Param('projectId') projectId: string) {
    try {
      return await this.docService.listByProject(DEV_ORG_ID, projectId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list project documents', error);
      throw new HttpException(
        error?.message || 'Failed to load documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/creator-projects/:projectId/documents/:docId
  @Delete('creator-projects/:projectId/documents/:docId')
  async deleteDocument(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    try {
      return await this.docService.delete(DEV_ORG_ID, projectId, docId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete project document', error);
      throw new HttpException(
        error?.message || 'Failed to delete document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/creator/portal/project/:projectId?creatorId=xxx
  @Get('creator/portal/project/:projectId')
  async getProjectForCreator(
    @Param('projectId') projectId: string,
    @Query('creatorId') creatorId: string,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId query parameter is required');
    }
    try {
      return await this.docService.getProjectForCreator(projectId, creatorId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get project for creator portal', error);
      throw new HttpException(
        error?.message || 'Failed to load project',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
