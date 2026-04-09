import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PromptEngine } from './prompt-engine';
import { AiGeneratorService } from './ai-generator.service';

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
  useEmojis?: boolean;
  headlineRequirements?: string;
  primaryTextRequirements?: string;
  linkDescriptionRequirements?: string;
  ctaRequirements?: string;
  headlineCount?: number;
  primaryTextCount?: number;
  linkDescriptionCount?: number;
  ctaCount?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGenerator: AiGeneratorService,
  ) {}

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
  // AI Generation — Claude API first, template engine fallback
  // -----------------------------------------------------------------------

  async generate(orgId: string, data: GenerateContentDto) {
    this.logger.log(`Generating content: AI=${!!this.aiGenerator}, type=${data.type}, language=${data.language || 'Deutsch'}`);

    // Try AI generation first (returns null if no API key or on error)
    const aiResult = await this.aiGenerator.generate({
      language: data.language || 'Deutsch',
      useEmojis: data.useEmojis || false,
      productName: data.product,
      productDescription: data.productDescription,
      keyBenefits: data.keyBenefits,
      usps: data.usps,
      pricePoint: data.pricePoint,
      targetPersona: data.targetPersona || data.audience,
      painPoints: data.painPoints,
      desires: data.desiresGoals,
      awarenessLevel: data.awarenessLevel,
      funnelStage: data.funnelStage,
      competitorNames: data.competitorNames,
      keyDifferentiators: data.keyDifferentiators,
      marketInsights: data.marketInsights,
      adAngle: data.angle,
      emotionalTrigger: data.emotionalTrigger,
      tone: data.tone,
      headlineRequirements: data.headlineRequirements,
      primaryTextRequirements: data.primaryTextRequirements,
      linkDescriptionRequirements: data.linkDescriptionRequirements,
      ctaRequirements: data.ctaRequirements,
      headlineCount: data.headlineCount || data.count || 5,
      primaryTextCount: data.primaryTextCount || 3,
      linkDescriptionCount: data.linkDescriptionCount || 3,
      ctaCount: data.ctaCount || 5,
      bestPerformingHook: data.bestPerformingHook,
      topCompetitorAdCopy: data.topCompetitorAdCopy,
    });

    if (aiResult) {
      return this.formatAiResult(aiResult, data);
    }

    // Fallback to template engine
    return this.generateWithTemplates(data);
  }

  private formatAiResult(aiResult: import('./ai-generator.service').AiGenerateResult, data: GenerateContentDto) {
    const items: any[] = [];
    const type = data.type || 'headline';

    // Headlines
    for (const h of aiResult.headlines) {
      items.push({
        type: 'headline',
        title: h.length > 60 ? h.slice(0, 57) + '...' : h,
        body: h,
        framework: data.angle || 'AI',
        platform: 'meta',
        tone: data.tone || 'Professional',
        wordCount: h.split(/\s+/).length,
        charCount: h.length,
        aiGenerated: true,
        aiModel: aiResult.aiModel,
      });
    }

    // Primary Texts
    for (const t of aiResult.primaryTexts) {
      items.push({
        type: 'primary_text',
        title: t.length > 60 ? t.slice(0, 57) + '...' : t,
        body: t,
        framework: data.angle || 'AI',
        platform: 'meta',
        tone: data.tone || 'Professional',
        wordCount: t.split(/\s+/).length,
        charCount: t.length,
        aiGenerated: true,
        aiModel: aiResult.aiModel,
      });
    }

    // Link Descriptions
    for (const ld of aiResult.linkDescriptions) {
      items.push({
        type: 'brief',
        title: 'Link Description',
        body: ld,
        framework: 'benefit_led',
        platform: 'meta',
        tone: data.tone || 'Professional',
        wordCount: ld.split(/\s+/).length,
        charCount: ld.length,
        aiGenerated: true,
        aiModel: aiResult.aiModel,
      });
    }

    // CTAs
    for (const cta of aiResult.ctas) {
      items.push({
        type: 'cta',
        title: cta,
        body: cta,
        framework: 'command',
        platform: 'meta',
        tone: data.tone || 'Professional',
        wordCount: cta.split(/\s+/).length,
        charCount: cta.length,
        aiGenerated: true,
        aiModel: aiResult.aiModel,
      });
    }

    // Hooks
    for (const hook of aiResult.hooks) {
      items.push({
        type: 'hook',
        title: hook.length > 60 ? hook.slice(0, 57) + '...' : hook,
        body: hook,
        framework: 'pattern_interrupt',
        platform: 'meta',
        tone: data.tone || 'Professional',
        wordCount: hook.split(/\s+/).length,
        charCount: hook.length,
        aiGenerated: true,
        aiModel: aiResult.aiModel,
      });
    }

    // Map AI angles to the expected shape
    const angles = aiResult.angles.map((a) => ({
      name: a.name,
      description: a.description,
      emotion: a.emotion,
      bestFor: type,
      example: a.example,
    }));

    const frameworks = [...new Set(items.map((i) => i.framework))];

    return {
      items,
      angles,
      meta: {
        totalGenerated: items.length,
        frameworks,
        language: data.language || 'Deutsch',
        aiPowered: true,
      },
    };
  }

  private generateWithTemplates(data: GenerateContentDto) {
    const count = Math.min(Math.max(data.count || 3, 1), 10);
    const primaryType = data.type || 'headline';
    const context = PromptEngine.buildContext(data);

    // Generate the primary type
    const primaryResult = PromptEngine.generateAll(context, primaryType, count);

    // Also generate all other content types so users get a complete set
    const allTypes = ['headline', 'primary_text', 'cta', 'hook'];
    const additionalItems: any[] = [];

    for (const t of allTypes) {
      if (t === primaryType) continue; // skip the primary type, already generated
      try {
        const extra = PromptEngine.generateAll(context, t, t === 'headline' ? 5 : t === 'cta' ? 5 : 3);
        for (const item of extra.items) {
          additionalItems.push({
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
          });
        }
      } catch {
        // If a type fails, continue with others
      }
    }

    const primaryItems = primaryResult.items.map((item) => ({
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

    const allItems = [...primaryItems, ...additionalItems];

    return {
      items: allItems,
      angles: primaryResult.angles,
      meta: {
        ...primaryResult.meta,
        totalGenerated: allItems.length,
      },
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
