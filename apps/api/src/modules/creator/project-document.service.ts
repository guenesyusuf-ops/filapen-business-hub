import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

export interface CreateProjectDocumentDto {
  projectId: string;
  orgId: string;
  type: string; // briefing | skript | sonstige
  fileName: string;
  fileUrl: string;
  storageKey?: string;
  fileSize?: number;
}

@Injectable()
export class ProjectDocumentService {
  private readonly logger = new Logger(ProjectDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listByProject(orgId: string, projectId: string) {
    // Verify project exists and belongs to org
    const project = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const docs = await this.prisma.projectDocument.findMany({
      where: { projectId, orgId },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => this.serialize(d));
  }

  async create(data: CreateProjectDocumentDto) {
    const doc = await this.prisma.projectDocument.create({
      data: {
        orgId: data.orgId,
        projectId: data.projectId,
        type: data.type,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        storageKey: data.storageKey ?? null,
        fileSize: data.fileSize ?? null,
      },
    });
    return this.serialize(doc);
  }

  async delete(orgId: string, projectId: string, docId: string) {
    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: docId, projectId, orgId },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    // Delete from R2 if storageKey exists
    if (doc.storageKey) {
      try {
        await this.storage.delete(doc.storageKey);
      } catch (err) {
        this.logger.warn(`Failed to delete file from R2: ${doc.storageKey}`, err);
      }
    }

    await this.prisma.projectDocument.delete({ where: { id: docId } });
    return { success: true };
  }

  async getProjectForCreator(projectId: string, creatorId: string) {
    // Verify the creator has an accepted invitation for this project
    const invitation = await this.prisma.projectInvitation.findFirst({
      where: {
        projectId,
        creatorId,
        status: 'accepted',
      },
    });
    if (!invitation) {
      throw new NotFoundException('Project not found or invitation not accepted');
    }

    const project = await this.prisma.creatorProject.findUnique({
      where: { id: projectId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            handle: true,
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Group documents by type
    const docs = (project as any).documents ?? [];
    const groupedDocs = {
      briefing: docs.filter((d: any) => d.type === 'briefing').map((d: any) => this.serialize(d)),
      skript: docs.filter((d: any) => d.type === 'skript').map((d: any) => this.serialize(d)),
      sonstige: docs.filter((d: any) => d.type === 'sonstige').map((d: any) => this.serialize(d)),
    };

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      deadline: project.deadline ? project.deadline.toISOString().slice(0, 10) : null,
      campaignType: (project as any).campaignType ?? null,
      action: (project as any).action ?? null,
      startDate: (project as any).startDate
        ? (project as any).startDate.toISOString().slice(0, 10)
        : null,
      neededCreators: (project as any).neededCreators ?? 0,
      product: project.product
        ? {
            id: project.product.id,
            title: project.product.title,
            imageUrl: project.product.imageUrl,
            handle: project.product.handle,
          }
        : null,
      notes: project.description,
      documents: groupedDocs,
    };
  }

  private serialize(doc: any) {
    return {
      id: doc.id,
      orgId: doc.orgId,
      projectId: doc.projectId,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      storageKey: doc.storageKey,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
