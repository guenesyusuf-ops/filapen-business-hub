import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

@Injectable()
export class WmSchedulerService {
  private readonly logger = new Logger(WmSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================================
  // Feature 1: Deadline-Erinnerung — laeuft jede Stunde
  // =========================================================================

  @Cron('0 * * * *')
  async checkDeadlineReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const tasks = await this.prisma.wmTask.findMany({
      where: {
        completed: false,
        dueDate: new Date(tomorrowDate),
      },
    });

    for (const task of tasks) {
      await this.prisma.wmActivity.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId: 'system',
          userName: 'System',
          action: 'deadline_reminder',
          details: `Deadline morgen: ${tomorrowDate}`,
        },
      }).catch(() => {});

      // Erstelle In-App Notification fuer Assignee
      if (task.assigneeId) {
        await this.createNotification({
          userId: task.assigneeId,
          type: 'deadline_reminder',
          title: 'Deadline morgen',
          message: `Die Aufgabe "${task.title}" ist morgen faellig.`,
          taskId: task.id,
          projectId: task.projectId,
        });
      }
    }

    if (tasks.length > 0) {
      this.logger.log(`Deadline reminders: ${tasks.length} Aufgaben morgen faellig`);
    }
  }

  // =========================================================================
  // Feature 1b: Ueberfaellig-Eskalation — alle 6 Stunden
  // =========================================================================

  @Cron('0 */6 * * *')
  async checkOverdueEscalation() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const overdue = await this.prisma.wmTask.findMany({
      where: {
        completed: false,
        dueDate: { lt: twoDaysAgo },
      },
    });

    for (const task of overdue) {
      const daysOverdue = Math.ceil(
        (Date.now() - new Date(task.dueDate!).getTime()) / 86400000,
      );

      await this.prisma.wmActivity.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId: 'system',
          userName: 'System',
          action: 'overdue_escalation',
          details: `Aufgabe seit ${daysOverdue} Tagen ueberfaellig`,
        },
      }).catch(() => {});

      // Erstelle In-App Notification
      if (task.assigneeId) {
        await this.createNotification({
          userId: task.assigneeId,
          type: 'overdue',
          title: 'Aufgabe ueberfaellig',
          message: `Die Aufgabe "${task.title}" ist seit ${daysOverdue} Tagen ueberfaellig.`,
          taskId: task.id,
          projectId: task.projectId,
        });
      }
    }

    if (overdue.length > 0) {
      this.logger.log(`Overdue escalation: ${overdue.length} Aufgaben eskaliert`);
    }
  }

  // =========================================================================
  // Notification Helper
  // =========================================================================

  private async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    taskId?: string;
    projectId?: string;
  }) {
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
}
