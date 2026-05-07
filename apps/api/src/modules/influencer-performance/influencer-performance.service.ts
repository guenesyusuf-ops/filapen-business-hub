import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Influencer Performance Service.
 *
 * Speichert pro Influencer×Kampagne×Post eine Zeile mit Basis-Daten,
 * Kosten, Performance-Metriken, Tracking, Content-Analyse + Notizen.
 *
 * Computed-Felder (ROAS, ROI, profit, CPA, CPM, conversion rate, AOV,
 * profit margin) werden hier on-read berechnet — nicht in der DB —
 * weil wir sie auch fuer Filtering/Sorting/Aggregations brauchen und
 * sich Eingabe-Werte sehr oft aendern.
 */

export type EntryStatus =
  | 'planned'
  | 'contacted'
  | 'negotiating'
  | 'booked'
  | 'posted'
  | 'completed'
  | 'cancelled'
  | 'blacklisted';

interface EntryInput {
  influencerProfileId?: string | null;
  influencerName?: string;
  platform?: string;
  category?: string | null;
  managerContact?: string | null;
  profileUrl?: string | null;
  followerCount?: number | null;
  engagementRate?: number | null;
  storyViews?: number | null;
  avgViews?: number | null;
  country?: string | null;
  language?: string | null;

  campaignName?: string | null;
  postedAt?: string | null;
  storyAt?: string | null;
  productName?: string | null;
  discountCode?: string | null;
  discountPct?: number | null;
  landingPageUrl?: string | null;
  affiliateLink?: string | null;
  status?: EntryStatus;

  influencerFee?: number;
  productCost?: number;
  shippingCost?: number;
  cogs?: number;
  extraCost?: number;

  revenue?: number;
  orders?: number;
  clicks?: number;
  views?: number;
  profitMarginOverride?: number | null;

  trackingLink?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  trackingStatus?: string | null;
  attributionConfirmed?: boolean;

  hookWorked?: boolean | null;
  ctaQuality?: number | null;
  videoQuality?: number | null;
  brandingScore?: number | null;
  performanceRating?: number | null;
  bookable?: boolean | null;

  learnings?: string | null;
  whatWorked?: string | null;
  whatDidntWork?: string | null;
  improvementIdeas?: string | null;

  whitelist?: boolean;
  blacklist?: boolean;
}

