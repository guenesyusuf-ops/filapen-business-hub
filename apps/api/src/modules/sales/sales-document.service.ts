import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import * as crypto from 'crypto';

type DocKind = 'original' | 'confirmation' | 'invoice' | 'other';

@Injectable()
export class SalesDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(orgId: string, orderId: string) {
    // Verify order belongs to org
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, orgId }, select: { id: true } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return this.prisma.salesOrderDocument.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async attach(
    orgId: string,
    userId: string,
    orderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    kind: DocKind = 'other',
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Datei fehlt');
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, orgId }, select: { id: true } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');

    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const uid = crypto.randomBytes(8).toString('hex');
    const key = `sales/${orgId}/${orderId}/${kind}-${Date.now()}-${uid}.${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype || 'application/octet-stream');

    return this.prisma.salesOrderDocument.create({
      data: {
        orgId,
        orderId,
        kind,
        fileName: file.originalname,
        r2Key: key,
        url,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedById: userId,
      },
    });
  }

  /**
   * Store raw bytes (e.g. easybill-PDF download) as a SalesOrderDocument.
   * Skips the Multer/upload path since there's no incoming file.
   */
  async attachBuffer(
    orgId: string,
    userId: string,
    orderId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    kind: DocKind,
  ) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, orgId }, select: { id: true } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    const ext = (fileName.split('.').pop() || 'pdf').toLowerCase().slice(0, 10);
    const uid = crypto.randomBytes(8).toString('hex');
    const key = `sales/${orgId}/${orderId}/${kind}-${Date.now()}-${uid}.${ext}`;
    const url = await this.storage.upload(key, buffer, mimeType);
    return this.prisma.salesOrderDocument.create({
      data: {
        orgId, orderId, kind, fileName, r2Key: key, url,
        mimeType, sizeBytes: buffer.length, uploadedById: userId,
      },
    });
  }

  async remove(orgId: string, orderId: string, documentId: string) {
    const doc = await this.prisma.salesOrderDocument.findFirst({
      where: { id: documentId, orderId, orgId },
    });
    if (!doc) throw new NotFoundException('Dokument nicht gefunden');
    // Best effort R2 cleanup
    try { await this.storage.delete(doc.r2Key); } catch {}
    await this.prisma.salesOrderDocument.delete({ where: { id: doc.id } });
    return { ok: true };
  }
}
