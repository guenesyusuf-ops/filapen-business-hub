import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateBriefingDto {
  title: string;
  productId?: string;
  notes?: string;
  dealId?: string;
  content?: string;
  guidelines?: any;
  references?: string[];
  status?: string;
}

export interface UpdateBriefingDto extends Partial<CreateBriefingDto> {}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** List all briefings for an org, with product info + attachment count */
  async list(orgId: string) {
    const briefings = await this.prisma.briefing.findMany({
      where: { orgId },
      include: {
        product: {
          select: { id: true, title: true, imageUrl: true },
        },
        _count: {
          select: { attachments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return briefings.map((b) => ({
      ...this.serialize(b),
      product: b.product ?? null,
      attachmentCount: b._count.attachments,
    }));
  }

  /** List briefings for a deal (legacy support) */
  async listByDeal(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
    });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const briefings = await this.prisma.briefing.findMany({
      where: { orgId, dealId },
      orderBy: { createdAt: 'desc' },
    });

    return briefings.map(this.serialize);
  }

  /** Get a single briefing with all attachments */
  async getById(orgId: string, briefingId: string) {
    const briefing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
      include: {
        product: {
          select: { id: true, title: true, imageUrl: true },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
    });

    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }

    return {
      ...this.serialize(briefing),
      product: briefing.product ?? null,
      deal: briefing.deal ?? null,
      attachments: briefing.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        storageKey: a.storageKey,
        fileSize: a.fileSize,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /** List all briefings visible to a creator (all briefings in the org) */
  async listForCreator(orgId: string) {
    const briefings = await this.prisma.briefing.findMany({
      where: { orgId },
      include: {
        product: {
          select: { id: true, title: true, imageUrl: true },
        },
        _count: {
          select: { attachments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return briefings.map((b) => ({
      ...this.serialize(b),
      product: b.product ?? null,
      attachmentCount: b._count.attachments,
    }));
  }

  async create(orgId: string, data: CreateBriefingDto) {
    const briefing = await this.prisma.briefing.create({
      data: {
        orgId,
        title: data.title,
        productId: data.productId || null,
        notes: data.notes || null,
        dealId: data.dealId || null,
        content: data.content || null,
        guidelines: data.guidelines || {},
        references: data.references || [],
        status: (data.status as any) || 'draft',
      },
    });

    return this.serialize(briefing);
  }

  async update(orgId: string, briefingId: string, data: UpdateBriefingDto) {
    const existing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Briefing not found');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.productId !== undefined) updateData.productId = data.productId || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.content !== undefined) updateData.content = data.content || null;
    if (data.guidelines !== undefined) updateData.guidelines = data.guidelines;
    if (data.references !== undefined) updateData.references = data.references;
    if (data.status !== undefined) updateData.status = data.status as any;

    const briefing = await this.prisma.briefing.update({
      where: { id: briefingId },
      data: updateData,
    });

    return this.serialize(briefing);
  }

  /** Delete briefing + all attachments from R2 */
  async delete(orgId: string, briefingId: string) {
    const existing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
      include: { attachments: true },
    });
    if (!existing) {
      throw new NotFoundException('Briefing not found');
    }

    // Delete files from R2
    for (const att of existing.attachments) {
      if (att.storageKey) {
        try {
          await this.storage.delete(att.storageKey);
        } catch (err) {
          this.logger.warn(`Failed to delete R2 key: ${att.storageKey}`, err);
        }
      }
    }

    await this.prisma.briefing.delete({ where: { id: briefingId } });
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Attachments
  // -----------------------------------------------------------------------

  async addAttachment(
    orgId: string,
    briefingId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    const briefing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
    });
    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `briefing-attachments/${briefingId}/${timestamp}-${safeName}`;

    const fileUrl = await this.storage.upload(key, file.buffer, file.mimetype);

    // Determine file type category
    let fileType = 'sonstige';
    const mime = file.mimetype.toLowerCase();
    if (mime === 'application/pdf') fileType = 'pdf';
    else if (mime.startsWith('image/')) fileType = 'image';
    else if (mime.startsWith('video/')) fileType = 'video';

    const attachment = await this.prisma.briefingAttachment.create({
      data: {
        orgId,
        briefingId,
        fileName: file.originalname,
        fileUrl,
        fileType,
        storageKey: key,
        fileSize: file.size,
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType,
      storageKey: attachment.storageKey,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  async deleteAttachment(orgId: string, briefingId: string, attachmentId: string) {
    const attachment = await this.prisma.briefingAttachment.findFirst({
      where: { id: attachmentId, briefingId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.storageKey) {
      try {
        await this.storage.delete(attachment.storageKey);
      } catch (err) {
        this.logger.warn(`Failed to delete R2 key: ${attachment.storageKey}`, err);
      }
    }

    await this.prisma.briefingAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private serialize(briefing: any) {
    return {
      id: briefing.id,
      orgId: briefing.orgId,
      dealId: briefing.dealId,
      productId: briefing.productId,
      title: briefing.title,
      content: briefing.content,
      notes: briefing.notes,
      guidelines: briefing.guidelines,
      references: briefing.references,
      status: briefing.status,
      createdAt: briefing.createdAt.toISOString(),
      updatedAt: briefing.updatedAt.toISOString(),
    };
  }
}
