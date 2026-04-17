import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Headers,
  Logger, HttpException, HttpStatus, BadRequestException,
  UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AuthService } from '../auth/auth.service';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly docs: DocumentsService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new HttpException('Invalid auth', HttpStatus.UNAUTHORIZED);
    try { return this.auth.validateToken(parts[1]).sub; }
    catch { throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED); }
  }

  // ==================== FOLDERS ====================

  @Get('folders')
  async listFolders(
    @Headers('authorization') authHeader: string,
    @Query('parentId') parentId?: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.docs.listFolders(parentId || null, userId);
  }

  @Post('folders')
  async createFolder(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; parentId?: string; color?: string; description?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.name?.trim()) throw new BadRequestException('Name fehlt');
    return this.docs.createFolder(body, userId);
  }

  @Put('folders/:id')
  async updateFolder(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; description?: string },
  ) {
    return this.docs.updateFolder(id, body);
  }

  @Patch('folders/:id/lock')
  async lockFolder(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const userId = this.extractUserId(authHeader);
    return this.docs.lockFolder(id, userId);
  }

  @Patch('folders/:id/unlock')
  async unlockFolder(@Param('id') id: string) {
    return this.docs.unlockFolder(id);
  }

  @Patch('folders/:id/trash')
  async trashFolder(@Param('id') id: string) {
    return this.docs.trashFolder(id);
  }

  @Patch('folders/:id/restore')
  async restoreFolder(@Param('id') id: string) {
    return this.docs.restoreFolder(id);
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id') id: string) {
    return this.docs.deleteFolder(id);
  }

  // ==================== FOLDER PERMISSIONS ====================

  @Get('folders/:id/permissions')
  async getFolderPermissions(@Param('id') id: string) {
    return this.docs.getFolderPermissions(id);
  }

  @Put('folders/:id/permissions')
  async setFolderPermission(
    @Param('id') folderId: string,
    @Body() body: { userId: string; canRead: boolean; canUpload: boolean; canEdit: boolean; canDelete: boolean },
  ) {
    return this.docs.setFolderPermission(folderId, body.userId, body);
  }

  @Delete('folders/:id/permissions/:userId')
  async removeFolderPermission(@Param('id') folderId: string, @Param('userId') userId: string) {
    return this.docs.removeFolderPermission(folderId, userId);
  }

  // ==================== FILES ====================

  @Get('files')
  async listFiles(
    @Headers('authorization') authHeader: string,
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
    @Query('fileType') fileType?: string,
    @Query('status') status?: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.docs.listFiles(folderId || null, userId, { search, fileType, status });
  }

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  async uploadFile(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { folderId?: string; tags?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!file) throw new BadRequestException('Keine Datei');
    const tags = body.tags ? JSON.parse(body.tags) : [];
    return this.docs.uploadFile(body.folderId || null, file, userId, tags);
  }

  @Post('files/upload-multi')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 200 * 1024 * 1024 } }))
  async uploadMultiple(
    @Headers('authorization') authHeader: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { folderId?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!files?.length) throw new BadRequestException('Keine Dateien');
    const results = [];
    for (const file of files) {
      results.push(await this.docs.uploadFile(body.folderId || null, file, userId));
    }
    return results;
  }

  @Put('files/:id')
  async updateFile(
    @Param('id') id: string,
    @Body() body: { fileName?: string; status?: string; tags?: string[]; metadata?: any },
  ) {
    return this.docs.updateFile(id, body);
  }

  @Patch('files/:id/move')
  async moveFile(@Param('id') id: string, @Body() body: { folderId: string | null }) {
    return this.docs.moveFile(id, body.folderId);
  }

  @Patch('files/:id/trash')
  async trashFile(@Param('id') id: string) {
    return this.docs.trashFile(id);
  }

  @Patch('files/:id/restore')
  async restoreFile(@Param('id') id: string) {
    return this.docs.restoreFile(id);
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string) {
    return this.docs.deleteFile(id);
  }

  @Get('files/:id/versions')
  async getFileVersions(@Param('id') id: string) {
    return this.docs.getFileVersions(id);
  }

  // ==================== FAVORITES ====================

  @Post('favorites')
  async toggleFavorite(
    @Headers('authorization') authHeader: string,
    @Body() body: { folderId?: string; fileId?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.docs.toggleFavorite(userId, body.folderId, body.fileId);
  }

  @Get('favorites')
  async getFavorites(@Headers('authorization') authHeader: string) {
    const userId = this.extractUserId(authHeader);
    return this.docs.getFavorites(userId);
  }

  // ==================== ACTIVITY + SEARCH + TRASH ====================

  @Get('activities')
  async getActivities(@Query('folderId') folderId?: string) {
    return this.docs.getActivities(folderId);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q?.trim()) return { folders: [], files: [] };
    return this.docs.search(q.trim());
  }

  @Get('trash')
  async getTrash() {
    return this.docs.getTrash();
  }
}
