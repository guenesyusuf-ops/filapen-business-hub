import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { ReturnService } from './return.service';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB pro Bild
const MAX_IMAGES_PER_RETURN = 10;

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class ReturnImageService {
  private readonly logger = new Logger(ReturnImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly returns: ReturnService,
  ) {}

  async upload(orgId: string, returnId: string, userId: string, files: UploadedFile[]) {
    const ret = await this.prisma.return.findFirst({
      where: { id: returnId, orgId },
      select: { id: true, _count: { select: { images: true } } },
    });
    if (!ret) throw new NotFoundException('Retoure nicht gefunden');

    const existing = ret._count.images;
    if (existing + files.length > MAX_IMAGES_PER_RETURN) {
      throw new BadRequestException(
        `Maximal ${MAX_IMAGES_PER_RETURN} Bilder pro Retoure. Aktuell ${existing}, neue ${files.length}.`,
      );
    }

    const uploaded: any[] = [];
    for (const file of files) {
      if (!file?.buffer?.length) continue;
      const mime = (file.mimetype || '').toLowerCase();
      if (!ALLOWED_MIMES.has(mime)) {
        throw new BadRequestException(`Dateityp ${mime} nicht unterstuetzt. Erlaubt: JPG, PNG, HEIC, WebP.`);
      }
      if (file.size > MAX_BYTES) {
        throw new BadRequestException(`Datei zu gross (max ${MAX_BYTES / 1024 / 1024} MB)`);
      }

      const safeName = (file.originalname || 'photo.jpg')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 60);
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const rnd = Math.random().toString(36).slice(2, 10);
      const key = `returns/${orgId}/${yyyy}/${mm}/${returnId}/${rnd}-${safeName}`;

      let storageUrl: string;
      try {
        storageUrl = await this.storage.upload(key, file.buffer, mime);
      } catch (err: any) {
        this.logger.error(`R2 upload failed: ${err?.message}`);
        throw new BadRequestException('Bild-Upload fehlgeschlagen');
      }

      const img = await this.prisma.returnImage.create({
        data: {
          returnId,
          uploadedById: userId,
          fileName: safeName,
          fileMime: mime,
          fileSize: file.size,
          storagePath: key,
          storageUrl,
        },
      });
      uploaded.push(img);
    }

    await this.returns.recordEvent(
      orgId, returnId, userId,
      'image_added',
      `${uploaded.length} Bild${uploaded.length === 1 ? '' : 'er'} hochgeladen`,
      { count: uploaded.length },
    );

    return { uploaded: uploaded.length };
  }

  async remove(orgId: string, returnId: string, imageId: string, userId: string) {
    const img = await this.prisma.returnImage.findFirst({
      where: { id: imageId, returnId, return: { orgId } },
    });
    if (!img) throw new NotFoundException('Bild nicht gefunden');

    try {
      await this.storage.delete(img.storagePath);
    } catch (err: any) {
      this.logger.warn(`R2 delete failed (continuing): ${err?.message}`);
    }
    await this.prisma.returnImage.delete({ where: { id: imageId } });
    await this.returns.recordEvent(orgId, returnId, userId, 'image_removed', `Bild entfernt: ${img.fileName}`, null);
    return { removed: true };
  }
}
