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

    // Sales-Modul: SalesOrders haben Tracking-Nummern aber keine eigene
    // OrderShipment-Row. Wir prueffen die direkt am Order-Objekt + setzen
    // shippedAt sobald DHL den ersten Scan registriert.
    try {
      await this.pollSalesShipments();
    } catch (err: any) {
      this.logger.error(`Sales-Poll loop failed: ${err?.message}`);
    }
  }

  /**
   * Auto-Erkennung "wirklich versendet" fuer Sales-Bestellungen.
   *
   * Logik:
   *   - Suche SalesOrders mit shippedAt=null aber trackingNumbers != []
   *   - Hole pro Tracking-Nummer den aktuellen DHL-Status
   *   - Sobald irgendeine Tracking-Nummer einen Scan-Status liefert
   *     (handed_to_carrier / in_transit / out_for_delivery / delivered)
   *     → setze shippedAt + status='shipped' + Event-Log
   *
   * Manuelles Setzen via toggleStatus bleibt unberuehrt — der Poller
   * setzt nur wenn shippedAt noch leer ist (kein Override).
   */
  private async pollSalesShipments() {
    const candidates = await this.prisma.salesOrder.findMany({
      where: {
        shippedAt: null,
        status: { notIn: ['cancelled', 'completed'] },
        trackingNumbers: { isEmpty: false },
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        orgId: true,
        orderNumber: true,
        trackingNumbers: true,
      },
      take: 200,
    });

    if (candidates.length === 0) return;

    // Cache: pro orgId einmalig den DHL-Account laden — sonst N Lookups
    // bei N Sales-Orders der gleichen Org.
    const credCache = new Map<string, any>();
    const adapter = this.registry.get('dhl');
    if (!adapter.getTracking) return;

    for (const order of candidates) {
      try {
        let credentials = credCache.get(order.orgId);
        if (credentials === undefined) {
          const account = await this.accounts.findDefault(order.orgId, 'dhl');
          if (!account) {
            credCache.set(order.orgId, null);
            continue;
          }
          const loaded = await this.accounts.loadForUse(order.orgId, account.id);
          credentials = loaded?.credentialsDecrypted ?? null;
          credCache.set(order.orgId, credentials);
        }
        if (!credentials) continue;

        // Erste Tracking-Nummer mit Scan-Status gewinnt — Multi-Karton-
        // Bestellungen haben mehrere Tracking-Nummern, eine reicht
        // damit das Lager die Bestellung "rausgegeben" hat.
        let earliestScanAt: Date | null = null;

        for (const tn of order.trackingNumbers) {
          if (!tn) continue;
          try {
            const result = await adapter.getTracking!(tn, credentials);
            if (!result) continue;
            const scanStatuses = ['handed_to_carrier', 'in_transit', 'out_for_delivery', 'delivered'];
            if (!scanStatuses.includes(result.status)) continue;
            // Erstes Scan-Event finden — das ist unser shippedAt
            const firstScan = (result.events || [])
              .filter((e) => scanStatuses.includes(e.status))
              .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0];
            if (firstScan) {
              if (!earliestScanAt || firstScan.occurredAt < earliestScanAt) {
                earliestScanAt = firstScan.occurredAt;
              }
            }
          } catch (err: any) {
            // Einzelne Tracking-Nummer kann scheitern (z.B. noch nicht im
            // DHL-System) — andere Nummern weiter versuchen.
            this.logger.debug(`Tracking ${tn} probe failed: ${err?.message}`);
          }
        }

        if (earliestScanAt) {
          await this.prisma.salesOrder.update({
            where: { id: order.id },
            data: {
              shippedAt: earliestScanAt,
              status: 'shipped',
              events: { create: {
                orgId: order.orgId,
                type: 'shipped',
                actorId: '00000000-0000-0000-0000-000000000099',
                note: `Automatisch versendet erkannt (DHL-Scan ${earliestScanAt.toISOString()})`,
              } },
            },
          });
          this.logger.log(`SalesOrder ${order.orderNumber} auto-marked shipped at ${earliestScanAt.toISOString()}`);
        }
      } catch (err: any) {
        this.logger.warn(`Sales-Poll for order ${order.id} failed: ${err?.message}`);
      }
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
