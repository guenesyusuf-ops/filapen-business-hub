import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateCommentDto {
  uploadId: string;
  creatorId?: string;
  authorRole: string; // admin, creator
  authorName: string;
  message: string;
}

export interface MarkReadDto {
  uploadId: string;
  role: 'admin' | 'creator';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listByUpload(orgId: string, uploadId: string) {
    // Verify upload exists for this org
    const upload = await this.prisma.creatorUpload.findFirst({
      where: { id: uploadId, orgId },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    const comments = await this.prisma.uploadComment.findMany({
      where: { uploadId },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map(this.serialize);
  }

  async create(orgId: string, data: CreateCommentDto) {
    // Verify upload exists for this org
    const upload = await this.prisma.creatorUpload.findFirst({
      where: { id: data.uploadId, orgId },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    const comment = await this.prisma.uploadComment.create({
      data: {
        orgId,
        uploadId: data.uploadId,
        creatorId: data.creatorId || null,
        authorRole: data.authorRole,
        authorName: data.authorName,
        message: data.message,
        // If admin writes, mark as read by admin; if creator writes, mark as read by creator
        readByAdmin: data.authorRole === 'admin',
        readByCreator: data.authorRole === 'creator',
      },
    });

    return this.serialize(comment);
  }

  async markRead(orgId: string, data: MarkReadDto) {
    const updateData =
      data.role === 'admin'
        ? { readByAdmin: true }
        : { readByCreator: true };

    await this.prisma.uploadComment.updateMany({
      where: {
        uploadId: data.uploadId,
        upload: { orgId },
      },
      data: updateData,
    });

    return { success: true };
  }

  private serialize(comment: any) {
    return {
      id: comment.id,
      orgId: comment.orgId,
      uploadId: comment.uploadId,
      creatorId: comment.creatorId,
      authorRole: comment.authorRole,
      authorName: comment.authorName,
      message: comment.message,
      readByAdmin: comment.readByAdmin,
      readByCreator: comment.readByCreator,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
