import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers, Res,
  UploadedFiles, UseInterceptors, BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilapenSendService } from './send.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('send')
export class FilapenSendController {
  constructor(
    private readonly svc: FilapenSendService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(authHeader: string | undefined): Promise<{ userId: string; orgId: string }> {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid authorization header', HttpStatus.UNAUTHORIZED);
    }
    let payload;
    try { payload = this.auth.validateToken(parts[1]); } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    return { userId: user.id, orgId: user.orgId };
  }

  @Get('inbox')
  async inbox(@Headers('authorization') authHeader: string) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.inbox(orgId, userId);
  }

  @Get('outbox')
  async outbox(@Headers('authorization') authHeader: string) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.outbox(orgId, userId);
  }

  /**
   * Upload: multipart/form-data mit
   *  - files (mehrfach, max 50 Dateien à 500 MB)
   *  - recipientIds (JSON-Array als String)
   *  - filePaths (optional JSON-Array, gleiche Reihenfolge wie files)
   *  - message (optional)
   */
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 50, {
    limits: { fileSize: 500 * 1024 * 1024, files: 50 },
  }))
  async upload(
    @Headers('authorization') authHeader: string,
    @UploadedFiles() files: any[],
    @Body() body: { recipientIds: string; filePaths?: string; message?: string },
  ) {
    const { userId, orgId } = await this.ctx(authHeader);
    if (!files?.length) throw new BadRequestException('Keine Dateien angehaengt');

    let recipientIds: string[] = [];
    try { recipientIds = JSON.parse(body.recipientIds); } catch {
      throw new BadRequestException('recipientIds muss ein JSON-Array sein');
    }
    let filePaths: string[] | undefined;
    if (body.filePaths) {
      try { filePaths = JSON.parse(body.filePaths); } catch { filePaths = undefined; }
    }
    return this.svc.create(orgId, userId, {
      recipientIds,
      message: body.message,
      files,
      filePaths,
    });
  }

  /** Download einer einzelnen Datei (Stream-Proxy von R2). */
  @Get('items/:itemId/file')
  async download(
    @Headers('authorization') authHeader: string,
    @Param('itemId') itemId: string,
    @Query('inline') inline: string | undefined,
    @Res() res: Response,
  ) {
    const { userId, orgId } = await this.ctx(authHeader);
    const { stream, fileName, mimeType, contentLength } = await this.svc.getItemForDownload(orgId, userId, itemId);
    const disposition = inline === '1' || inline === 'true' ? 'inline' : 'attachment';
    const safeAscii = fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '');
    const encoded = encodeURIComponent(fileName);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Cache-Control', 'private, max-age=60');
    stream.pipe(res);
  }

  @Patch(':id/received')
  async markReceived(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.markReceived(orgId, userId, id);
  }

  /** Sender widerruft → Datei + Record geloescht */
  @Delete(':id')
  async revoke(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.revoke(orgId, userId, id);
  }

  /** Empfaenger versteckt aus Inbox (Datei bleibt fuer andere Empfaenger erhalten) */
  @Patch(':id/hide')
  async hide(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.hideFromInbox(orgId, userId, id);
  }
}
