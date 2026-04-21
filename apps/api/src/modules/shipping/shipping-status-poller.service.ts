import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { CarrierAccountService } from './carrier-account.service';
import { ShippingEmailAutomationService } from './shipping-email-automation.service';

/**
 * Hourly polling of carrier tracking APIs for shipments in-transit.
 * Only runs when a carrier account has apiReady=true. Stub-mode
 * shipments are ignored (user will update status manually).
 */
@Injectable()
export class ShippingStatusPoller {
  private readonly logger = new Logger(ShippingStatusPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CarrierRegistry,
    private readonly accounts: CarrierAccountService,
    private readonly emailAuto: ShippingEmailAutomationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'shipping-status-poll' })
  async poll() {
    try {
      // Only poll shipments that are live and in API mode
      const active = await this.prisma.orderShipment.findMany({
        where: {
          apiMode: true,
          status: { in: ['label_created', 'handed_to_carrier', 'in_transit', 'out_for_delivery'] },
          trackingNumber: { not: null },
          createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, // last 60 days only
        },
        include: { carrierAccount: true },
        take: 200,
      });

      for (const shipment of active) {
        try {
          await this.pollOne(shipment);
        } catch (err: any) {
          this.logger.warn(`Poll failed for ${shipment.id}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Poll loop failed: ${err?.message}`);
    }
  }

  private async pollOne(shipment: any) {
    const adapter = this.registry.get(shipment.carrier);
    if (!adapter.getTracking || !shipment.carrierAccountId) return;
    const loaded = await this.accounts.loadForUse(shipment.orgId, shipment.carrierAccountId);
    const result = await adapter.getTracking(shipment.trackingNumber, loaded?.credentialsDecrypted);
    if (!result) return;

    // Upsert any new events
    for (const e of result.events || []) {
      const existing = await this.prisma.orderShipmentStatusEvent.findFirst({
        where: {
          shipmentId: shipment.id,
          status: e.status,
          occurredAt: e.occurredAt,
        },
      });
      if (!existing) {
        await this.prisma.orderShipmentStatusEvent.create({
          data: {
            shipmentId: shipment.id,
            status: e.status,
            occurredAt: e.occurredAt,
            note: e.note || null,
            rawData: e.rawData ?? null,
            source: 'polling',
          },
        });
      }
    }

    // Update current status if changed
    if (result.status !== shipment.status) {
      const patch: any = { status: result.status };
      if (result.status === 'handed_to_carrier' && !shipment.handedOverAt) patch.handedOverAt = new Date();
      if (result.status === 'delivered' && !shipment.deliveredAt) patch.deliveredAt = new Date();
      await this.prisma.orderShipment.update({ where: { id: shipment.id }, data: patch });

      // Trigger email automation for the new status
      this.emailAuto.triggerForStatus(shipment.orgId, shipment.id, result.status as any).catch(() => {});
    }
  }
}