interface ListFilters {
  search?: string;
  platform?: string;
  status?: EntryStatus | 'all';
  campaignName?: string;
  fromDate?: string;
  toDate?: string;
  whitelist?: boolean;
  blacklist?: boolean;
  /** Nur profitable (ROAS > breakEven) */
  profitableOnly?: boolean;
  /** Mindest-ROAS */
  minRoas?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class InfluencerPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Computed-Felder
  // ------------------------------------------------------------------
  /**
   * Erweitert eine DB-Row um die berechneten Performance-Felder.
   * Alle Beträge in EUR (oder Org-Currency, hier vereinfacht ohne FX).
   *
   * Edge Cases:
   *  - kosten=0 → ROAS/ROI/CPA = null (nicht berechenbar)
   *  - revenue=0 + kosten>0 → profit=−kosten, ROAS=0, ROI=−100
   *  - clicks=0 → conversionRate/EPC = null
   *  - views=0 → CPM = null
   *  - orders=0 → AOV/CPA = null
   *
   * Status-Label (status-derived "performance flag" fuer UI-Badges):
   *  - blacklist → ❌
   *  - roas >= 4 (oder 2× breakEven) → 🔥
   *  - profit > 0 → ✅
   *  - profit ≈ 0 (innerhalb ±5% von break-even) → ⚠
   *  - profit < 0 → ❌
   */
  enrich(row: any) {
    const num = (v: any) => (v == null ? 0 : Number(v));
    const influencerFee = num(row.influencerFee);
    const productCost = num(row.productCost);
    const shippingCost = num(row.shippingCost);
    const cogs = num(row.cogs);
    const extraCost = num(row.extraCost);
    const totalCost = influencerFee + productCost + shippingCost + cogs + extraCost;

    const revenue = num(row.revenue);
    const orders = Number(row.orders ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const views = Number(row.views ?? 0);

    const profit = revenue - totalCost;
    const roas = totalCost > 0 ? revenue / totalCost : null;
    const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : null;
    const cpa = orders > 0 ? totalCost / orders : null;
    const cpm = views > 0 ? (totalCost / views) * 1000 : null;
    const conversionRate = clicks > 0 ? orders / clicks : null;
    const epc = clicks > 0 ? revenue / clicks : null;
    const aov = orders > 0 ? revenue / orders : null;

    // Profit margin: override > computed (revenue > 0)
    const profitMargin = row.profitMarginOverride != null
      ? Number(row.profitMarginOverride)
      : revenue > 0
        ? (profit / revenue) * 100
        : null;
    const breakEvenRoas = profitMargin && profitMargin > 0 ? 100 / profitMargin : null;

    // Performance-Flag fuer UI
    let perfFlag: '🔥' | '✅' | '⚠️' | '❌' | null = null;
    if (row.blacklist) perfFlag = '❌';
    else if (roas != null) {
      if (roas >= (breakEvenRoas ?? 1) * 2) perfFlag = '🔥';
      else if (profit > 0) perfFlag = '✅';
      else if (Math.abs(profit) <= totalCost * 0.05) perfFlag = '⚠️';
      else perfFlag = '❌';
    }

    return {
      ...row,
      // Convert Decimal-Strings → Numbers fuer Frontend
      influencerFee, productCost, shippingCost, cogs, extraCost,
      revenue, orders, clicks, views,
      engagementRate: row.engagementRate != null ? Number(row.engagementRate) : null,
      discountPct: row.discountPct != null ? Number(row.discountPct) : null,
      profitMarginOverride: row.profitMarginOverride != null ? Number(row.profitMarginOverride) : null,
      // Computed
      totalCost,
      profit,
      roas,
      roi,
      cpa,
      cpm,
      conversionRate,
      epc,
      aov,
      profitMargin,
      breakEvenRoas,
      perfFlag,
    };
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  async list(filters: ListFilters = {}) {
    const where: Prisma.InfluencerPerformanceEntryWhereInput = { orgId: DEV_ORG_ID };
    if (filters.platform) where.platform = filters.platform;
    if (filters.status && filters.status !== 'all') where.status = filters.status;
    if (filters.campaignName) where.campaignName = filters.campaignName;
    if (filters.whitelist) where.whitelist = true;
    if (filters.blacklist) where.blacklist = true;
    if (filters.fromDate || filters.toDate) {
      where.postedAt = {};
      if (filters.fromDate) (where.postedAt as any).gte = new Date(filters.fromDate);
      if (filters.toDate) (where.postedAt as any).lte = new Date(filters.toDate);
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { influencerName: { contains: q, mode: 'insensitive' } },
        { campaignName: { contains: q, mode: 'insensitive' } },
        { discountCode: { contains: q, mode: 'insensitive' } },
        { productName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const limit = Math.min(filters.limit ?? 100, 500);
    const offset = filters.offset ?? 0;

    const [rows, total] = await Promise.all([
      this.prisma.influencerPerformanceEntry.findMany({
        where,
        orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.influencerPerformanceEntry.count({ where }),
    ]);
    let items = rows.map((r) => this.enrich(r));
    // Post-filter fuer computed Werte (DB kennt sie nicht)
    if (filters.profitableOnly) {
      items = items.filter((r) => r.profit > 0);
    }
    if (filters.minRoas != null) {
      items = items.filter((r) => r.roas != null && r.roas >= filters.minRoas!);
    }
    return { items, total };
  }

  async get(id: string) {
    const row = await this.prisma.influencerPerformanceEntry.findFirst({
      where: { id, orgId: DEV_ORG_ID },
    });
    if (!row) throw new NotFoundException('Eintrag nicht gefunden');
    return this.enrich(row);
  }

  async create(userId: string, data: EntryInput) {
    if (!data.influencerName?.trim()) throw new BadRequestException('Name erforderlich');
    if (!data.platform?.trim()) throw new BadRequestException('Plattform erforderlich');
    const created = await this.prisma.influencerPerformanceEntry.create({
      data: this.toDb({ ...data, createdById: userId }),
    });
    return this.enrich(created);
  }

  async update(id: string, _userId: string, data: EntryInput) {
    const row = await this.prisma.influencerPerformanceEntry.findFirst({
      where: { id, orgId: DEV_ORG_ID },
    });
    if (!row) throw new NotFoundException('Eintrag nicht gefunden');
    const updated = await this.prisma.influencerPerformanceEntry.update({
      where: { id },
      data: this.toDb(data),
    });
    return this.enrich(updated);
  }

  async remove(id: string) {
    const row = await this.prisma.influencerPerformanceEntry.findFirst({
      where: { id, orgId: DEV_ORG_ID },
    });
    if (!row) throw new NotFoundException('Eintrag nicht gefunden');
    await this.prisma.influencerPerformanceEntry.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Aggregations / Dashboard-KPIs
  // ------------------------------------------------------------------

  /**
   * Globale KPIs ueber den gefilterten Datensatz.
   * Wird vom Dashboard genutzt — gleiche Filter wie list, aber returnt
   * Aggregations statt einzelne Zeilen.
   */
  async kpis(filters: ListFilters = {}) {
    const { items } = await this.list({ ...filters, limit: 500, offset: 0 });
    const totalRevenue = items.reduce((s, r) => s + r.revenue, 0);
    const totalCost = items.reduce((s, r) => s + r.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalOrders = items.reduce((s, r) => s + r.orders, 0);
    const totalViews = items.reduce((s, r) => s + r.views, 0);
    const totalClicks = items.reduce((s, r) => s + r.clicks, 0);
    const influencerCount = items.length;

    const avgRevenuePerInfluencer = influencerCount > 0 ? totalRevenue / influencerCount : 0;
    const overallRoas = totalCost > 0 ? totalRevenue / totalCost : null;
    const avgRoas = (() => {
      const roasVals = items.map((r) => r.roas).filter((v): v is number => v != null);
      return roasVals.length > 0 ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : null;
    })();
    const avgStoryViews = (() => {
      const vals = items.map((r) => r.storyViews).filter((v): v is number => v != null && v > 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();
    const avgConversionRate = (() => {
      const vals = items.map((r) => r.conversionRate).filter((v): v is number => v != null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();
    const cogsShare = totalRevenue > 0
      ? (items.reduce((s, r) => s + r.cogs, 0) / totalRevenue) * 100
      : null;
    const cpa = totalOrders > 0 ? totalCost / totalOrders : null;
    const cpm = totalViews > 0 ? (totalCost / totalViews) * 1000 : null;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : null;

    // Avg profit margin → Break-Even-ROAS
    const marginVals = items.map((r) => r.profitMargin).filter((v): v is number => v != null);
    const avgProfitMargin = marginVals.length > 0
      ? marginVals.reduce((a, b) => a + b, 0) / marginVals.length
      : null;
    const breakEvenRoas = avgProfitMargin && avgProfitMargin > 0 ? 100 / avgProfitMargin : null;

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      totalOrders,
      totalViews,
      totalClicks,
      influencerCount,
      avgRevenuePerInfluencer,
      overallRoas,
      avgRoas,
      breakEvenRoas,
      avgStoryViews,
      avgConversionRate,
      cogsShare,
      cpa,
      cpm,
      roi,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private toDb(input: EntryInput & { createdById?: string }): any {
    const out: any = {};
    // Direkt durchreichen, nur normalisieren
    if ('createdById' in input && input.createdById) out.createdById = input.createdById;
    if (!out.orgId) out.orgId = DEV_ORG_ID;

    const direct = [
      'influencerName', 'platform', 'category', 'managerContact', 'profileUrl',
      'country', 'language', 'campaignName', 'productName', 'discountCode',
      'landingPageUrl', 'affiliateLink', 'status', 'trackingLink', 'utmSource',
      'utmCampaign', 'trackingStatus', 'learnings', 'whatWorked', 'whatDidntWork',
      'improvementIdeas',
    ] as const;
    for (const k of direct) {
      if (k in input) out[k] = (input as any)[k] ?? null;
    }

    const ints = [
      'followerCount', 'storyViews', 'avgViews', 'orders', 'clicks', 'views',
      'ctaQuality', 'videoQuality', 'brandingScore', 'performanceRating',
    ] as const;
    for (const k of ints) {
      if (k in input) {
        const v = (input as any)[k];
        out[k] = v == null ? null : Math.max(0, Math.floor(Number(v)));
      }
    }

    const decimals = [
      'engagementRate', 'discountPct', 'influencerFee', 'productCost',
      'shippingCost', 'cogs', 'extraCost', 'revenue', 'profitMarginOverride',
    ] as const;
    for (const k of decimals) {
      if (k in input) {
        const v = (input as any)[k];
        out[k] = v == null ? null : Number(v);
      }
    }

    const bools = [
      'attributionConfirmed', 'hookWorked', 'bookable', 'whitelist', 'blacklist',
    ] as const;
    for (const k of bools) {
      if (k in input) {
        const v = (input as any)[k];
        out[k] = v == null ? null : !!v;
      }
    }

    const dates = ['postedAt', 'storyAt'] as const;
    for (const k of dates) {
      if (k in input) {
        const v = (input as any)[k];
        out[k] = v ? new Date(v) : null;
      }
    }

    if ('influencerProfileId' in input) {
      out.influencerProfileId = input.influencerProfileId || null;
    }

    return out;
  }
}
