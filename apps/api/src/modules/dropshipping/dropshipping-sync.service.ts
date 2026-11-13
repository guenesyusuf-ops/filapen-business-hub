import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DsSyncResult {
  scanned: number;
  created: number;
  updated: number;
}

interface RuleDef {
  id: string;
  mode: string; // 'subset' | 'exact'
  skus: Set<string>;
}

function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Kern des Dropshipping-Sync (Phase 1.5 — regelbasiert).
 *
 * Liest ausschliesslich die bereits lokal synchronisierten Shopify-Bestellungen
 * und stellt die passenden dem Dropshipper bereit. Schreibt NUR in ds_*-Tabellen.
 *
 * Matching ueber Regeln (ds_rules). Jede Regel hat einen Modus:
 *   - 'subset': Bestellung passt, wenn ALLE ihre Produkte aus der SKU-Menge der
 *     Regel stammen (kein fremdes Produkt, Menge egal).
 *   - 'exact':  Bestellung passt nur, wenn ihre Produkt-Menge GENAU der SKU-Menge
 *     der Regel entspricht.
 * Eine Bestellung wird uebernommen, sobald sie zu IRGENDEINER aktiven Regel passt.
 * Positionen ohne SKU gelten als "fremd" und schliessen eine Bestellung aus.
 */
