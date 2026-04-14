import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateNotificationDto {
  creatorId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, data: CreateNotificationDto) {
    const notification = await this.prisma.creatorNotification.create({
      data: {
        orgId,
        creatorId: data.creatorId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: (data.metadata ?? {}) as any,
      },
    });

    return this.serialize(notification);
  }

  async listByCreator(orgId: string, creatorId: string, limit = 20) {
    const notifications = await this.prisma.creatorNotification.findMany({
      where: { orgId, creatorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map((n) => this.serialize(n));
  }

  async unreadCount(orgId: string, creatorId: string) {
    const count = await this.prisma.creatorNotification.count({
      where: { orgId, creatorId, read: false },
    });
    return { count };
  }

  async markAsRead(orgId: string, notificationId: string) {
    const existing = await this.prisma.creatorNotification.findFirst({
      where: { id: notificationId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.creatorNotification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return this.serialize(updated);
  }

  async markAllAsRead(orgId: string, creatorId: string) {
    await this.prisma.creatorNotification.updateMany({
      where: { orgId, creatorId, read: false },
      data: { read: true },
    });
    return { success: true };
  }

  private serialize(notification: any) {
    return {
      id: notification.id,
      orgId: notification.orgId,
      creatorId: notification.creatorId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      metadata: notification.metadata,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
