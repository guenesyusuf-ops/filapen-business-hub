import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateTemplateDto {
  name: string;
  type: string;
  promptTemplate: string;
  variables?: { name: string; type: string; required: boolean }[];
  category?: string;
  isSystem?: boolean;
}

export interface ListTemplatesParams {
  type?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, params: ListTemplatesParams) {
    const {
      type,
      category,
      search,
      page = 1,
      pageSize = 50,
    } = params;

    const where: any = {
      OR: [{ orgId }, { isSystem: true }],
    };

    if (type) {
      where.type = type as any;
    }
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.contentTemplate.findMany({
        where,
        orderBy: [{ isSystem: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.contentTemplate.count({ where }),
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
    const template = await this.prisma.contentTemplate.findFirst({
      where: {
        id,
        OR: [{ orgId }, { isSystem: true }],
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.serialize(template);
  }

  async create(orgId: string, data: CreateTemplateDto) {
    const template = await this.prisma.contentTemplate.create({
      data: {
        orgId,
        name: data.name,
        type: data.type as any,
        promptTemplate: data.promptTemplate,
        variables: data.variables ? JSON.parse(JSON.stringify(data.variables)) : [],
        category: data.category || null,
        isSystem: false,
      },
    });

    return this.serialize(template);
  }

  async incrementUsage(id: string) {
    await this.prisma.contentTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  private serialize(template: any) {
    return {
      id: template.id,
      orgId: template.orgId,
      name: template.name,
      type: template.type,
      promptTemplate: template.promptTemplate,
      variables: template.variables,
      category: template.category,
      isSystem: template.isSystem,
      usageCount: template.usageCount,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }
}
