import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateBrandDto {
  name: string;
  category?: string;
  website?: string;
  channels?: string[];
  competitors?: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all brands for an organization, optionally filtered.
   */
  async listBrands(orgId: string, search?: string, category?: string) {
    const where: Prisma.BrandWhereInput = { orgId };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const brands = await this.prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { mentions: true } },
      },
    });

    // For each brand, count distinct influencers
    const brandsWithStats = await Promise.all(
      brands.map(async (brand) => {
        const distinctInfluencers = await this.prisma.brandMention.findMany({
          where: { brandId: brand.id },
          distinct: ['influencerProfileId'],
          select: { influencerProfileId: true },
        });

        return {
          id: brand.id,
          orgId: brand.orgId,
          name: brand.name,
          category: brand.category,
          logoUrl: brand.logoUrl,
          website: brand.website,
          channels: brand.channels,
          competitors: brand.competitors,
          totalMentions: brand._count.mentions,
          totalInfluencers: distinctInfluencers.length,
          createdAt: brand.createdAt.toISOString(),
        };
      }),
    );

    return brandsWithStats;
  }

  /**
   * Get brand detail with associated influencers and timeline.
   */
  async getBrandDetail(orgId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, orgId },
      include: {
        mentions: {
          include: {
            influencerProfile: {
              select: {
                id: true,
                displayName: true,
                handle: true,
                platform: true,
                followerCount: true,
                engagementRate: true,
                avatarUrl: true,
                isVerified: true,
                brandedContentPct: true,
                niche: true,
              },
            },
          },
          orderBy: { mentionDate: 'desc' },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Mention type breakdown
    const typeBreakdown = { organic: 0, paid: 0, link: 0, affiliate: 0 };
    let totalReach = 0;
    let engagementSum = 0;
    let engagementCount = 0;

    for (const mention of brand.mentions) {
      const t = mention.type as keyof typeof typeBreakdown;
      if (typeBreakdown[t] !== undefined) {
        typeBreakdown[t]++;
      }
      if (mention.estimatedReach) {
        totalReach += mention.estimatedReach;
      }
      if (mention.engagementRate) {
        engagementSum += Number(mention.engagementRate);
        engagementCount++;
      }
    }

    // Timeline grouped by month
    const timelineMap = new Map<string, { organic: number; paid: number; link: number; affiliate: number }>();
    for (const mention of brand.mentions) {
      const d = new Date(mention.mentionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!timelineMap.has(key)) {
        timelineMap.set(key, { organic: 0, paid: 0, link: 0, affiliate: 0 });
      }
      const entry = timelineMap.get(key)!;
      const t = mention.type as keyof typeof entry;
      if (entry[t] !== undefined) {
        entry[t]++;
      }
    }

    // Sort timeline by month
    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts }));

    // Top influencers by mention count
    const influencerMentionCounts = new Map<string, { count: number; profile: any }>();
    for (const mention of brand.mentions) {
      const infId = mention.influencerProfileId;
      if (!influencerMentionCounts.has(infId)) {
        influencerMentionCounts.set(infId, {
          count: 0,
          profile: mention.influencerProfile,
        });
      }
      influencerMentionCounts.get(infId)!.count++;
    }

    const topInfluencers = Array.from(influencerMentionCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => ({
        ...this.serializeInfluencerBrief(entry.profile),
        totalMentions: entry.count,
      }));

    // Distinct influencer count
    const distinctInfluencers = new Set(brand.mentions.map((m) => m.influencerProfileId));

    return {
      id: brand.id,
      orgId: brand.orgId,
      name: brand.name,
      category: brand.category,
      logoUrl: brand.logoUrl,
      website: brand.website,
      channels: brand.channels,
      competitors: brand.competitors,
      createdAt: brand.createdAt.toISOString(),
      totalMentions: brand.mentions.length,
      totalInfluencers: distinctInfluencers.size,
      totalReach,
      avgEngagement: engagementCount > 0 ? +(engagementSum / engagementCount).toFixed(2) : 0,
      typeBreakdown,
      timeline,
      topInfluencers,
    };
  }

  /**
   * Get influencers associated with a brand.
   */
  async getBrandInfluencers(orgId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, orgId },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const mentions = await this.prisma.brandMention.findMany({
      where: { brandId },
      include: {
        influencerProfile: {
          select: {
            id: true,
            displayName: true,
            handle: true,
            platform: true,
            followerCount: true,
            engagementRate: true,
            avatarUrl: true,
            isVerified: true,
            brandedContentPct: true,
            niche: true,
            score: true,
          },
        },
      },
      orderBy: { mentionDate: 'desc' },
    });

    // Group by influencer
    const grouped = new Map<
      string,
      {
        profile: any;
        mentions: typeof mentions;
        types: Set<string>;
        firstMention: Date;
        lastMention: Date;
      }
    >();

    for (const mention of mentions) {
      const infId = mention.influencerProfileId;
      if (!grouped.has(infId)) {
        grouped.set(infId, {
          profile: mention.influencerProfile,
          mentions: [],
          types: new Set(),
          firstMention: new Date(mention.mentionDate),
          lastMention: new Date(mention.mentionDate),
        });
      }
      const entry = grouped.get(infId)!;
      entry.mentions.push(mention);
      entry.types.add(mention.type);
      const mDate = new Date(mention.mentionDate);
      if (mDate < entry.firstMention) entry.firstMention = mDate;
      if (mDate > entry.lastMention) entry.lastMention = mDate;
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...this.serializeInfluencerBrief(entry.profile),
        score: entry.profile.score,
        totalMentions: entry.mentions.length,
        mentionTypes: Array.from(entry.types),
        firstMention: entry.firstMention.toISOString().split('T')[0],
        lastMention: entry.lastMention.toISOString().split('T')[0],
      }))
      .sort((a, b) => b.totalMentions - a.totalMentions);
  }

  /**
   * Get mention timeline data for a brand.
   */
  async getBrandTimeline(orgId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, orgId },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const mentions = await this.prisma.brandMention.findMany({
      where: { brandId },
      include: {
        influencerProfile: {
          select: {
            id: true,
            displayName: true,
            handle: true,
            platform: true,
          },
        },
      },
      orderBy: { mentionDate: 'asc' },
    });

    // Group by influencer, with each mention as a point
    const influencerMap = new Map<string, { name: string; handle: string; platform: string; points: any[] }>();

    for (const mention of mentions) {
      const infId = mention.influencerProfileId;
      if (!influencerMap.has(infId)) {
        influencerMap.set(infId, {
          name: mention.influencerProfile.displayName,
          handle: mention.influencerProfile.handle,
          platform: mention.influencerProfile.platform,
          points: [],
        });
      }
      influencerMap.get(infId)!.points.push({
        date: mention.mentionDate.toISOString().split('T')[0],
        type: mention.type,
        engagementRate: mention.engagementRate ? Number(mention.engagementRate) : null,
        estimatedReach: mention.estimatedReach,
        postUrl: mention.postUrl,
      });
    }

    return {
      brandId: brand.id,
      brandName: brand.name,
      influencers: Array.from(influencerMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      })),
    };
  }

  /**
   * Get competitor overlap — influencers that work with this brand AND its competitors.
   */
  async getCompetitorOverlap(orgId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, orgId },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand.competitors.length === 0) {
      return { competitors: [] };
    }

    // Find competitor brands in our DB
    const competitorBrands = await this.prisma.brand.findMany({
      where: {
        orgId,
        name: { in: brand.competitors },
      },
    });

    if (competitorBrands.length === 0) {
      return { competitors: [] };
    }

    // Get influencers who mentioned this brand
    const brandInfluencerIds = await this.prisma.brandMention.findMany({
      where: { brandId },
      distinct: ['influencerProfileId'],
      select: { influencerProfileId: true },
    });
    const brandInfluencerSet = new Set(brandInfluencerIds.map((m) => m.influencerProfileId));

    // For each competitor, find overlapping influencers
    const result = [];
    for (const competitor of competitorBrands) {
      const compInfluencerIds = await this.prisma.brandMention.findMany({
        where: { brandId: competitor.id },
        distinct: ['influencerProfileId'],
        select: { influencerProfileId: true },
      });

      const overlapIds = compInfluencerIds
        .map((m) => m.influencerProfileId)
        .filter((id) => brandInfluencerSet.has(id));

      if (overlapIds.length > 0) {
        const overlapInfluencers = await this.prisma.influencerProfile.findMany({
          where: { id: { in: overlapIds } },
          select: {
            id: true,
            displayName: true,
            handle: true,
            platform: true,
            followerCount: true,
            engagementRate: true,
            avatarUrl: true,
            isVerified: true,
          },
        });

        result.push({
          competitor: {
            id: competitor.id,
            name: competitor.name,
            category: competitor.category,
          },
          overlapCount: overlapIds.length,
          influencers: overlapInfluencers.map(this.serializeInfluencerBrief),
        });
      }
    }

    return { competitors: result };
  }

  /**
   * Search brands by name.
   */
  async searchBrands(orgId: string, query: string) {
    const brands = await this.prisma.brand.findMany({
      where: {
        orgId,
        name: { contains: query, mode: 'insensitive' },
      },
      include: {
        _count: { select: { mentions: true } },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      category: brand.category,
      logoUrl: brand.logoUrl,
      totalMentions: brand._count.mentions,
    }));
  }

  /**
   * Create a new brand.
   */
  async createBrand(orgId: string, data: CreateBrandDto) {
    const brand = await this.prisma.brand.create({
      data: {
        orgId,
        name: data.name,
        category: data.category || null,
        website: data.website || null,
        channels: data.channels || [],
        competitors: data.competitors || [],
      },
    });

    return {
      id: brand.id,
      orgId: brand.orgId,
      name: brand.name,
      category: brand.category,
      logoUrl: brand.logoUrl,
      website: brand.website,
      channels: brand.channels,
      competitors: brand.competitors,
      totalMentions: 0,
      totalInfluencers: 0,
      createdAt: brand.createdAt.toISOString(),
    };
  }

  /**
   * Get brands associated with an influencer.
   */
  async getInfluencerBrands(orgId: string, influencerProfileId: string) {
    const mentions = await this.prisma.brandMention.findMany({
      where: { influencerProfileId, brand: { orgId } },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            category: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { mentionDate: 'desc' },
    });

    // Group by brand
    const brandMap = new Map<
      string,
      {
        brand: any;
        mentions: any[];
        types: Set<string>;
        firstMention: Date;
        lastMention: Date;
      }
    >();

    for (const mention of mentions) {
      const bId = mention.brandId;
      if (!brandMap.has(bId)) {
        brandMap.set(bId, {
          brand: mention.brand,
          mentions: [],
          types: new Set(),
          firstMention: new Date(mention.mentionDate),
          lastMention: new Date(mention.mentionDate),
        });
      }
      const entry = brandMap.get(bId)!;
      entry.mentions.push({
        id: mention.id,
        type: mention.type,
        platform: mention.platform,
        mentionDate: mention.mentionDate.toISOString().split('T')[0],
        engagementRate: mention.engagementRate ? Number(mention.engagementRate) : null,
        estimatedReach: mention.estimatedReach,
        postUrl: mention.postUrl,
      });
      entry.types.add(mention.type);
      const mDate = new Date(mention.mentionDate);
      if (mDate < entry.firstMention) entry.firstMention = mDate;
      if (mDate > entry.lastMention) entry.lastMention = mDate;
    }

    return Array.from(brandMap.values()).map((entry) => ({
      brand: entry.brand,
      totalMentions: entry.mentions.length,
      mentionTypes: Array.from(entry.types),
      firstMention: entry.firstMention.toISOString().split('T')[0],
      lastMention: entry.lastMention.toISOString().split('T')[0],
      mentions: entry.mentions,
    }));
  }

  private serializeInfluencerBrief(profile: any) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      handle: profile.handle,
      platform: profile.platform,
      followerCount: profile.followerCount,
      engagementRate: profile.engagementRate ? Number(profile.engagementRate) : 0,
      avatarUrl: profile.avatarUrl,
      isVerified: profile.isVerified,
      brandedContentPct: profile.brandedContentPct ? Number(profile.brandedContentPct) : null,
      niche: profile.niche,
    };
  }
}
