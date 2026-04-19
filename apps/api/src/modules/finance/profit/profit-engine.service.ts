import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';
import type {
  PnLResult,
  WaterfallSegment,
  ChannelPerformance,
  ProductProfitability,
} from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Internal row types returned by $queryRaw
// ---------------------------------------------------------------------------

interface AggregateRow {
  gross_revenue: Prisma.Decimal;
  total_discounts: Prisma.Decimal;
  total_refunds: Prisma.Decimal;
  net_revenue: Prisma.Decimal;
  total_cogs: Prisma.Decimal;
  total_ad_spend: Prisma.Decimal;
  total_shipping_cost: Prisma.Decimal;
  total_payment_fees: Prisma.Decimal;
  total_fixed_costs_allocated: Prisma.Decimal;
  order_count: bigint;
  units_sold: bigint;
  new_customer_count: bigint;
  returning_customer_count: bigint;
  refund_count: bigint;
}

interface DailyRow {
  date: Date;
  gross_revenue: Prisma.Decimal;
  net_revenue: Prisma.Decimal;
  total_cogs: Prisma.Decimal;
  total_ad_spend: Prisma.Decimal;
  total_shipping_cost: Prisma.Decimal;
  total_payment_fees: Prisma.Decimal;
  total_fixed_costs_allocated: Prisma.Decimal;
  total_discounts: Prisma.Decimal;
  total_refunds: Prisma.Decimal;
  gross_profit: Prisma.Decimal;
  contribution_margin: Prisma.Decimal;
  net_profit: Prisma.Decimal;
  order_count: bigint;
  units_sold: bigint;
  new_customer_count: bigint;
  returning_customer_count: bigint;
  refund_count: bigint;
}

