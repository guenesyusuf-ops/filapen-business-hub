import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CostService } from '../cost/cost.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderMetrics {
  gross_revenue: Prisma.Decimal;
  total_discounts: Prisma.Decimal;
  total_refunds: Prisma.Decimal;
  order_count: bigint;
  units_sold: bigint;
  new_customer_count: bigint;
  returning_customer_count: bigint;
  refund_count: bigint;
}

interface CogsTotal {
  total_cogs: Prisma.Decimal;
}

interface AdSpendTotal {
  total_ad_spend: Prisma.Decimal;
}

interface ShippingTotal {
  total_shipping_cost: Prisma.Decimal;
}

interface PaymentFeeTotal {
  total_payment_fees: Prisma.Decimal;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly costService: CostService,
  ) {}

  /**
   * Full recalculation of DailyAggregate for a specific org, date, and channel.
   *
   * Uses pg_advisory_xact_lock to prevent concurrent recalculations for the
   * same (org, date) pair. The lock key is derived from a hash of the orgId + date.
   */
  async recalculate(orgId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().slice(0, 10);
    this.logger.log(`Recalculating aggregates for org=${orgId} date=${dateStr}`);

    // Compute a numeric lock key from orgId + date (CRC-like)
    const lockKey = this.computeLockKey(orgId, dateStr);

    await this.prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock within the transaction
        // Use $executeRaw because pg_advisory_xact_lock returns void which $queryRaw can't deserialize
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        // -------------------------------------------------------------------
        // 1. Order metrics (for shopify_dtc channel)
        // -------------------------------------------------------------------
        const orderMetrics = await tx.$queryRaw<OrderMetrics[]>`
          SELECT
            COALESCE(SUM(o.total_price), 0)     AS gross_revenue,
            COALESCE(SUM(o.total_discounts), 0)  AS total_discounts,
            COALESCE(SUM(o.total_refunded), 0)   AS total_refunds,
            COUNT(*)::bigint                     AS order_count,
            COALESCE(SUM(
              (SELECT COALESCE(SUM(oli.quantity), 0) FROM order_line_items oli WHERE oli.order_id = o.id)
            ), 0)::bigint                        AS units_sold,
            COUNT(CASE WHEN o.is_first_order = true THEN 1 END)::bigint
                                                 AS new_customer_count,
            COUNT(CASE WHEN o.is_first_order = false THEN 1 END)::bigint
                                                 AS returning_customer_count,
            COUNT(CASE WHEN o.financial_status IN ('refunded', 'partially_refunded') THEN 1 END)::bigint
                                                 AS refund_count
          FROM orders o
          WHERE o.org_id = ${orgId}::uuid
            AND DATE(o.placed_at AT TIME ZONE 'Europe/Berlin') = ${dateStr}::date
            AND o.status != 'cancelled'
        `;
        const om = orderMetrics[0];

        // -------------------------------------------------------------------
        // 2. COGS from line items
        // -------------------------------------------------------------------
        const cogsResult = await tx.$queryRaw<CogsTotal[]>`
          SELECT COALESCE(SUM(oli.line_cogs), 0) AS total_cogs
          FROM order_line_items oli
          INNER JOIN orders o ON o.id = oli.order_id
          WHERE oli.org_id = ${orgId}::uuid
            AND DATE(o.placed_at AT TIME ZONE 'Europe/Berlin') = ${dateStr}::date
            AND o.status != 'cancelled'
        `;
        const totalCogs = Number(cogsResult[0].total_cogs);

        // -------------------------------------------------------------------
        // 3. Ad spend from ad_metrics (per platform)
        // -------------------------------------------------------------------
        const metaSpend = await tx.$queryRaw<AdSpendTotal[]>`
          SELECT COALESCE(SUM(spend), 0) AS total_ad_spend
          FROM ad_metrics
          WHERE org_id = ${orgId}::uuid
            AND date = ${dateStr}::date
            AND platform = 'meta'
        `;

        const googleSpend = await tx.$queryRaw<AdSpendTotal[]>`
          SELECT COALESCE(SUM(spend), 0) AS total_ad_spend
          FROM ad_metrics
          WHERE org_id = ${orgId}::uuid
            AND date = ${dateStr}::date
            AND platform = 'google'
        `;

        const metaAdSpend = Number(metaSpend[0].total_ad_spend);
        const googleAdSpend = Number(googleSpend[0].total_ad_spend);
        const totalAdSpend = metaAdSpend + googleAdSpend;

        // -------------------------------------------------------------------
        // 4. Shipping costs
        // -------------------------------------------------------------------
        const shippingResult = await tx.$queryRaw<ShippingTotal[]>`
          SELECT COALESCE(SUM(COALESCE(sc.actual_cost, sc.estimated_cost, 0)), 0)
            AS total_shipping_cost
          FROM shipping_costs sc
          INNER JOIN orders o ON o.id = sc.order_id
          WHERE sc.org_id = ${orgId}::uuid
            AND DATE(o.placed_at AT TIME ZONE 'Europe/Berlin') = ${dateStr}::date
            AND o.status != 'cancelled'
        `;
        const totalShipping = Number(shippingResult[0].total_shipping_cost);

        // -------------------------------------------------------------------
        // 5. Payment fees (calculated from orders + payment config)
        // -------------------------------------------------------------------
        const paymentConfigs = await tx.paymentMethodConfig.findMany({
          where: { orgId, isActive: true },
        });

        let totalPaymentFees = 0;
        if (paymentConfigs.length > 0) {
          const orderPayments = await tx.$queryRaw<
            Array<{ total_price: Prisma.Decimal; payment_gateway: string | null }>
          >`
            SELECT total_price, payment_gateway
            FROM orders
            WHERE org_id = ${orgId}::uuid
              AND DATE(placed_at) = ${dateStr}::date
              AND status != 'cancelled'
              AND financial_status IN ('paid', 'partially_paid', 'partially_refunded')
          `;

          for (const op of orderPayments) {
            totalPaymentFees += this.costService.calculatePaymentFee(
              Number(op.total_price),
              op.payment_gateway,
              paymentConfigs,
            );
          }
        }

        // -------------------------------------------------------------------
        // 6. Fixed costs (prorated daily)
        // -------------------------------------------------------------------
        const fixedCosts = await tx.fixedCost.findMany({
          where: {
            orgId,
            startDate: { lte: new Date(dateStr) },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date(dateStr) } },
            ],
          },
        });

        const dailyFixedCosts = this.costService.calculateDailyFixedCosts(
          fixedCosts,
          new Date(dateStr),
        );

        // -------------------------------------------------------------------
        // 7. Derive all calculated fields
        // -------------------------------------------------------------------
        const grossRevenue = Number(om.gross_revenue);
        const totalDiscounts = Number(om.total_discounts);
        const totalRefunds = Number(om.total_refunds);
        const orderCount = Number(om.order_count);
        const unitsSold = Number(om.units_sold);
        const newCustomerCount = Number(om.new_customer_count);
        const returningCustomerCount = Number(om.returning_customer_count);
        const refundCount = Number(om.refund_count);

        const netRevenue = grossRevenue - totalDiscounts - totalRefunds;
        const grossProfit = netRevenue - totalCogs;
        const contributionMargin =
          grossProfit - totalAdSpend - totalShipping - totalPaymentFees;
        const netProfit = contributionMargin - dailyFixedCosts;
        const avgOrderValue = orderCount > 0 ? netRevenue / orderCount : 0;
        const refundRate = orderCount > 0 ? refundCount / orderCount : 0;
        const blendedRoas = totalAdSpend > 0 ? netRevenue / totalAdSpend : null;
        const blendedCac =
          newCustomerCount > 0 ? totalAdSpend / newCustomerCount : null;

        // -------------------------------------------------------------------
        // 8. UPSERT into daily_aggregates for the "all" channel
        // -------------------------------------------------------------------
        await tx.$queryRaw`
          INSERT INTO daily_aggregates (
            org_id, date, channel,
            gross_revenue, net_revenue, total_cogs,
            total_ad_spend, total_shipping_cost, total_payment_fees,
            total_refunds, total_discounts, total_fixed_costs_allocated,
            gross_profit, contribution_margin, net_profit,
            order_count, units_sold,
            new_customer_count, returning_customer_count,
            avg_order_value, refund_count, refund_rate,
            blended_roas, blended_cac
          ) VALUES (
            ${orgId}::uuid, ${dateStr}::date, 'all',
            ${grossRevenue}, ${netRevenue}, ${totalCogs},
            ${totalAdSpend}, ${totalShipping}, ${totalPaymentFees},
            ${totalRefunds}, ${totalDiscounts}, ${dailyFixedCosts},
            ${grossProfit}, ${contributionMargin}, ${netProfit},
            ${orderCount}, ${unitsSold},
            ${newCustomerCount}, ${returningCustomerCount},
            ${round2(avgOrderValue)}, ${refundCount}, ${round6(refundRate)},
            ${blendedRoas !== null ? round4(blendedRoas) : null},
            ${blendedCac !== null ? round2(blendedCac) : null}
          )
          ON CONFLICT (org_id, date, channel)
          DO UPDATE SET
            gross_revenue = EXCLUDED.gross_revenue,
            net_revenue = EXCLUDED.net_revenue,
            total_cogs = EXCLUDED.total_cogs,
            total_ad_spend = EXCLUDED.total_ad_spend,
            total_shipping_cost = EXCLUDED.total_shipping_cost,
            total_payment_fees = EXCLUDED.total_payment_fees,
            total_refunds = EXCLUDED.total_refunds,
            total_discounts = EXCLUDED.total_discounts,
            total_fixed_costs_allocated = EXCLUDED.total_fixed_costs_allocated,
            gross_profit = EXCLUDED.gross_profit,
            contribution_margin = EXCLUDED.contribution_margin,
            net_profit = EXCLUDED.net_profit,
            order_count = EXCLUDED.order_count,
            units_sold = EXCLUDED.units_sold,
            new_customer_count = EXCLUDED.new_customer_count,
            returning_customer_count = EXCLUDED.returning_customer_count,
            avg_order_value = EXCLUDED.avg_order_value,
            refund_count = EXCLUDED.refund_count,
            refund_rate = EXCLUDED.refund_rate,
            blended_roas = EXCLUDED.blended_roas,
            blended_cac = EXCLUDED.blended_cac
        `;

        // -------------------------------------------------------------------
        // UPSERT for shopify_dtc channel (orders only, no ad spend)
        // -------------------------------------------------------------------
        const dtcNetRevenue = grossRevenue - totalDiscounts - totalRefunds;
        const dtcGrossProfit = dtcNetRevenue - totalCogs;
        const dtcContributionMargin =
          dtcGrossProfit - totalShipping - totalPaymentFees;
        const dtcNetProfit = dtcContributionMargin - dailyFixedCosts;

        await tx.$queryRaw`
          INSERT INTO daily_aggregates (
            org_id, date, channel,
            gross_revenue, net_revenue, total_cogs,
            total_ad_spend, total_shipping_cost, total_payment_fees,
            total_refunds, total_discounts, total_fixed_costs_allocated,
            gross_profit, contribution_margin, net_profit,
            order_count, units_sold,
            new_customer_count, returning_customer_count,
            avg_order_value, refund_count, refund_rate,
            blended_roas, blended_cac
          ) VALUES (
            ${orgId}::uuid, ${dateStr}::date, 'shopify_dtc',
            ${grossRevenue}, ${dtcNetRevenue}, ${totalCogs},
            0, ${totalShipping}, ${totalPaymentFees},
            ${totalRefunds}, ${totalDiscounts}, ${dailyFixedCosts},
            ${dtcGrossProfit}, ${dtcContributionMargin}, ${dtcNetProfit},
            ${orderCount}, ${unitsSold},
            ${newCustomerCount}, ${returningCustomerCount},
            ${round2(avgOrderValue)}, ${refundCount}, ${round6(refundRate)},
            NULL, NULL
          )
          ON CONFLICT (org_id, date, channel)
          DO UPDATE SET
            gross_revenue = EXCLUDED.gross_revenue,
            net_revenue = EXCLUDED.net_revenue,
            total_cogs = EXCLUDED.total_cogs,
            total_ad_spend = EXCLUDED.total_ad_spend,
            total_shipping_cost = EXCLUDED.total_shipping_cost,
            total_payment_fees = EXCLUDED.total_payment_fees,
            total_refunds = EXCLUDED.total_refunds,
            total_discounts = EXCLUDED.total_discounts,
            total_fixed_costs_allocated = EXCLUDED.total_fixed_costs_allocated,
            gross_profit = EXCLUDED.gross_profit,
            contribution_margin = EXCLUDED.contribution_margin,
            net_profit = EXCLUDED.net_profit,
            order_count = EXCLUDED.order_count,
            units_sold = EXCLUDED.units_sold,
            new_customer_count = EXCLUDED.new_customer_count,
            returning_customer_count = EXCLUDED.returning_customer_count,
            avg_order_value = EXCLUDED.avg_order_value,
            refund_count = EXCLUDED.refund_count,
            refund_rate = EXCLUDED.refund_rate,
            blended_roas = EXCLUDED.blended_roas,
            blended_cac = EXCLUDED.blended_cac
        `;

        // -------------------------------------------------------------------
        // UPSERT for meta_ads channel
        // -------------------------------------------------------------------
        if (metaAdSpend > 0) {
          const metaRoas = metaAdSpend > 0 ? grossRevenue / metaAdSpend : null;
          await tx.$queryRaw`
            INSERT INTO daily_aggregates (
              org_id, date, channel,
              gross_revenue, net_revenue, total_cogs,
              total_ad_spend, total_shipping_cost, total_payment_fees,
              total_refunds, total_discounts, total_fixed_costs_allocated,
              gross_profit, contribution_margin, net_profit,
              order_count, units_sold,
              new_customer_count, returning_customer_count,
              avg_order_value, refund_count, refund_rate,
              blended_roas, blended_cac
            ) VALUES (
              ${orgId}::uuid, ${dateStr}::date, 'meta_ads',
              0, 0, 0,
              ${metaAdSpend}, 0, 0,
              0, 0, 0,
              0, ${-metaAdSpend}, ${-metaAdSpend},
              0, 0, 0, 0, 0, 0, 0,
              ${metaRoas !== null ? round4(metaRoas) : null}, NULL
            )
            ON CONFLICT (org_id, date, channel)
            DO UPDATE SET
              total_ad_spend = EXCLUDED.total_ad_spend,
              contribution_margin = EXCLUDED.contribution_margin,
              net_profit = EXCLUDED.net_profit,
              blended_roas = EXCLUDED.blended_roas
          `;
        }

        // -------------------------------------------------------------------
        // UPSERT for google_ads channel
        // -------------------------------------------------------------------
        if (googleAdSpend > 0) {
          const googleRoas =
            googleAdSpend > 0 ? grossRevenue / googleAdSpend : null;
          await tx.$queryRaw`
            INSERT INTO daily_aggregates (
              org_id, date, channel,
              gross_revenue, net_revenue, total_cogs,
              total_ad_spend, total_shipping_cost, total_payment_fees,
              total_refunds, total_discounts, total_fixed_costs_allocated,
              gross_profit, contribution_margin, net_profit,
              order_count, units_sold,
              new_customer_count, returning_customer_count,
              avg_order_value, refund_count, refund_rate,
              blended_roas, blended_cac
            ) VALUES (
              ${orgId}::uuid, ${dateStr}::date, 'google_ads',
              0, 0, 0,
              ${googleAdSpend}, 0, 0,
              0, 0, 0,
              0, ${-googleAdSpend}, ${-googleAdSpend},
              0, 0, 0, 0, 0, 0, 0,
              ${googleRoas !== null ? round4(googleRoas) : null}, NULL
            )
            ON CONFLICT (org_id, date, channel)
            DO UPDATE SET
              total_ad_spend = EXCLUDED.total_ad_spend,
              contribution_margin = EXCLUDED.contribution_margin,
              net_profit = EXCLUDED.net_profit,
              blended_roas = EXCLUDED.blended_roas
          `;
        }
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    this.logger.log(`Aggregation complete for org=${orgId} date=${dateStr}`);
  }

  /**
   * Enqueue reaggregation for affected dates after a data sync.
   * Deduplicates dates before enqueuing.
   */
  async triggerReaggregation(orgId: string, dates: Date[]): Promise<void> {
    // Deduplicate by date string
    const uniqueDates = [
      ...new Set(dates.map((d) => d.toISOString().slice(0, 10))),
    ];

    this.logger.log(
      `Enqueuing reaggregation for org=${orgId}, ${uniqueDates.length} dates`,
    );

    const jobs = uniqueDates.map((dateStr) => ({
      name: 'recalculate',
      data: { orgId, date: dateStr },
      opts: {
        jobId: `agg:${orgId}:${dateStr}`,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    }));

    // Without Redis/BullMQ, run reaggregation synchronously
    for (const dateStr of uniqueDates) {
      await this.recalculate(orgId, new Date(dateStr));
    }
  }

  /**
   * Rebuild all aggregates for a date range.
   * Called after initial backfill or full recalculation.
   */
  async rebuildRange(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const dates: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    this.logger.log(
      `Rebuilding aggregates for org=${orgId}, ${dates.length} days`,
    );

    await this.triggerReaggregation(orgId, dates);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Compute a stable numeric lock key from orgId + date string.
   * Uses a simple hash reduced to a 32-bit signed integer for pg_advisory_lock.
   */
  private computeLockKey(orgId: string, dateStr: string): number {
    const str = `${orgId}:${dateStr}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // Force 32-bit signed integer
    }
    return hash;
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
