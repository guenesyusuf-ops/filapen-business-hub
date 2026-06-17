import {
  Controller, Get, Post, Delete,
  Param, Body, Headers,
  Logger, HttpException, HttpStatus, BadRequestException,
  Res, StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { DocShareService } from './doc-share.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuthService } from '../auth/auth.service';

@Controller()
export class DocShareController {
  private readonly logger = new Logger(DocShareController.name);

  constructor(
    private readonly share: DocShareService,
    private readonly storage: StorageService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new HttpException('Invalid auth', HttpStatus.UNAUTHORIZED);
    try { return this.auth.validateToken(parts[1]).sub; }
    catch { throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED); }
  }

  // ==================== HUB (authenticated) ====================

  @Post('documents/folders/:folderId/share-links')
  async createLink(
    @Headers('authorization') authHeader: string,
    @Param('folderId') folderId: string,
    @Body() body: { durationDays?: number | null },
  ) {
    const userId = this.extractUserId(authHeader);
    const dur = body.durationDays === undefined ? null : body.durationDays;
    return this.share.createLink(folderId, userId, dur);
  }

  @Get('documents/folders/:folderId/share-links')
  async listLinks(
    @Headers('authorization') authHeader: string,
    @Param('folderId') folderId: string,
  ) {
    this.extractUserId(authHeader);
    return this.share.listLinksForFolder(folderId);
  }

  @Delete('documents/share-links/:id')
  async revokeLink(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    this.extractUserId(authHeader);
    return this.share.revokeLink(id);
  }

  // ==================== PUBLIC (no auth) ====================

  @Get('share/docs/:token')
  async resolveByToken(@Param('token') token: string) {
    if (!token || token.length < 8) throw new BadRequestException('Token ungueltig');
    return this.share.resolveByToken(token);
  }

  @Get('share/docs/:token/files/:fileId/download')
  async downloadFile(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.share.getFileForToken(token, fileId);
    if (!file.storageKey) throw new HttpException('Datei nicht verfuegbar', HttpStatus.NOT_FOUND);
    let obj;
    try {
      obj = await this.storage.getObject(file.storageKey);
    } catch (err: any) {
      throw new HttpException(`Datei konnte nicht geladen werden: ${err?.message ?? 'Unbekannt'}`, HttpStatus.NOT_FOUND);
    }
    res.set({
      'Content-Type': obj.contentType || file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      ...(obj.contentLength ? { 'Content-Length': String(obj.contentLength) } : {}),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(obj.body);
  }
}
