import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Scans open sales orders and fires DirectMessages to team members who opted
 * in via menu permission "sales". Each (order, kind) combo is sent exactly
 * once thanks to the unique index on SalesOrderReminder.
 */
@Injectable()
export class SalesReminderService {
  private readonly logger = new Logger(SalesReminderService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 7 * * *') // daily 07:00 — delivery-date driven reminders
  async checkDeliveryDates() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      try {
        await this.runForOrg(org.id);
      } catch (err: any) {
        this.logger.error(`Delivery-date check failed for org ${org.id}: ${err.message}`);
      }
    }
  }

  @Cron('0 */4 * * *') // every 4 hours — invoice-after-shipping
  async checkInvoiceAfterShipping() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      try {
        await this.runInvoiceRemindersForOrg(org.id);
      } catch (err: any) {
        this.logger.error(`Invoice reminder check failed for org ${org.id}: ${err.message}`);
      }
    }
  }

  private async runForOrg(orgId: string) {
    const now = new Date();
    const in3 = new Date();
    in3.setDate(in3.getDate() + 3);

    const open = await this.prisma.salesOrder.findMany({
      where: {
        orgId, shippedAt: null,
        status: { notIn: ['cancelled', 'completed'] },
        requiredDeliveryDate: { not: null },
      },
      include: { customer: { select: { companyName: true } } },
    });

    for (const order of open) {
      const due = order.requiredDeliveryDate!;
      const daysTo = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysTo < 0) {
        await this.sendOnce(order, 'overdue',
          `🚨 Bestellung ${order.orderNumber} (${order.customer.companyName}) ist ${Math.abs(daysTo)} Tag(e) überfällig.`);
      } else if (daysTo <= 3) {
        await this.sendOnce(order, 'urgent_3d',
          `⚠️ Bestellung ${order.orderNumber} (${order.customer.companyName}) muss in ${daysTo} Tag(en) versendet werden.`);
      }
    }
  }

  private async runInvoiceRemindersForOrg(orgId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        orgId,
        shippedAt: { lt: yesterday, not: null },
        invoiceSentAt: null,
        status: { notIn: ['cancelled', 'completed'] },
      },
      include: { customer: { select: { companyName: true } } },
    });
    for (const order of orders) {
      await this.sendOnce(order, 'invoice_after_shipping',
        `💰 Bestellung ${order.orderNumber} (${order.customer.companyName}) ist seit gestern versendet — Rechnung noch offen.`);
    }
  }

  /**
   * Idempotent reminder dispatcher: checks SalesOrderReminder unique constraint,
   * sends DMs to all users of this org that have "sales" permission OR are
   * owner/admin.
   */
  private async sendOnce(order: { id: string; orgId: string; orderNumber: string; assignedToId?: string | null }, kind: 'urgent_3d' | 'overdue' | 'invoice_after_shipping', message: string) {
    const already = await this.prisma.salesOrderReminder.findFirst({
      where: { orderId: order.id, kind },
    });
    if (already) return;

    // Find recipients — all active users with sales access
    const users = await this.prisma.user.findMany({
      where: {
        orgId: order.orgId,
        status: 'active',
        OR: [
          { role: 'owner' },
          { role: 'admin' },
          { menuPermissions: { has: 'sales' } },
        ],
      },
      select: { id: true },
    });

    // Use a "system" sender — if none set, reuse the assignedTo user, else any owner
    const senderId = order.assignedToId
      ?? users[0]?.id
      ?? (await this.prisma.user.findFirst({ where: { orgId: order.orgId, role: 'owner' }, select: { id: true } }))?.id;

    if (!senderId) {
      this.logger.warn(`No sender for reminder order=${order.id}`);
      return;
    }

    const recipients = users.filter((u) => u.id !== senderId);
    if (recipients.length === 0) return;

    await this.prisma.$transaction([
      ...recipients.map((r) =>
        this.prisma.directMessage.create({
          data: { senderId, recipientId: r.id, content: message },
        }),
      ),
      this.prisma.salesOrderReminder.create({
        data: {
          orgId: order.orgId,
          orderId: order.id,
          kind,
          sentToUserIds: recipients.map((r) => r.id),
        },
      }),
    ]);

    this.logger.log(`Reminder ${kind} sent for order=${order.orderNumber} to ${recipients.length} user(s)`);
  }
}
