import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface MarketingEventInput {
  orgId: string;
  contactId?: string | null;
  anonymousId?: string | null;
  type: string;
  source?: string;
  payload?: any;
  externalId?: string | null;
  occurredAt?: Date;
}

/**
 * Generic event store for marketing-relevant signals:
 * viewed_product, added_to_cart, checkout_started, order_placed,
 * email_opened, email_clicked, unsubscribed, bounced, complained, ...
 *
 * Idempotent per (orgId, source, externalId) — re-delivered webhooks
 * won't create duplicates.
 */
@Injectable()
export class MarketingEventService {
  private readonly logger = new Logger(MarketingEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: MarketingEventInput): Promise<void> {
    try {
      await this.prisma.marketingEvent.create({
        data: {
          orgId: input.orgId,
          contactId: input.contactId || null,
          anonymousId: input.anonymousId || null,
          type: input.type,
          source: input.source || 'shopify',
          payload: input.payload ?? null,
          externalId: input.externalId || null,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    } catch (err: any) {
      // P2002 = unique violation → already recorded (idempotent), ignore
      if (err?.code === 'P2002') return;
      this.logger.error(`Event record failed: ${err?.message}`, err?.stack);
    }
  }

  async listForContact(orgId: string, contactId: string, limit = 50) {
    return this.prisma.marketingEvent.findMany({
      where: { orgId, contactId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async recentForOrg(orgId: string, limit = 100) {
    return this.prisma.marketingEvent.findMany({
      where: { orgId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 500),
      include: {
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}
