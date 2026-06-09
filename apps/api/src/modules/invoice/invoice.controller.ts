import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query,
  UploadedFile, UseInterceptors, Res, StreamableFile,
  HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { InvoiceService, InvoiceListQuery } from './invoice.service';
import { InvoiceUploadService } from './invoice-upload.service';
import { InvoiceOcrService } from './invoice-ocr.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoiceStatsService } from './invoice-stats.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly svc: InvoiceService,
    private readonly uploadSvc: InvoiceUploadService,
    private readonly ocr: InvoiceOcrService,
    private readonly settingsSvc: InvoiceSettingsService,
    private readonly statsSvc: InvoiceStatsService,
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

  @Get()
  async list(@Headers('authorization') authHeader: string, @Query() q: InvoiceListQuery) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.list(orgId, q);
  }

  @Get('status-counts')
  async statusCounts(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.statusCounts(orgId);
  }

  @Get('suppliers')
  async suppliers(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.suppliersDetailed(orgId);
  }

  @Get('stats/dashboard')
  async statsDashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.statsSvc.dashboard(orgId);
  }

  @Get('settings')
  async getSettings(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.settingsSvc.getOrCreate(orgId);
  }

  @Put('settings')
  async updateSettings(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { orgId } = await this.ctx(authHeader);
    return this.settingsSvc.update(orgId, body);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: any,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    if (!file) throw new BadRequestException('Datei fehlt');
    return this.uploadSvc.upload(orgId, userId, file);
  }

  @Get(':id/file')
  async streamFile(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { orgId } = await this.ctx(authHeader);
    const inv = await this.prisma.invoice.findFirst({ where: { id, orgId } });
    if (!inv) throw new HttpException('Rechnung nicht gefunden', HttpStatus.NOT_FOUND);
    const obj = await this.storage.getObject(inv.storagePath);
    res.set({
      'Content-Type': obj.contentType || inv.fileMime || 'application/octet-stream',
      'Content-Disposition': `${download === '1' ? 'attachment' : 'inline'}; filename="${inv.fileName}"`,
      ...(obj.contentLength ? { 'Content-Length': String(obj.contentLength) } : {}),
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(obj.body);
  }

  @Get(':id/duplicates')
  async duplicates(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId } = await this.ctx(authHeader);
    const inv = await this.prisma.invoice.findFirst({ where: { id, orgId } });
    if (!inv) throw new HttpException('Rechnung nicht gefunden', HttpStatus.NOT_FOUND);
    return this.ocr.findDuplicates(orgId, {
      invoiceNumber: inv.invoiceNumber,
      supplierName: inv.supplierName,
      grossAmount: inv.grossAmount ? Number(inv.grossAmount) : null,
      excludeId: id,
    });
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

  @Post(':id/paid')
  async markPaid(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { paidAt?: string; note?: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.markPaid(orgId, id, userId, body || {});
  }

  @Post(':id/unpaid')
  async markUnpaid(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.markUnpaid(orgId, id, userId);
  }

  @Post(':id/archive')
  async archive(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.archive(orgId, id, userId);
  }

  @Post(':id/restore')
  async restore(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.restore(orgId, id, userId);
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.remove(orgId, id);
  }
}
