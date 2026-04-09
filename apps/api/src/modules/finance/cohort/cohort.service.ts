import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CohortCell {
  cohortMonth: string;
  activityMonth: string;
  monthsSinceFirst: number;
  activeCustomers: number;
  revenue: number;
  orders: number;
  retentionRate: number;
}

export interface CohortRow {
  cohortMonth: string;
  cohortSize: number;
  cells: CohortCell[];
}

export interface CohortResult {
  cohorts: CohortRow[];
  maxMonthsSinceFirst: number;
  overallRetentionByMonth: Array<{ month: number; rate: number }>;
}

export interface LTVSegment {
  segment: string;
  customerCount: number;
  avgLtv: number;
  avgOrders: number;
  avgAov: number;
  avgLifespanDays: number;
}

export interface LTVResult {
  segments: LTVSegment[];
  overallLTV: number;
  totalCustomers: number;
  repeatPurchaseRate: number;
}

export interface CustomerBreakdown {
  newCustomers: number;
  returningCustomers: number;
  totalCustomers: number;
  repeatPurchaseRate: number;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface CohortQueryRow {
  cohort_month: Date;
  activity_month: Date;
  active_customers: bigint;
  revenue: Prisma.Decimal;
  order_count: bigint;
  months_since_first: number;
}

interface LTVQueryRow {
  segment: string;
  customer_count: bigint;
  avg_ltv: Prisma.Decimal;
  avg_orders: Prisma.Decimal;
  avg_aov: Prisma.Decimal;
  avg_customer_lifespan_days: Prisma.Decimal | null;
}

interface CustomerBreakdownRow {
  total_customers: bigint;
  repeat_customers: bigint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CohortService {
  private readonly logger = new Logger(CohortService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // =========================================================================
  // getCohortAnalysis
  // =========================================================================

  async getCohortAnalysis(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CohortResult> {
    const cacheKey = `cohort:${orgId}:${fmt(startDate)}:${fmt(endDate)}`;
    const cached = await this.cache.get<CohortResult>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<CohortQueryRow[]>`
      WITH customer_first_order AS (
        SELECT
          customer_id,
          MIN(placed_at) as first_purchase_date,
          DATE_TRUNC('month', MIN(placed_at)) as cohort_month
        FROM orders
        WHERE org_id = ${orgId}::uuid
          AND status != 'cancelled'
          AND customer_id IS NOT NULL
        GROUP BY customer_id
      ),
      monthly_activity AS (
        SELECT
          cfo.cohort_month,
          DATE_TRUNC('month', o.placed_at) as activity_month,
          COUNT(DISTINCT o.customer_id) as active_customers,
          SUM(o.total_price) as revenue,
          COUNT(*) as order_count
        FROM orders o
        JOIN customer_first_order cfo ON o.customer_id = cfo.customer_id
        WHERE o.org_id = ${orgId}::uuid
          AND o.status != 'cancelled'
          AND o.placed_at >= ${startDate}::date
        GROUP BY cfo.cohort_month, DATE_TRUNC('month', o.placed_at)
      )
      SELECT
        cohort_month,
        activity_month,
        active_customers::bigint,
        revenue,
        order_count::bigint,
        EXTRACT(MONTH FROM AGE(activity_month, cohort_month))::int as months_since_first
      FROM monthly_activity
      WHERE cohort_month >= ${startDate}::date
        AND cohort_month <= ${endDate}::date
      ORDER BY cohort_month, activity_month
    `;

    // Build cohort matrix
    const cohortMap = new Map<string, { size: number; cells: CohortCell[] }>();

    for (const row of rows) {
      const cohortMonth = fmtDate(row.cohort_month);
      const activityMonth = fmtDate(row.activity_month);
      const activeCustomers = Number(row.active_customers);
      const revenue = Number(row.revenue);
      const orders = Number(row.order_count);
      const monthsSinceFirst = row.months_since_first;

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, { size: 0, cells: [] });
      }

      const cohort = cohortMap.get(cohortMonth)!;

      // Month 0 = the cohort size
      if (monthsSinceFirst === 0) {
        cohort.size = activeCustomers;
      }

      cohort.cells.push({
        cohortMonth,
        activityMonth,
        monthsSinceFirst,
        activeCustomers,
        revenue: round2(revenue),
        orders,
        retentionRate: 0, // computed after
      });
    }

    // Compute retention rates
    let maxMonths = 0;
    const cohortRows: CohortRow[] = [];

    for (const [cohortMonth, data] of cohortMap) {
      const cohortSize = data.size || (data.cells[0]?.activeCustomers ?? 1);
      const cells = data.cells.map((cell) => ({
        ...cell,
        retentionRate:
          cohortSize > 0
            ? round2((cell.activeCustomers / cohortSize) * 100)
            : 0,
      }));

      const localMax = cells.reduce((m, c) => Math.max(m, c.monthsSinceFirst), 0);
      maxMonths = Math.max(maxMonths, localMax);

      cohortRows.push({
        cohortMonth,
        cohortSize,
        cells,
      });
    }

    // Calculate overall retention by month offset
    const overallRetention: Array<{ month: number; rate: number }> = [];
    for (let m = 0; m <= maxMonths; m++) {
      let totalRetention = 0;
      let count = 0;
      for (const cohort of cohortRows) {
        const cell = cohort.cells.find((c) => c.monthsSinceFirst === m);
        if (cell) {
          totalRetention += cell.retentionRate;
          count++;
        }
      }
      overallRetention.push({
        month: m,
        rate: count > 0 ? round2(totalRetention / count) : 0,
      });
    }

    const result: CohortResult = {
      cohorts: cohortRows.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth)),
      maxMonthsSinceFirst: maxMonths,
      overallRetentionByMonth: overallRetention,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  // =========================================================================
  // getLTV
  // =========================================================================

  async getLTV(orgId: string): Promise<LTVResult> {
    const cacheKey = `ltv:${orgId}`;
    const cached = await this.cache.get<LTVResult>(cacheKey);
    if (cached) return cached;

    const ltvRows = await this.prisma.$queryRaw<LTVQueryRow[]>`
      WITH customer_stats AS (
        SELECT
          customer_id,
          COUNT(*) as order_count,
          SUM(total_price - total_discounts - total_refunded) as total_revenue,
          MIN(placed_at) as first_order,
          MAX(placed_at) as last_order,
          AVG(total_price) as avg_order_value
        FROM orders
        WHERE org_id = ${orgId}::uuid
          AND status != 'cancelled'
          AND customer_id IS NOT NULL
        GROUP BY customer_id
      )
      SELECT
        CASE
          WHEN order_count = 1 THEN '1 order'
          WHEN order_count BETWEEN 2 AND 3 THEN '2-3 orders'
          WHEN order_count BETWEEN 4 AND 6 THEN '4-6 orders'
          ELSE '7+ orders'
        END as segment,
        COUNT(*)::bigint as customer_count,
        AVG(total_revenue) as avg_ltv,
        AVG(order_count) as avg_orders,
        AVG(avg_order_value) as avg_aov,
        AVG(EXTRACT(DAY FROM (last_order - first_order))) as avg_customer_lifespan_days
      FROM customer_stats
      GROUP BY
        CASE
          WHEN order_count = 1 THEN '1 order'
          WHEN order_count BETWEEN 2 AND 3 THEN '2-3 orders'
          WHEN order_count BETWEEN 4 AND 6 THEN '4-6 orders'
          ELSE '7+ orders'
        END
      ORDER BY MIN(order_count)
    `;

    const segments: LTVSegment[] = ltvRows.map((r) => ({
      segment: r.segment,
      customerCount: Number(r.customer_count),
      avgLtv: round2(Number(r.avg_ltv)),
      avgOrders: round2(Number(r.avg_orders)),
      avgAov: round2(Number(r.avg_aov)),
      avgLifespanDays: round2(Number(r.avg_customer_lifespan_days ?? 0)),
    }));

    // Overall LTV
    const totalCustomers = segments.reduce((s, seg) => s + seg.customerCount, 0);
    const weightedLtv = segments.reduce(
      (s, seg) => s + seg.avgLtv * seg.customerCount,
      0,
    );
    const overallLTV = totalCustomers > 0 ? round2(weightedLtv / totalCustomers) : 0;

    // Customer breakdown
    const breakdown = await this.prisma.$queryRaw<CustomerBreakdownRow[]>`
      WITH customer_orders AS (
        SELECT customer_id, COUNT(*) as cnt
        FROM orders
        WHERE org_id = ${orgId}::uuid
          AND status != 'cancelled'
          AND customer_id IS NOT NULL
        GROUP BY customer_id
      )
      SELECT
        COUNT(*)::bigint as total_customers,
        COUNT(*) FILTER (WHERE cnt > 1)::bigint as repeat_customers
      FROM customer_orders
    `;

    const total = Number(breakdown[0]?.total_customers ?? 0);
    const repeat = Number(breakdown[0]?.repeat_customers ?? 0);
    const repeatPurchaseRate = total > 0 ? round2((repeat / total) * 100) : 0;

    const result: LTVResult = {
      segments,
      overallLTV,
      totalCustomers,
      repeatPurchaseRate,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
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

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}
