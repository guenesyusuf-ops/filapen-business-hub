import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateUploadDto {
  creatorId: string;
  fileName: string;
  fileUrl: string;
  fileType: string; // image, video, file, link
  mimeType?: string;
  fileSize?: number;
  tab: string; // bilder, videos, roh, auswertung
  category?: string;
  product?: string;
  label?: string;
  batch?: string;
  storageKey?: string;
}

export interface ListUploadsParams {
  creatorId: string;
  tab?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListUploadsParams) {
    const where: any = { orgId, creatorId: params.creatorId };
    if (params.tab) {
      where.tab = params.tab;
    }

    const uploads = await this.prisma.creatorUpload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { comments: true } },
      },
    });

    return uploads.map((u) => this.serialize(u));
  }

  async create(orgId: string, data: CreateUploadDto) {
    // Verify creator belongs to org
    const creator = await this.prisma.creator.findFirst({
      where: { id: data.creatorId, orgId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const upload = await this.prisma.creatorUpload.create({
      data: {
        orgId,
        creatorId: data.creatorId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        mimeType: data.mimeType || null,
        fileSize: data.fileSize != null ? BigInt(data.fileSize) : null,
        tab: data.tab,
        category: data.category || null,
        product: data.product || null,
        label: data.label || null,
        batch: data.batch || null,
        storageKey: data.storageKey || null,
      },
    });

    return this.serialize(upload);
  }

  async delete(orgId: string, uploadId: string) {
    const existing = await this.prisma.creatorUpload.findFirst({
      where: { id: uploadId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Upload not found');
    }

    await this.prisma.creatorUpload.delete({ where: { id: uploadId } });
    return { success: true };
  }

  async markSeen(orgId: string, creatorId: string) {
    await this.prisma.creatorUpload.updateMany({
      where: { orgId, creatorId, seenByAdmin: false },
      data: { seenByAdmin: true },
    });
    return { success: true };
  }

  async listAll(orgId: string, params: { tab?: string; page?: number; pageSize?: number }) {
    const { tab, page = 1, pageSize = 25 } = params;
    const where: any = { orgId };
    if (tab) where.tab = tab;

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.creatorUpload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.creatorUpload.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...this.serialize(u),
        creator: (u as any).creator,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async unseenCount(orgId: string) {
    const count = await this.prisma.creatorUpload.count({
      where: { orgId, seenByAdmin: false },
    });
    return { count };
  }

  async goLive(orgId: string, uploadId: string, liveDate: string, notifyCreator = true) {
    const existing = await this.prisma.creatorUpload.findFirst({
      where: { id: uploadId, orgId },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Upload not found');
    }

    const updated = await this.prisma.creatorUpload.update({
      where: { id: uploadId },
      data: {
        liveStatus: 'live',
        liveDate: new Date(liveDate),
        liveApprovedAt: new Date(),
      },
      include: {
        _count: { select: { comments: true } },
        creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      },
    });

    // Create notification for the creator if requested
    if (notifyCreator) {
      try {
        const dateStr = new Date(liveDate).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const label = existing.label || existing.fileName;
        await this.prisma.creatorNotification.create({
          data: {
            orgId,
            creatorId: existing.creatorId,
            type: 'content_live',
            title: 'Content geht online',
            message: `Dein Content "${label}" geht am ${dateStr} Online`,
            metadata: {
              uploadId,
              liveDate,
              label,
            },
          },
        });
      } catch (err) {
        this.logger.warn('Failed to create live notification', err);
      }
    }

    return {
      ...this.serialize(updated),
      creator: (updated as any).creator,
    };
  }

  async goOffline(orgId: string, uploadId: string) {
    const existing = await this.prisma.creatorUpload.findFirst({
      where: { id: uploadId, orgId },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Upload not found');
    }

    const updated = await this.prisma.creatorUpload.update({
      where: { id: uploadId },
      data: {
        liveStatus: 'inactive',
      },
      include: {
        _count: { select: { comments: true } },
        creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      },
    });

    return {
      ...this.serialize(updated),
      creator: (updated as any).creator,
    };
  }

  async listLive(orgId: string) {
    const uploads = await this.prisma.creatorUpload.findMany({
      where: { orgId, liveStatus: 'live' },
      orderBy: { liveDate: 'asc' },
      include: {
        creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    return uploads.map((u) => ({
      ...this.serialize(u),
      creator: (u as any).creator,
    }));
  }

  private serialize(upload: any) {
    return {
      id: upload.id,
      orgId: upload.orgId,
      creatorId: upload.creatorId,
      fileName: upload.fileName,
      fileUrl: upload.fileUrl,
      fileType: upload.fileType,
      mimeType: upload.mimeType,
      fileSize: upload.fileSize != null ? Number(upload.fileSize) : null,
      tab: upload.tab,
      category: upload.category,
      product: upload.product,
      label: upload.label,
      batch: upload.batch,
      storageKey: upload.storageKey,
      seenByAdmin: upload.seenByAdmin,
      liveStatus: upload.liveStatus || null,
      liveDate: upload.liveDate ? upload.liveDate.toISOString() : null,
      liveApprovedAt: upload.liveApprovedAt ? upload.liveApprovedAt.toISOString() : null,
      liveApprovedBy: upload.liveApprovedBy || null,
      commentCount: upload._count?.comments ?? 0,
      createdAt: upload.createdAt.toISOString(),
    };
  }
}
