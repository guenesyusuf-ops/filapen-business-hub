import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateBriefingDto {
  dealId: string;
  title: string;
  content?: string;
  guidelines?: any;
  references?: string[];
  status?: string;
}

export interface UpdateBriefingDto extends Partial<CreateBriefingDto> {}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listByDeal(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
    });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const briefings = await this.prisma.briefing.findMany({
      where: { orgId, dealId },
      orderBy: { createdAt: 'desc' },
    });

    return briefings.map(this.serialize);
  }

  async getById(orgId: string, briefingId: string) {
    const briefing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
      include: {
        deal: {
          select: { id: true, title: true, stage: true },
        },
      },
    });

    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }

    return {
      ...this.serialize(briefing),
      deal: briefing.deal,
    };
  }

  async create(orgId: string, data: CreateBriefingDto) {
    // Verify deal belongs to org
    const deal = await this.prisma.deal.findFirst({
      where: { id: data.dealId, orgId },
    });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const briefing = await this.prisma.briefing.create({
      data: {
        orgId,
        dealId: data.dealId,
        title: data.title,
        content: data.content || null,
        guidelines: data.guidelines || {},
        references: data.references || [],
        status: (data.status as any) || 'draft',
      },
    });

    return this.serialize(briefing);
  }

  async update(orgId: string, briefingId: string, data: UpdateBriefingDto) {
    const existing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Briefing not found');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content || null;
    if (data.guidelines !== undefined) updateData.guidelines = data.guidelines;
    if (data.references !== undefined) updateData.references = data.references;
    if (data.status !== undefined) updateData.status = data.status as any;

    const briefing = await this.prisma.briefing.update({
      where: { id: briefingId },
      data: updateData,
    });

    return this.serialize(briefing);
  }

  async delete(orgId: string, briefingId: string) {
    const existing = await this.prisma.briefing.findFirst({
      where: { id: briefingId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Briefing not found');
    }

    await this.prisma.briefing.delete({ where: { id: briefingId } });
    return { success: true };
  }

  private serialize(briefing: any) {
    return {
      id: briefing.id,
      orgId: briefing.orgId,
      dealId: briefing.dealId,
      title: briefing.title,
      content: briefing.content,
      guidelines: briefing.guidelines,
      references: briefing.references,
      status: briefing.status,
      createdAt: briefing.createdAt.toISOString(),
      updatedAt: briefing.updatedAt.toISOString(),
    };
  }
}
