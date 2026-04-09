import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttributionModel = 'last_touch' | 'linear' | 'time_decay' | 'data_driven';

export interface ChannelAttribution {
  channel: string;
  revenue: number;
  spend: number;
  orders: number;
  newCustomers: number;
  revenueShare: number;
  roas: number;
  cac: number;
  incrementalRevenue: number;
  contribution: number;
}

export interface AttributionResult {
  model: AttributionModel;
  totalRevenue: number;
  totalSpend: number;
  channels: ChannelAttribution[];
  insights: string[];
}

export interface ChannelEfficiency {
  channel: string;
  efficiency: number;
  correlation: number;
  avgDailySpend: number;
  avgDailyRevenue: number;
  revenuePerDollarSpent: number;
  diminishingReturnsThreshold: number;
}

export interface OptimalBudgetItem {
  channel: string;
  currentSpend: number;
  suggestedSpend: number;
  expectedRevenueLift: number;
}

export interface SpendRevenueCurve {
  channel: string;
  points: Array<{ spend: number; revenue: number }>;
}

export interface MarketingMixResult {
  channelEfficiency: ChannelEfficiency[];
  optimalBudget: OptimalBudgetItem[];
  spendVsRevenueCurves: SpendRevenueCurve[];
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface ChannelAggRow {
  channel: string;
  revenue: Prisma.Decimal;
  spend: Prisma.Decimal;
  orders: bigint;
  new_customers: bigint;
}

interface DailyChannelRow {
  date: Date;
  channel: string;
  net_revenue: Prisma.Decimal;
  total_ad_spend: Prisma.Decimal;
  order_count: bigint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // =========================================================================
  // getAttribution
  // =========================================================================

