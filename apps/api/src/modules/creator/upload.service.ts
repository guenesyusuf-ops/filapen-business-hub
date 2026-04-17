import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  async list(orgId: string, params: ListUploadsParams) {
    const where: any = {
      orgId,
      creatorId: params.creatorId,
      // Do NOT filter __folder__ entries here — the Creator Portal
      // needs them to build its folder structure.
    };
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

    // =========================================================================
    // AUTOMATION: When a creator uploads an invoice (tab='rechnungen'),
    // auto-create a task in the "Rechnungen" WM project.
    // =========================================================================
    if (data.tab === 'rechnungen') {
      try {
        await this.autoCreateInvoiceTask(orgId, creator.name, upload.id);
      } catch (err) {
        this.logger.warn('Auto-create invoice task failed:', err);
        // Don't fail the upload if the task creation fails
      }
    }

    return this.serialize(upload);
  }

  async delete(orgId: string, uploadId: string) {
    const existing = await this.prisma.creatorUpload.findFirst({
      where: { id: uploadId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Upload not found');
    }

    // Delete file from R2 storage if storageKey exists
    if (existing.storageKey && this.storageService) {
      try {
        await this.storageService.delete(existing.storageKey);
        this.logger.log(`Deleted R2 file: ${existing.storageKey}`);
      } catch (err) {
        this.logger.warn(`Failed to delete R2 file ${existing.storageKey}:`, err);
      }
    }

    await this.prisma.creatorUpload.delete({ where: { id: uploadId } });
    return { success: true };
  }

  async deleteBatch(orgId: string, batch: string) {
    // Find all uploads in this batch
    const uploads = await this.prisma.creatorUpload.findMany({
      where: { orgId, batch },
    });

    // Delete files from R2
    if (this.storageService) {
      for (const u of uploads) {
        if (u.storageKey) {
          try {
            await this.storageService.delete(u.storageKey);
          } catch (err) {
            this.logger.warn(`Failed to delete R2 file ${u.storageKey}:`, err);
          }
        }
      }
    }

    // Delete all DB records
    const result = await this.prisma.creatorUpload.deleteMany({
      where: { orgId, batch },
    });

    this.logger.log(`Deleted batch "${batch}": ${result.count} uploads`);
    return { success: true, deleted: result.count };
  }

  async markSeen(orgId: string, creatorId: string) {
    await this.prisma.creatorUpload.updateMany({
      where: { orgId, creatorId, seenByAdmin: false },
      data: { seenByAdmin: true },
    });
    return { success: true };
  }

  async recentForAdmin(orgId: string, limit: number) {
    const uploads = await this.prisma.creatorUpload.findMany({
      where: {
        orgId,
        NOT: { fileName: { startsWith: '__folder__' } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    const unseenCount = await this.prisma.creatorUpload.count({
      where: {
        orgId,
        seenByAdmin: false,
        NOT: { fileName: { startsWith: '__folder__' } },
      },
    });

    return {
      items: uploads.map((u) => ({
        id: u.id,
        creatorId: u.creatorId,
        creatorName: (u as any).creator?.name || 'Unbekannt',
        fileName: u.fileName,
        label: u.label,
        batch: u.batch,
        fileType: u.fileType,
        createdAt: u.createdAt.toISOString(),
        seen: u.seenByAdmin,
      })),
      unseenCount,
    };
  }

  async markSingleSeen(orgId: string, id: string) {
    await this.prisma.creatorUpload.update({
      where: { id },
      data: { seenByAdmin: true },
    });
    return { success: true };
  }

  async markBatchSeen(orgId: string, batch: string) {
    await this.prisma.creatorUpload.updateMany({
      where: { orgId, batch, seenByAdmin: false },
      data: { seenByAdmin: true },
    });
    return { success: true };
  }

  async markAllSeen(orgId: string) {
    await this.prisma.creatorUpload.updateMany({
      where: { orgId, seenByAdmin: false },
      data: { seenByAdmin: true },
    });
    return { success: true };
  }

  async listAll(orgId: string, params: { tab?: string; batch?: string; creatorId?: string; page?: number; pageSize?: number }) {
    const { tab, batch, creatorId, page = 1, pageSize = 25 } = params;
    const where: any = {
      orgId,
      NOT: { fileName: { startsWith: '__folder__' } },
    };
    if (tab) where.tab = tab;
    if (creatorId) where.creatorId = creatorId;
    if (batch !== undefined) {
      if (batch === '__none__') {
        where.OR = [{ batch: null }, { batch: '' }];
      } else {
        where.batch = batch;
      }
    }

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

  async listFolders(orgId: string, params: { creatorId?: string; tab?: string }) {
    const { creatorId, tab } = params;

    // Fetch ALL uploads (no tab filter on query level) so we can group by batch
    // and then filter folders by whether they contain files of the requested tab.
    const where: any = { orgId };
    if (creatorId) where.creatorId = creatorId;

    const uploads = await this.prisma.creatorUpload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      },
    });

    // Group by batch — __folder__ entries create the folder, real files count as fileCount
    // Only count files that match the requested tab (if any)
    const folderMap = new Map<string, {
      batch: string;
      name: string;
      createdAt: string;
      fileCount: number;
      previewUrl: string | null;
      creatorName: string | null;
      creatorId: string | null;
      unseenCount: number;
    }>();

    for (const u of uploads) {
      const batchKey = u.batch || '__none__';
      const isMetadata = u.fileName?.startsWith('__folder__');
      const matchesTab = !tab || u.tab === tab;

      // Skip non-metadata files that don't match the tab filter
      if (!isMetadata && !matchesTab) continue;

      let folderName = u.batch || 'Unsortiert';
      if (isMetadata && u.label) {
        try {
          const meta = JSON.parse(u.label);
          if (meta.name) folderName = meta.name;
        } catch { /* label is not JSON, use batch name */ }
      }

      const existing = folderMap.get(batchKey);

      if (!existing) {
        folderMap.set(batchKey, {
          batch: batchKey,
          name: folderName,
          createdAt: u.createdAt.toISOString(),
          fileCount: isMetadata ? 0 : 1,
          previewUrl: (!isMetadata && (u.fileType === 'image' || u.fileType === 'video')) ? u.fileUrl : null,
          creatorName: (u as any).creator?.name || null,
          creatorId: u.creatorId,
          unseenCount: (isMetadata || u.seenByAdmin) ? 0 : 1,
        });
      } else {
        if (isMetadata && existing.name === existing.batch) {
          try {
            const meta = JSON.parse(u.label || '');
            if (meta.name) existing.name = meta.name;
          } catch { /* ignore */ }
        }
        if (!isMetadata) {
          existing.fileCount += 1;
          if (!existing.previewUrl && (u.fileType === 'image' || u.fileType === 'video')) {
            existing.previewUrl = u.fileUrl;
          }
          if (!u.seenByAdmin) {
            existing.unseenCount += 1;
          }
        }
        if (u.createdAt.toISOString() < existing.createdAt) {
          existing.createdAt = u.createdAt.toISOString();
        }
      }
    }

    // When filtering by tab, only show folders that have real files of that type
    // (folders with 0 matching files are hidden)
    const entries = Array.from(folderMap.values())
      .filter((f) => !tab || f.fileCount > 0);

    // Sort folders: newest first, but 'Unsortiert' always last
    const folders = entries.sort((a, b) => {
      if (a.batch === '__none__') return 1;
      if (b.batch === '__none__') return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    // Count real uploads per tab (for badge counts)
    const tabCounts: Record<string, number> = { bilder: 0, videos: 0, roh: 0, auswertung: 0 };
    for (const u of uploads) {
      if (u.fileName?.startsWith('__folder__')) continue;
      if (u.tab && tabCounts[u.tab] !== undefined) {
        tabCounts[u.tab] += 1;
      }
    }

    return { folders, tabCounts, total: uploads.filter((u) => !u.fileName?.startsWith('__folder__')).length };
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
        liveStatus: 'offline',
      },
      include: {
        _count: { select: { comments: true } },
        creator: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      },
    });

    // Create notification for the creator
    try {
      const label = existing.label || existing.fileName;
      const nowStr = new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      await this.prisma.creatorNotification.create({
        data: {
          orgId,
          creatorId: existing.creatorId,
          type: 'content_offline',
          title: 'Content offline',
          message: `Dein Content "${label}" ist offline ${nowStr}. Deine Auswertung folgt.`,
          metadata: {
            uploadId,
            label,
          },
        },
      });
    } catch (err) {
      this.logger.warn('Failed to create offline notification', err);
    }

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

  /**
   * Auto-creates a task in the "Rechnungen" project when a creator uploads an invoice.
   * Assignees: Mazlum + Yavuz. Due: 5 business days. Column: To Do.
   */
  private async autoCreateInvoiceTask(orgId: string, creatorName: string, uploadId: string) {
    // Find the Rechnungen project
    const project = await this.prisma.wmProject.findFirst({
      where: { orgId, name: { contains: 'Rechnungen', mode: 'insensitive' } },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!project) {
      this.logger.warn('Rechnungen project not found — skipping auto-task');
      return;
    }

    // Find the "To Do" column (first column)
    const todoColumn = project.columns[0];
    if (!todoColumn) return;

    // Find Mazlum and Yavuz
    const assignees = await this.prisma.user.findMany({
      where: {
        orgId,
        OR: [
          { name: { contains: 'Mazlum', mode: 'insensitive' } },
          { name: { contains: 'Yavuz', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    // Calculate 5 business days from now
    const dueDate = new Date();
    let addedDays = 0;
    while (addedDays < 5) {
      dueDate.setDate(dueDate.getDate() + 1);
      const day = dueDate.getDay();
      if (day !== 0 && day !== 6) addedDays++; // skip weekends
    }

    // Create the task
    const task = await this.prisma.wmTask.create({
      data: {
        orgId,
        projectId: project.id,
        columnId: todoColumn.id,
        title: `${creatorName} Rechnung`,
        description: `Automatisch erstellt nach Rechnungs-Upload (Upload-ID: ${uploadId})`,
        priority: 'medium',
        assigneeId: assignees[0]?.id || null,
        createdById: assignees[0]?.id || orgId,
        dueDate,
        position: 0,
      },
    });

    // Assign both Mazlum and Yavuz
    if (assignees.length > 0) {
      await this.prisma.wmTaskAssignee.createMany({
        data: assignees.map((u) => ({ taskId: task.id, userId: u.id })),
        skipDuplicates: true,
      });
    }

    // Notify assignees
    for (const u of assignees) {
      try {
        await this.prisma.wmNotification.create({
          data: {
            userId: u.id,
            type: 'assignment',
            title: 'Neue Rechnung eingegangen',
            message: `${creatorName} hat eine Rechnung hochgeladen. Bitte innerhalb von 5 Werktagen bearbeiten.`,
            taskId: task.id,
            projectId: project.id,
          },
        });
      } catch { /* ignore */ }
    }

    this.logger.log(`Auto-created invoice task "${task.title}" for ${assignees.length} assignees`);
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
