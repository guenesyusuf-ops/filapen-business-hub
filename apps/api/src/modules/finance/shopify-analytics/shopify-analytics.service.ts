import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface RevenueBreakdown {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  shipping: number;
  returnFees: number;
  taxes: number;
  totalSales: number;
}

export interface HourlyPoint {
  hour: number;
  revenue: number;
  orders: number;
  aov: number;
}

export interface ShopifyAnalyticsOverview {
  range: { start: string; end: string; timezone: string };
  revenueBreakdown: RevenueBreakdown;
  hourlyRevenue: HourlyPoint[];
  ordersTimeSeries: Array<{ date: string; orders: number }>;
  aovTimeSeries: Array<{ date: string; aov: number }>;
  returningCustomerRate: Array<{ date: string; rate: number }>;
  revenueByProduct: Array<{
    productId: string | null;
    title: string;
    revenue: number;
  }>;
  revenueByVariant: Array<{
    variantId: string | null;
    title: string;
    sku: string | null;
    revenue: number;
  }>;
  ordersByProduct: Array<{
    productId: string | null;
    title: string;
    orderCount: number;
  }>;
  topVariantsByUnits: Array<{
    variantId: string | null;
    title: string;
    sku: string | null;
    units: number;
  }>;
  itemsOrderedTimeSeries: Array<{ date: string; items: number }>;
  avgItemsPerOrder: Array<{ date: string; avg: number }>;
  returnRateTimeSeries: Array<{ date: string; rate: number }>;
  returnedItemsTimeSeries: Array<{ date: string; count: number }>;
  returns: Array<{
    date: string;
    orderNumber: string;
    productTitle: string;
    status: string;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ShopifyAnalyticsService {
  private readonly logger = new Logger(ShopifyAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Number helpers
  // -------------------------------------------------------------------------

  private toNum(v: string | number | null | undefined): number {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private toInt(v: string | number | bigint | null | undefined): number {
    if (v == null) return 0;
    if (typeof v === 'bigint') return Number(v);
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  // -------------------------------------------------------------------------
  // Main entry — parallel queries
  // -------------------------------------------------------------------------

  async getOverview(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<ShopifyAnalyticsOverview> {
    const [
      breakdown,
      hourly,
      ordersDaily,
      returningRate,
      revByProduct,
      revByVariant,
      ordersByProduct,
      topVariants,
      itemsDaily,
      returnRateDaily,
      returnedItemsDaily,
      returnsList,
    ] = await Promise.all([
      this.queryRevenueBreakdown(orgId, startDate, endDate),
      this.queryHourlyRevenue(orgId, startDate, endDate),
      this.queryOrdersTimeSeries(orgId, startDate, endDate),
      this.queryReturningCustomerRate(orgId, startDate, endDate),
      this.queryRevenueByProduct(orgId, startDate, endDate),
      this.queryRevenueByVariant(orgId, startDate, endDate),
      this.queryOrdersByProduct(orgId, startDate, endDate),
      this.queryTopVariantsByUnits(orgId, startDate, endDate),
      this.queryItemsOrderedTimeSeries(orgId, startDate, endDate),
      this.queryReturnRateTimeSeries(orgId, startDate, endDate),
      this.queryReturnedItemsTimeSeries(orgId, startDate, endDate),
      this.queryReturnsList(orgId, startDate, endDate),
    ]);

    // Build AOV time series from ordersDaily (needs revenue per day)
    const aovTimeSeries = ordersDaily.map((d) => ({
      date: d.date,
      aov: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0,
    }));

    // Build avgItemsPerOrder from ordersDaily + itemsDaily
    const ordersByDate = new Map(ordersDaily.map((d) => [d.date, d.orders]));
    const avgItemsPerOrder = itemsDaily.map((d) => {
      const ord = ordersByDate.get(d.date) ?? 0;
      return {
        date: d.date,
        avg: ord > 0 ? Math.round((d.items / ord) * 100) / 100 : 0,
      };
    });

    return {
      range: { start: startDate, end: endDate, timezone: 'Europe/Berlin' },
      revenueBreakdown: breakdown,
      hourlyRevenue: hourly,
      ordersTimeSeries: ordersDaily.map((d) => ({
        date: d.date,
        orders: d.orders,
      })),
      aovTimeSeries,
      returningCustomerRate: returningRate,
      revenueByProduct: revByProduct,
      revenueByVariant: revByVariant,
      ordersByProduct,
      topVariantsByUnits: topVariants,
      itemsOrderedTimeSeries: itemsDaily,
      avgItemsPerOrder,
      returnRateTimeSeries: returnRateDaily,
      returnedItemsTimeSeries: returnedItemsDaily,
      returns: returnsList,
    };
  }

  // -------------------------------------------------------------------------
  // Revenue breakdown (Shopify style: Brutto/Rabatte/Ruckgaben/Netto/...)
  // -------------------------------------------------------------------------

  private async queryRevenueBreakdown(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<RevenueBreakdown> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        gross_sales: string | null;
        discounts: string | null;
        returns: string | null;
        net_sales: string | null;
        shipping: string | null;
        taxes: string | null;
        total_sales: string | null;
      }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      filtered AS (
        SELECT
          COALESCE(total_price, 0)     AS total_price,
          COALESCE(total_tax, 0)       AS total_tax,
          COALESCE(total_shipping, 0)  AS total_shipping,
          COALESCE(total_discounts, 0) AS total_discounts,
          COALESCE(total_refunded, 0)  AS total_refunded
        FROM orders, bounds
        WHERE org_id = ${orgId}::uuid
          AND placed_at >= bounds.start_ts
          AND placed_at <  bounds.end_ts
          AND status != 'cancelled'
      )
      SELECT
        (COALESCE(SUM(total_price), 0)
          - COALESCE(SUM(total_tax), 0)
          - COALESCE(SUM(total_shipping), 0)
          - COALESCE(SUM(total_refunded), 0)
          + COALESCE(SUM(total_discounts), 0)
          + COALESCE(SUM(total_refunded), 0)
        )::text AS gross_sales,
        COALESCE(SUM(total_discounts), 0)::text AS discounts,
        COALESCE(SUM(total_refunded), 0)::text  AS returns,
        (COALESCE(SUM(total_price), 0)
          - COALESCE(SUM(total_tax), 0)
          - COALESCE(SUM(total_shipping), 0)
          - COALESCE(SUM(total_refunded), 0)
        )::text AS net_sales,
        COALESCE(SUM(total_shipping), 0)::text  AS shipping,
        COALESCE(SUM(total_tax), 0)::text       AS taxes,
        (COALESCE(SUM(total_price), 0) - COALESCE(SUM(total_refunded), 0))::text AS total_sales
      FROM filtered
    `;

    const row = rows[0] ?? {
      gross_sales: '0',
      discounts: '0',
      returns: '0',
      net_sales: '0',
      shipping: '0',
      taxes: '0',
      total_sales: '0',
    };

    return {
      grossSales: this.toNum(row.gross_sales),
      discounts: this.toNum(row.discounts),
      returns: this.toNum(row.returns),
      netSales: this.toNum(row.net_sales),
      shipping: this.toNum(row.shipping),
      returnFees: 0,
      taxes: this.toNum(row.taxes),
      totalSales: this.toNum(row.total_sales),
    };
  }

  // -------------------------------------------------------------------------
  // Hourly revenue (0-23) — used for single-day views
  // -------------------------------------------------------------------------

  private async queryHourlyRevenue(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<HourlyPoint[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ hour: number; revenue: string | null; orders: bigint }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      hours AS (SELECT generate_series(0, 23) AS hour),
      agg AS (
        SELECT
          EXTRACT(HOUR FROM (placed_at AT TIME ZONE 'Europe/Berlin'))::int AS hour,
          SUM(COALESCE(total_price, 0) - COALESCE(total_refunded, 0)) AS revenue,
          COUNT(*) AS orders
        FROM orders, bounds
        WHERE org_id = ${orgId}::uuid
          AND placed_at >= bounds.start_ts
          AND placed_at <  bounds.end_ts
          AND status != 'cancelled'
        GROUP BY 1
      )
      SELECT
        h.hour,
        COALESCE(a.revenue, 0)::text  AS revenue,
        COALESCE(a.orders, 0)::bigint AS orders
      FROM hours h
      LEFT JOIN agg a ON a.hour = h.hour
      ORDER BY h.hour ASC
    `;

    return rows.map((r) => {
      const revenue = this.toNum(r.revenue);
      const orders = this.toInt(r.orders);
      const aov = orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0;
      return { hour: Number(r.hour), revenue, orders, aov };
    });
  }

  // -------------------------------------------------------------------------
  // Daily orders + revenue
  // -------------------------------------------------------------------------

  private async queryOrdersTimeSeries(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; orders: number; revenue: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; orders: bigint; revenue: string | null }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      days AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, INTERVAL '1 day')::date AS day
      ),
      agg AS (
        SELECT
          (placed_at AT TIME ZONE 'Europe/Berlin')::date AS day,
          COUNT(*) AS orders,
          SUM(COALESCE(total_price, 0) - COALESCE(total_refunded, 0)) AS revenue
        FROM orders, bounds
        WHERE org_id = ${orgId}::uuid
          AND placed_at >= bounds.start_ts
          AND placed_at <  bounds.end_ts
          AND status != 'cancelled'
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(a.orders, 0)::bigint AS orders,
        COALESCE(a.revenue, 0)::text  AS revenue
      FROM days d
      LEFT JOIN agg a ON a.day = d.day
      ORDER BY d.day ASC
    `;

    return rows.map((r) => ({
      date: r.day,
      orders: this.toInt(r.orders),
      revenue: this.toNum(r.revenue),
    }));
  }

  // -------------------------------------------------------------------------
  // Returning customer rate (daily)
  // -------------------------------------------------------------------------

  private async queryReturningCustomerRate(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; rate: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; returning: bigint; total: bigint }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      days AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, INTERVAL '1 day')::date AS day
      ),
      agg AS (
        SELECT
          (placed_at AT TIME ZONE 'Europe/Berlin')::date AS day,
          SUM(CASE WHEN is_first_order = false THEN 1 ELSE 0 END)::bigint AS returning,
          COUNT(*)::bigint AS total
        FROM orders, bounds
        WHERE org_id = ${orgId}::uuid
          AND placed_at >= bounds.start_ts
          AND placed_at <  bounds.end_ts
          AND status != 'cancelled'
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(a.returning, 0)::bigint AS returning,
        COALESCE(a.total, 0)::bigint AS total
      FROM days d
      LEFT JOIN agg a ON a.day = d.day
      ORDER BY d.day ASC
    `;

    return rows.map((r) => {
      const total = this.toInt(r.total);
      const returning = this.toInt(r.returning);
      return {
        date: r.day,
        rate: total > 0 ? Math.round((returning / total) * 10000) / 100 : 0,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Revenue by product (Top 10)
  // -------------------------------------------------------------------------

  private async queryRevenueByProduct(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ productId: string | null; title: string; revenue: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ product_id: string | null; title: string; revenue: string | null }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      )
      SELECT
        p.id::text AS product_id,
        COALESCE(p.title, oli.title) AS title,
        SUM(oli.line_total)::text AS revenue
      FROM order_line_items oli
      JOIN orders o ON oli.order_id = o.id
      LEFT JOIN product_variants pv ON oli.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id,
      bounds
      WHERE o.org_id = ${orgId}::uuid
        AND o.placed_at >= bounds.start_ts
        AND o.placed_at <  bounds.end_ts
        AND o.status != 'cancelled'
      GROUP BY p.id, COALESCE(p.title, oli.title)
      ORDER BY SUM(oli.line_total) DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      productId: r.product_id,
      title: r.title ?? 'Unbekannt',
      revenue: this.toNum(r.revenue),
    }));
  }

  // -------------------------------------------------------------------------
  // Revenue by variant (Top 10)
  // -------------------------------------------------------------------------

  private async queryRevenueByVariant(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{
      variantId: string | null;
      title: string;
      sku: string | null;
      revenue: number;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        variant_id: string | null;
        title: string;
        sku: string | null;
        revenue: string | null;
      }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      )
      SELECT
        pv.id::text AS variant_id,
        COALESCE(p.title || ' - ' || pv.title, oli.title) AS title,
        pv.sku AS sku,
        SUM(oli.line_total)::text AS revenue
      FROM order_line_items oli
      JOIN orders o ON oli.order_id = o.id
      LEFT JOIN product_variants pv ON oli.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id,
      bounds
      WHERE o.org_id = ${orgId}::uuid
        AND o.placed_at >= bounds.start_ts
        AND o.placed_at <  bounds.end_ts
        AND o.status != 'cancelled'
      GROUP BY pv.id, COALESCE(p.title || ' - ' || pv.title, oli.title), pv.sku
      ORDER BY SUM(oli.line_total) DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      variantId: r.variant_id,
      title: r.title ?? 'Unbekannt',
      sku: r.sku,
      revenue: this.toNum(r.revenue),
    }));
  }

  // -------------------------------------------------------------------------
  // Orders by product (distinct orders per product, Top 10)
  // -------------------------------------------------------------------------

  private async queryOrdersByProduct(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ productId: string | null; title: string; orderCount: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ product_id: string | null; title: string; order_count: bigint }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      )
      SELECT
        p.id::text AS product_id,
        COALESCE(p.title, oli.title) AS title,
        COUNT(DISTINCT o.id)::bigint AS order_count
      FROM order_line_items oli
      JOIN orders o ON oli.order_id = o.id
      LEFT JOIN product_variants pv ON oli.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id,
      bounds
      WHERE o.org_id = ${orgId}::uuid
        AND o.placed_at >= bounds.start_ts
        AND o.placed_at <  bounds.end_ts
        AND o.status != 'cancelled'
      GROUP BY p.id, COALESCE(p.title, oli.title)
      ORDER BY COUNT(DISTINCT o.id) DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      productId: r.product_id,
      title: r.title ?? 'Unbekannt',
      orderCount: this.toInt(r.order_count),
    }));
  }

  // -------------------------------------------------------------------------
  // Top variants by units sold (Top 10)
  // -------------------------------------------------------------------------

  private async queryTopVariantsByUnits(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{
      variantId: string | null;
      title: string;
      sku: string | null;
      units: number;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        variant_id: string | null;
        title: string;
        sku: string | null;
        units: bigint;
      }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      )
      SELECT
        pv.id::text AS variant_id,
        COALESCE(p.title || ' - ' || pv.title, oli.title) AS title,
        pv.sku AS sku,
        SUM(oli.quantity)::bigint AS units
      FROM order_line_items oli
      JOIN orders o ON oli.order_id = o.id
      LEFT JOIN product_variants pv ON oli.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id,
      bounds
      WHERE o.org_id = ${orgId}::uuid
        AND o.placed_at >= bounds.start_ts
        AND o.placed_at <  bounds.end_ts
        AND o.status != 'cancelled'
      GROUP BY pv.id, COALESCE(p.title || ' - ' || pv.title, oli.title), pv.sku
      ORDER BY SUM(oli.quantity) DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      variantId: r.variant_id,
      title: r.title ?? 'Unbekannt',
      sku: r.sku,
      units: this.toInt(r.units),
    }));
  }

  // -------------------------------------------------------------------------
  // Items ordered time series
  // -------------------------------------------------------------------------

  private async queryItemsOrderedTimeSeries(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; items: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; items: bigint }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      days AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, INTERVAL '1 day')::date AS day
      ),
      agg AS (
        SELECT
          (o.placed_at AT TIME ZONE 'Europe/Berlin')::date AS day,
          SUM(oli.quantity)::bigint AS items
        FROM order_line_items oli
        JOIN orders o ON oli.order_id = o.id,
        bounds
        WHERE o.org_id = ${orgId}::uuid
          AND o.placed_at >= bounds.start_ts
          AND o.placed_at <  bounds.end_ts
          AND o.status != 'cancelled'
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(a.items, 0)::bigint AS items
      FROM days d
      LEFT JOIN agg a ON a.day = d.day
      ORDER BY d.day ASC
    `;

    return rows.map((r) => ({
      date: r.day,
      items: this.toInt(r.items),
    }));
  }

  // -------------------------------------------------------------------------
  // Return rate time series (daily refunds / total orders)
  // -------------------------------------------------------------------------

  private async queryReturnRateTimeSeries(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; rate: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; refunded: bigint; total: bigint }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      days AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, INTERVAL '1 day')::date AS day
      ),
      agg AS (
        SELECT
          (placed_at AT TIME ZONE 'Europe/Berlin')::date AS day,
          SUM(CASE WHEN total_refunded > 0 THEN 1 ELSE 0 END)::bigint AS refunded,
          COUNT(*)::bigint AS total
        FROM orders, bounds
        WHERE org_id = ${orgId}::uuid
          AND placed_at >= bounds.start_ts
          AND placed_at <  bounds.end_ts
          AND status != 'cancelled'
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(a.refunded, 0)::bigint AS refunded,
        COALESCE(a.total, 0)::bigint AS total
      FROM days d
      LEFT JOIN agg a ON a.day = d.day
      ORDER BY d.day ASC
    `;

    return rows.map((r) => {
      const total = this.toInt(r.total);
      const refunded = this.toInt(r.refunded);
      return {
        date: r.day,
        rate: total > 0 ? Math.round((refunded / total) * 10000) / 100 : 0,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Returned items count per day — from refunds.refund_line_items JSON
  // -------------------------------------------------------------------------

  private async queryReturnedItemsTimeSeries(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; count: string | null }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      ),
      days AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, INTERVAL '1 day')::date AS day
      ),
      agg AS (
        SELECT
          (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
          COALESCE(SUM(
            (SELECT COALESCE(SUM((li->>'quantity')::int), 0)
             FROM unnest(r.refund_line_items) AS li)
          ), 0) AS count
        FROM refunds r,
        bounds
        WHERE r.org_id = ${orgId}::uuid
          AND r.created_at >= bounds.start_ts
          AND r.created_at <  bounds.end_ts
        GROUP BY 1
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(a.count, 0)::text AS count
      FROM days d
      LEFT JOIN agg a ON a.day = d.day
      ORDER BY d.day ASC
    `;

    return rows.map((r) => ({
      date: r.day,
      count: this.toInt(r.count),
    }));
  }

  // -------------------------------------------------------------------------
  // Returns list (for table)
  // -------------------------------------------------------------------------

  private async queryReturnsList(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{ date: string; orderNumber: string; productTitle: string; status: string }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        created_at: Date;
        order_number: string;
        product_title: string | null;
        status: string | null;
      }>
    >`
      WITH bounds AS (
        SELECT
          (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
          ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
      )
      SELECT
        r.created_at,
        o.order_number,
        COALESCE(
          (SELECT string_agg(DISTINCT oli.title, ', ')
             FROM order_line_items oli
            WHERE oli.order_id = o.id),
          'Unbekannt'
        ) AS product_title,
        o.financial_status::text AS status
      FROM refunds r
      JOIN orders o ON r.order_id = o.id,
      bounds
      WHERE r.org_id = ${orgId}::uuid
        AND r.created_at >= bounds.start_ts
        AND r.created_at <  bounds.end_ts
      ORDER BY r.created_at DESC
      LIMIT 100
    `;

    return rows.map((r) => ({
      date: r.created_at.toISOString(),
      orderNumber: r.order_number,
      productTitle: r.product_title ?? 'Unbekannt',
      status: r.status ?? 'refunded',
    }));
  }
}
