import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { InvoiceOcrService } from './invoice-ocr.service';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class InvoiceUploadService {
  private readonly logger = new Logger(InvoiceUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: InvoiceOcrService,
  ) {}

  /**
   * Nimmt eine hochgeladene Datei entgegen, legt sie in R2 ab und erzeugt
   * den Invoice-Record mit Status "pending". OCR laeuft im Hintergrund —
   * der Aufrufer bekommt sofort die Invoice-ID zurueck und kann pollen.
   */
  async upload(
    orgId: string,
    userId: string,
    file: UploadedFile,
  ): Promise<{ id: string; ocrStatus: string; possibleDuplicates: any[] }> {
    if (!file?.buffer?.length) throw new BadRequestException('Datei fehlt');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`Datei zu gross (max ${MAX_BYTES / 1024 / 1024} MB)`);
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException(`Dateityp ${mime} nicht unterstuetzt. Erlaubt: PDF, JPG, PNG.`);
    }

    // R2-Key: invoices/{orgId}/{YYYY}/{MM}/{uuid-prefix}-{original}
    const safeName = (file.originalname || 'invoice.pdf')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 10);
    const key = `invoices/${orgId}/${yyyy}/${mm}/${rnd}-${safeName}`;

    let storageUrl: string;
    try {
      storageUrl = await this.storage.upload(key, file.buffer, mime);
    } catch (err: any) {
      this.logger.error(`R2 upload failed: ${err?.message}`);
      throw new BadRequestException('Datei-Upload fehlgeschlagen');
    }

    // Invoice-Record anlegen
    const inv = await this.prisma.invoice.create({
      data: {
        orgId,
        uploadedById: userId,
        fileName: safeName,
        fileMime: mime,
        fileSize: file.size,
        storagePath: key,
        storageUrl,
        ocrStatus: 'pending',
        status: 'open',
      },
    });
    await this.prisma.invoiceEvent.create({
      data: {
        orgId,
        invoiceId: inv.id,
        actorId: userId,
        type: 'uploaded',
        note: `Hochgeladen: ${safeName} (${(file.size / 1024).toFixed(1)} KB)`,
        metadata: { mime, size: file.size },
      },
    });

    // OCR im Hintergrund — wir warten NICHT auf das Ergebnis. Der Client
    // pollt /invoices/{id} bis ocrStatus !== 'pending'/'processing'.
    setImmediate(() => {
      this.ocr.processInvoice(inv.id, file)
        .then(() => this.runDuplicateCheck(orgId, inv.id))
        .catch((err) => this.logger.error(`background OCR error: ${err?.message}`));
    });

    return { id: inv.id, ocrStatus: 'pending', possibleDuplicates: [] };
  }

  /**
   * Nach erfolgreicher OCR: suche nach Dubletten und speichere sie als
   * Metadata-Hint auf einem Event, damit das Frontend sie anzeigen kann.
   */
  private async runDuplicateCheck(orgId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      select: { invoiceNumber: true, supplierName: true, grossAmount: true },
    });
    if (!inv) return;
    const dupes = await this.ocr.findDuplicates(orgId, {
      invoiceNumber: inv.invoiceNumber,
      supplierName: inv.supplierName,
      grossAmount: inv.grossAmount ? Number(inv.grossAmount) : null,
      excludeId: invoiceId,
    });
    if (dupes.length > 0) {
      await this.prisma.invoiceEvent.create({
        data: {
          orgId,
          invoiceId,
          type: 'duplicate_warning',
          note: `${dupes.length} mögliche Dublette(n) gefunden`,
          metadata: { duplicates: dupes },
        },
      });
    }
  }
}
