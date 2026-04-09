import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ListInfluencersParams {
  search?: string;
  platform?: string;
  niche?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxEngagement?: number;
  location?: string;
  hasEmail?: boolean;
  isVerified?: boolean;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class InfluencerService {
  private readonly logger = new Logger(InfluencerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListInfluencersParams) {
    const {
      search,
      platform,
      niche,
      minFollowers,
      maxFollowers,
      minEngagement,
      maxEngagement,
      location,
      hasEmail,
      isVerified,
      sortBy = 'score',
      sortOrder = 'desc',
      page = 1,
      pageSize = 24,
    } = params;

    const where: Prisma.InfluencerProfileWhereInput = { orgId };

    if (platform) {
      where.platform = { equals: platform, mode: 'insensitive' };
    }
    if (niche) {
      where.niche = { equals: niche, mode: 'insensitive' };
    }
    if (minFollowers !== undefined || maxFollowers !== undefined) {
      where.followerCount = {};
      if (minFollowers !== undefined) where.followerCount.gte = minFollowers;
      if (maxFollowers !== undefined) where.followerCount.lte = maxFollowers;
    }
    if (minEngagement !== undefined || maxEngagement !== undefined) {
      where.engagementRate = {};
      if (minEngagement !== undefined) {
        where.engagementRate.gte = new Prisma.Decimal(minEngagement);
      }
      if (maxEngagement !== undefined) {
        where.engagementRate.lte = new Prisma.Decimal(maxEngagement);
      }
    }
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }
    if (hasEmail) {
      where.email = { not: null };
    }
    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSort: Record<string, string> = {
      followerCount: 'followerCount',
      engagementRate: 'engagementRate',
      score: 'score',
      displayName: 'displayName',
      createdAt: 'createdAt',
      avgLikes: 'avgLikes',
    };

    const orderField = allowedSort[sortBy] || 'score';
    const orderBy = { [orderField]: sortOrder };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.influencerProfile.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.influencerProfile.count({ where }),
    ]);

    return {
      items: items.map(this.serialize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(orgId: string, id: string) {
    const profile = await this.prisma.influencerProfile.findFirst({
      where: { id, orgId },
      include: {
        watchlistItems: {
          include: {
            watchlist: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Influencer profile not found');
    }

    return {
      ...this.serialize(profile),
      watchlists: profile.watchlistItems.map((wi) => ({
        watchlistId: wi.watchlist.id,
        watchlistName: wi.watchlist.name,
        addedAt: wi.addedAt.toISOString(),
      })),
    };
  }

  async getStats(orgId: string) {
    const [
      total,
      byPlatform,
      byNiche,
      avgStats,
    ] = await Promise.all([
      this.prisma.influencerProfile.count({ where: { orgId } }),
      this.prisma.influencerProfile.groupBy({
        by: ['platform'],
        where: { orgId },
        _count: true,
        _avg: { engagementRate: true },
      }),
      this.prisma.influencerProfile.groupBy({
        by: ['niche'],
        where: { orgId, niche: { not: null } },
        _count: true,
        orderBy: { _count: { niche: 'desc' } },
        take: 10,
      }),
      this.prisma.influencerProfile.aggregate({
        where: { orgId },
        _avg: { engagementRate: true, score: true, followerCount: true },
      }),
    ]);

    const watchlistCount = await this.prisma.watchlist.count({ where: { orgId } });

    // Top 10 by score
    const topInfluencers = await this.prisma.influencerProfile.findMany({
      where: { orgId },
      orderBy: { score: 'desc' },
      take: 10,
    });

    // Find top platform
    const sortedPlatforms = [...byPlatform].sort((a, b) => b._count - a._count);
    const topPlatform = sortedPlatforms.length > 0 ? sortedPlatforms[0].platform : 'N/A';

    return {
      total,
      avgEngagementRate: avgStats._avg.engagementRate
        ? Number(avgStats._avg.engagementRate)
        : 0,
      avgScore: avgStats._avg.score ? Math.round(avgStats._avg.score) : 0,
      avgFollowers: avgStats._avg.followerCount
        ? Math.round(avgStats._avg.followerCount)
        : 0,
      topPlatform,
      watchlistCount,
      byPlatform: byPlatform.map((p) => ({
        platform: p.platform,
        count: p._count,
        avgEngagement: p._avg.engagementRate ? Number(p._avg.engagementRate) : 0,
      })),
      byNiche: byNiche.map((n) => ({
        niche: n.niche,
        count: n._count,
      })),
      topInfluencers: topInfluencers.map(this.serialize),
    };
  }

  private serialize(profile: any) {
    return {
      id: profile.id,
      orgId: profile.orgId,
      platform: profile.platform,
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      engagementRate: profile.engagementRate ? Number(profile.engagementRate) : 0,
      avgLikes: profile.avgLikes,
      avgComments: profile.avgComments,
      avgViews: profile.avgViews,
      niche: profile.niche,
      location: profile.location,
      language: profile.language,
      isVerified: profile.isVerified,
      email: profile.email,
      websiteUrl: profile.websiteUrl,
      audienceCountry: profile.audienceCountry,
      audienceAge: profile.audienceAge,
      audienceGender: profile.audienceGender,
      score: profile.score,
      tags: profile.tags,
      brandedContentPct: profile.brandedContentPct ? Number(profile.brandedContentPct) : null,
      estimatedMediaValue: profile.estimatedMediaValue ? Number(profile.estimatedMediaValue) : null,
      growthRate: profile.growthRate ? Number(profile.growthRate) : null,
      postingFrequency: profile.postingFrequency,
      contentCategories: profile.contentCategories || [],
      brandFitScore: profile.brandFitScore,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
