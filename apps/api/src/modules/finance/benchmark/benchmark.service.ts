import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgMetrics {
  roas: number;
  grossMargin: number;
  netMargin: number;
  cac: number;
  aov: number;
  refundRate: number;
  repeatPurchaseRate: number;
  conversionRate: number;
}

export interface BenchmarkTier {
  roas: number;
  grossMargin: number;
  netMargin: number;
  cac: number;
  aov: number;
  refundRate: number;
  repeatPurchaseRate: number;
  conversionRate: number;
}

export interface MetricComparison {
  metric: string;
  label: string;
  orgValue: number;
  avgValue: number;
  top25Value: number;
  bottom25Value: number;
  percentile: number;
  status: 'above_avg' | 'at_avg' | 'below_avg';
  format: 'currency' | 'percent' | 'multiplier';
}

export interface BenchmarkResult {
  org: OrgMetrics;
  benchmarks: {
    ecommerce_avg: BenchmarkTier;
    ecommerce_top25: BenchmarkTier;
    ecommerce_bottom25: BenchmarkTier;
  };
  comparison: MetricComparison[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface OrgMetricRow {
  gross_revenue: Prisma.Decimal;
  net_revenue: Prisma.Decimal;
  total_cogs: Prisma.Decimal;
  net_profit: Prisma.Decimal;
  total_ad_spend: Prisma.Decimal;
  order_count: bigint;
  new_customer_count: bigint;
  refund_count: bigint;
  impressions: bigint;
  clicks: bigint;
  conversions: bigint;
}

interface RepeatRow {
  total_customers: bigint;
  repeat_customers: bigint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL = 300;

// Industry benchmarks (hardcoded for MVP)
const BENCHMARKS = {
  ecommerce_avg: {
    roas: 4.0,
    grossMargin: 55,
    netMargin: 12,
    cac: 35,
    aov: 65,
    refundRate: 3.5,
    repeatPurchaseRate: 27,
    conversionRate: 2.8,
  },
  ecommerce_top25: {
    roas: 6.5,
    grossMargin: 68,
    netMargin: 22,
    cac: 20,
    aov: 95,
    refundRate: 1.8,
    repeatPurchaseRate: 42,
    conversionRate: 4.5,
  },
  ecommerce_bottom25: {
    roas: 2.0,
    grossMargin: 35,
    netMargin: 3,
    cac: 65,
    aov: 40,
    refundRate: 7,
    repeatPurchaseRate: 12,
    conversionRate: 1.2,
  },
} as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // =========================================================================
  // getBenchmarks
  // =========================================================================

  async getBenchmarks(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BenchmarkResult> {
    const cacheKey = `bench:${orgId}:${fmt(startDate)}:${fmt(endDate)}`;
    const cached = await this.cache.get<BenchmarkResult>(cacheKey);
    if (cached) return cached;

    const orgMetrics = await this.getOrgMetrics(orgId, startDate, endDate);
    const comparison = this.compareMetrics(orgMetrics, BENCHMARKS);
    const recommendations = this.generateRecommendations(orgMetrics, BENCHMARKS);

    const result: BenchmarkResult = {
      org: orgMetrics,
      benchmarks: { ...BENCHMARKS },
      comparison,
      recommendations,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  // =========================================================================
  // getOrgMetrics
  // =========================================================================

  private async getOrgMetrics(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrgMetrics> {
    // Core financial metrics from daily aggregates
    const rows = await this.prisma.$queryRaw<OrgMetricRow[]>`
      SELECT
        da_totals.*,
        COALESCE(am_totals.impressions, 0)::bigint AS impressions,
        COALESCE(am_totals.clicks, 0)::bigint AS clicks,
        COALESCE(am_totals.conversions, 0)::bigint AS conversions
      FROM (
        SELECT
          COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
          COALESCE(SUM(net_revenue), 0) AS net_revenue,
          COALESCE(SUM(total_cogs), 0) AS total_cogs,
          COALESCE(SUM(net_profit), 0) AS net_profit,
          COALESCE(SUM(total_ad_spend), 0) AS total_ad_spend,
          COALESCE(SUM(order_count), 0)::bigint AS order_count,
          COALESCE(SUM(new_customer_count), 0)::bigint AS new_customer_count,
          COALESCE(SUM(refund_count), 0)::bigint AS refund_count
        FROM daily_aggregates
        WHERE org_id = ${orgId}::uuid
          AND date >= ${startDate}::date
          AND date <= ${endDate}::date
          AND channel::text = 'all'
      ) da_totals
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(impressions), 0) AS impressions,
          COALESCE(SUM(clicks), 0) AS clicks,
          COALESCE(SUM(conversions), 0) AS conversions
        FROM ad_metrics
        WHERE org_id = ${orgId}::uuid
          AND date >= ${startDate}::date
          AND date <= ${endDate}::date
      ) am_totals
    `;

    const row = rows[0] || {
      gross_revenue: 0, net_revenue: 0, total_cogs: 0, net_profit: 0,
      total_ad_spend: 0, order_count: 0n, new_customer_count: 0n,
      refund_count: 0n, impressions: 0n, clicks: 0n, conversions: 0n,
    };
    const grossRevenue = Number(row.gross_revenue);
    const netRevenue = Number(row.net_revenue);
    const cogs = Number(row.total_cogs);
    const netProfit = Number(row.net_profit);
    const adSpend = Number(row.total_ad_spend);
    const orderCount = Number(row.order_count);
    const newCustomers = Number(row.new_customer_count);
    const refundCount = Number(row.refund_count);
    const impressions = Number(row.impressions);
    const clicks = Number(row.clicks);

    const grossProfit = netRevenue - cogs;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    const roas = adSpend > 0 ? netRevenue / adSpend : 0;
    const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
    const aov = orderCount > 0 ? grossRevenue / orderCount : 0;
    const refundRate = orderCount > 0 ? (refundCount / orderCount) * 100 : 0;
    const conversionRate = clicks > 0 ? (orderCount / clicks) * 100 : 0;

    // Repeat purchase rate
    const repeatRows = await this.prisma.$queryRaw<RepeatRow[]>`
      WITH customer_orders AS (
        SELECT customer_id, COUNT(*) as cnt
        FROM orders
        WHERE org_id = ${orgId}::uuid
          AND status != 'cancelled'
          AND customer_id IS NOT NULL
          AND placed_at >= ${startDate}::date
          AND placed_at <= ${endDate}::date
        GROUP BY customer_id
      )
      SELECT
        COUNT(*)::bigint as total_customers,
        COUNT(*) FILTER (WHERE cnt > 1)::bigint as repeat_customers
      FROM customer_orders
    `;

    const totalCusts = Number(repeatRows[0]?.total_customers ?? 0);
    const repeatCusts = Number(repeatRows[0]?.repeat_customers ?? 0);
    const repeatPurchaseRate = totalCusts > 0 ? (repeatCusts / totalCusts) * 100 : 0;

    return {
      roas: round2(roas),
      grossMargin: round2(grossMargin),
      netMargin: round2(netMargin),
      cac: round2(cac),
      aov: round2(aov),
      refundRate: round2(refundRate),
      repeatPurchaseRate: round2(repeatPurchaseRate),
      conversionRate: round2(conversionRate),
    };
  }

  // =========================================================================
  // compareMetrics
  // =========================================================================

  private compareMetrics(
    org: OrgMetrics,
    benchmarks: typeof BENCHMARKS,
  ): MetricComparison[] {
    const metrics: Array<{
      key: keyof OrgMetrics;
      label: string;
      format: MetricComparison['format'];
      invertBetter?: boolean;
    }> = [
      { key: 'roas', label: 'ROAS', format: 'multiplier' },
      { key: 'grossMargin', label: 'Gross Margin', format: 'percent' },
      { key: 'netMargin', label: 'Net Margin', format: 'percent' },
      { key: 'cac', label: 'Customer Acquisition Cost', format: 'currency', invertBetter: true },
      { key: 'aov', label: 'Average Order Value', format: 'currency' },
      { key: 'refundRate', label: 'Refund Rate', format: 'percent', invertBetter: true },
      { key: 'repeatPurchaseRate', label: 'Repeat Purchase Rate', format: 'percent' },
      { key: 'conversionRate', label: 'Conversion Rate', format: 'percent' },
    ];

    return metrics.map(({ key, label, format, invertBetter }) => {
      const orgValue = org[key];
      const avgValue = benchmarks.ecommerce_avg[key];
      const top25Value = benchmarks.ecommerce_top25[key];
      const bottom25Value = benchmarks.ecommerce_bottom25[key];

      // Calculate percentile (linear interpolation between bottom25, avg, top25)
      let percentile: number;
      if (invertBetter) {
        // Lower is better (CAC, refund rate)
        if (orgValue <= top25Value) percentile = 75 + ((top25Value - orgValue) / Math.max(top25Value, 1)) * 25;
        else if (orgValue <= avgValue) percentile = 50 + ((avgValue - orgValue) / Math.max(avgValue - top25Value, 1)) * 25;
        else if (orgValue <= bottom25Value) percentile = 25 + ((bottom25Value - orgValue) / Math.max(bottom25Value - avgValue, 1)) * 25;
        else percentile = Math.max(5, 25 * (bottom25Value / Math.max(orgValue, 1)));
      } else {
        // Higher is better
        if (orgValue >= top25Value) percentile = 75 + ((orgValue - top25Value) / Math.max(top25Value, 1)) * 25;
        else if (orgValue >= avgValue) percentile = 50 + ((orgValue - avgValue) / Math.max(top25Value - avgValue, 1)) * 25;
        else if (orgValue >= bottom25Value) percentile = 25 + ((orgValue - bottom25Value) / Math.max(avgValue - bottom25Value, 1)) * 25;
        else percentile = Math.max(5, 25 * (orgValue / Math.max(bottom25Value, 1)));
      }

      percentile = Math.min(99, Math.max(1, round2(percentile)));

      // Status determination
      let status: MetricComparison['status'];
      if (invertBetter) {
        status = orgValue < avgValue ? 'above_avg' : orgValue > avgValue * 1.1 ? 'below_avg' : 'at_avg';
      } else {
        status = orgValue > avgValue ? 'above_avg' : orgValue < avgValue * 0.9 ? 'below_avg' : 'at_avg';
      }

      return {
        metric: key,
        label,
        orgValue: round2(orgValue),
        avgValue: round2(avgValue),
        top25Value: round2(top25Value),
        bottom25Value: round2(bottom25Value),
        percentile,
        status,
        format,
      };
    });
  }

  // =========================================================================
  // generateRecommendations
  // =========================================================================

  private generateRecommendations(
    org: OrgMetrics,
    benchmarks: typeof BENCHMARKS,
  ): string[] {
    const recs: string[] = [];
    const avg = benchmarks.ecommerce_avg;

    if (org.roas < avg.roas) {
      const gap = round2(((avg.roas - org.roas) / avg.roas) * 100);
      recs.push(
        `Your ROAS (${org.roas.toFixed(2)}x) is ${gap}% below industry average (${avg.roas.toFixed(1)}x). Focus on high-performing campaigns and pause low-ROAS ads to improve efficiency.`,
      );
    }

    if (org.grossMargin < avg.grossMargin) {
      recs.push(
        `Gross margin (${org.grossMargin.toFixed(1)}%) is below the ${avg.grossMargin}% average. Review supplier pricing, consider bundling, or negotiate better COGS rates.`,
      );
    }

    if (org.cac > avg.cac) {
      recs.push(
        `CAC ($${org.cac.toFixed(2)}) exceeds the $${avg.cac} industry average. Invest in organic channels, referral programs, or retargeting to lower acquisition costs.`,
      );
    }

    if (org.refundRate > avg.refundRate) {
      recs.push(
        `Refund rate (${org.refundRate.toFixed(1)}%) is above the ${avg.refundRate}% average. Improve product descriptions, sizing guides, and quality control to reduce returns.`,
      );
    }

    if (org.repeatPurchaseRate < avg.repeatPurchaseRate) {
      recs.push(
        `Repeat purchase rate (${org.repeatPurchaseRate.toFixed(1)}%) is below the ${avg.repeatPurchaseRate}% average. Implement loyalty programs, post-purchase email flows, and subscription options.`,
      );
    }

    if (org.aov < avg.aov) {
      recs.push(
        `Average order value ($${org.aov.toFixed(2)}) is below the $${avg.aov} benchmark. Use cross-selling, upselling, free shipping thresholds, and product bundles.`,
      );
    }

    if (org.conversionRate < avg.conversionRate) {
      recs.push(
        `Conversion rate (${org.conversionRate.toFixed(2)}%) is below the ${avg.conversionRate}% average. Optimize landing pages, checkout flow, and ad targeting.`,
      );
    }

    if (recs.length === 0) {
      recs.push(
        'Your metrics are performing at or above industry averages across the board. Focus on maintaining this momentum and exploring new growth channels.',
      );
    }

    return recs;
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}
