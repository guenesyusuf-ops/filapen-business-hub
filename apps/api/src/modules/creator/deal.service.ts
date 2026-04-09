import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateDealDto {
  creatorId: string;
  title: string;
  type?: string;
  stage?: string;
  amount?: number;
  currency?: string;
  deliverables?: any;
  startDate?: string;
  deadline?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateDealDto extends Partial<CreateDealDto> {
  paymentStatus?: string;
}

export interface ListDealsParams {
  stage?: string;
  creatorId?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class DealService {
  private readonly logger = new Logger(DealService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListDealsParams) {
    const {
      stage,
      creatorId,
      type,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 25,
    } = params;

    const where: Prisma.DealWhereInput = { orgId };

    if (stage) where.stage = stage as any;
    if (creatorId) where.creatorId = creatorId;
    if (type) where.type = type as any;
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (startDate) {
      where.createdAt = { ...(where.createdAt as any || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt as any || {}), lte: new Date(endDate) };
    }

    const allowedSort: Record<string, string> = {
      title: 'title',
      createdAt: 'createdAt',
      amount: 'amount',
      stage: 'stage',
      deadline: 'deadline',
    };

    const orderField = allowedSort[sortBy] || 'createdAt';
    const orderBy = { [orderField]: sortOrder };

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          creator: {
            select: { id: true, name: true, handle: true, platform: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      items: items.map(this.serialize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getKanban(orgId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { orgId, stage: { not: 'cancelled' } },
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, handle: true, platform: true, avatarUrl: true },
        },
      },
    });

    const stages = ['lead', 'outreach', 'negotiation', 'contracted', 'in_progress', 'review', 'completed'];
    const kanban: Record<string, any[]> = {};
    for (const s of stages) {
      kanban[s] = [];
    }

    for (const deal of deals) {
      const stage = deal.stage as string;
      if (kanban[stage]) {
        kanban[stage].push(this.serialize(deal));
      }
    }

    return kanban;
  }

  async getById(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      include: {
        creator: {
          select: {
            id: true, name: true, handle: true, platform: true,
            avatarUrl: true, email: true, followerCount: true,
          },
        },
        briefings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return {
      ...this.serialize(deal),
      creator: deal.creator,
      briefings: deal.briefings.map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  }

  async create(orgId: string, data: CreateDealDto) {
    // Verify creator belongs to org
    const creator = await this.prisma.creator.findFirst({
      where: { id: data.creatorId, orgId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const deal = await this.prisma.deal.create({
      data: {
        orgId,
        creatorId: data.creatorId,
        title: data.title,
        type: (data.type as any) || 'ugc',
        stage: (data.stage as any) || 'lead',
        amount: data.amount != null ? new Prisma.Decimal(data.amount) : null,
        currency: data.currency || 'USD',
        deliverables: data.deliverables || [],
        startDate: data.startDate ? new Date(data.startDate) : null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        notes: data.notes || null,
        tags: data.tags || [],
      },
      include: {
        creator: {
          select: { id: true, name: true, handle: true, platform: true, avatarUrl: true },
        },
      },
    });

    // Increment creator's total_deals
    await this.prisma.creator.update({
      where: { id: data.creatorId },
      data: { totalDeals: { increment: 1 } },
    });

    return this.serialize(deal);
  }

  async update(orgId: string, dealId: string, data: UpdateDealDto) {
    const existing = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Deal not found');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.type !== undefined) updateData.type = data.type as any;
    if (data.stage !== undefined) updateData.stage = data.stage as any;
    if (data.amount !== undefined) {
      updateData.amount = data.amount != null ? new Prisma.Decimal(data.amount) : null;
    }
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus as any;
    if (data.deliverables !== undefined) updateData.deliverables = data.deliverables;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.tags !== undefined) updateData.tags = data.tags;

    // If stage moved to completed, set completedAt and update creator totalSpend
    if (data.stage === 'completed' && existing.stage !== 'completed') {
      updateData.completedAt = new Date();
      if (existing.amount) {
        await this.prisma.creator.update({
          where: { id: existing.creatorId },
          data: { totalSpend: { increment: existing.amount } },
        });
      }
    }

    const deal = await this.prisma.deal.update({
      where: { id: dealId },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, handle: true, platform: true, avatarUrl: true },
        },
      },
    });

    return this.serialize(deal);
  }

  async moveStage(orgId: string, dealId: string, newStage: string) {
    return this.update(orgId, dealId, { stage: newStage });
  }

  async getPipelineStats(orgId: string) {
    const byStage = await this.prisma.deal.groupBy({
      by: ['stage'],
      where: { orgId },
      _count: true,
      _sum: { amount: true },
    });

    const totalDeals = await this.prisma.deal.count({ where: { orgId } });
    const totalValue = await this.prisma.deal.aggregate({
      where: { orgId },
      _sum: { amount: true },
    });

    return {
      totalDeals,
      totalValue: totalValue._sum.amount ? Number(totalValue._sum.amount) : 0,
      byStage: byStage.map((s) => ({
        stage: s.stage,
        count: s._count,
        value: s._sum.amount ? Number(s._sum.amount) : 0,
      })),
    };
  }

  private serialize(deal: any) {
    const result: any = {
      id: deal.id,
      orgId: deal.orgId,
      creatorId: deal.creatorId,
      title: deal.title,
      type: deal.type,
      stage: deal.stage,
      amount: deal.amount ? Number(deal.amount) : null,
      currency: deal.currency,
      paymentStatus: deal.paymentStatus,
      deliverables: deal.deliverables,
      startDate: deal.startDate ? deal.startDate.toISOString().slice(0, 10) : null,
      deadline: deal.deadline ? deal.deadline.toISOString().slice(0, 10) : null,
      completedAt: deal.completedAt ? deal.completedAt.toISOString() : null,
      notes: deal.notes,
      tags: deal.tags,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
    };

    if (deal.creator) {
      result.creator = deal.creator;
    }

    return result;
  }
}
