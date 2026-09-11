import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductCostService } from './product-cost.service';
import { toD, round2, ONE, HUNDRED } from './domain/decimal';
import { margin } from './domain/margin';

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
  /** Netto-Wert der nicht zugeordneten Positionen — deren Wareneinsatz fehlt. */
  unmatchedNet: string;
  /** Zugeordnet, aber kein Kostensatz deckt den Liefertermin ab (stille 0). */
  positionsWithoutCostRate: number;
  netWithoutCostRate: string;
  /**
   * Auftraege ohne Wunschliefertermin. Sie lassen sich keinem Monat zuordnen
   * und tauchen deshalb in KEINER Auswertung auf — frueher restlos unsichtbar.
   */
  ordersWithoutDeliveryDate: number;
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
        // 'draft' bleibt aussen vor: jeder KI-Import landet zunaechst als
        // Entwurf, auch ungeprueft und mit niedriger Erkennungssicherheit.
        // Ein Extraktionsfehler darf das Controlling nicht erreichen, bevor
        // der Auftrag bestaetigt wurde.
        status: { notIn: ['cancelled' as any, 'draft' as any] },
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
    let aggGross = toD(0), aggNet = toD(0), aggCost = toD(0), aggProfit = toD(0);
    let unmatchedOrders = 0, unmatchedPositions = 0;
    let unmatchedNet = toD(0);
    let positionsWithoutCostRate = 0;
    let netWithoutCostRate = toD(0);

    for (const order of orders) {
      // requiredDeliveryDate ist durch den Query-Filter garantiert gesetzt —
      // NULL-Termine kommen hier nie an (siehe countOrdersWithoutDeliveryDate).
      const dateForCosts = order.requiredDeliveryDate as Date;
      let orderGrossBeforeSkonto = toD(0);
      let orderCost = toD(0);
      let unmatchedInOrder = 0;

      // gewichteten VAT ermitteln
      let sumForVat = toD(0), sumVatWeighted = toD(0);
      for (const it of order.lineItems) {
        const rate = toD(it.matchedVariant?.vatRate ?? 19);
        const lineNet = toD(it.lineNet);
        sumForVat = sumForVat.plus(lineNet);
        sumVatWeighted = sumVatWeighted.plus(lineNet.times(rate));
      }
      const weightedVatRate = sumForVat.gt(0)
        ? sumVatWeighted.div(sumForVat)
        : toD(19); // Fallback

      for (const it of order.lineItems) {
        const rate = toD(it.matchedVariant?.vatRate ?? 19);
        const lineNet = toD(it.lineNet);
        const lineGross = lineNet.times(ONE.plus(rate.div(HUNDRED)));
        orderGrossBeforeSkonto = orderGrossBeforeSkonto.plus(lineGross);

        if (it.matchedVariant?.productId) {
          const costStr = await this.productCosts.getCostAt(
            orgId, it.matchedVariant.productId, 'cost', dateForCosts,
          );
          if (costStr !== null) {
            orderCost = orderCost.plus(toD(costStr).times(it.quantity));
          } else {
            // Zugeordnet, aber kein Kostensatz deckt den Liefertermin ab.
            // Frueher lief das still auf 0 durch, OHNE den Unmatched-Zaehler
            // zu erhoehen — die Oberflaeche gab also Entwarnung, waehrend der
            // Gewinn mit 100 % Marge gerechnet wurde. Jetzt eigener Zaehler.
            positionsWithoutCostRate++;
            netWithoutCostRate = netWithoutCostRate.plus(lineNet);
          }
        } else {
          unmatchedInOrder++;
          unmatchedPositions++;
          unmatchedNet = unmatchedNet.plus(lineNet);
        }
      }

      const orderGrossAfterSkonto = orderGrossBeforeSkonto
        .times(ONE.minus(toD(SKONTO_PCT).div(HUNDRED)));
      const orderNet = orderGrossAfterSkonto
        .div(ONE.plus(weightedVatRate.div(HUNDRED)));
      const orderProfit = orderNet.minus(orderCost);
      const orderMargin = margin(orderProfit, orderNet);

      if (unmatchedInOrder > 0) unmatchedOrders++;
      aggGross = aggGross.plus(orderGrossAfterSkonto);
      aggNet = aggNet.plus(orderNet);
      aggCost = aggCost.plus(orderCost);
      aggProfit = aggProfit.plus(orderProfit);

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
        margin: orderMargin !== null ? orderMargin.toString() : null,
        hasUnmatched: unmatchedInOrder > 0,
      });
    }

    const aggregate: WholesaleAutoAggregate = {
      orderCount: result.length,
      totalGross: round2(aggGross).toString(),
      totalNet: round2(aggNet).toString(),
      totalVat: round2(aggGross.minus(aggNet)).toString(),
      totalCost: round2(aggCost).toString(),
      totalProfit: round2(aggProfit).toString(),
      margin: margin(aggProfit, aggNet)?.toString() ?? null,
      unmatchedOrders,
      unmatchedPositions,
      unmatchedNet: round2(unmatchedNet).toString(),
      positionsWithoutCostRate,
      netWithoutCostRate: round2(netWithoutCostRate).toString(),
      ordersWithoutDeliveryDate: await this.countOrdersWithoutDeliveryDate(orgId),
    };

    return { orders: result, aggregate };
  }

  /** Nur der Aggregate-Wert fuer CalculationService.computeMonth. */
  async aggregateForMonth(orgId: string, year: number, month: number): Promise<WholesaleAutoAggregate> {
    const { aggregate } = await this.listForMonth(orgId, year, month);
    return aggregate;
  }

  /**
   * Auftraege ohne Wunschliefertermin. Der Monats-Query filtert auf
   * requiredDeliveryDate, und SQL schliesst NULL dabei aus — solche Auftraege
   * erschienen in keinem Monat, keiner Warnung und keiner Unmatched-Liste.
   * Wir erfinden keinen Termin (das wuerde Umsatz in einen falschen Monat
   * schieben), machen sie aber zaehlbar, damit nichts mehr still verschwindet.
   */
  private async countOrdersWithoutDeliveryDate(orgId: string): Promise<number> {
    return this.prisma.salesOrder.count({
      where: {
        orgId,
        requiredDeliveryDate: null,
        status: { notIn: ['cancelled' as any, 'draft' as any] },
      },
    });
  }

  /** Nicht-gematchte Positionen mit Kontext fuer die Match-Warnung. */
  /**
   * Ordnet eine Sales-Order-Line-Position einem Filapen-Produkt zu.
   * Findet den ersten ProductVariant zu dem Produkt und setzt das als
   * matchedProductVariantId auf die Line-Position.
   *
   * Cross-Org-safe: pruefen dass sowohl Line-Item als auch Produkt zur Org gehoeren.
   */
  async matchLineItem(orgId: string, lineItemId: string, productId: string): Promise<{
    ok: boolean;
    matchedProductVariantId: string;
  }> {
    // 1. Verifizieren dass Line-Item zur Org gehoert
    const item = await this.prisma.salesOrderLineItem.findFirst({
      where: { id: lineItemId, orgId },
      select: { id: true, orderId: true },
    });
    if (!item) throw new Error('Sales-Order-Position nicht gefunden');

    // 2. Verifizieren dass Produkt zur Org gehoert + erste Variante finden
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId },
      include: {
        variants: {
          select: { id: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!product) throw new Error('Filapen-Produkt nicht gefunden');
    if (product.variants.length === 0) {
      throw new Error('Produkt hat keine Varianten — kann nicht matchen');
    }
    const variantId = product.variants[0].id;

    // 3. Match setzen
    await this.prisma.salesOrderLineItem.update({
      where: { id: lineItemId },
      data: { matchedProductVariantId: variantId },
    });

    return { ok: true, matchedProductVariantId: variantId };
  }

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
    currentMatch: null;
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
      currentMatch: null,
    }));
  }

  /**
   * Alle Line-Positionen eines Monats (auch bereits gematchte), mit
   * dem aktuellen Match zur Anzeige im "Match aendern"-Wizard.
   */
  async listAllLineItems(orgId: string, year: number, month: number): Promise<Array<{
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
    currentMatch: {
      productId: string;
      productTitle: string;
      externalId: string | null;
    } | null;
  }>> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const items = await this.prisma.salesOrderLineItem.findMany({
      where: {
        orgId,
        order: { requiredDeliveryDate: { gte: from, lte: to }, status: { notIn: ['cancelled' as any] } },
      },
      include: {
        order: { include: { customer: { select: { companyName: true } } } },
        matchedVariant: {
          select: {
            productId: true,
            product: { select: { title: true, externalId: true } },
          },
        },
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
      currentMatch: it.matchedVariant?.product
        ? {
            productId: it.matchedVariant.productId,
            productTitle: it.matchedVariant.product.title,
            externalId: it.matchedVariant.product.externalId,
          }
        : null,
    }));
  }

  /** Match einer Line-Position entfernen (setzt matchedProductVariantId auf null). */
  async unmatchLineItem(orgId: string, lineItemId: string): Promise<{ ok: boolean }> {
    const item = await this.prisma.salesOrderLineItem.findFirst({
      where: { id: lineItemId, orgId },
      select: { id: true },
    });
    if (!item) throw new Error('Sales-Order-Position nicht gefunden');
    await this.prisma.salesOrderLineItem.update({
      where: { id: lineItemId },
      data: { matchedProductVariantId: null },
    });
    return { ok: true };
  }
}

// Frueher stand hier ein eigener round2(n: number) mit Math.round(n * 100) / 100.
// Der ueberschattete das zentrale round2 aus domain/decimal, rechnete in Float
// und rundete an der .xx5-Grenze systematisch ab (1.005 -> 1.00, 8.165 -> 8.16),
// weil 1.005 * 100 als Double 100.49999999999999 ergibt. Der Fehler ging immer
// in dieselbe Richtung und summierte sich damit ueber alle Auftraege auf,
// statt sich auszumitteln. Die gesamte Kette laeuft jetzt ueber Prisma.Decimal.

