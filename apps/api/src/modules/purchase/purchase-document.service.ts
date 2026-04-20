import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
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
  'image/jpg',
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class PurchaseDocumentService {
  private readonly logger = new Logger(PurchaseDocumentService.name);

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
    this.logger.log(
      `Upload request — org=${orgId} user=${userId} order=${purchaseOrderId} type=${documentType} ` +
      `name=${file?.originalname} size=${file?.size} mime=${file?.mimetype}`,
    );

    if (!file) throw new BadRequestException('Keine Datei empfangen');
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Datei ist leer');
    }
    if (!file.mimetype) {
      throw new BadRequestException('Dateityp nicht erkannt');
    }
    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(`Dateityp "${mime}" nicht erlaubt (erlaubt: PDF, JPG, PNG, WebP, HEIC)`);
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`Datei zu groß (${Math.round(file.size / 1024 / 1024)} MB, max 25 MB)`);
    }

    if (purchaseOrderId) {
      const order = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, orgId } });
      if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    }

    const cleanName = (file.originalname || 'document').replace(/[^\w.\-]/g, '_');
    const key = `purchase/${orgId}/${purchaseOrderId || 'unassigned'}/${Date.now()}-${cleanName}`;

    let url: string;
    try {
      url = await this.storage.upload(key, file.buffer, mime);
      this.logger.log(`R2 upload OK — key=${key}`);
    } catch (err: any) {
      this.logger.error(`R2 upload FAILED — key=${key}: ${err?.message}`, err?.stack);
      throw new InternalServerErrorException(`Upload zum Cloudflare-Speicher fehlgeschlagen: ${err?.message || 'unbekannter Fehler'}`);
    }

    try {
      const doc = await this.prisma.purchaseDocument.create({
        data: {
          orgId,
          purchaseOrderId,
          fileName: cleanName,
          fileUrl: url,
          storageKey: key,
          fileSize: BigInt(file.size),
          mimeType: mime,
          documentType,
          uploadedById: userId,
        },
      });

      this.audit.log(orgId, userId, 'document', doc.id, 'upload', {
        fileName: doc.fileName,
        type: documentType,
        size: file.size,
      }, purchaseOrderId || undefined).catch(() => {});

      return {
        ...doc,
        fileSize: doc.fileSize ? Number(doc.fileSize) : null,
      };
    } catch (err: any) {
      this.logger.error(`DB insert failed after upload — key=${key}: ${err?.message}`, err?.stack);
      // Best-effort rollback: delete the just-uploaded file from R2
      this.storage.delete(key).catch(() => {});
      throw new InternalServerErrorException(`Datenbank konnte Dokument nicht speichern: ${err?.message}`);
    }
  }

  async list(orgId: string, purchaseOrderId: string) {
    const docs = await this.prisma.purchaseDocument.findMany({
      where: { orgId, purchaseOrderId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    return docs.map((d) => ({ ...d, fileSize: d.fileSize ? Number(d.fileSize) : null }));
  }

  async remove(orgId: string, userId: string, docId: string) {
    const existing = await this.prisma.purchaseDocument.findFirst({ where: { id: docId, orgId } });
    if (!existing) throw new NotFoundException('Dokument nicht gefunden');
    try {
      await this.storage.delete(existing.storageKey);
    } catch (err: any) {
      this.logger.warn(`R2 delete failed (continuing) — key=${existing.storageKey}: ${err?.message}`);
    }
    await this.prisma.purchaseDocument.delete({ where: { id: docId } });
    this.audit.log(orgId, userId, 'document', docId, 'delete', {
      fileName: existing.fileName,
    }, existing.purchaseOrderId || undefined).catch(() => {});
    return { deleted: true };
  }
}
