import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { PurchaseAuditService } from './purchase-audit.service';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class PurchaseDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: PurchaseAuditService,
  ) {}

  async upload(
    orgId: string,
    userId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
    purchaseOrderId: string | null,
    documentType: 'invoice' | 'proforma' | 'delivery_note' | 'receipt' | 'other',
  ) {
    if (!file) throw new BadRequestException('Keine Datei');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Dateityp nicht erlaubt (PDF/JPG/PNG/WebP/HEIC)');
    }
    if (file.size > MAX_BYTES) throw new BadRequestException('Datei zu groß (max 25 MB)');
    if (purchaseOrderId) {
      const order = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, orgId } });
      if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    }

    const cleanName = file.originalname.replace(/[^\w.\-]/g, '_');
    const key = `purchase/${orgId}/${purchaseOrderId || 'unassigned'}/${Date.now()}-${cleanName}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    const doc = await this.prisma.purchaseDocument.create({
      data: {
        orgId,
        purchaseOrderId,
        fileName: cleanName,
        fileUrl: url,
        storageKey: key,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        documentType,
        uploadedById: userId,
      },
    });

    await this.audit.log(orgId, userId, 'document', doc.id, 'upload', {
      fileName: doc.fileName,
      type: documentType,
    }, purchaseOrderId || undefined);
    return doc;
  }

  async list(orgId: string, purchaseOrderId: string) {
    return this.prisma.purchaseDocument.findMany({
      where: { orgId, purchaseOrderId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  async remove(orgId: string, userId: string, docId: string) {
    const existing = await this.prisma.purchaseDocument.findFirst({ where: { id: docId, orgId } });
    if (!existing) throw new NotFoundException('Dokument nicht gefunden');
    try {
      await this.storage.delete(existing.storageKey);
    } catch {
      // best-effort
    }
    await this.prisma.purchaseDocument.delete({ where: { id: docId } });
    await this.audit.log(orgId, userId, 'document', docId, 'delete', {
      fileName: existing.fileName,
    }, existing.purchaseOrderId || undefined);
    return { deleted: true };
  }
}
