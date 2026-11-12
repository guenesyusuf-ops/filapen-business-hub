import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DsSyncResult {
  scanned: number;
  created: number;
  updated: number;
}

/**
 * Kern des Dropshipping-Sync.
 *
 * Liest ausschliesslich die bereits lokal synchronisierten Shopify-Bestellungen
 * (`orders` / `order_line_items`, von der bestehenden Integration gepflegt) und
 * stellt die passenden dem Dropshipper als ds_orders bereit. Schreibt NUR in
 * ds_*-Tabellen — nichts Bestehendes wird veraendert, kein direkter Shopify-Call.
 *
 * Auswahlkriterien (Master-Entscheidung):
 *   - bezahlt + offen (financialStatus = paid, nicht storniert, noch nicht voll
 *     fulfilled)
 *   - enthaelt mindestens eine als Dropshipping markierte SKU
 * Uebernommen werden pro Bestellung NUR die Dropship-Positionen + die
 * Versanddaten als Snapshot.
 */
@Injectable()
export class DropshippingSyncService {
  private readonly logger = new Logger(DropshippingSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncOrg(orgId: string, trigger: 'cron' | 'manual' | 'initial'): Promise<DsSyncResult> {
    const log = await this.prisma.dsSyncLog.create({
      data: { orgId, trigger, status: 'ok' },
    });

    let scanned = 0;
    let created = 0;
    let updated = 0;

    try {
      const skuRows = await this.prisma.dsSku.findMany({
        where: { orgId, active: true },
        select: { sku: true },
      });
      const skus = skuRows.map((r) => r.sku);

      if (skus.length > 0) {
        const skuSet = new Set(skus);

        // Einzelner aktiver Partner → neue Bestellungen automatisch zuordnen.
        const partners = await this.prisma.dsPartner.findMany({
          where: { orgId, active: true },
          select: { id: true },
          take: 2,
        });
        const soloPartnerId = partners.length === 1 ? partners[0].id : null;

        const orders = await this.prisma.order.findMany({
          where: {
            orgId,
            status: { not: 'cancelled' },
            financialStatus: 'paid',
            fulfillmentStatus: { in: ['unfulfilled', 'partial'] },
            lineItems: { some: { sku: { in: skus } } },
          },
          include: { lineItems: true },
        });
        scanned = orders.length;

        for (const o of orders) {
          const dropItems = o.lineItems.filter((li) => li.sku && skuSet.has(li.sku));
          if (dropItems.length === 0) continue;

          const existing = await this.prisma.dsOrder.findUnique({
            where: { orgId_orderExternalId: { orgId, orderExternalId: o.externalId } },
            select: { id: true, status: true },
          });

          if (!existing) {
            await this.prisma.dsOrder.create({
              data: {
                orgId,
                partnerId: soloPartnerId,
                orderId: o.id,
                orderExternalId: o.externalId,
                orderNumber: o.orderNumber,
                placedAt: o.placedAt,
                customerName: o.customerName,
                customerPhone: o.customerPhone,
                customerEmail: o.customerEmail,
                shippingAddress: (o.shippingAddress as any) ?? undefined,
                countryCode: o.countryCode,
                status: 'new',
                items: {
                  create: dropItems.map((li) => ({
                    orgId,
                    sku: li.sku,
                    title: li.title,
                    quantity: li.quantity,
                    lineItemExternalId: li.externalId,
                  })),
                },
              },
            });
            created++;
          } else {
            // Snapshot + Positionen nur auffrischen, solange der Dropshipper noch
            // nichts getan hat (status = new). Danach bleibt alles eingefroren.
            if (existing.status === 'new') {
              await this.prisma.dsOrder.update({
                where: { id: existing.id },
                data: {
                  orderId: o.id,
                  orderNumber: o.orderNumber,
                  placedAt: o.placedAt,
                  customerName: o.customerName,
                  customerPhone: o.customerPhone,
                  customerEmail: o.customerEmail,
                  shippingAddress: (o.shippingAddress as any) ?? undefined,
                  countryCode: o.countryCode,
                  // vorhandene Zuordnung nie mit null ueberschreiben
                  partnerId: soloPartnerId ?? undefined,
                },
              });

              for (const li of dropItems) {
                await this.prisma.dsOrderItem.upsert({
                  where: {
                    dsOrderId_lineItemExternalId: {
                      dsOrderId: existing.id,
                      lineItemExternalId: li.externalId,
                    },
                  },
                  create: {
                    orgId,
                    dsOrderId: existing.id,
                    sku: li.sku,
                    title: li.title,
                    quantity: li.quantity,
                    lineItemExternalId: li.externalId,
                  },
                  update: { sku: li.sku, title: li.title, quantity: li.quantity },
                });
              }

              // Positionen entfernen, die nicht mehr zur Auswahl passen.
              const keep = dropItems.map((li) => li.externalId);
              await this.prisma.dsOrderItem.deleteMany({
                where: {
                  dsOrderId: existing.id,
                  lineItemExternalId: { notIn: keep.length ? keep : ['__none__'] },
                },
              });
            }
            updated++;
          }
        }
      }

      await this.prisma.dsSyncLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          ordersScanned: scanned,
          ordersCreated: created,
          ordersUpdated: updated,
          status: 'ok',
        },
      });

      return { scanned, created, updated };
    } catch (err: any) {
      this.logger.error(`Dropshipping-Sync fuer Org ${orgId} fehlgeschlagen`, err);
      await this.prisma.dsSyncLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          status: 'error',
          error: String(err?.message ?? err).slice(0, 2000),
        },
      });
      throw err;
    }
  }
}
