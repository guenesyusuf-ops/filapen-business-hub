import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateChatMessageDto {
  message: string;
  senderRole: 'admin' | 'creator';
  senderName: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMessages(orgId: string, creatorId: string) {
    // Verify creator exists
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, orgId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { orgId, creatorId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return messages.map((m) => ({
      id: m.id,
      orgId: m.orgId,
      creatorId: m.creatorId,
      senderRole: m.senderRole,
      senderName: m.senderName,
      message: m.message,
      readByAdmin: m.readByAdmin,
      readByCreator: m.readByCreator,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async sendMessage(orgId: string, creatorId: string, data: CreateChatMessageDto) {
    // Verify creator exists
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, orgId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        orgId,
        creatorId,
        senderRole: data.senderRole,
        senderName: data.senderName,
        message: data.message,
        readByAdmin: data.senderRole === 'admin',
        readByCreator: data.senderRole === 'creator',
      },
    });

    return {
      id: message.id,
      orgId: message.orgId,
      creatorId: message.creatorId,
      senderRole: message.senderRole,
      senderName: message.senderName,
      message: message.message,
      readByAdmin: message.readByAdmin,
      readByCreator: message.readByCreator,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async markRead(orgId: string, creatorId: string, role: 'admin' | 'creator') {
    const field = role === 'admin' ? 'readByAdmin' : 'readByCreator';

    await this.prisma.chatMessage.updateMany({
      where: {
        orgId,
        creatorId,
        [field]: false,
      },
      data: {
        [field]: true,
      },
    });

    return { success: true };
  }

  async getUnreadCount(orgId: string, creatorId: string, role: 'admin' | 'creator') {
    const field = role === 'admin' ? 'readByAdmin' : 'readByCreator';

    return this.prisma.chatMessage.count({
      where: {
        orgId,
        creatorId,
        [field]: false,
      },
    });
  }
}