@Injectable()
export class DropshippingSyncService {
  private readonly logger = new Logger(DropshippingSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SKU → Bild-URL fuer eine Menge SKUs (Variante, sonst Produkt). */
  private async buildImageMap(orgId: string, skus: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (skus.length === 0) return map;
    const variants = await this.prisma.productVariant.findMany({
      where: { orgId, sku: { in: skus } },
      select: { sku: true, imageUrl: true, product: { select: { imageUrl: true } } },
    });
    for (const v of variants) {
      if (!v.sku) continue;
      if (!map.has(v.sku)) map.set(v.sku, v.imageUrl ?? v.product?.imageUrl ?? null);
    }
    return map;
  }

  private async loadRules(orgId: string): Promise<RuleDef[]> {
    const rules = await this.prisma.dsRule.findMany({
      where: { orgId, active: true },
      select: { id: true, mode: true, skus: { select: { sku: true } } },
    });
    return rules
      .map((r) => ({ id: r.id, mode: r.mode, skus: new Set(r.skus.map((s) => s.sku)) }))
      .filter((r) => r.skus.size > 0);
  }

  /** Prueft, ob eine Bestellung (Liste von Line-Items) zu einer Regel passt. */
  private orderMatches(lineItems: Array<{ sku: string | null }>, rules: RuleDef[]): boolean {
    const hasForeignNull = lineItems.some((li) => !li.sku);
    if (hasForeignNull) return false;
    const skusInOrder = new Set<string>(lineItems.map((li) => li.sku as string));
    if (skusInOrder.size === 0) return false;
    for (const rule of rules) {
      if (rule.mode === 'exact') {
        if (setEquals(skusInOrder, rule.skus)) return true;
      } else {
        // subset: jedes Produkt der Bestellung muss in der Regel-Menge sein
        let ok = true;
        for (const s of skusInOrder) if (!rule.skus.has(s)) { ok = false; break; }
        if (ok) return true;
      }
    }
    return false;
  }

  async syncOrg(orgId: string, trigger: 'cron' | 'manual' | 'initial'): Promise<DsSyncResult> {
    const log = await this.prisma.dsSyncLog.create({ data: { orgId, trigger, status: 'ok' } });

    let scanned = 0;
    let created = 0;
    let updated = 0;

    try {
      const rules = await this.loadRules(orgId);

      if (rules.length > 0) {
        const union = new Set<string>();
        for (const r of rules) for (const s of r.skus) union.add(s);
        const unionArr = [...union];

        const imageMap = await this.buildImageMap(orgId, unionArr);
        const soloPartnerId = await this.resolveSoloPartner(orgId);

        const orders = await this.prisma.order.findMany({
          where: {
            orgId,
            status: { not: 'cancelled' },
            financialStatus: 'paid',
            fulfillmentStatus: { in: ['unfulfilled', 'partial'] },
            lineItems: { some: { sku: { in: unionArr } } },
          },
          include: { lineItems: true },
        });
        scanned = orders.length;

        for (const o of orders) {
          if (!this.orderMatches(o.lineItems, rules)) continue;
          // Bei einem Treffer sind per Definition ALLE Positionen Dropship-Artikel.
          const r = await this.upsertDsOrder(orgId, o, o.lineItems, imageMap, soloPartnerId);
          if (r === 'created') created++;
          else if (r === 'updated') updated++;
        }
      }

      await this.prisma.dsSyncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), ordersScanned: scanned, ordersCreated: created, ordersUpdated: updated, status: 'ok' },
      });
      return { scanned, created, updated };
    } catch (err: any) {
      this.logger.error(`Dropshipping-Sync fuer Org ${orgId} fehlgeschlagen`, err);
      await this.prisma.dsSyncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), status: 'error', error: String(err?.message ?? err).slice(0, 2000) },
      });
      throw err;
    }
  }

  /**
   * Manueller Import einer Bestellung per Bestellnummer — ignoriert die Regeln
   * (Override). Dem Dropshipper werden NUR die Dropship-Produkte gezeigt (SKUs,
   * die in irgendeiner Regel vorkommen); gibt es noch keine Regeln, alle.
   */
  async importByOrderNumber(orgId: string, orderNumber: string): Promise<{ id: string; itemCount: number }> {
    const num = orderNumber.trim().replace(/^#/, '');
    if (!num) throw new BadRequestException('Bestellnummer fehlt');

    const order = await this.prisma.order.findFirst({
      where: { orgId, orderNumber: num },
      include: { lineItems: true },
    });
    if (!order) throw new NotFoundException(`Bestellung #${num} nicht gefunden`);

    const rules = await this.loadRules(orgId);
    const union = new Set<string>();
    for (const r of rules) for (const s of r.skus) union.add(s);

    const dropItems = union.size > 0
      ? order.lineItems.filter((li) => li.sku && union.has(li.sku))
      : order.lineItems;

    if (dropItems.length === 0) {
      throw new BadRequestException(
        'Diese Bestellung enthaelt keine Dropship-Produkte (keine SKU passt zu einer Regel).',
      );
    }

    const imageMap = await this.buildImageMap(orgId, dropItems.map((li) => li.sku!).filter(Boolean));
    const soloPartnerId = await this.resolveSoloPartner(orgId);
    await this.upsertDsOrder(orgId, order, dropItems, imageMap, soloPartnerId);

    const saved = await this.prisma.dsOrder.findUnique({
      where: { orgId_orderExternalId: { orgId, orderExternalId: order.externalId } },
      select: { id: true },
    });
    await this.prisma.dsAuditLog.create({
      data: { orgId, actorType: 'user', action: 'manual_import', dsOrderId: saved?.id, detail: { orderNumber: num } },
    });
    return { id: saved!.id, itemCount: dropItems.length };
  }

  private async resolveSoloPartner(orgId: string): Promise<string | null> {
    const partners = await this.prisma.dsPartner.findMany({
      where: { orgId, active: true }, select: { id: true }, take: 2,
    });
    return partners.length === 1 ? partners[0].id : null;
  }

  private async upsertDsOrder(
    orgId: string,
    o: any,
    dropItems: Array<any>,
    imageMap: Map<string, string | null>,
    soloPartnerId: string | null,
  ): Promise<'created' | 'updated' | 'skipped'> {
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
              imageUrl: li.sku ? imageMap.get(li.sku) ?? null : null,
              lineItemExternalId: li.externalId,
            })),
          },
        },
      });
      return 'created';
    }

    // Nur auffrischen, solange der Dropshipper noch nichts getan hat.
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
          partnerId: soloPartnerId ?? undefined,
        },
      });
      for (const li of dropItems) {
        await this.prisma.dsOrderItem.upsert({
          where: { dsOrderId_lineItemExternalId: { dsOrderId: existing.id, lineItemExternalId: li.externalId } },
          create: {
            orgId, dsOrderId: existing.id, sku: li.sku, title: li.title, quantity: li.quantity,
            imageUrl: li.sku ? imageMap.get(li.sku) ?? null : null, lineItemExternalId: li.externalId,
          },
          update: { sku: li.sku, title: li.title, quantity: li.quantity, imageUrl: li.sku ? imageMap.get(li.sku) ?? null : null },
        });
      }
      const keep = dropItems.map((li) => li.externalId);
      await this.prisma.dsOrderItem.deleteMany({
        where: { dsOrderId: existing.id, lineItemExternalId: { notIn: keep.length ? keep : ['__none__'] } },
      });
    }
    return 'updated';
  }
}
