import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSenderService } from '../email-marketing/email-sender.service';
import type { OrderShipmentStatus } from '@prisma/client';

export interface AutomationInput {
  triggerStatus: OrderShipmentStatus;
  templateId: string | null;
  enabled: boolean;
  sendDelayMinutes?: number;
  subject?: string | null;
}

/**
 * Bridges shipment status-changes to the Email-Marketing Sender.
 * Users configure per-status which template to send (enabled + delay).
 * Templates live in the Email-Marketing module — we just reference them.
 */
@Injectable()
export class ShippingEmailAutomationService {
  private readonly logger = new Logger(ShippingEmailAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: EmailSenderService,
  ) {}

  async list(orgId: string) {
    return this.prisma.shippingEmailAutomation.findMany({
      where: { orgId },
      orderBy: { triggerStatus: 'asc' },
      include: { template: { select: { id: true, name: true, subject: true } } },
    });
  }

  async upsert(orgId: string, data: AutomationInput) {
    if (!data.triggerStatus) throw new BadRequestException('Trigger-Status fehlt');
    return this.prisma.shippingEmailAutomation.upsert({
      where: { orgId_triggerStatus: { orgId, triggerStatus: data.triggerStatus } },
      update: {
        templateId: data.templateId || null,
        enabled: data.enabled,
        sendDelayMinutes: data.sendDelayMinutes ?? 0,
        subject: data.subject?.trim() || null,
      },
      create: {
        orgId,
        triggerStatus: data.triggerStatus,
        templateId: data.templateId || null,
        enabled: data.enabled,
        sendDelayMinutes: data.sendDelayMinutes ?? 0,
        subject: data.subject?.trim() || null,
      },
    });
  }

  /**
   * Called from OrderShipmentService whenever a status changes.
   * Looks up matching automation, runs sender (via Email-Marketing),
   * logs the send.
   */
  async triggerForStatus(orgId: string, shipmentId: string, newStatus: OrderShipmentStatus): Promise<void> {
    const auto = await this.prisma.shippingEmailAutomation.findFirst({
      where: { orgId, triggerStatus: newStatus, enabled: true },
    });
    if (!auto || !auto.templateId) return; // nothing to send

    const shipment = await this.prisma.orderShipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: { select: { customerEmail: true, customerName: true } },
      },
    });
    if (!shipment) return;
    const recipientEmail = shipment.recipientEmail || shipment.order?.customerEmail;
    if (!recipientEmail) {
      this.logger.warn(`No email for shipment ${shipmentId} — skipping ${newStatus} automation`);
      return;
    }

    // Find or create a contact for this email (email-marketing uses Contact)
    let contact = await this.prisma.contact.findUnique({
      where: { orgId_email: { orgId, email: recipientEmail.toLowerCase() } },
    });
    if (!contact) {
      // Transactional-style: create contact without marketing consent (for transactional sends)
      contact = await this.prisma.contact.create({
        data: {
          orgId,
          email: recipientEmail.toLowerCase(),
          firstName: (shipment.recipientName || shipment.order?.customerName || '').split(' ')[0] || null,
          marketingConsent: 'never_subscribed',
        },
      });
    }

    try {
      const result = await this.sender.send({
        orgId,
        contactId: contact.id,
        templateId: auto.templateId,
        consentMode: 'all_opted_in', // transactional: don't filter by marketing consent
        extra: {
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          carrier: shipment.carrier,
          recipientName: shipment.recipientName,
        },
      });

      await this.prisma.shippingEmailLog.create({
        data: {
          orgId,
          shipmentId,
          automationId: auto.id,
          triggerStatus: newStatus,
          recipientEmail,
          subject: auto.subject || `Versand-Update: ${newStatus}`,
          messageId: result.status === 'sent' ? result.messageId : null,
          errorMessage: result.status === 'skipped' ? `skipped:${result.reason}` : null,
        },
      });
    } catch (err: any) {
      this.logger.error(`triggerForStatus send failed: ${err?.message}`);
      await this.prisma.shippingEmailLog.create({
        data: {
          orgId,
          shipmentId,
          automationId: auto.id,
          triggerStatus: newStatus,
          recipientEmail,
          subject: auto.subject || `Versand-Update: ${newStatus}`,
          errorMessage: err?.message || 'unknown',
        },
      }).catch(() => {});
    }
  }

  async logsForShipment(orgId: string, shipmentId: string) {
    return this.prisma.shippingEmailLog.findMany({
      where: { orgId, shipmentId },
      orderBy: { sentAt: 'desc' },
    });
  }
}
