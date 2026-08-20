import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductCostService } from './product-cost.service';

/**
 * Automatischer Sync des Grosshandel-Bereichs mit dem Verkauf-Modul (/sales).
 *
 * Regeln (Master's Vorgabe):
 *   - Quelle: SalesOrder + SalesOrderLineItem
 *   - Datum: requiredDeliveryDate (Wunschliefertermin) bestimmt Monatszuordnung
 *   - Skonto: pauschal 3 % vom Bruttoumsatz abziehen (immer)
 *   - Produktkosten: via matched ProductVariant → productId → pa_product_cost
 *     historisch am requiredDeliveryDate
 *   - Nicht-gematchte Positionen: Warnung, Master matched manuell im
 *     Verkauf-Modul
 *
 * KEIN Schreiben in pa_wholesale_order — live-aggregiert.
 */

const SKONTO_PCT = 3;   // §Master's Vorgabe, ggf. spaeter konfigurierbar

export type WholesaleOrderStatus = 'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'paid' | 'completed' | 'cancelled';

export interface WholesaleAutoOrder {
  id: string;
  orderNumber: string;
  externalOrderNumber: string | null;
  customerName: string;
  requiredDeliveryDate: string | null;      // YYYY-MM-DD
  status: string;
  itemCount: number;
  unmatchedCount: number;
  totalGrossBeforeSkonto: string;
  totalGross: string;                       // nach 3% Skonto
  totalNet: string;                         // Brutto/1.19 (bzw. weighted VAT)
  totalCost: string;                        // Σ (Menge × Produktkosten)
  totalProfit: string;                      // Netto − Produktkosten
  margin: string | null;
  hasUnmatched: boolean;
}

export interface WholesaleAutoAggregate {
  orderCount: number;
  totalGross: string;
  totalNet: string;
  totalVat: string;
  totalCost: string;
  totalProfit: string;
  margin: string | null;
  unmatchedOrders: number;
  unmatchedPositions: number;
}

@Injectable()
export class WholesaleSyncService {
  private readonly logger = new Logger(WholesaleSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productCosts: ProductCostService,
  ) {}

