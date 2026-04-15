import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

export interface WmNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  task_id: string | null;
  project_id: string | null;
  read: boolean;
  created_at: Date;
}

@Injectable()
export class WmNotificationService {
  private readonly logger = new Logger(WmNotificationService.name);

  // =========================================================================
  // Notifications fuer aktuellen User
  // =========================================================================

  async getNotifications(userId?: string): Promise<WmNotificationRow[]> {
    const uid = userId || DEV_USER_ID;
    return this.prisma.$queryRawUnsafe<WmNotificationRow[]>(
      `SELECT id, user_id, type, title, message, task_id, project_id, read, created_at
       FROM wm_notifications
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 100`,
      uid,
    );
  }

  async getUnreadCount(userId?: string): Promise<{ count: number }> {
    const uid = userId || DEV_USER_ID;
    const result = await this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*)::int as count FROM wm_notifications WHERE user_id = $1::uuid AND read = false`,
      uid,
    );
    return { count: Number(result[0]?.count ?? 0) };
  }

  async markAsRead(notificationId: string): Promise<{ updated: boolean }> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE wm_notifications SET read = true WHERE id = $1::uuid`,
      notificationId,
    );
    return { updated: true };
  }

  async markAllAsRead(userId?: string): Promise<{ updated: boolean }> {
    const uid = userId || DEV_USER_ID;
    await this.prisma.$executeRawUnsafe(
      `UPDATE wm_notifications SET read = true WHERE user_id = $1::uuid AND read = false`,
      uid,
    );
    return { updated: true };
  }

  // =========================================================================
  // Notification erstellen (fuer andere Services)
  // =========================================================================

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    taskId?: string;
    projectId?: string;
  }): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO wm_notifications (id, user_id, type, title, message, task_id, project_id, read, created_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::uuid, $6::uuid, false, NOW())`,
        data.userId,
        data.type,
        data.title,
        data.message,
        data.taskId ?? null,
        data.projectId ?? null,
      );
    } catch (err) {
      this.logger.warn(`Failed to create notification: ${err}`);
    }
  }

  constructor(private readonly prisma: PrismaService) {}
}
