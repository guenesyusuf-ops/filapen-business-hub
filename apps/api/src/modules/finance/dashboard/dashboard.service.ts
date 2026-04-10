import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfitEngineService } from '../profit/profit-engine.service';
import { CostService } from '../cost/cost.service';
import type {
  DashboardOverviewResult,
  KpiValue,
  PnLResult,
} from '@filapen/shared/src/types/finance';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profitEngine: ProfitEngineService,
    private readonly costService: CostService,
  ) {}

  /**
   * Assemble full dashboard overview with KPIs, comparison to previous period,
   * and chart data.
   */
  async getOverview(
    orgId: string,
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<DashboardOverviewResult & { timeSeries: any; waterfall: any }> {
    // Calculate the previous period of equal length
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1); // day before start
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    prevStart.setHours(0, 0, 0, 0);

    // Fetch current and previous period P&L in parallel
    const [currentPnL, previousPnL, timeSeries] = await Promise.all([
      this.profitEngine.calculatePnL(orgId, startDate, endDate, channel),
      this.profitEngine.calculatePnL(orgId, prevStart, prevEnd, channel),
      this.profitEngine.getTimeSeries(
        orgId,
        startDate,
        endDate,
        ['revenue', 'profit', 'adSpend'],
        channel,
      ),
    ]);

    // Build KPIs with comparison
    const currentOrders = await this.getOrderMetrics(orgId, startDate, endDate, channel);
    const previousOrders = await this.getOrderMetrics(orgId, prevStart, prevEnd, channel);

    const kpis = this.buildKpis(currentPnL, previousPnL, currentOrders, previousOrders);

    // Build revenue chart from time series (legacy format)
    const revenueChart = timeSeries.dates.map((date, i) => ({
      date,
      grossRevenue: timeSeries.series.revenue?.[i] ?? 0,
      netProfit: timeSeries.series.profit?.[i] ?? 0,
      adSpend: timeSeries.series.adSpend?.[i] ?? 0,
    }));

    // Build waterfall from current P&L
    const waterfall = currentPnL.waterfall ?? this.buildWaterfall(currentPnL);

    return {
      dateRange: { start: startDate, end: endDate },
      kpis,
      revenueChart,
      timeSeries,
      waterfall,
    };
  }

  /**
   * Get order-level metrics (orderCount, AOV, refundRate, newCustomerRate)
   * from daily_aggregates for KPI building.
   */
  private async getOrderMetrics(
    orgId: string,
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<{
    orderCount: number;
    avgOrderValue: number;
    refundRate: number;
    newCustomerRate: number;
    blendedRoas: number;
  }> {
    // Always filter by channel — default to 'all' which is the pre-aggregated total
    const effectiveChannel = channel || 'all';
    const channelFilter = `AND channel = '${effectiveChannel}'`;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        order_count: bigint;
        avg_order_value: number;
        refund_count: bigint;
        new_customer_count: bigint;
        returning_customer_count: bigint;
        total_ad_spend: number;
        net_revenue: number;
      }>
    >(
      `SELECT
        COALESCE(SUM(order_count), 0)::bigint AS order_count,
        CASE WHEN SUM(order_count) > 0
          THEN SUM(net_revenue) / SUM(order_count)
          ELSE 0
        END AS avg_order_value,
        COALESCE(SUM(refund_count), 0)::bigint AS refund_count,
        COALESCE(SUM(new_customer_count), 0)::bigint AS new_customer_count,
        COALESCE(SUM(returning_customer_count), 0)::bigint AS returning_customer_count,
        COALESCE(SUM(total_ad_spend), 0) AS total_ad_spend,
        COALESCE(SUM(net_revenue), 0) AS net_revenue
      FROM daily_aggregates
      WHERE org_id = $1::uuid
        AND date >= $2::date
        AND date <= $3::date
        ${channelFilter}`,
      orgId,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10),
    );

    const row = rows[0];
    const orderCount = Number(row?.order_count ?? 0);
    const refundCount = Number(row?.refund_count ?? 0);
    const newCustomers = Number(row?.new_customer_count ?? 0);
    const returningCustomers = Number(row?.returning_customer_count ?? 0);
    const totalCustomers = newCustomers + returningCustomers;
    const totalAdSpend = Number(row?.total_ad_spend ?? 0);
    const netRevenue = Number(row?.net_revenue ?? 0);

    return {
      orderCount,
      avgOrderValue: Number(row?.avg_order_value ?? 0),
      refundRate: orderCount > 0
        ? Math.round((refundCount / orderCount) * 10000) / 100
        : 0,
      newCustomerRate: totalCustomers > 0
        ? Math.round((newCustomers / totalCustomers) * 10000) / 100
        : 0,
      blendedRoas: totalAdSpend > 0
        ? Math.round((netRevenue / totalAdSpend) * 100) / 100
        : 0,
    };
  }

  private buildKpis(
    current: PnLResult,
    previous: PnLResult,
    currentMetrics: { orderCount: number; avgOrderValue: number; refundRate: number; newCustomerRate: number; blendedRoas: number },
    previousMetrics: { orderCount: number; avgOrderValue: number; refundRate: number; newCustomerRate: number; blendedRoas: number },
  ): DashboardOverviewResult['kpis'] {
    return {
      grossRevenue: this.makeKpi('Gross Revenue', current.grossRevenue, previous.grossRevenue, 'currency'),
      netProfit: this.makeKpi('Net Profit', current.netProfit, previous.netProfit, 'currency'),
      totalAdSpend: this.makeKpi('Ad Spend', current.adSpend, previous.adSpend, 'currency'),
      blendedRoas: this.makeKpi('Blended ROAS', currentMetrics.blendedRoas, previousMetrics.blendedRoas, 'number'),
      orderCount: this.makeKpi('Orders', currentMetrics.orderCount, previousMetrics.orderCount, 'number'),
      avgOrderValue: this.makeKpi('AOV', currentMetrics.avgOrderValue, previousMetrics.avgOrderValue, 'currency'),
      refundRate: this.makeKpi('Refund Rate', currentMetrics.refundRate, previousMetrics.refundRate, 'percent'),
      newCustomerRate: this.makeKpi('New Customer Rate', currentMetrics.newCustomerRate, previousMetrics.newCustomerRate, 'percent'),
    };
  }

  private buildWaterfall(pnl: PnLResult): Array<{ label: string; value: number; type: string }> {
    return [
      { label: 'Gross Revenue', value: pnl.grossRevenue, type: 'positive' },
      { label: 'Discounts', value: -Math.abs(pnl.discounts), type: 'negative' },
      { label: 'Net Revenue', value: pnl.netRevenue, type: 'subtotal' },
      { label: 'COGS', value: -Math.abs(pnl.cogs), type: 'negative' },
      { label: 'Gross Profit', value: pnl.grossProfit, type: 'subtotal' },
      { label: 'Ad Spend', value: -Math.abs(pnl.adSpend), type: 'negative' },
      { label: 'Shipping', value: -Math.abs(pnl.shippingCosts), type: 'negative' },
      { label: 'Payment Fees', value: -Math.abs(pnl.paymentFees), type: 'negative' },
      { label: 'Fixed Costs', value: -Math.abs(pnl.fixedCosts), type: 'negative' },
      { label: 'Net Profit', value: pnl.netProfit, type: 'total' },
    ];
  }

  private makeKpi(
    label: string,
    value: number,
    previousValue: number,
    format: KpiValue['format'],
  ): KpiValue {
    const changePercent = previousValue !== 0
      ? Math.round(((value - previousValue) / Math.abs(previousValue)) * 10000) / 100
      : value > 0
        ? 100
        : 0;

    return {
      label,
      value: Math.round(value * 100) / 100,
      previousValue: Math.round(previousValue * 100) / 100,
      changePercent,
      format,
      currency: 'USD',
    };
  }
}
