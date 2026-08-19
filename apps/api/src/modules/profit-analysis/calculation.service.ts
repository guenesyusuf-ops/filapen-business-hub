import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';
import { ProductCostService } from './product-cost.service';
import { SETTING_KEYS } from './settings.constants';
import { calculateMixedVat, roundMixedVat, MixedVatResult } from './domain/vat';
import {
  webshopProfit, amazonProfit, tiktokProfit, aggregateDay,
  ChannelProfitResult, DayAggregateResult, roundChannelProfit,
} from './domain/channel-profit';
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

export interface ComputedMonth {
  year: number;
  month: number;
  status: 'open' | 'closed' | 'locked' | null;
  days: ComputedDay[];
  totals: ComputedMonthTotal;
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

    return {
      year, month,
      status: monthRow.status as any,
      days,
      totals: this.computeMonthTotals(days),
    };
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
      productSales: day.productSales,
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
    // Produktkosten-Luecken
    for (const s of ctx.productSales as any[]) {
      const entry = ctx.costLookup.get(s.productId);
      if (!entry?.cost.length) {
        w.push(`Produktkosten fehlen fuer verkauftes Produkt (Kanal ${s.channel}).`);
        break;
      }
    }
    if (ctx.tiktokVat.grossAdjusted.gt(0) && toD(ctx.ads?.tiktokAds ?? 0).isZero()) {
      w.push('TikTok-Umsatz vorhanden, aber keine TikTok Ads eingetragen.');
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
