import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query,
  UploadedFiles, UseInterceptors, Res, StreamableFile,
  HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ReturnService, ReturnListQuery } from './return.service';
import { ReturnImageService } from './return-image.service';
import { ReturnStatsService } from './return-stats.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('returns')
export class ReturnController {
  constructor(
    private readonly svc: ReturnService,
    private readonly imageSvc: ReturnImageService,
    private readonly stats: ReturnStatsService,
    private readonly storage: StorageService,
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

  // -------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------

  @Get()
  async list(@Headers('authorization') authHeader: string, @Query() q: ReturnListQuery) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.list(orgId, q);
  }

  @Get('status-counts')
  async statusCounts(
    @Headers('authorization') authHeader: string,
    @Query('platform') platform?: string,
  ) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.statusCounts(orgId, platform);
  }

  @Get('stats/dashboard')
  async statsDashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.stats.dashboard(orgId);
  }

  @Get('products')
  async products(
    @Headers('authorization') authHeader: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.searchProducts(orgId, q, limit ? parseInt(limit, 10) : 20);
  }

  // -------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------

  @Post()
  async create(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.create(orgId, userId, body);
  }

  @Get(':id')
  async getOne(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.get(orgId, id);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.update(orgId, id, userId, body);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.remove(orgId, id);
  }

  // -------------------------------------------------------------------
  // STATUS-WORKFLOW
  // -------------------------------------------------------------------

  @Post(':id/submit-review')
  async submitReview(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.submitForReview(orgId, id, userId);
  }

  @Post(':id/accept')
  async accept(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { refundAmount?: number; refundDate?: string; damaged?: boolean; note?: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.accept(orgId, id, userId, body || {});
  }

  @Post(':id/reject')
  async reject(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { reason: string; note?: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.reject(orgId, id, userId, body || ({} as any));
  }

  @Post(':id/refund')
  async refund(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { refundAmount?: number; refundDate?: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.markRefunded(orgId, id, userId, body || {});
  }

  @Post(':id/revert')
  async revert(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    if (!body?.status) throw new BadRequestException('Status fehlt');
    return this.svc.revert(orgId, id, userId, body.status as any);
  }

  // -------------------------------------------------------------------
  // POSITIONEN
  // -------------------------------------------------------------------

  @Post(':id/items')
  async addItem(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.addItem(orgId, id, userId, body || {});
  }

  @Delete(':id/items/:itemId')
  async removeItem(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.removeItem(orgId, id, userId, itemId);
  }

  // -------------------------------------------------------------------
  // BILDER
  // -------------------------------------------------------------------

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImages(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @UploadedFiles() files: any[],
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    if (!files || files.length === 0) throw new BadRequestException('Keine Dateien empfangen');
    return this.imageSvc.upload(orgId, id, userId, files);
  }

  @Get(':id/images/:imageId/file')
  async streamImage(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { orgId } = await this.ctx(authHeader);
    const img = await this.prisma.returnImage.findFirst({
      where: { id: imageId, returnId: id, return: { orgId } },
    });
    if (!img) throw new HttpException('Bild nicht gefunden', HttpStatus.NOT_FOUND);
    let obj;
    try {
      obj = await this.storage.getObject(img.storagePath);
    } catch (err: any) {
      throw new HttpException(`Datei konnte nicht geladen werden: ${err?.message ?? 'unbekannt'}`, HttpStatus.NOT_FOUND);
    }
    res.set({
      'Content-Type': obj.contentType || img.fileMime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${img.fileName}"`,
      ...(obj.contentLength ? { 'Content-Length': String(obj.contentLength) } : {}),
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(obj.body);
  }

  @Delete(':id/images/:imageId')
  async removeImage(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.imageSvc.remove(orgId, id, imageId, userId);
  }
}
