import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateCreatorDto {
  name: string;
  email?: string;
  phone?: string;
  platform?: string;
  handle?: string;
  firstContact?: string;
  followerCount?: number;
  engagementRate?: number;
  niche?: string;
  location?: string;
  avatarUrl?: string;
  ratePerPost?: number;
  ratePerVideo?: number;
  notes?: string;
  tags?: string[];
  status?: string;
  score?: number;
  age?: number;
  kids?: boolean;
  kidsAges?: string;
  kidsOnVideo?: boolean;
  compensation?: string;
  provision?: string;
  fixAmount?: number;
  contracts?: any;
  creatorNotes?: string;
}

export interface UpdateCreatorDto extends Partial<CreateCreatorDto> {}

export interface ListCreatorsParams {
  search?: string;
  status?: string;
  niche?: string;
  platform?: string;
  compensation?: string;
  kids?: string | boolean;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListCreatorsParams) {
    const {
      search,
      status,
      niche,
      platform,
      compensation,
      kids,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 25,
    } = params;

    const where: Prisma.CreatorWhereInput = { orgId };

    if (status) {
      where.status = status as any;
    } else {
      // Default: exclude deleted (churned) creators
      where.status = { not: 'churned' };
    }
    if (niche) {
      where.niche = { equals: niche, mode: 'insensitive' };
    }
    if (platform) {
      where.platform = { equals: platform, mode: 'insensitive' };
    }
    if (compensation) {
      where.compensation = compensation;
    }
    if (kids !== undefined && kids !== null && kids !== '') {
      where.kids = kids === 'true' || kids === true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSort: Record<string, string> = {
      name: 'name',
      createdAt: 'createdAt',
      followerCount: 'followerCount',
      engagementRate: 'engagementRate',
      totalDeals: 'totalDeals',
      totalSpend: 'totalSpend',
      score: 'score',
      status: 'status',
    };

    const orderField = allowedSort[sortBy] || 'createdAt';
    const orderBy = { [orderField]: sortOrder };

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.creator.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.creator.count({ where }),
    ]);

    return {
      items: items.map(this.serialize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(orgId: string, creatorId: string) {
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, orgId },
      include: {
        deals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return {
      ...this.serialize(creator),
      deals: creator.deals.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        stage: d.stage,
        amount: d.amount ? Number(d.amount) : null,
        paymentStatus: d.paymentStatus,
        deadline: d.deadline ? d.deadline.toISOString().slice(0, 10) : null,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  async create(orgId: string, data: CreateCreatorDto) {
    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.prisma.creator.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const creator = await this.prisma.creator.create({
      data: {
        orgId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        platform: data.platform || null,
        handle: data.handle || null,
        followerCount: data.followerCount ?? null,
        engagementRate: data.engagementRate != null ? new Prisma.Decimal(data.engagementRate) : null,
        niche: data.niche || null,
        location: data.location || null,
        avatarUrl: data.avatarUrl || null,
        ratePerPost: data.ratePerPost != null ? new Prisma.Decimal(data.ratePerPost) : null,
        ratePerVideo: data.ratePerVideo != null ? new Prisma.Decimal(data.ratePerVideo) : null,
        notes: data.notes || null,
        tags: data.tags || [],
        status: (data.status as any) || 'prospect',
        score: data.score ?? 0,
        inviteCode,
        age: data.age ?? null,
        kids: data.kids ?? false,
        kidsAges: data.kidsAges || null,
        kidsOnVideo: data.kidsOnVideo ?? false,
        compensation: data.compensation || null,
        provision: data.provision || null,
        fixAmount: data.fixAmount != null ? new Prisma.Decimal(data.fixAmount) : null,
        contracts: data.contracts || [],
        creatorNotes: data.creatorNotes || null,
        firstContact: data.firstContact || null,
      },
    });

    return this.serialize(creator);
  }

  async update(orgId: string, creatorId: string, data: UpdateCreatorDto) {
    // Verify exists
    const existing = await this.prisma.creator.findFirst({
      where: { id: creatorId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Creator not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.platform !== undefined) updateData.platform = data.platform || null;
    if (data.handle !== undefined) updateData.handle = data.handle || null;
    if (data.followerCount !== undefined) updateData.followerCount = data.followerCount;
    if (data.engagementRate !== undefined) {
      updateData.engagementRate = data.engagementRate != null
        ? new Prisma.Decimal(data.engagementRate)
        : null;
    }
    if (data.niche !== undefined) updateData.niche = data.niche || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;
    if (data.ratePerPost !== undefined) {
      updateData.ratePerPost = data.ratePerPost != null
        ? new Prisma.Decimal(data.ratePerPost)
        : null;
    }
    if (data.ratePerVideo !== undefined) {
      updateData.ratePerVideo = data.ratePerVideo != null
        ? new Prisma.Decimal(data.ratePerVideo)
        : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.age !== undefined) updateData.age = data.age ?? null;
    if (data.kids !== undefined) updateData.kids = data.kids;
    if (data.kidsAges !== undefined) updateData.kidsAges = data.kidsAges || null;
    if (data.kidsOnVideo !== undefined) updateData.kidsOnVideo = data.kidsOnVideo;
    if (data.compensation !== undefined) updateData.compensation = data.compensation || null;
    if (data.provision !== undefined) updateData.provision = data.provision || null;
    if (data.fixAmount !== undefined) {
      updateData.fixAmount = data.fixAmount != null
        ? new Prisma.Decimal(data.fixAmount)
        : null;
    }
    if (data.contracts !== undefined) updateData.contracts = data.contracts;
    if (data.creatorNotes !== undefined) updateData.creatorNotes = data.creatorNotes || null;
    if (data.firstContact !== undefined) updateData.firstContact = data.firstContact || null;

    const creator = await this.prisma.creator.update({
      where: { id: creatorId },
      data: updateData,
    });

    return this.serialize(creator);
  }

  async delete(orgId: string, creatorId: string) {
    const existing = await this.prisma.creator.findFirst({
      where: { id: creatorId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Creator not found');
    }

    // Soft delete: set status to churned + revoke portal access
    await this.prisma.creator.update({
      where: { id: creatorId },
      data: {
        status: 'churned',
        inviteCode: null, // revoke portal access
      },
    });

    return { success: true };
  }

  async getStats(orgId: string) {
    const [
      total,
      byStatus,
      byNiche,
      byPlatform,
    ] = await Promise.all([
      this.prisma.creator.count({ where: { orgId } }),
      this.prisma.creator.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      }),
      this.prisma.creator.groupBy({
        by: ['niche'],
        where: { orgId, niche: { not: null } },
        _count: true,
        orderBy: { _count: { niche: 'desc' } },
        take: 10,
      }),
      this.prisma.creator.groupBy({
        by: ['platform'],
        where: { orgId, platform: { not: null } },
        _count: true,
      }),
    ]);

    // Aggregate total spend
    const spendResult = await this.prisma.creator.aggregate({
      where: { orgId },
      _sum: { totalSpend: true },
      _avg: { engagementRate: true, score: true },
    });

    return {
      total,
      totalSpend: spendResult._sum.totalSpend ? Number(spendResult._sum.totalSpend) : 0,
      avgEngagementRate: spendResult._avg.engagementRate
        ? Number(spendResult._avg.engagementRate)
        : 0,
      avgScore: spendResult._avg.score ? Math.round(spendResult._avg.score) : 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byNiche: byNiche.map((n) => ({ niche: n.niche, count: n._count })),
      byPlatform: byPlatform.map((p) => ({ platform: p.platform, count: p._count })),
    };
  }

  async findByInviteCode(inviteCode: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { inviteCode },
    });
    if (!creator) {
      throw new NotFoundException('Invalid invite code');
    }
    return this.serialize(creator);
  }

  async updateLastLogin(creatorId: string) {
    await this.prisma.creator.update({
      where: { id: creatorId },
      data: { lastLogin: new Date() },
    });
  }

  private serialize(creator: any) {
    return {
      id: creator.id,
      orgId: creator.orgId,
      name: creator.name,
      email: creator.email,
      phone: creator.phone,
      platform: creator.platform,
      handle: creator.handle,
      followerCount: creator.followerCount,
      engagementRate: creator.engagementRate ? Number(creator.engagementRate) : null,
      niche: creator.niche,
      location: creator.location,
      avatarUrl: creator.avatarUrl,
      ratePerPost: creator.ratePerPost ? Number(creator.ratePerPost) : null,
      ratePerVideo: creator.ratePerVideo ? Number(creator.ratePerVideo) : null,
      notes: creator.notes,
      tags: creator.tags,
      status: creator.status,
      score: creator.score,
      totalDeals: creator.totalDeals,
      totalSpend: Number(creator.totalSpend),
      inviteCode: creator.inviteCode,
      age: creator.age ?? null,
      kids: creator.kids,
      kidsAges: creator.kidsAges,
      kidsOnVideo: creator.kidsOnVideo,
      compensation: creator.compensation,
      provision: creator.provision,
      fixAmount: creator.fixAmount ? Number(creator.fixAmount) : null,
      contracts: creator.contracts,
      creatorNotes: creator.creatorNotes,
      firstContact: creator.firstContact,
      lastLogin: creator.lastLogin ? creator.lastLogin.toISOString() : null,
      createdAt: creator.createdAt.toISOString(),
      updatedAt: creator.updatedAt.toISOString(),
    };
  }
}
