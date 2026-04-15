import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WmChatService {
  private readonly logger = new Logger(WmChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listMessages(projectId: string, limit = 100) {
    const project = await this.prisma.wmProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.wmProjectChat.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async sendMessage(projectId: string, data: { userId: string; userName: string; message: string }) {
    const project = await this.prisma.wmProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.wmProjectChat.create({
      data: {
        projectId,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
      },
    });
  }
}
