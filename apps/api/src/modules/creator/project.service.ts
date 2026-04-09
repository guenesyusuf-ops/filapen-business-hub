import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateProjectDto {
  name: string;
  description?: string;
  status?: string;
  deadline?: string;
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
    });

    return projects.map(this.serialize);
  }

  async getById(orgId: string, projectId: string) {
    const project = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Fetch assigned creators
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

    const project = await this.prisma.creatorProject.update({
      where: { id: projectId },
      data: updateData,
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
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
