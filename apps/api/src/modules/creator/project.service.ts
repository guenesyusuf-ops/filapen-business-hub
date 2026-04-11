import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type CampaignType = 'discount' | 'launch' | 'push' | 'other';

export interface CreateProjectDto {
  name: string;
  campaignType?: CampaignType;
  action?: string;
  startDate?: string; // ISO date
  productId?: string;
  neededCreators?: number;
  description?: string;
  budget?: number;
  deadline?: string;
  status?: string;
  creatorIds?: string[];
  tags?: string[];
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const projects = await this.prisma.creatorProject.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            handle: true,
          },
        },
        _count: {
          select: { invitations: true },
        },
      },
    });

    return projects.map((p) => ({
      ...this.serialize(p),
      invitationsCount: (p as any)._count?.invitations ?? 0,
    }));
  }

  async getById(orgId: string, projectId: string) {
    const project = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            handle: true,
          },
        },
        invitations: {
          orderBy: { invitedAt: 'desc' },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                handle: true,
                platform: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Fetch assigned creators (legacy creatorIds field)
    let creators: any[] = [];
    if (project.creatorIds.length > 0) {
      creators = await this.prisma.creator.findMany({
        where: { id: { in: project.creatorIds }, orgId },
        select: {
          id: true,
          name: true,
          handle: true,
          platform: true,
          avatarUrl: true,
          status: true,
        },
      });
    }

    return {
      ...this.serialize(project),
      creators,
      invitations: (project as any).invitations.map((inv: any) => ({
        id: inv.id,
        status: inv.status,
        invitedAt: inv.invitedAt.toISOString(),
        respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
        expiresAt: inv.expiresAt.toISOString(),
        message: inv.message,
        creator: inv.creator,
      })),
    };
  }

  async create(orgId: string, data: CreateProjectDto) {
    const project = await this.prisma.creatorProject.create({
      data: {
        orgId,
        name: data.name,
        description: data.description || null,
        status: data.status || 'active',
        deadline: data.deadline ? new Date(data.deadline) : null,
        creatorIds: data.creatorIds || [],
        tags: data.tags || [],
        campaignType: data.campaignType || null,
        action: data.action || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        productId: data.productId || null,
        neededCreators: data.neededCreators ?? 0,
        budget: data.budget !== undefined && data.budget !== null ? (data.budget as any) : null,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            handle: true,
          },
        },
      },
    });

    return this.serialize(project);
  }

  async update(orgId: string, projectId: string, data: UpdateProjectDto) {
    const existing = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    }
    if (data.creatorIds !== undefined) updateData.creatorIds = data.creatorIds;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.campaignType !== undefined) updateData.campaignType = data.campaignType || null;
    if (data.action !== undefined) updateData.action = data.action || null;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.productId !== undefined) updateData.productId = data.productId || null;
    if (data.neededCreators !== undefined) updateData.neededCreators = data.neededCreators;
    if (data.budget !== undefined) {
      updateData.budget = data.budget === null ? null : (data.budget as any);
    }

    const project = await this.prisma.creatorProject.update({
      where: { id: projectId },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            handle: true,
          },
        },
      },
    });

    return this.serialize(project);
  }

  async delete(orgId: string, projectId: string) {
    const existing = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.creatorProject.delete({ where: { id: projectId } });
    return { success: true };
  }

  private serialize(project: any) {
    return {
      id: project.id,
      orgId: project.orgId,
      name: project.name,
      description: project.description,
      status: project.status,
      deadline: project.deadline ? project.deadline.toISOString().slice(0, 10) : null,
      creatorIds: project.creatorIds,
      tags: project.tags,
      campaignType: project.campaignType ?? null,
      action: project.action ?? null,
      startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
      productId: project.productId ?? null,
      neededCreators: project.neededCreators ?? 0,
      budget:
        project.budget !== undefined && project.budget !== null
          ? Number(project.budget)
          : null,
      product: project.product
        ? {
            id: project.product.id,
            title: project.product.title,
            imageUrl: project.product.imageUrl,
            handle: project.product.handle,
          }
        : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
