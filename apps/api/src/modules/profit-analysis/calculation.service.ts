import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';
import { ProductCostService } from './product-cost.service';
import { WholesaleService } from './wholesale.service';
import { WholesaleSyncService } from './wholesale-sync.service';
import { OverheadService } from './overhead.service';
import { SETTING_KEYS } from './settings.constants';
import { calculateMixedVat, roundMixedVat, MixedVatResult } from './domain/vat';
import {
  webshopProfit, amazonProfit, tiktokProfit, aggregateDay,
  ChannelProfitResult, DayAggregateResult, roundChannelProfit,
} from './domain/channel-profit';
import { calculateWholesaleOrder, roundWholesaleOrder } from './domain/wholesale';
import { aggregateOverhead, roundOverheadTotals } from './domain/overhead';
import { D, toD, round2 } from './domain/decimal';
import { margin } from './domain/margin';

export interface ComputedChannel {
  vat: MixedVatResult;                     // gross/net/vat inkl. Retouren
  profit: ChannelProfitResult;             // inkl. Marge + ROAS
}

export interface ComputedDay {
  date: string;
  monthStatus: 'open' | 'closed' | 'locked';
  shopify: ComputedChannel;
  amazon: ComputedChannel;
  tiktok: ComputedChannel;
  aggregate: DayAggregateResult;
  // fuer UI-Warnungen (§74):
  warnings: string[];
}

export interface ComputedMonthTotal {
  netSalesTotal: string;
  grossSalesTotal: string;
  vatTotal: string;
  adsTotal: string;
  productCostsTotal: string;
  shippingCostsTotal: string;
  platformFeesTotal: string;
  profitBeforeOverhead: string;              // Master-Prompt §55 (ohne Grosshandel)
  marginBeforeOverhead: string | null;       // Master-Prompt §37
}

export interface ComputedWholesaleTotals {
  orderCount: number;
  totalGross: string;
  totalNet: string;
  totalVat: string;
  totalCost: string;
  totalProfit: string;
  margin: string | null;
}

export interface ComputedOverheadCategory {
  category: string;
  totalNet: string;
  ratioOfNetSales: string | null;
}

export interface ComputedOverhead {
  entries: Array<{
    id: string;
    category: string;
    label: string;
    enteredAmount: string;
    isGross: boolean;
    vatRate: string;
    netAmount: string;
    grossAmount: string;
    vatAmount: string;
    note: string | null;
  }>;
  totalNet: string;
  totalGross: string;
  totalVat: string;
  byCategory: ComputedOverheadCategory[];
}

export interface ComputedMonth {
  year: number;
  month: number;
  status: 'open' | 'closed' | 'locked' | null;
  days: ComputedDay[];
  totals: ComputedMonthTotal;
  wholesale: ComputedWholesaleTotals;
  overhead: ComputedOverhead;
  /** Master-Prompt §55: Profit vor Gemeinkosten (Kanäle + Grosshandel). */
  profitBeforeOverheadWithWholesale: string;
  /** Master-Prompt §56: operativer Monatsgewinn (nach Gemeinkosten). */
  operatingProfit: string;
  /** Master-Prompt §57: operative Endmarge. */
  operatingMargin: string | null;
  /** Netto-Umsatz inkl. Grosshandel — Basis fuer §57 und §54. */
  netSalesWithWholesale: string;
}

/**
 * Orchestriert die reinen Domain-Functions mit den historisierten Kosten und
 * Settings. Ist damit die einzige Stelle im Modul die "wie viel war die
 * Amazon-Gebuehr am 15. Juli" beantwortet — Read-Model.
 */