  /** Alle Auftraege eines Monats via requiredDeliveryDate. */
  async listForMonth(orgId: string, year: number, month: number): Promise<{
    orders: WholesaleAutoOrder[];
    aggregate: WholesaleAutoAggregate;
  }> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return this.listForRange(orgId, from, to);
  }

  async listForRange(orgId: string, from: Date, to: Date): Promise<{
    orders: WholesaleAutoOrder[];
    aggregate: WholesaleAutoAggregate;
  }> {
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        orgId,
        requiredDeliveryDate: { gte: from, lte: to },
        status: { notIn: ['cancelled' as any] },
      },
      include: {
        customer: { select: { companyName: true } },
        lineItems: {
          include: {
            matchedVariant: {
              select: { id: true, productId: true, vatRate: true, title: true },
            },
          },
        },
      },
      orderBy: { requiredDeliveryDate: 'asc' },
    });

    // Fuer historische Kosten: fuer jede matched-Position die pa_product_cost
    // am requiredDeliveryDate abfragen. Ein Batch pro Auftrag reicht.
    const result: WholesaleAutoOrder[] = [];
    let aggGross = 0, aggNet = 0, aggCost = 0, aggProfit = 0;
    let unmatchedOrders = 0, unmatchedPositions = 0;

    for (const order of orders) {
      const dateForCosts = order.requiredDeliveryDate ?? new Date();
      let orderGrossBeforeSkonto = 0;
      let orderCost = 0;
      let unmatchedInOrder = 0;
      let weightedVatRate = 19; // Fallback

      // gewichteten VAT ermitteln
      let sumForVat = 0, sumVatWeighted = 0;
      for (const it of order.lineItems) {
        const rate = it.matchedVariant?.vatRate !== undefined
          ? Number(it.matchedVariant.vatRate)
          : 19;
        const lineNet = Number(it.lineNet);
        sumForVat += lineNet;
        sumVatWeighted += lineNet * rate;
      }
      if (sumForVat > 0) weightedVatRate = sumVatWeighted / sumForVat;

      for (const it of order.lineItems) {
        const rate = it.matchedVariant?.vatRate !== undefined
          ? Number(it.matchedVariant.vatRate)
          : 19;
        const lineNet = Number(it.lineNet);
        const lineGross = lineNet * (1 + rate / 100);
        orderGrossBeforeSkonto += lineGross;

        if (it.matchedVariant?.productId) {
          const costStr = await this.productCosts.getCostAt(
            orgId, it.matchedVariant.productId, 'cost', dateForCosts,
          );
          if (costStr !== null) {
            orderCost += Number(costStr) * it.quantity;
          }
        } else {
          unmatchedInOrder++;
          unmatchedPositions++;
        }
      }

      const orderGrossAfterSkonto = orderGrossBeforeSkonto * (1 - SKONTO_PCT / 100);
      const orderNet = orderGrossAfterSkonto / (1 + weightedVatRate / 100);
      const orderVat = orderGrossAfterSkonto - orderNet;
      const orderProfit = orderNet - orderCost;
      const orderMargin = orderNet > 0 ? (orderProfit / orderNet) * 100 : null;

      if (unmatchedInOrder > 0) unmatchedOrders++;
      aggGross += orderGrossAfterSkonto;
      aggNet += orderNet;
      aggCost += orderCost;
      aggProfit += orderProfit;

      result.push({
        id: order.id,
        orderNumber: order.orderNumber,
        externalOrderNumber: order.externalOrderNumber,
        customerName: order.customer?.companyName ?? '—',
        requiredDeliveryDate: order.requiredDeliveryDate?.toISOString().slice(0, 10) ?? null,
        status: order.status,
        itemCount: order.lineItems.length,
        unmatchedCount: unmatchedInOrder,
        totalGrossBeforeSkonto: round2(orderGrossBeforeSkonto).toString(),
        totalGross: round2(orderGrossAfterSkonto).toString(),
        totalNet: round2(orderNet).toString(),
        totalCost: round2(orderCost).toString(),
        totalProfit: round2(orderProfit).toString(),
        margin: orderMargin !== null ? round2(orderMargin).toString() : null,
        hasUnmatched: unmatchedInOrder > 0,
      });
    }

    const aggregate: WholesaleAutoAggregate = {
      orderCount: result.length,
      totalGross: round2(aggGross).toString(),
      totalNet: round2(aggNet).toString(),
      totalVat: round2(aggGross - aggNet).toString(),
      totalCost: round2(aggCost).toString(),
      totalProfit: round2(aggProfit).toString(),
      margin: aggNet > 0 ? round2((aggProfit / aggNet) * 100).toString() : null,
      unmatchedOrders,
      unmatchedPositions,
    };

    return { orders: result, aggregate };
  }

  /** Nur der Aggregate-Wert fuer CalculationService.computeMonth. */
  async aggregateForMonth(orgId: string, year: number, month: number): Promise<WholesaleAutoAggregate> {
    const { aggregate } = await this.listForMonth(orgId, year, month);
    return aggregate;
  }

  /** Nicht-gematchte Positionen mit Kontext fuer die Match-Warnung. */
  async listUnmatched(orgId: string, year: number, month: number): Promise<Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    lineItemId: string;
    position: number;
    title: string;
    ean: string | null;
    supplierArticleNumber: string | null;
    quantity: number;
    lineNet: string;
  }>> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const items = await this.prisma.salesOrderLineItem.findMany({
      where: {
        orgId,
        matchedProductVariantId: null,
        order: { requiredDeliveryDate: { gte: from, lte: to }, status: { notIn: ['cancelled' as any] } },
      },
      include: {
        order: { include: { customer: { select: { companyName: true } } } },
      },
      orderBy: [{ order: { requiredDeliveryDate: 'asc' } }, { position: 'asc' }],
    });
    return items.map((it) => ({
      orderId: it.orderId,
      orderNumber: it.order.orderNumber,
      customerName: it.order.customer?.companyName ?? '—',
      lineItemId: it.id,
      position: it.position,
      title: it.title,
      ean: it.ean,
      supplierArticleNumber: it.supplierArticleNumber,
      quantity: it.quantity,
      lineNet: it.lineNet.toString(),
    }));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