interface ChannelRow extends AggregateRow {
  channel: string;
  impressions: bigint;
  clicks: bigint;
  conversions: bigint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PNL_CACHE_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ProfitEngineService {
  private readonly logger = new Logger(ProfitEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // =========================================================================
  // calculatePnL — main entry point
  // =========================================================================

  /**
   * Calculate the full P&L waterfall for a date range and optional channel.
   *
   * Waterfall:
   *   Gross Revenue -> Discounts -> Refunds -> Net Revenue -> COGS ->
   *   Gross Profit -> Ad Spend -> Shipping -> Payment Fees -> Fixed Costs -> Net Profit
   */
  async calculatePnL(
    orgId: string,
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<PnLResult> {
    // 1. Check Redis cache
    const cacheKey = this.buildCacheKey('pnl', orgId, startDate, endDate, channel);
    const cached = await this.cache.get<PnLResult>(cacheKey);
    if (cached) {
      this.logger.debug(`PnL cache hit: ${cacheKey}`);
      return cached;
    }

    // 2. Query DailyAggregate — ALWAYS filter by channel to prevent summing
    // multiple channel rows. Default to 'all' which is the pre-aggregated total.
    const effectiveChannel = channel || 'all';
    const channelFilter = Prisma.sql`AND channel = ${effectiveChannel}::channel`;

    const rows = await this.prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COALESCE(SUM(gross_revenue), 0)              AS gross_revenue,
        COALESCE(SUM(total_discounts), 0)             AS total_discounts,
        COALESCE(SUM(total_refunds), 0)               AS total_refunds,
        COALESCE(SUM(net_revenue), 0)                 AS net_revenue,
        COALESCE(SUM(total_cogs), 0)                  AS total_cogs,
        COALESCE(SUM(total_ad_spend), 0)              AS total_ad_spend,
        COALESCE(SUM(total_shipping_cost), 0)         AS total_shipping_cost,
        COALESCE(SUM(total_payment_fees), 0)          AS total_payment_fees,
        COALESCE(SUM(total_fixed_costs_allocated), 0) AS total_fixed_costs_allocated,
        COALESCE(SUM(order_count), 0)::bigint         AS order_count,
        COALESCE(SUM(units_sold), 0)::bigint          AS units_sold,
        COALESCE(SUM(new_customer_count), 0)::bigint  AS new_customer_count,
        COALESCE(SUM(returning_customer_count), 0)::bigint AS returning_customer_count,
        COALESCE(SUM(refund_count), 0)::bigint        AS refund_count
      FROM daily_aggregates
      WHERE org_id = ${orgId}::uuid
        AND date >= ${startDate}::date
        AND date <= ${endDate}::date
        ${channelFilter}
    `;

    const row = rows[0];

    // 3. Extract numeric values
    const grossRevenue = Number(row.gross_revenue);
    const discounts = Number(row.total_discounts);
    const refunds = Number(row.total_refunds);
    const cogs = Number(row.total_cogs);
    const adSpend = Number(row.total_ad_spend);
    const shippingCosts = Number(row.total_shipping_cost);
    const paymentFees = Number(row.total_payment_fees);
    const fixedCosts = Number(row.total_fixed_costs_allocated);
    const orderCount = Number(row.order_count);
    const newCustomerCount = Number(row.new_customer_count);
    const refundCount = Number(row.refund_count);

    // 4. Calculate derived metrics
    // grossRevenue (Shopify total_price) already has discounts/refunds deducted.
    // Do NOT subtract discounts/refunds again — they are informational only.
    const netRevenue = grossRevenue;
    const grossProfit = netRevenue - cogs;
    const contributionMargin = grossProfit - adSpend - shippingCosts - paymentFees;
    const netProfit = contributionMargin - fixedCosts;

    const grossMarginPercent =
      netRevenue > 0
        ? Math.round((grossProfit / netRevenue) * 10000) / 100
        : 0;

    const contributionMarginPercent =
      netRevenue > 0
        ? Math.round((contributionMargin / netRevenue) * 10000) / 100
        : 0;

    const netMarginPercent =
      netRevenue > 0
        ? Math.round((netProfit / netRevenue) * 10000) / 100
        : 0;

    // 5. Build waterfall segments
    const waterfall = this.buildWaterfallSegments({
      grossRevenue,
      discounts,
      refunds,
      cogs,
      adSpend,
      shippingCosts,
      paymentFees,
      fixedCosts,
      netProfit,
    });

    // 6. Assemble result
    const result: PnLResult = {
      dateRange: { start: startDate, end: endDate },
      grossRevenue: round2(grossRevenue),
      discounts: round2(discounts),
      netRevenue: round2(netRevenue),
      cogs: round2(cogs),
      grossProfit: round2(grossProfit),
      grossMarginPercent,
      adSpend: round2(adSpend),
      shippingCosts: round2(shippingCosts),
      paymentFees: round2(paymentFees),
      contributionMargin: round2(contributionMargin),
      contributionMarginPercent,
      fixedCosts: round2(fixedCosts),
      netProfit: round2(netProfit),
      netMarginPercent,
      waterfall,
    };

    // 7. Cache and return
    await this.cache.set(cacheKey, result, PNL_CACHE_TTL);
    return result;
  }

  // =========================================================================
  // calculateProductProfitability
  // =========================================================================

  /**
   * Product-level profitability for a date range.
   * Returns sorted, paginated product margin data.
   */
  async calculateProductProfitability(
    orgId: string,
    startDate: Date,
    endDate: Date,
    options: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
      page: number;
      pageSize: number;
      search?: string;
      category?: string;
    },
  ): Promise<{ items: ProductProfitability[]; total: number }> {
    const { sortBy, sortOrder, page, pageSize, search, category } = options;
    const offset = (page - 1) * pageSize;

    const sortColumnMap: Record<string, string> = {
      grossRevenue: 'gross_revenue',
      grossProfit: 'gross_profit',
      grossMarginPercent: 'gross_margin_pct',
      unitsSold: 'units_sold',
      refundRate: 'refund_rate',
      title: 'p.title',
    };
    const orderCol = sortColumnMap[sortBy] ?? 'gross_revenue';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const searchClause = search
      ? Prisma.sql`AND (p.title ILIKE ${'%' + search + '%'} OR pv.sku ILIKE ${'%' + search + '%'})`
      : Prisma.empty;
    const categoryClause = category
      ? Prisma.sql`AND p.category = ${category}`
      : Prisma.empty;

    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT p.id)::bigint AS count
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id
      INNER JOIN order_line_items oli ON oli.product_variant_id = pv.id
      INNER JOIN orders o ON o.id = oli.order_id
      WHERE p.org_id = ${orgId}::uuid
        AND o.placed_at >= ${startDate}
        AND o.placed_at <= ${endDate}
        AND o.status != 'cancelled'
        ${searchClause}
        ${categoryClause}
    `;
    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        title: string;
        sku: string | null;
        image_url: string | null;
        units_sold: bigint;
        gross_revenue: Prisma.Decimal;
        total_cogs: Prisma.Decimal;
        gross_profit: Prisma.Decimal;
        gross_margin_pct: Prisma.Decimal;
        refund_count: bigint;
        refund_rate: Prisma.Decimal;
      }>
    >`
      SELECT
        p.id                                                  AS product_id,
        p.title                                               AS title,
        MIN(pv.sku)                                           AS sku,
        p.image_url                                           AS image_url,
        COALESCE(SUM(oli.quantity), 0)::bigint                AS units_sold,
        COALESCE(SUM(oli.line_total), 0)                      AS gross_revenue,
        COALESCE(SUM(oli.line_cogs), 0)                       AS total_cogs,
        COALESCE(SUM(oli.line_total), 0) - COALESCE(SUM(COALESCE(oli.line_cogs, 0)), 0)
                                                              AS gross_profit,
        CASE
          WHEN SUM(oli.line_total) > 0
          THEN ((SUM(oli.line_total) - SUM(COALESCE(oli.line_cogs, 0))) / SUM(oli.line_total) * 100)
          ELSE 0
        END                                                   AS gross_margin_pct,
        COUNT(DISTINCT CASE WHEN o.financial_status IN ('refunded', 'partially_refunded') THEN o.id END)::bigint
                                                              AS refund_count,
        CASE
          WHEN COUNT(DISTINCT o.id) > 0
          THEN (COUNT(DISTINCT CASE WHEN o.financial_status IN ('refunded', 'partially_refunded') THEN o.id END)::numeric
                / COUNT(DISTINCT o.id)::numeric * 100)
          ELSE 0
        END                                                   AS refund_rate
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id
      INNER JOIN order_line_items oli ON oli.product_variant_id = pv.id
      INNER JOIN orders o ON o.id = oli.order_id
      WHERE p.org_id = ${orgId}::uuid
        AND o.placed_at >= ${startDate}
        AND o.placed_at <= ${endDate}
        AND o.status != 'cancelled'
        ${searchClause}
        ${categoryClause}
      GROUP BY p.id, p.title, p.image_url
      ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(orderDir)}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const items: ProductProfitability[] = rows.map((r) => ({
      productId: r.product_id,
      title: r.title,
      sku: r.sku,
      imageUrl: r.image_url,
      unitsSold: Number(r.units_sold),
      grossRevenue: round2(Number(r.gross_revenue)),
      totalCogs: round2(Number(r.total_cogs)),
      grossProfit: round2(Number(r.gross_profit)),
      grossMarginPercent: Math.round(Number(r.gross_margin_pct) * 100) / 100,
      refundCount: Number(r.refund_count),
      refundRate: Math.round(Number(r.refund_rate) * 100) / 100,
    }));

    return { items, total };
  }

  // =========================================================================
  // getTimeSeries
  // =========================================================================

  /**
   * Daily time series data for dashboard charts.
   */
  async getTimeSeries(
    orgId: string,
    startDate: Date,
    endDate: Date,
    metrics: string[],
    channel?: string,
  ): Promise<{ dates: string[]; series: Record<string, number[]> }> {
    const cacheKey = this.buildCacheKey(
      'ts',
      orgId,
      startDate,
      endDate,
      channel,
      metrics.sort().join(','),
    );
    const cached = await this.cache.get<{
      dates: string[];
      series: Record<string, number[]>;
    }>(cacheKey);
    if (cached) return cached;

    // Always filter by channel to prevent summing multiple channel rows
    const effectiveChannel = channel || 'all';
    const channelFilter = Prisma.sql`AND channel = ${effectiveChannel}::channel`;

    const rows = await this.prisma.$queryRaw<DailyRow[]>`
      SELECT
        date,
        COALESCE(SUM(gross_revenue), 0)              AS gross_revenue,
        COALESCE(SUM(net_revenue), 0)                 AS net_revenue,
        COALESCE(SUM(total_cogs), 0)                  AS total_cogs,
        COALESCE(SUM(total_ad_spend), 0)              AS total_ad_spend,
        COALESCE(SUM(total_shipping_cost), 0)         AS total_shipping_cost,
        COALESCE(SUM(total_payment_fees), 0)          AS total_payment_fees,
        COALESCE(SUM(total_fixed_costs_allocated), 0) AS total_fixed_costs_allocated,
        COALESCE(SUM(total_discounts), 0)             AS total_discounts,
        COALESCE(SUM(total_refunds), 0)               AS total_refunds,
        COALESCE(SUM(gross_profit), 0)                AS gross_profit,
        COALESCE(SUM(contribution_margin), 0)         AS contribution_margin,
        COALESCE(SUM(net_profit), 0)                  AS net_profit,
        COALESCE(SUM(order_count), 0)::bigint         AS order_count,
        COALESCE(SUM(units_sold), 0)::bigint          AS units_sold,
        COALESCE(SUM(new_customer_count), 0)::bigint  AS new_customer_count,
        COALESCE(SUM(returning_customer_count), 0)::bigint AS returning_customer_count,
        COALESCE(SUM(refund_count), 0)::bigint        AS refund_count
      FROM daily_aggregates
      WHERE org_id = ${orgId}::uuid
        AND date >= ${startDate}::date
        AND date <= ${endDate}::date
        ${channelFilter}
      GROUP BY date
      ORDER BY date ASC
    `;

    // Map of metric name to column accessor
    const metricAccessors: Record<string, (r: DailyRow) => number> = {
      revenue: (r) => Number(r.gross_revenue),
      netRevenue: (r) => Number(r.net_revenue),
      profit: (r) => Number(r.net_profit),
      grossProfit: (r) => Number(r.gross_profit),
      adSpend: (r) => Number(r.total_ad_spend),
      cogs: (r) => Number(r.total_cogs),
      shipping: (r) => Number(r.total_shipping_cost),
      paymentFees: (r) => Number(r.total_payment_fees),
      fixedCosts: (r) => Number(r.total_fixed_costs_allocated),
      discounts: (r) => Number(r.total_discounts),
      refunds: (r) => Number(r.total_refunds),
      contributionMargin: (r) => Number(r.contribution_margin),
      orders: (r) => Number(r.order_count),
      units: (r) => Number(r.units_sold),
      newCustomers: (r) => Number(r.new_customer_count),
      returningCustomers: (r) => Number(r.returning_customer_count),
      refundCount: (r) => Number(r.refund_count),
    };

    const dates = rows.map((r) => formatDateISO(r.date));
    const series: Record<string, number[]> = {};

    for (const metric of metrics) {
      const accessor = metricAccessors[metric];
      if (accessor) {
        series[metric] = rows.map((r) => round2(accessor(r)));
      } else {
        this.logger.warn(`Unknown time-series metric: ${metric}`);
        series[metric] = rows.map(() => 0);
      }
    }

    const result = { dates, series };
    await this.cache.set(cacheKey, result, PNL_CACHE_TTL);
    return result;
  }

  // =========================================================================
  // getChannelPerformance
  // =========================================================================

  /**
   * Channel-level performance breakdown.
   */
  async getChannelPerformance(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ChannelPerformance[]> {
    const cacheKey = this.buildCacheKey('channel', orgId, startDate, endDate);
    const cached = await this.cache.get<ChannelPerformance[]>(cacheKey);
    if (cached) return cached;

    // Join daily_aggregates with ad_metrics for impression/click/conversion data
    const rows = await this.prisma.$queryRaw<ChannelRow[]>`
      SELECT
        da.channel                                     AS channel,
        COALESCE(SUM(da.gross_revenue), 0)             AS gross_revenue,
        COALESCE(SUM(da.total_discounts), 0)           AS total_discounts,
        COALESCE(SUM(da.total_refunds), 0)             AS total_refunds,
        COALESCE(SUM(da.net_revenue), 0)               AS net_revenue,
        COALESCE(SUM(da.total_cogs), 0)                AS total_cogs,
        COALESCE(SUM(da.total_ad_spend), 0)            AS total_ad_spend,
        COALESCE(SUM(da.total_shipping_cost), 0)       AS total_shipping_cost,
        COALESCE(SUM(da.total_payment_fees), 0)        AS total_payment_fees,
        COALESCE(SUM(da.total_fixed_costs_allocated), 0) AS total_fixed_costs_allocated,
        COALESCE(SUM(da.order_count), 0)::bigint       AS order_count,
        COALESCE(SUM(da.units_sold), 0)::bigint        AS units_sold,
        COALESCE(SUM(da.new_customer_count), 0)::bigint AS new_customer_count,
        COALESCE(SUM(da.returning_customer_count), 0)::bigint AS returning_customer_count,
        COALESCE(SUM(da.refund_count), 0)::bigint      AS refund_count,
        COALESCE(am.total_impressions, 0)::bigint      AS impressions,
        COALESCE(am.total_clicks, 0)::bigint           AS clicks,
        COALESCE(am.total_conversions, 0)::bigint      AS conversions
      FROM daily_aggregates da
      LEFT JOIN LATERAL (
        SELECT
          SUM(adm.impressions) AS total_impressions,
          SUM(adm.clicks)     AS total_clicks,
          SUM(adm.conversions) AS total_conversions
        FROM ad_metrics adm
        WHERE adm.org_id = da.org_id
          AND adm.date >= ${startDate}::date
          AND adm.date <= ${endDate}::date
          AND (
            (da.channel = 'meta_ads' AND adm.platform = 'meta') OR
            (da.channel = 'google_ads' AND adm.platform = 'google') OR
            (da.channel = 'tiktok' AND adm.platform = 'tiktok') OR
            (da.channel = 'amazon' AND adm.platform = 'amazon')
          )
      ) am ON true
      WHERE da.org_id = ${orgId}::uuid
        AND da.date >= ${startDate}::date
        AND da.date <= ${endDate}::date
        AND da.channel::text != 'all'
      GROUP BY da.channel, am.total_impressions, am.total_clicks, am.total_conversions
      ORDER BY SUM(da.gross_revenue) DESC
    `;

    const results: ChannelPerformance[] = rows.map((r) => {
      const spend = Number(r.total_ad_spend);
      const revenue = Number(r.net_revenue);
      const conversions = Number(r.conversions);
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);

      return {
        channel: r.channel,
        spend: round2(spend),
        revenue: round2(revenue),
        roas: spend > 0 ? round2(revenue / spend) : 0,
        conversions,
        cpa: conversions > 0 ? round2(spend / conversions) : 0,
        impressions,
        clicks,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? round2(spend / clicks) : 0,
      };
    });

    await this.cache.set(cacheKey, results, PNL_CACHE_TTL);
    return results;
  }

  // =========================================================================
  // buildWaterfallSegments
  // =========================================================================

  /**
   * Build the P&L waterfall chart segments.
   *
   * Segments:
   *   1. Gross Revenue (+)
   *   2. Discounts (-)
   *   3. Refunds (-)
   *   4. COGS (-)
   *   5. Ad Spend (-)
   *   6. Shipping (-)
   *   7. Payment Fees (-)
   *   8. Fixed Costs (-)
   *   9. Net Profit (= total)
   */
  buildWaterfallSegments(pnl: {
    grossRevenue: number;
    discounts: number;
    refunds: number;
    cogs: number;
    adSpend: number;
    shippingCosts: number;
    paymentFees: number;
    fixedCosts: number;
    netProfit: number;
  }): WaterfallSegment[] {
    return [
      {
        label: 'Gross Revenue',
        value: round2(pnl.grossRevenue),
        type: 'positive',
        color: '#22c55e',
      },
      {
        label: 'Discounts',
        value: round2(-pnl.discounts),
        type: 'negative',
        color: '#f97316',
      },
      {
        label: 'Refunds',
        value: round2(-pnl.refunds),
        type: 'negative',
        color: '#ef4444',
      },
      {
        label: 'COGS',
        value: round2(-pnl.cogs),
        type: 'negative',
        color: '#a855f7',
      },
      {
        label: 'Ad Spend',
        value: round2(-pnl.adSpend),
        type: 'negative',
        color: '#3b82f6',
      },
      {
        label: 'Shipping',
        value: round2(-pnl.shippingCosts),
        type: 'negative',
        color: '#6366f1',
      },
      {
        label: 'Payment Fees',
        value: round2(-pnl.paymentFees),
        type: 'negative',
        color: '#ec4899',
      },
      {
        label: 'Fixed Costs',
        value: round2(-pnl.fixedCosts),
        type: 'negative',
        color: '#78716c',
      },
      {
        label: 'Net Profit',
        value: round2(pnl.netProfit),
        type: 'total',
        color: pnl.netProfit >= 0 ? '#22c55e' : '#ef4444',
      },
    ];
  }

  // =========================================================================
  // getCampaigns
  // =========================================================================

  /**
   * Campaign-level performance aggregated over a date range.
   */
  async getCampaigns(
    orgId: string,
    startDate: Date,
    endDate: Date,
    platform?: string,
  ): Promise<Array<{
    id: string;
    name: string;
    status: string;
    externalId: string;
    platform: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
    cpa: number;
    ctr: number;
    cpc: number;
  }>> {
    const cacheKey = this.buildCacheKey('campaigns', orgId, startDate, endDate, platform);
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const platformFilter = platform
      ? Prisma.sql`AND aa.platform = ${platform}::ad_platform`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        status: string;
        external_id: string;
        platform: string;
        spend: Prisma.Decimal;
        impressions: bigint;
        clicks: bigint;
        conversions: bigint;
        revenue: Prisma.Decimal;
        roas: Prisma.Decimal;
      }>
    >`
      SELECT
        c.id,
        c.name,
        c.status::text,
        c.external_id,
        aa.platform::text,
        COALESCE(SUM(m.spend), 0) AS spend,
        COALESCE(SUM(m.impressions), 0)::bigint AS impressions,
        COALESCE(SUM(m.clicks), 0)::bigint AS clicks,
        COALESCE(SUM(m.conversions), 0)::bigint AS conversions,
        COALESCE(SUM(m.conversion_value), 0) AS revenue,
        CASE WHEN SUM(m.spend) > 0
          THEN SUM(m.conversion_value) / SUM(m.spend)
          ELSE 0
        END AS roas
      FROM ad_campaigns c
      INNER JOIN ad_accounts aa ON aa.id = c.ad_account_id
      LEFT JOIN ad_metrics m
        ON c.id = m.campaign_id
        AND m.date >= ${startDate}::date
        AND m.date <= ${endDate}::date
      WHERE c.org_id = ${orgId}::uuid
        ${platformFilter}
      GROUP BY c.id, c.name, c.status, c.external_id, aa.platform
      ORDER BY COALESCE(SUM(m.spend), 0) DESC
    `;

    const results = rows.map((r) => {
      const spend = Number(r.spend);
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      const conversions = Number(r.conversions);
      const revenue = Number(r.revenue);

      return {
        id: r.id,
        name: r.name,
        status: r.status,
        externalId: r.external_id,
        platform: r.platform,
        spend: round2(spend),
        impressions,
        clicks,
        conversions,
        revenue: round2(revenue),
        roas: round2(Number(r.roas)),
        cpa: conversions > 0 ? round2(spend / conversions) : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? round2(spend / clicks) : 0,
      };
    });

    await this.cache.set(cacheKey, results, PNL_CACHE_TTL);
    return results;
  }

  // =========================================================================
  // getCampaignDetail
  // =========================================================================

  /**
   * Single campaign detail with daily time series metrics.
   */
  async getCampaignDetail(
    orgId: string,
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    campaign: {
      id: string;
      name: string;
      status: string;
      externalId: string;
      platform: string;
      objective: string | null;
      dailyBudget: number | null;
    };
    totals: {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      revenue: number;
      roas: number;
      cpa: number;
      ctr: number;
      cpc: number;
      cpm: number;
    };
    daily: Array<{
      date: string;
      spend: number;
      revenue: number;
      roas: number;
      impressions: number;
      clicks: number;
      conversions: number;
    }>;
  }> {
    // Fetch campaign info
    const campaign = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        status: string;
        external_id: string;
        platform: string;
        objective: string | null;
        daily_budget: Prisma.Decimal | null;
      }>
    >`
      SELECT
        c.id, c.name, c.status::text, c.external_id,
        aa.platform::text, c.objective, c.daily_budget
      FROM ad_campaigns c
      INNER JOIN ad_accounts aa ON aa.id = c.ad_account_id
      WHERE c.id = ${campaignId}::uuid AND c.org_id = ${orgId}::uuid
    `;

    if (!campaign.length) {
      throw new Error('Campaign not found');
    }
    const info = campaign[0];

    // Fetch daily metrics
    const dailyRows = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        spend: Prisma.Decimal;
        impressions: bigint;
        clicks: bigint;
        conversions: bigint;
        revenue: Prisma.Decimal;
      }>
    >`
      SELECT
        m.date,
        COALESCE(SUM(m.spend), 0) AS spend,
        COALESCE(SUM(m.impressions), 0)::bigint AS impressions,
        COALESCE(SUM(m.clicks), 0)::bigint AS clicks,
        COALESCE(SUM(m.conversions), 0)::bigint AS conversions,
        COALESCE(SUM(m.conversion_value), 0) AS revenue
      FROM ad_metrics m
      WHERE m.campaign_id = ${campaignId}::uuid
        AND m.org_id = ${orgId}::uuid
        AND m.date >= ${startDate}::date
        AND m.date <= ${endDate}::date
      GROUP BY m.date
      ORDER BY m.date ASC
    `;

    // Build daily array
    const daily = dailyRows.map((r) => {
      const spend = Number(r.spend);
      const revenue = Number(r.revenue);
      return {
        date: formatDateISO(r.date),
        spend: round2(spend),
        revenue: round2(revenue),
        roas: spend > 0 ? round2(revenue / spend) : 0,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        conversions: Number(r.conversions),
      };
    });

    // Compute totals
    const totalSpend = daily.reduce((s, d) => s + d.spend, 0);
    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0);
    const totalClicks = daily.reduce((s, d) => s + d.clicks, 0);
    const totalConversions = daily.reduce((s, d) => s + d.conversions, 0);

    return {
      campaign: {
        id: info.id,
        name: info.name,
        status: info.status,
        externalId: info.external_id,
        platform: info.platform,
        objective: info.objective,
        dailyBudget: info.daily_budget ? Number(info.daily_budget) : null,
      },
      totals: {
        spend: round2(totalSpend),
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        revenue: round2(totalRevenue),
        roas: totalSpend > 0 ? round2(totalRevenue / totalSpend) : 0,
        cpa: totalConversions > 0 ? round2(totalSpend / totalConversions) : 0,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        cpc: totalClicks > 0 ? round2(totalSpend / totalClicks) : 0,
        cpm: totalImpressions > 0 ? round2((totalSpend / totalImpressions) * 1000) : 0,
      },
      daily,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private buildCacheKey(
    prefix: string,
    orgId: string,
    startDate: Date,
    endDate: Date,
    ...extra: Array<string | undefined>
  ): string {
    const parts = [
      prefix,
      orgId,
      formatDateISO(startDate),
      formatDateISO(endDate),
      ...extra.filter(Boolean),
    ];
    return parts.join(':');
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}