  async getAttribution(
    orgId: string,
    startDate: Date,
    endDate: Date,
    model: AttributionModel,
  ): Promise<AttributionResult> {
    const cacheKey = `attribution:${orgId}:${fmt(startDate)}:${fmt(endDate)}:${model}`;
    const cached = await this.cache.get<AttributionResult>(cacheKey);
    if (cached) return cached;

    const channels = await this.prisma.$queryRaw<ChannelAggRow[]>`
      SELECT
        channel::text,
        COALESCE(SUM(net_revenue), 0) as revenue,
        COALESCE(SUM(total_ad_spend), 0) as spend,
        COALESCE(SUM(order_count), 0)::bigint as orders,
        COALESCE(SUM(new_customer_count), 0)::bigint as new_customers
      FROM daily_aggregates
      WHERE org_id = ${orgId}::uuid
        AND date >= ${startDate}::date AND date <= ${endDate}::date
        AND channel::text != 'all'
      GROUP BY channel
      ORDER BY SUM(net_revenue) DESC
    `;

    const totalRevenue = channels.reduce((sum, c) => sum + Number(c.revenue), 0);
    const totalSpend = channels.reduce((sum, c) => sum + Number(c.spend), 0);
    const channelCount = channels.length;

    const attributedChannels: ChannelAttribution[] = channels.map((c, index) => {
      const revenue = Number(c.revenue);
      const spend = Number(c.spend);
      const orders = Number(c.orders);
      const newCustomers = Number(c.new_customers);
      const revenueShare = totalRevenue > 0 ? round2((revenue / totalRevenue) * 100) : 0;

      // Model-based contribution weighting
      let contribution: number;
      switch (model) {
        case 'last_touch':
          // Last-touch: highest revenue channel gets disproportionate credit
          contribution = index === 0
            ? Math.min(revenueShare * 1.5, 100)
            : revenueShare * (1 - 0.5 / Math.max(channelCount - 1, 1));
          break;
        case 'linear':
          // Linear: equal credit across all channels
          contribution = channelCount > 0 ? round2(100 / channelCount) : 0;
          break;
        case 'time_decay':
          // Time-decay: weight by recency proxy (order volume as recency stand-in)
          contribution = revenueShare * (1 + (orders / Math.max(totalRevenue / 100, 1)) * 0.1);
          break;
        case 'data_driven':
        default:
          // Data-driven: weight by ROAS efficiency
          const roas = spend > 0 ? revenue / spend : 0;
          const totalRoas = channels.reduce((s, ch) => {
            const chSpend = Number(ch.spend);
            return s + (chSpend > 0 ? Number(ch.revenue) / chSpend : 0);
          }, 0);
          contribution = totalRoas > 0 ? round2((roas / totalRoas) * 100) : revenueShare;
          break;
      }

      // Incremental revenue: revenue minus baseline (spend-proportional share)
      const spendShare = totalSpend > 0 ? spend / totalSpend : 0;
      const baselineRevenue = totalRevenue * spendShare;
      const incrementalRevenue = round2(revenue - baselineRevenue);

      return {
        channel: c.channel,
        revenue: round2(revenue),
        spend: round2(spend),
        orders,
        newCustomers,
        revenueShare: round2(revenueShare),
        roas: spend > 0 ? round2(revenue / spend) : 0,
        cac: newCustomers > 0 ? round2(spend / newCustomers) : 0,
        incrementalRevenue,
        contribution: round2(contribution),
      };
    });

    // Normalize contributions to 100%
    const totalContribution = attributedChannels.reduce((s, c) => s + c.contribution, 0);
    if (totalContribution > 0) {
      attributedChannels.forEach((c) => {
        c.contribution = round2((c.contribution / totalContribution) * 100);
      });
    }

    const insights = this.generateInsights(attributedChannels, totalRevenue, totalSpend);

    const result: AttributionResult = {
      model,
      totalRevenue: round2(totalRevenue),
      totalSpend: round2(totalSpend),
      channels: attributedChannels,
      insights,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  // =========================================================================
  // getMarketingMix
  // =========================================================================

  async getMarketingMix(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MarketingMixResult> {
    const cacheKey = `mmm:${orgId}:${fmt(startDate)}:${fmt(endDate)}`;
    const cached = await this.cache.get<MarketingMixResult>(cacheKey);
    if (cached) return cached;

    const dailyData = await this.prisma.$queryRaw<DailyChannelRow[]>`
      SELECT date, channel::text, net_revenue, total_ad_spend, order_count::bigint
      FROM daily_aggregates
      WHERE org_id = ${orgId}::uuid
        AND date >= ${startDate}::date AND date <= ${endDate}::date
        AND channel::text != 'all'
      ORDER BY date
    `;

    // Group data by channel
    const channelMap = new Map<string, Array<{ spend: number; revenue: number }>>();
    for (const row of dailyData) {
      if (!channelMap.has(row.channel)) {
        channelMap.set(row.channel, []);
      }
      channelMap.get(row.channel)!.push({
        spend: Number(row.total_ad_spend),
        revenue: Number(row.net_revenue),
      });
    }

    const channelEfficiency: ChannelEfficiency[] = [];
    const optimalBudget: OptimalBudgetItem[] = [];
    const spendVsRevenueCurves: SpendRevenueCurve[] = [];

    for (const [channel, data] of channelMap) {
      const totalSpend = data.reduce((s, d) => s + d.spend, 0);
      const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
      const dayCount = data.length || 1;
      const avgSpend = totalSpend / dayCount;
      const avgRevenue = totalRevenue / dayCount;

      // Calculate Pearson correlation between spend and revenue
      const correlation = pearsonCorrelation(
        data.map((d) => d.spend),
        data.map((d) => d.revenue),
      );

      const efficiency = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      // Estimate diminishing returns threshold using simple heuristic:
      // sort days by spend, find where marginal ROAS drops below 1
      const sorted = [...data].sort((a, b) => a.spend - b.spend);
      let threshold = avgSpend * 2;
      if (sorted.length > 5) {
        const topQuartile = sorted.slice(Math.floor(sorted.length * 0.75));
        const topAvgRoas =
          topQuartile.reduce((s, d) => s + (d.spend > 0 ? d.revenue / d.spend : 0), 0) /
          topQuartile.length;
        const bottomQuartile = sorted.slice(0, Math.floor(sorted.length * 0.25));
        const bottomAvgRoas =
          bottomQuartile.reduce((s, d) => s + (d.spend > 0 ? d.revenue / d.spend : 0), 0) /
          Math.max(bottomQuartile.length, 1);
        if (topAvgRoas < bottomAvgRoas && topQuartile.length > 0) {
          threshold = topQuartile[0]!.spend;
        }
      }

      channelEfficiency.push({
        channel,
        efficiency: round2(efficiency),
        correlation: round2(correlation),
        avgDailySpend: round2(avgSpend),
        avgDailyRevenue: round2(avgRevenue),
        revenuePerDollarSpent: round2(efficiency),
        diminishingReturnsThreshold: round2(threshold),
      });

      // Optimal budget suggestion
      const currentDailySpend = avgSpend;
      let suggestedDailySpend = currentDailySpend;
      if (efficiency > 3) {
        suggestedDailySpend = currentDailySpend * 1.2;
      } else if (efficiency < 1) {
        suggestedDailySpend = currentDailySpend * 0.7;
      }

      optimalBudget.push({
        channel,
        currentSpend: round2(totalSpend),
        suggestedSpend: round2(suggestedDailySpend * dayCount),
        expectedRevenueLift: round2((suggestedDailySpend - currentDailySpend) * efficiency * dayCount),
      });

      // Build spend-revenue curve (10 points from 0 to 2x current spend)
      const points: Array<{ spend: number; revenue: number }> = [];
      const maxSpend = avgSpend * 2;
      for (let i = 0; i <= 10; i++) {
        const spendLevel = (maxSpend / 10) * i;
        // Simple logarithmic model: revenue = k * ln(1 + spend)
        const k = totalRevenue / Math.max(Math.log(1 + totalSpend), 1);
        const estimatedRevenue = k * Math.log(1 + spendLevel * dayCount);
        points.push({
          spend: round2(spendLevel * dayCount),
          revenue: round2(estimatedRevenue),
        });
      }
      spendVsRevenueCurves.push({ channel, points });
    }

    const result: MarketingMixResult = {
      channelEfficiency,
      optimalBudget,
      spendVsRevenueCurves,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private generateInsights(
    channels: ChannelAttribution[],
    totalRevenue: number,
    totalSpend: number,
  ): string[] {
    const insights: string[] = [];

    const bestRoas = channels.reduce(
      (best, c) => (c.roas > best.roas ? c : best),
      channels[0] ?? { channel: 'none', roas: 0 },
    );
    if (bestRoas.roas > 0) {
      insights.push(
        `${bestRoas.channel} has the highest ROAS at ${bestRoas.roas.toFixed(2)}x.`,
      );
    }

    const lowestCac = channels
      .filter((c) => c.cac > 0)
      .reduce((best, c) => (c.cac < best.cac ? c : best), channels[0] ?? { channel: 'none', cac: Infinity });
    if (lowestCac && lowestCac.cac < Infinity) {
      insights.push(
        `${lowestCac.channel} has the lowest CAC at $${lowestCac.cac.toFixed(2)} per new customer.`,
      );
    }

    const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    if (blendedRoas < 2) {
      insights.push(
        `Blended ROAS is ${blendedRoas.toFixed(2)}x. Consider reallocating budget from low-ROAS to high-ROAS channels.`,
      );
    }

    const underperformers = channels.filter((c) => c.roas > 0 && c.roas < 1);
    if (underperformers.length > 0) {
      insights.push(
        `${underperformers.map((c) => c.channel).join(', ')} ${underperformers.length === 1 ? 'has' : 'have'} ROAS below 1.0x -- spending more than earning.`,
      );
    }

    return insights;
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

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * (y[i] ?? 0), 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
}
