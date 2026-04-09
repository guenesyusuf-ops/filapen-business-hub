import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PromptEngine } from './prompt-engine';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateContentDto {
  type: string;
  title: string;
  body: string;
  platform?: string;
  status?: string;
  brandVoiceId?: string;
  aiGenerated?: boolean;
  aiModel?: string;
  tags?: string[];
  rating?: number;
  campaign?: string;
}

export interface UpdateContentDto extends Partial<CreateContentDto> {}

export interface ListContentParams {
  search?: string;
  type?: string;
  status?: string;
  platform?: string;
  campaign?: string;
  aiGenerated?: boolean;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GenerateContentDto {
  type: string;
  language?: string;
  product?: string;
  productDescription?: string;
  keyBenefits?: string;
  pricePoint?: string;
  usps?: string;
  audience?: string;
  targetPersona?: string;
  painPoints?: string;
  desiresGoals?: string;
  awarenessLevel?: string;
  funnelStage?: string;
  competitorNames?: string;
  keyDifferentiators?: string;
  angle?: string;
  emotionalTrigger?: string;
  ctaType?: string;
  tone?: string;
  bestPerformingHook?: string;
  topCompetitorAdCopy?: string;
  marketInsights?: string;
  brandVoiceId?: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListContentParams) {
    const {
      search,
      type,
      status,
      platform,
      campaign,
      aiGenerated,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 25,
    } = params;

    const where: Prisma.ContentPieceWhereInput = { orgId };

    if (type) where.type = type as any;
    if (status) where.status = status as any;
    if (platform) where.platform = { equals: platform, mode: 'insensitive' };
    if (campaign) where.campaign = { contains: campaign, mode: 'insensitive' };
    if (aiGenerated !== undefined) where.aiGenerated = aiGenerated;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { campaign: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSort: Record<string, string> = {
      title: 'title',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      type: 'type',
      status: 'status',
      rating: 'rating',
    };

    const orderField = allowedSort[sortBy] || 'createdAt';
    const orderBy = { [orderField]: sortOrder };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.contentPiece.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          brandVoice: { select: { id: true, name: true } },
        },
      }),
      this.prisma.contentPiece.count({ where }),
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
    const piece = await this.prisma.contentPiece.findFirst({
      where: { id, orgId },
      include: {
        brandVoice: { select: { id: true, name: true } },
      },
    });

    if (!piece) {
      throw new NotFoundException('Content piece not found');
    }

    return this.serialize(piece);
  }

  async create(orgId: string, data: CreateContentDto) {
    const piece = await this.prisma.contentPiece.create({
      data: {
        orgId,
        type: data.type as any,
        title: data.title,
        body: data.body,
        platform: data.platform || null,
        status: (data.status as any) || 'draft',
        brandVoiceId: data.brandVoiceId || null,
        aiGenerated: data.aiGenerated ?? false,
        aiModel: data.aiModel || null,
        tags: data.tags || [],
        rating: data.rating ?? null,
        campaign: data.campaign || null,
      },
      include: {
        brandVoice: { select: { id: true, name: true } },
      },
    });

    return this.serialize(piece);
  }

  async update(orgId: string, id: string, data: UpdateContentDto) {
    const existing = await this.prisma.contentPiece.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Content piece not found');
    }

    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type as any;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.platform !== undefined) updateData.platform = data.platform || null;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.brandVoiceId !== undefined) updateData.brandVoiceId = data.brandVoiceId || null;
    if (data.aiGenerated !== undefined) updateData.aiGenerated = data.aiGenerated;
    if (data.aiModel !== undefined) updateData.aiModel = data.aiModel || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.campaign !== undefined) updateData.campaign = data.campaign || null;

    const piece = await this.prisma.contentPiece.update({
      where: { id },
      data: updateData,
      include: {
        brandVoice: { select: { id: true, name: true } },
      },
    });

    return this.serialize(piece);
  }

  async delete(orgId: string, id: string) {
    const existing = await this.prisma.contentPiece.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Content piece not found');
    }

    await this.prisma.contentPiece.delete({ where: { id } });
    return { success: true };
  }

  async getStats(orgId: string) {
    const [
      total,
      byType,
      byStatus,
      aiCount,
      templateCount,
    ] = await Promise.all([
      this.prisma.contentPiece.count({ where: { orgId } }),
      this.prisma.contentPiece.groupBy({
        by: ['type'],
        where: { orgId },
        _count: true,
      }),
      this.prisma.contentPiece.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      }),
      this.prisma.contentPiece.count({ where: { orgId, aiGenerated: true } }),
      this.prisma.contentTemplate.count({
        where: { OR: [{ orgId }, { isSystem: true }] },
      }),
    ]);

    const publishedCount = byStatus.find((s) => s.status === 'published')?._count ?? 0;

    return {
      total,
      published: publishedCount,
      aiGenerated: aiCount,
      templates: templateCount,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  // -----------------------------------------------------------------------
  // Elite AI Generation (sophisticated template engine, no external API)
  // Uses proven copywriting frameworks: AIDA, PAS, BAB, Story, 4P
  // -----------------------------------------------------------------------

  async generate(orgId: string, data: GenerateContentDto) {
    const count = Math.min(Math.max(data.count || 3, 1), 10);
    const type = data.type || 'headline';

    const context = PromptEngine.buildContext(data);
    const result = PromptEngine.generateAll(context, type, count);

    // Map to the response shape expected by the frontend
    const items = result.items.map((item) => ({
      type: item.type,
      title: item.title,
      body: item.body,
      framework: item.framework,
      platform: item.platform,
      tone: item.tone,
      wordCount: item.wordCount,
      charCount: item.charCount,
      aiGenerated: true,
      aiModel: 'filapen-v2',
    }));

    return {
      items,
      angles: result.angles,
      meta: result.meta,
    };
  }

  private serialize(piece: any) {
    return {
      id: piece.id,
      orgId: piece.orgId,
      type: piece.type,
      title: piece.title,
      body: piece.body,
      platform: piece.platform,
      status: piece.status,
      brandVoiceId: piece.brandVoiceId,
      brandVoiceName: piece.brandVoice?.name ?? null,
      aiGenerated: piece.aiGenerated,
      aiModel: piece.aiModel,
      tags: piece.tags,
      rating: piece.rating,
      campaign: piece.campaign,
      createdAt: piece.createdAt.toISOString(),
      updatedAt: piece.updatedAt.toISOString(),
    };
  }
}
