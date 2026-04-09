import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateBrandVoiceDto {
  name: string;
  description?: string;
  toneAttributes?: Record<string, number>;
  examples?: string[];
  bannedWords?: string[];
  isDefault?: boolean;
}

export interface UpdateBrandVoiceDto extends Partial<CreateBrandVoiceDto> {}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BrandVoiceService {
  private readonly logger = new Logger(BrandVoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const items = await this.prisma.brandVoice.findMany({
      where: { orgId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { contentPieces: true } },
      },
    });

    return {
      items: items.map((v) => ({
        id: v.id,
        orgId: v.orgId,
        name: v.name,
        description: v.description,
        toneAttributes: v.toneAttributes,
        examples: v.examples,
        bannedWords: v.bannedWords,
        isDefault: v.isDefault,
        contentCount: v._count.contentPieces,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    };
  }

  async getById(orgId: string, id: string) {
    const voice = await this.prisma.brandVoice.findFirst({
      where: { id, orgId },
      include: {
        _count: { select: { contentPieces: true } },
      },
    });

    if (!voice) {
      throw new NotFoundException('Brand voice not found');
    }

    return {
      id: voice.id,
      orgId: voice.orgId,
      name: voice.name,
      description: voice.description,
      toneAttributes: voice.toneAttributes,
      examples: voice.examples,
      bannedWords: voice.bannedWords,
      isDefault: voice.isDefault,
      contentCount: voice._count.contentPieces,
      createdAt: voice.createdAt.toISOString(),
      updatedAt: voice.updatedAt.toISOString(),
    };
  }

  async create(orgId: string, data: CreateBrandVoiceDto) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.brandVoice.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const voice = await this.prisma.brandVoice.create({
      data: {
        orgId,
        name: data.name,
        description: data.description || null,
        toneAttributes: data.toneAttributes || null,
        examples: data.examples || [],
        bannedWords: data.bannedWords || [],
        isDefault: data.isDefault ?? false,
      },
    });

    return {
      id: voice.id,
      orgId: voice.orgId,
      name: voice.name,
      description: voice.description,
      toneAttributes: voice.toneAttributes,
      examples: voice.examples,
      bannedWords: voice.bannedWords,
      isDefault: voice.isDefault,
      createdAt: voice.createdAt.toISOString(),
      updatedAt: voice.updatedAt.toISOString(),
    };
  }

  async update(orgId: string, id: string, data: UpdateBrandVoiceDto) {
    const existing = await this.prisma.brandVoice.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Brand voice not found');
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.brandVoice.updateMany({
        where: { orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.toneAttributes !== undefined) updateData.toneAttributes = data.toneAttributes;
    if (data.examples !== undefined) updateData.examples = data.examples;
    if (data.bannedWords !== undefined) updateData.bannedWords = data.bannedWords;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const voice = await this.prisma.brandVoice.update({
      where: { id },
      data: updateData,
    });

    return {
      id: voice.id,
      orgId: voice.orgId,
      name: voice.name,
      description: voice.description,
      toneAttributes: voice.toneAttributes,
      examples: voice.examples,
      bannedWords: voice.bannedWords,
      isDefault: voice.isDefault,
      createdAt: voice.createdAt.toISOString(),
      updatedAt: voice.updatedAt.toISOString(),
    };
  }

  async delete(orgId: string, id: string) {
    const existing = await this.prisma.brandVoice.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Brand voice not found');
    }

    await this.prisma.brandVoice.delete({ where: { id } });
    return { success: true };
  }
}
