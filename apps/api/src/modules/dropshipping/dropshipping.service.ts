import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DsSkuRow {
  sku: string;
  title: string | null;
  productTitle: string;
  variantExternalId: string | null;
  dropship: boolean;
}

/**
 * Owner-seitige Lese-/Pflege-Logik des Dropshipping-Moduls (Hub-intern).
 * Reines Read-Model + SKU-Auswahl; der eigentliche Sync liegt in
 * DropshippingSyncService.
 */
@Injectable()
export class DropshippingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Alle Produkt-Varianten mit SKU + Markierung, ob sie fuer Dropshipping aktiv sind. */
  async listSkus(orgId: string, q?: string): Promise<DsSkuRow[]> {
    const search = (q ?? '').trim();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        orgId,
        sku: { not: null },
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { product: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        externalId: true,
        sku: true,
        title: true,
        product: { select: { title: true } },
      },
      orderBy: [{ product: { title: 'asc' } }, { title: 'asc' }],
      take: 2000,
    });

    const dsRows = await this.prisma.dsSku.findMany({
      where: { orgId },
      select: { sku: true, active: true },
    });
    const activeSet = new Set(dsRows.filter((r) => r.active).map((r) => r.sku));

    const seen = new Set<string>();
    const out: DsSkuRow[] = [];
    for (const v of variants) {
      if (!v.sku || seen.has(v.sku)) continue;
      seen.add(v.sku);
      out.push({
        sku: v.sku,
        title: v.title,
        productTitle: v.product?.title ?? '',
        variantExternalId: v.externalId,
        dropship: activeSet.has(v.sku),
      });
    }
    return out;
  }

  /** SKU fuer Dropshipping an-/abschalten. */
  async toggleSku(
    orgId: string,
    input: { sku: string; title?: string | null; variantExternalId?: string | null; active: boolean },
  ): Promise<{ sku: string; active: boolean }> {
    const sku = input.sku.trim();
    await this.prisma.dsSku.upsert({
      where: { orgId_sku: { orgId, sku } },
      create: {
        orgId,
        sku,
        title: input.title ?? null,
        variantExternalId: input.variantExternalId ?? null,
        active: input.active,
      },
      update: {
        active: input.active,
        title: input.title ?? undefined,
        variantExternalId: input.variantExternalId ?? undefined,
      },
    });
    return { sku, active: input.active };
  }

  /** Owner-Liste der Dropship-Bestellungen. */
  async listOrders(orgId: string, status?: string) {
    const validStatus = ['new', 'shipped_cn', 'in_de', 'delivered', 'on_hold'];
    return this.prisma.dsOrder.findMany({
      where: {
        orgId,
        ...(status && validStatus.includes(status) ? { status: status as any } : {}),
      },
      include: {
        items: true,
        partner: { select: { id: true, name: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 500,
    });
  }

  /** Kennzahlen fuer die Uebersicht: Anzahl je Status + ueberfaellige. */
  async stats(orgId: string) {
    const grouped = await this.prisma.dsOrder.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {
      new: 0, shipped_cn: 0, in_de: 0, delivered: 0, on_hold: 0,
    };
    for (const g of grouped) byStatus[g.status] = g._count._all;

    // "Ueberfaellig": seit > 48h offen (status new).
    const threshold = new Date(Date.now() - 48 * 3600 * 1000);
    const overdue = await this.prisma.dsOrder.count({
      where: { orgId, status: 'new', placedAt: { lt: threshold } },
    });

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const activeSkus = await this.prisma.dsSku.count({ where: { orgId, active: true } });

    return { byStatus, overdue, total, activeSkus };
  }

  /** Letzter Sync-Lauf. */
  async lastSync(orgId: string) {
    return this.prisma.dsSyncLog.findFirst({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