@Injectable()
export class CalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly productCosts: ProductCostService,
    private readonly wholesale: WholesaleService,
    private readonly wholesaleSync: WholesaleSyncService,
    private readonly overhead: OverheadService,
  ) {}

  /**
   * Vollstaendige Monatsberechnung. Fuer jeden vorhandenen Tag werden die
   * Kanal-Profite berechnet, plus Monats-Summen darueber.
   */
  async computeMonth(orgId: string, year: number, month: number): Promise<ComputedMonth> {
    const monthRow = await this.prisma.paMonth.findUnique({
      where: { orgId_year_month: { orgId, year, month } },
      include: {
        days: {
          orderBy: { date: 'asc' },
          include: { channelSales: true, ads: true, shipping: true, productSales: true },
        },
      },
    });

    if (!monthRow) {
      return {
        year, month, status: null, days: [],
        totals: this.zeroTotals(),
        wholesale: this.zeroWholesale(),
        overhead: this.zeroOverhead(),
        profitBeforeOverheadWithWholesale: '0',
        operatingProfit: '0',
        operatingMargin: null,
        netSalesWithWholesale: '0',
      };
    }

    // Alle Produkt-IDs fuer diesen Monat einsammeln → Kosten in einem Rutsch
    const productIds = new Set<string>();
    for (const d of monthRow.days) {
      for (const ps of d.productSales) productIds.add(ps.productId);
    }
    const costLookup = await this.buildCostLookup(orgId, Array.from(productIds));

    // Settings pro Datum abrufen (koennen sich innerhalb eines Monats aendern!)
    const days: ComputedDay[] = [];
    for (const day of monthRow.days) {
      days.push(await this.computeDayFromRow(orgId, day, costLookup));
    }
    const dayTotals = this.computeMonthTotals(days);

    // Grosshandel des Monats — automatisch aus /sales aggregiert
    // (requiredDeliveryDate im Monat, 3% Skonto pauschal, historische Produktkosten)
    const syncAgg = await this.wholesaleSync.aggregateForMonth(orgId, year, month);
    const wsNet = toD(syncAgg.totalNet);
    const wholesaleTotals: ComputedWholesaleTotals = {
      orderCount: syncAgg.orderCount,
      totalGross: syncAgg.totalGross,
      totalNet: syncAgg.totalNet,
      totalVat: syncAgg.totalVat,
      totalCost: syncAgg.totalCost,
      totalProfit: syncAgg.totalProfit,
      margin: syncAgg.margin,
    };

    // Gemeinkosten des Monats (inkl. Prozent-Anteil §54)
    const netSalesTotalWithWholesale = toD(dayTotals.netSalesTotal).plus(wsNet);
    const overheadEntries = await this.overhead.getEntriesForMonth(orgId, monthRow.id);
    const overheadRaw = aggregateOverhead(
      overheadEntries.map((e: any) => ({
        category: e.category, label: e.label,
        enteredAmount: e.enteredAmount, isGross: e.isGross, vatRate: e.vatRate,
      })),
      netSalesTotalWithWholesale,
    );
    const overheadRounded = roundOverheadTotals(overheadRaw);
    const overheadApi: ComputedOverhead = {
      entries: overheadEntries.map((e: any, i: number) => ({
        id: e.id, category: e.category, label: e.label,
        enteredAmount: e.enteredAmount.toString(),
        isGross: e.isGross, vatRate: e.vatRate.toString(),
        netAmount: overheadRounded.entries[i].netAmount.toString(),
        grossAmount: overheadRounded.entries[i].grossAmount.toString(),
        vatAmount: overheadRounded.entries[i].vatAmount.toString(),
        note: e.note,
      })),
      totalNet: overheadRounded.totalNet.toString(),
      totalGross: overheadRounded.totalGross.toString(),
      totalVat: overheadRounded.totalVat.toString(),
      byCategory: Object.entries(overheadRounded.byCategory).map(([cat, v]) => ({
        category: cat,
        totalNet: v.totalNet.toString(),
        ratioOfNetSales: v.ratioOfNetSales?.toString() ?? null,
      })),
    };

    // §55, §56, §57
    const profitBeforeOverheadWithWholesale = toD(dayTotals.profitBeforeOverhead).plus(toD(syncAgg.totalProfit));
    const operatingProfit = profitBeforeOverheadWithWholesale.minus(overheadRaw.totalNet);
    const operatingMargin = margin(operatingProfit, netSalesTotalWithWholesale);

    return {
      year, month,
      status: monthRow.status as any,
      days,
      totals: dayTotals,
      wholesale: wholesaleTotals,
      overhead: overheadApi,
      profitBeforeOverheadWithWholesale: round2(profitBeforeOverheadWithWholesale).toString(),
      operatingProfit: round2(operatingProfit).toString(),
      operatingMargin: operatingMargin?.toString() ?? null,
      netSalesWithWholesale: round2(netSalesTotalWithWholesale).toString(),
    };
  }

  private zeroWholesale(): ComputedWholesaleTotals {
    return { orderCount: 0, totalGross: '0', totalNet: '0', totalVat: '0', totalCost: '0', totalProfit: '0', margin: null };
  }
  private zeroOverhead(): ComputedOverhead {
    return { entries: [], totalNet: '0', totalGross: '0', totalVat: '0', byCategory: [] };
  }

  /** Einzelner Tag — praktisch fuer Autosave-Response ("was ergibt sich jetzt"). */
  async computeDay(orgId: string, dateIso: string): Promise<ComputedDay | null> {
    const parsed = new Date(dateIso + 'T00:00:00.000Z');
    const day = await this.prisma.paDay.findUnique({
      where: { orgId_date: { orgId, date: parsed } },
      include: {
        channelSales: true, ads: true, shipping: true, productSales: true,
        month: { select: { status: true } },
      },
    });
    if (!day) return null;

    const productIds = day.productSales.map((ps) => ps.productId);
    const costLookup = await this.buildCostLookup(orgId, productIds);
    return this.computeDayFromRow(orgId, day, costLookup);
  }

  // ---------------------------------------------------------------------------
  // Kern-Berechnung eines Tages
  // ---------------------------------------------------------------------------

  private async computeDayFromRow(orgId: string, day: any, costLookup: CostLookup): Promise<ComputedDay> {
    const date = day.date as Date;
    const dateIso = date.toISOString().slice(0, 10);

    // Historisch korrekte Settings fuer diesen Tag
    const [
      vatStandardStr, vatReducedStr,
      paymentFeeStr, amazonFeeStr, tiktokFeeStr,
      dhlPriceStr,
    ] = await Promise.all([
      this.settings.getValueAt(orgId, SETTING_KEYS.VAT_STANDARD, date),
      this.settings.getValueAt(orgId, SETTING_KEYS.VAT_REDUCED, date),
      this.settings.getValueAt(orgId, SETTING_KEYS.PAYMENT_FEE_SHOPIFY, date),
      this.settings.getValueAt(orgId, SETTING_KEYS.FEE_AMAZON, date),
      this.settings.getValueAt(orgId, SETTING_KEYS.FEE_TIKTOK, date),
      this.settings.getValueAt(orgId, SETTING_KEYS.DHL_PRICE_PER_PACKAGE, date),
    ]);

    // ChannelSales indexieren
    const byChannel = new Map<string, any>();
    for (const cs of day.channelSales) byChannel.set(cs.channel, cs);
    const shopifySales = byChannel.get('shopify') ?? this.zeroChannelSalesRow();
    const amazonSales  = byChannel.get('amazon')  ?? this.zeroChannelSalesRow();
    const tiktokSales  = byChannel.get('tiktok')  ?? this.zeroChannelSalesRow();

    // Ads / Shipping
    const ads = day.ads;
    const shipping = day.shipping;
    const dhlPrice = toD(dhlPriceStr);

    // Kanal-VAT/Netto berechnen
    const shopifyVat = calculateMixedVat({
      gross19: shopifySales.gross19, gross7: shopifySales.gross7,
      returns19: shopifySales.returns19, returns7: shopifySales.returns7,
      vatStandard: vatStandardStr, vatReduced: vatReducedStr,
    });
    const amazonVat = calculateMixedVat({
      gross19: amazonSales.gross19, gross7: amazonSales.gross7,
      returns19: amazonSales.returns19, returns7: amazonSales.returns7,
      vatStandard: vatStandardStr, vatReduced: vatReducedStr,
    });
    const tiktokVat = calculateMixedVat({
      gross19: tiktokSales.gross19, gross7: tiktokSales.gross7,
      returns19: tiktokSales.returns19, returns7: tiktokSales.returns7,
      vatStandard: vatStandardStr, vatReduced: vatReducedStr,
    });

    // Produktkosten pro Kanal (Stueckzahlen × historische Kosten)
    const productSalesByChannel = this.groupProductSales(day.productSales);
    const shopifyProductCosts = this.sumProductCosts(productSalesByChannel.shopify, costLookup, dateIso, 'cost');
    const amazonProductCosts  = this.sumProductCosts(productSalesByChannel.amazon,  costLookup, dateIso, 'cost');
    const tiktokProductCosts  = this.sumProductCosts(productSalesByChannel.tiktok,  costLookup, dateIso, 'cost');
    const amazonFulfillment   = this.sumProductCosts(productSalesByChannel.amazon,  costLookup, dateIso, 'fulfillment');

    // Versandkosten (Pakete × DHL-Preis)
    const shopifyShipping = toD(shipping?.shopifyPackages ?? 0).times(dhlPrice);
    const tiktokShipping  = toD(shipping?.tiktokPackages  ?? 0).times(dhlPrice);

    // Kanal-Profite
    const webshop = webshopProfit({
      netSales: shopifyVat.netAdjusted,
      grossSales: shopifyVat.grossAdjusted,
      productCosts: shopifyProductCosts,
      shippingCosts: shopifyShipping,
      paymentFeeRatePercent: paymentFeeStr,
      metaAds: ads?.meta ?? 0,
      googleAds: ads?.google ?? 0,
      influencer: ads?.influencer ?? 0,
    });
    const amazonRes = amazonProfit({
      netSales: amazonVat.netAdjusted,
      grossSales: amazonVat.grossAdjusted,
      productCosts: amazonProductCosts,
      fulfillmentCosts: amazonFulfillment,
      feeRatePercent: amazonFeeStr,
      amazonPpc: ads?.amazonPpc ?? 0,
    });
    const tiktokRes = tiktokProfit({
      netSales: tiktokVat.netAdjusted,
      grossSales: tiktokVat.grossAdjusted,
      productCosts: tiktokProductCosts,
      shippingCosts: tiktokShipping,
      feeRatePercent: tiktokFeeStr,
      tiktokAds: ads?.tiktokAds ?? 0,
    });

    const aggregate = aggregateDay({ webshop, amazon: amazonRes, tiktok: tiktokRes });

    // Produkt-Titel fuer Warnungen anhaengen
    const productTitles = new Map<string, string>();
    if (day.productSales.length > 0) {
      const ids = day.productSales.map((s: any) => s.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      });
      products.forEach((p) => productTitles.set(p.id, p.title));
    }
    const productSalesWithTitle = day.productSales.map((s: any) => ({
      ...s, productTitle: productTitles.get(s.productId),
    }));

    // Warnungen (§74)
    const warnings = this.collectWarnings({
      shopifyVat, amazonVat, tiktokVat,
      shopifyProductSalesCount: productSalesByChannel.shopify.length,
      amazonProductSalesCount: productSalesByChannel.amazon.length,
      tiktokProductSalesCount: productSalesByChannel.tiktok.length,
      shopifyPackages: shipping?.shopifyPackages ?? 0,
      tiktokPackages: shipping?.tiktokPackages ?? 0,
      ads,
      costLookup,
      productSales: productSalesWithTitle,
      dateIso,
    });

    return {
      date: dateIso,
      monthStatus: day.month?.status ?? 'open',
      shopify: { vat: roundMixedVat(shopifyVat), profit: roundChannelProfit(webshop) },
      amazon:  { vat: roundMixedVat(amazonVat),  profit: roundChannelProfit(amazonRes) },
      tiktok:  { vat: roundMixedVat(tiktokVat),  profit: roundChannelProfit(tiktokRes) },
      aggregate: {
        totalNetSales: round2(aggregate.totalNetSales),
        totalProfit: round2(aggregate.totalProfit),
        totalMargin: aggregate.totalMargin,
      } as any,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // Monats-Summen
  // ---------------------------------------------------------------------------

  private computeMonthTotals(days: ComputedDay[]): ComputedMonthTotal {
    let netSales = toD(0), grossSales = toD(0), vat = toD(0);
    let ads = toD(0), productCosts = toD(0), shipping = toD(0), fees = toD(0);
    let profit = toD(0);

    for (const d of days) {
      netSales = netSales
        .plus(toD(d.shopify.profit.netSales)).plus(toD(d.amazon.profit.netSales)).plus(toD(d.tiktok.profit.netSales));
      grossSales = grossSales
        .plus(d.shopify.vat.grossAdjusted).plus(d.amazon.vat.grossAdjusted).plus(d.tiktok.vat.grossAdjusted);
      vat = vat
        .plus(d.shopify.vat.vatTotal).plus(d.amazon.vat.vatTotal).plus(d.tiktok.vat.vatTotal);
      ads = ads
        .plus(toD(d.shopify.profit.adsAttributed)).plus(toD(d.amazon.profit.adsAttributed)).plus(toD(d.tiktok.profit.adsAttributed));
      productCosts = productCosts
        .plus(toD(d.shopify.profit.productCosts)).plus(toD(d.amazon.profit.productCosts)).plus(toD(d.tiktok.profit.productCosts));
      shipping = shipping
        .plus(toD(d.shopify.profit.shippingCosts)).plus(toD(d.amazon.profit.shippingCosts)).plus(toD(d.tiktok.profit.shippingCosts));
      fees = fees
        .plus(toD(d.shopify.profit.platformFees)).plus(toD(d.amazon.profit.platformFees)).plus(toD(d.tiktok.profit.platformFees));
      profit = profit
        .plus(toD(d.shopify.profit.profit)).plus(toD(d.amazon.profit.profit)).plus(toD(d.tiktok.profit.profit));
    }

    return {
      netSalesTotal: round2(netSales).toString(),
      grossSalesTotal: round2(grossSales).toString(),
      vatTotal: round2(vat).toString(),
      adsTotal: round2(ads).toString(),
      productCostsTotal: round2(productCosts).toString(),
      shippingCostsTotal: round2(shipping).toString(),
      platformFeesTotal: round2(fees).toString(),
      profitBeforeOverhead: round2(profit).toString(),
      marginBeforeOverhead: margin(profit, netSales)?.toString() ?? null,
    };
  }

  private zeroTotals(): ComputedMonthTotal {
    return {
      netSalesTotal: '0', grossSalesTotal: '0', vatTotal: '0',
      adsTotal: '0', productCostsTotal: '0', shippingCostsTotal: '0', platformFeesTotal: '0',
      profitBeforeOverhead: '0', marginBeforeOverhead: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Kosten-Lookups
  // ---------------------------------------------------------------------------

  private async buildCostLookup(orgId: string, productIds: string[]): Promise<CostLookup> {
    if (productIds.length === 0) return new Map();
    const [costs, ffs] = await Promise.all([
      this.prisma.paProductCost.findMany({
        where: { orgId, productId: { in: productIds } },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.paAmazonFulfillmentCost.findMany({
        where: { orgId, productId: { in: productIds } },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);
    const lookup: CostLookup = new Map();
    for (const productId of productIds) {
      lookup.set(productId, {
        cost: costs.filter((r) => r.productId === productId).map((r) => ({
          from: r.effectiveFrom, to: r.effectiveTo, value: r.cost,
        })),
        fulfillment: ffs.filter((r) => r.productId === productId).map((r) => ({
          from: r.effectiveFrom, to: r.effectiveTo, value: r.cost,
        })),
      });
    }
    return lookup;
  }

  private sumProductCosts(
    sales: Array<{ productId: string; quantity: number }>,
    lookup: CostLookup,
    dateIso: string,
    kind: 'cost' | 'fulfillment',
  ): D {
    const target = new Date(dateIso + 'T00:00:00.000Z');
    let total = toD(0);
    for (const s of sales) {
      const entry = lookup.get(s.productId);
      if (!entry) continue;
      const periods = kind === 'cost' ? entry.cost : entry.fulfillment;
      const valid = periods.find((p) =>
        p.from.getTime() <= target.getTime()
        && (p.to === null || p.to.getTime() >= target.getTime()),
      );
      if (!valid) continue;
      total = total.plus(toD(valid.value).times(s.quantity));
    }
    return total;
  }

  private groupProductSales(sales: any[]): Record<'shopify' | 'amazon' | 'tiktok', Array<{ productId: string; quantity: number }>> {
    const grouped = { shopify: [] as any[], amazon: [] as any[], tiktok: [] as any[] };
    for (const s of sales) {
      grouped[s.channel as keyof typeof grouped].push({ productId: s.productId, quantity: s.quantity });
    }
    return grouped;
  }

  private zeroChannelSalesRow() {
    return { gross19: 0, gross7: 0, returns19: 0, returns7: 0 };
  }

  // ---------------------------------------------------------------------------
  // Datenqualitaets-Warnungen (§74)
  // ---------------------------------------------------------------------------

  private collectWarnings(ctx: any): string[] {
    const w: string[] = [];
    if (ctx.shopifyVat.grossAdjusted.gt(0) && ctx.shopifyProductSalesCount === 0) {
      w.push('Shopify-Umsatz vorhanden, aber keine Produktverkaeufe eingetragen.');
    }
    if (ctx.amazonVat.grossAdjusted.gt(0) && ctx.amazonProductSalesCount === 0) {
      w.push('Amazon-Umsatz vorhanden, aber keine Produktverkaeufe eingetragen.');
    }
    if (ctx.tiktokVat.grossAdjusted.gt(0) && ctx.tiktokProductSalesCount === 0) {
      w.push('TikTok-Umsatz vorhanden, aber keine Produktverkaeufe eingetragen.');
    }
    if (ctx.shopifyVat.grossAdjusted.gt(0) && ctx.shopifyPackages === 0) {
      w.push('Shopify-Umsatz vorhanden, aber keine Pakete versendet.');
    }
    // Produkt-spezifische Kosten-Luecken (§74)
    const missingCost = new Set<string>();
    const missingFulfillment = new Set<string>();
    for (const s of ctx.productSales as any[]) {
      const entry = ctx.costLookup.get(s.productId);
      if (!entry?.cost.length) missingCost.add(s.productTitle ?? s.productId);
      if (s.channel === 'amazon' && !entry?.fulfillment.length) {
        missingFulfillment.add(s.productTitle ?? s.productId);
      }
    }
    if (missingCost.size > 0) {
      const list = Array.from(missingCost).slice(0, 3).join(', ');
      const rest = missingCost.size > 3 ? ` (+${missingCost.size - 3})` : '';
      w.push(`Produktkosten fehlen: ${list}${rest}`);
    }
    if (missingFulfillment.size > 0) {
      const list = Array.from(missingFulfillment).slice(0, 3).join(', ');
      const rest = missingFulfillment.size > 3 ? ` (+${missingFulfillment.size - 3})` : '';
      w.push(`Amazon-Fulfillment-Kosten fehlen fuer: ${list}${rest}`);
    }
    if (ctx.tiktokVat.grossAdjusted.gt(0) && toD(ctx.ads?.tiktokAds ?? 0).isZero()) {
      w.push('TikTok-Umsatz vorhanden, aber keine TikTok Ads eingetragen.');
    }
    // §74: sehr hoher Umsatz ohne Werbekosten
    const shopifyGross = ctx.shopifyVat.grossAdjusted;
    const shopifyAds = toD(ctx.ads?.meta ?? 0).plus(toD(ctx.ads?.google ?? 0));
    if (shopifyGross.gt(1000) && shopifyAds.isZero()) {
      w.push('Ueber 1.000 EUR Shopify-Umsatz ohne Meta/Google-Ads — bewusst so?');
    }
    return w;
  }
}

// -----------------------------------------------------------------------------
// Interne Typen
// -----------------------------------------------------------------------------

type CostLookup = Map<string, {
  cost: Array<{ from: Date; to: Date | null; value: any }>;
  fulfillment: Array<{ from: Date; to: Date | null; value: any }>;
}>;
