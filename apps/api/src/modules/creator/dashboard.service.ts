import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DashboardService
// Powers the Creator Hub overview dashboard (/creators page).
// ---------------------------------------------------------------------------

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Top KPI numbers for the "Content in Zahlen" panel.
   */
  /** Exclude soft-deleted (churned) creators from all dashboard queries */
  private readonly activeFilter = { status: { not: 'churned' as const } };

  async getStats(orgId: string) {
    const [creatorCount, productCount, projectCount, uploadCount, creatorsWithUploads] =
      await Promise.all([
        this.prisma.creator.count({ where: { orgId, ...this.activeFilter } }),
        this.prisma.product.count({ where: { orgId } }),
        this.prisma.creatorProject.count({ where: { orgId } }),
        this.prisma.creatorUpload.count({
          where: { orgId, creator: this.activeFilter },
        }),
        this.prisma.creatorUpload.findMany({
          where: { orgId, creator: this.activeFilter },
          distinct: ['creatorId'],
          select: { creatorId: true },
        }),
      ]);

    const creatorsWithUploadsCount = creatorsWithUploads.length;
    const creatorsWithoutUploads = Math.max(0, creatorCount - creatorsWithUploadsCount);

    return {
      creatorCount,
      productCount,
      projectCount,
      uploadCount,
      creatorsWithoutUploads,
      totalCreators: creatorCount,
    };
  }

  /**
   * List creators that have NOT uploaded anything yet.
   * Used by the upload-card modal.
   */
  async listCreatorsWithoutUploads(orgId: string) {
    const creatorsWithUploads = await this.prisma.creatorUpload.findMany({
      where: { orgId },
      distinct: ['creatorId'],
      select: { creatorId: true },
    });
    const uploadedIds = new Set(creatorsWithUploads.map((c) => c.creatorId));

    const allCreators = await this.prisma.creator.findMany({
      where: { orgId, ...this.activeFilter },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        niche: true,
        avatarUrl: true,
        platform: true,
        createdAt: true,
      },
    });

    return allCreators
      .filter((c) => !uploadedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        niche: c.niche,
        avatarUrl: c.avatarUrl,
        platform: c.platform,
        createdAt: c.createdAt.toISOString(),
      }));
  }

  /**
   * List creators WITH at least one upload, sorted by newest upload desc.
   * Returns analytics-table rows. One row per creator.
   */
  async listCreatorsWithUploads(orgId: string) {
    // Only show creators that have uploads which were NEVER processed
    // (liveStatus is null = fresh upload, not yet reviewed).
    // Once an upload goes "live" or "offline" it counts as handled.
    // Creator reappears only when they upload NEW content (liveStatus=null).
    const uploads = await this.prisma.creatorUpload.findMany({
      where: {
        orgId,
        NOT: { fileName: { startsWith: '__folder__' } },
        liveStatus: null,
        creator: this.activeFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            lastLogin: true,
            status: true,
            compensation: true,
            provision: true,
            fixAmount: true,
          },
        },
      },
    });

    // Group by creatorId, keeping the newest upload as the row representative
    const byCreator = new Map<
      string,
      {
        creatorId: string;
        name: string;
        avatarUrl: string | null;
        status: string;
        lastLogin: string | null;
        uploadCount: number;
        latestUploadAt: string;
        product: string | null;
        batch: string | null;
        compensation: string | null;
        provision: string | null;
        fixAmount: number | null;
      }
    >();

    for (const u of uploads) {
      if (!u.creator) continue;
      const existing = byCreator.get(u.creatorId);
      if (!existing) {
        const creator = u.creator as any;
        byCreator.set(u.creatorId, {
          creatorId: u.creatorId,
          name: creator.name,
          avatarUrl: creator.avatarUrl,
          status: (creator.status as unknown as string) || 'offline',
          lastLogin: creator.lastLogin ? creator.lastLogin.toISOString() : null,
          uploadCount: 1,
          latestUploadAt: u.createdAt.toISOString(),
          product: u.product,
          batch: u.batch,
          compensation: creator.compensation || null,
          provision: creator.provision || null,
          fixAmount: creator.fixAmount != null ? Number(creator.fixAmount) : null,
        });
      } else {
        existing.uploadCount += 1;
      }
    }

    // Already in desc order because uploads were iterated from newest first.
    return Array.from(byCreator.values());
  }

  /**
   * Top 5 newest creators (right sidebar "Neueste Creator").
   */
  async listRecentCreators(orgId: string, limit = 5) {
    const creators = await this.prisma.creator.findMany({
      where: { orgId, ...this.activeFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        niche: true,
        platform: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return creators.map((c) => ({
      id: c.id,
      name: c.name,
      niche: c.niche,
      platform: c.platform,
      avatarUrl: c.avatarUrl,
      createdAt: c.createdAt.toISOString(),
    }));
  }
}
