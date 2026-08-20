import { Injectable } from '@nestjs/common';
import { Prisma, PaChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Meist verkaufte Artikel im Zeitraum.
 *
 * Quelle: pa_daily_product_sale (Shopify / Amazon / TikTok Tages-Stueckzahlen).
 * Grosshandel wird bewusst NICHT eingerechnet — sein Aggregat basiert auf
 * requiredDeliveryDate, das ist eine andere Zeit-Achse.
 *
 * Skalierbar: aggregiert per Prisma groupBy, kein N+1.
 */

export interface TopProductRow {
  productId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  totalQty: number;
  perChannel: { shopify: number; amazon: number; tiktok: number };
}

export interface TopProductsResult {
  from: string;
  to: string;
  totalUnits: number;
  productCount: number;
  items: TopProductRow[];
}

@Injectable()
export class TopProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForRange(orgId: string, fromIso: string, toIso: string, limit = 50): Promise<TopProductsResult> {
    const from = new Date(fromIso + 'T00:00:00.000Z');
    const to = new Date(toIso + 'T23:59:59.999Z');

    // Alle Product-Sales im Range mit Kanal, gruppiert per (productId, channel)
    const rows = await this.prisma.paDailyProductSale.groupBy({
      by: ['productId', 'channel'],
      where: {
        orgId,
        day: { date: { gte: from, lte: to } },
      },
      _sum: { quantity: true },
    });

    // Nach productId gruppieren + perChannel-Splitting
    const byProduct = new Map<string, { total: number; shopify: number; amazon: number; tiktok: number }>();
    for (const r of rows) {
      const qty = r._sum.quantity ?? 0;
      const prev = byProduct.get(r.productId) ?? { total: 0, shopify: 0, amazon: 0, tiktok: 0 };
      prev.total += qty;
      if (r.channel === 'shopify') prev.shopify += qty;
      if (r.channel === 'amazon')  prev.amazon += qty;
      if (r.channel === 'tiktok')  prev.tiktok += qty;
      byProduct.set(r.productId, prev);
    }

    if (byProduct.size === 0) {
      return { from: fromIso, to: toIso, totalUnits: 0, productCount: 0, items: [] };
    }

    // Produkt-Metadaten in einem Batch nachladen
    const productIds = Array.from(byProduct.keys());
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, sku: true, imageUrl: true },
    });
    const metaMap = new Map(products.map((p) => [p.id, p]));

    const items: TopProductRow[] = productIds
      .map((pid) => {
        const agg = byProduct.get(pid)!;
        const meta = metaMap.get(pid);
        return {
          productId: pid,
          title: meta?.title ?? '(gelöschtes Produkt)',
          sku: meta?.sku ?? null,
          imageUrl: meta?.imageUrl ?? null,
          totalQty: agg.total,
          perChannel: { shopify: agg.shopify, amazon: agg.amazon, tiktok: agg.tiktok },
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, Math.max(1, Math.min(500, limit)));

    const totalUnits = Array.from(byProduct.values()).reduce((a, v) => a + v.total, 0);
    return {
      from: fromIso, to: toIso,
      totalUnits,
      productCount: byProduct.size,
      items,
    };
  }
}
