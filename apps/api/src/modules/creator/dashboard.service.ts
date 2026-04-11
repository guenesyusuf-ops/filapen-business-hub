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
  async getStats(orgId: string) {
    const [creatorCount, productCount, projectCount, uploadCount, creatorsWithUploads] =
      await Promise.all([
        this.prisma.creator.count({ where: { orgId } }),
        this.prisma.product.count({ where: { orgId } }),
        this.prisma.creatorProject.count({ where: { orgId } }),
        this.prisma.creatorUpload.count({ where: { orgId } }),
        this.prisma.creatorUpload.findMany({
          where: { orgId },
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
      where: { orgId },
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
    const uploads = await this.prisma.creatorUpload.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            lastLogin: true,
            status: true,
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
      }
    >();

    for (const u of uploads) {
      if (!u.creator) continue;
      const existing = byCreator.get(u.creatorId);
      if (!existing) {
        byCreator.set(u.creatorId, {
          creatorId: u.creatorId,
          name: u.creator.name,
          avatarUrl: u.creator.avatarUrl,
          status: (u.creator.status as unknown as string) || 'offline',
          lastLogin: u.creator.lastLogin ? u.creator.lastLogin.toISOString() : null,
          uploadCount: 1,
          latestUploadAt: u.createdAt.toISOString(),
          product: u.product,
          batch: u.batch,
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
      where: { orgId },
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
