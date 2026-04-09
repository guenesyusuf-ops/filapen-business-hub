import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateWatchlistDto {
  name: string;
  description?: string;
}

export interface UpdateWatchlistDto {
  name?: string;
  description?: string;
}

export interface AddWatchlistItemDto {
  influencerProfileId: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const watchlists = await this.prisma.watchlist.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    return watchlists.map((wl) => ({
      id: wl.id,
      orgId: wl.orgId,
      name: wl.name,
      description: wl.description,
      itemCount: wl._count.items,
      createdAt: wl.createdAt.toISOString(),
      updatedAt: wl.updatedAt.toISOString(),
    }));
  }

  async getById(orgId: string, id: string) {
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            influencerProfile: true,
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    return {
      id: watchlist.id,
      orgId: watchlist.orgId,
      name: watchlist.name,
      description: watchlist.description,
      createdAt: watchlist.createdAt.toISOString(),
      updatedAt: watchlist.updatedAt.toISOString(),
      items: watchlist.items.map((item) => ({
        id: item.id,
        notes: item.notes,
        addedAt: item.addedAt.toISOString(),
        influencer: {
          id: item.influencerProfile.id,
          platform: item.influencerProfile.platform,
          handle: item.influencerProfile.handle,
          displayName: item.influencerProfile.displayName,
          avatarUrl: item.influencerProfile.avatarUrl,
          followerCount: item.influencerProfile.followerCount,
          engagementRate: Number(item.influencerProfile.engagementRate),
          niche: item.influencerProfile.niche,
          score: item.influencerProfile.score,
          isVerified: item.influencerProfile.isVerified,
        },
      })),
    };
  }

  async create(orgId: string, data: CreateWatchlistDto) {
    const watchlist = await this.prisma.watchlist.create({
      data: {
        orgId,
        name: data.name,
        description: data.description || null,
      },
    });

    return {
      id: watchlist.id,
      orgId: watchlist.orgId,
      name: watchlist.name,
      description: watchlist.description,
      itemCount: 0,
      createdAt: watchlist.createdAt.toISOString(),
      updatedAt: watchlist.updatedAt.toISOString(),
    };
  }

  async update(orgId: string, id: string, data: UpdateWatchlistDto) {
    const existing = await this.prisma.watchlist.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Watchlist not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;

    const watchlist = await this.prisma.watchlist.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { items: true } } },
    });

    return {
      id: watchlist.id,
      orgId: watchlist.orgId,
      name: watchlist.name,
      description: watchlist.description,
      itemCount: watchlist._count.items,
      createdAt: watchlist.createdAt.toISOString(),
      updatedAt: watchlist.updatedAt.toISOString(),
    };
  }

  async delete(orgId: string, id: string) {
    const existing = await this.prisma.watchlist.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Watchlist not found');
    }

    await this.prisma.watchlist.delete({ where: { id } });
    return { success: true };
  }

  async addItem(orgId: string, watchlistId: string, data: AddWatchlistItemDto) {
    // Verify watchlist belongs to org
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, orgId },
    });
    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    // Verify influencer belongs to org
    const influencer = await this.prisma.influencerProfile.findFirst({
      where: { id: data.influencerProfileId, orgId },
    });
    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    // Check for duplicate
    const existing = await this.prisma.watchlistItem.findFirst({
      where: {
        watchlistId,
        influencerProfileId: data.influencerProfileId,
      },
    });
    if (existing) {
      throw new ConflictException('Influencer already in this watchlist');
    }

    const item = await this.prisma.watchlistItem.create({
      data: {
        watchlistId,
        influencerProfileId: data.influencerProfileId,
        notes: data.notes || null,
      },
      include: {
        influencerProfile: true,
      },
    });

    return {
      id: item.id,
      notes: item.notes,
      addedAt: item.addedAt.toISOString(),
      influencer: {
        id: item.influencerProfile.id,
        platform: item.influencerProfile.platform,
        handle: item.influencerProfile.handle,
        displayName: item.influencerProfile.displayName,
        avatarUrl: item.influencerProfile.avatarUrl,
        followerCount: item.influencerProfile.followerCount,
        engagementRate: Number(item.influencerProfile.engagementRate),
        niche: item.influencerProfile.niche,
        score: item.influencerProfile.score,
      },
    };
  }

  async removeItem(orgId: string, watchlistId: string, influencerProfileId: string) {
    // Verify watchlist belongs to org
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, orgId },
    });
    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    const item = await this.prisma.watchlistItem.findFirst({
      where: { watchlistId, influencerProfileId },
    });
    if (!item) {
      throw new NotFoundException('Influencer not found in this watchlist');
    }

    await this.prisma.watchlistItem.delete({ where: { id: item.id } });
    return { success: true };
  }
}
