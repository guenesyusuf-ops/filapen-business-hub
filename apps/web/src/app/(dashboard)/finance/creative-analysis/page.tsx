'use client';

import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Facebook,
  Search,
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import {
  useCreativePerformance,
  type CampaignWithTrend,
  type CampaignTrend,
} from '@/hooks/finance/useCreativePerformance';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function platformIcon(platform: string) {
  if (platform === 'meta') return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
  if (platform === 'google') return <Search className="h-3.5 w-3.5 text-red-600" />;
  return null;
}

function platformLabel(platform: string): string {
  if (platform === 'meta') return 'Meta';
  if (platform === 'google') return 'Google';
  return platform;
}

function trendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
    case 'declining':
      return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
    default:
      return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function trendBadge(trend: string) {
  const styles: Record<string, { bg: string; text: string }> = {
    improving: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    declining: { bg: 'bg-red-50', text: 'text-red-700' },
    stable: { bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  const style = styles[trend] ?? styles.stable!;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', style.bg, style.text)}>
      {trendIcon(trend)}
      {trend.charAt(0).toUpperCase() + trend.slice(1)}
    </span>
  );
}

function roasColor(roas: number): string {
  if (roas >= 2.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

function roasBgColor(roas: number): string {
  if (roas >= 2.0) return 'bg-emerald-50';
  if (roas >= 1.0) return 'bg-amber-50';
  return 'bg-red-50';
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#059669', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton({ height = 'h-[300px]' }: { height?: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
      <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
      <div className={cn(height, 'bg-gray-100 rounded')} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROAS Trend Chart
// ---------------------------------------------------------------------------

function RoasTrendChart({
  trends,
  loading,
}: {
  trends: CampaignTrend[];
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[350px]" />;
  if (!trends.length || !trends.some((t) => t.daily.length > 0)) return null;

  // Use the first campaign's dates as x-axis
  const dates = trends[0]?.daily.map((d) => d.date) ?? [];

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 10, color: '#6B7280' },
      type: 'scroll' as const,
    },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        formatter: (v: string) => {
          const parts = v.split('-');
          return `${parts[1]}/${parts[2]}`;
        },
      },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v}x` },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: trends.slice(0, 6).map((t, i) => ({
      name: t.campaignName.length > 25 ? t.campaignName.slice(0, 22) + '...' : t.campaignName,
      type: 'line' as const,
      data: t.daily.map((d) => d.roas),
      smooth: true,
      lineStyle: { width: 2, color: CHART_COLORS[i % CHART_COLORS.length] },
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      symbol: 'none',
    })),
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign ROAS Trends</h3>
      <ReactECharts option={option} style={{ height: '350px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spend Efficiency Scatter
// ---------------------------------------------------------------------------

function SpendEfficiencyChart({
  campaigns,
  loading,
}: {
  campaigns: CampaignWithTrend[];
  loading: boolean;
}) {
  if (loading) return <CardSkeleton />;
  if (!campaigns.length) return null;

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: { data: { value: [number, number]; name: string } }) => {
        const [spend, roas] = params.data.value;
        return `<div style="font-weight:600;margin-bottom:4px">${params.data.name}</div>
          <div>Spend: <strong>${formatDollarsFull(spend)}</strong></div>
          <div>ROAS: <strong>${roas.toFixed(2)}x</strong></div>`;
      },
    },
    grid: { left: '8%', right: '4%', bottom: '10%', top: '6%', containLabel: true },
    xAxis: {
      type: 'value' as const,
      name: 'Spend',
      nameLocation: 'center' as const,
      nameGap: 30,
      nameTextStyle: { fontSize: 11, color: '#6B7280' },
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'value' as const,
      name: 'ROAS',
      nameLocation: 'center' as const,
      nameGap: 40,
      nameTextStyle: { fontSize: 11, color: '#6B7280' },
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v}x` },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        type: 'scatter',
        data: campaigns.filter((c) => c.spend > 0).map((c, i) => ({
          value: [c.spend, c.roas],
          name: c.name,
          itemStyle: {
            color: c.roas >= 2 ? '#059669' : c.roas >= 1 ? '#f59e0b' : '#ef4444',
          },
          symbolSize: Math.max(12, Math.min(40, c.spend / Math.max(...campaigns.map((cc) => cc.spend)) * 40)),
        })),
      },
    ],
    // Reference line at ROAS = 1
    markLine: {
      data: [{ yAxis: 1, lineStyle: { color: '#DC2626', type: 'dashed' } }],
      label: { formatter: 'Break-even' },
    },
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Spend Efficiency (Spend vs. ROAS)</h3>
      <ReactECharts option={option} style={{ height: '300px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreativeAnalysisPage() {
  const query = useCreativePerformance();
  const campaigns = query.data?.campaigns ?? [];
  const trends = query.data?.trends ?? [];
  const isLoading = query.isLoading;

  const summary = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const improving = campaigns.filter((c) => c.roasTrend === 'improving').length;
    const declining = campaigns.filter((c) => c.roasTrend === 'declining').length;
    return {
      totalSpend,
      totalRevenue,
      blendedRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      totalConversions,
      improving,
      declining,
    };
  }, [campaigns]);

  // Sort by ROAS descending for top performers
  const sortedByRoas = useMemo(
    () => [...campaigns].sort((a, b) => b.roas - a.roas),
    [campaigns],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Creative Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Analyze campaign performance, ROAS trends, and spend efficiency
          </p>
        </div>
        <DateRangePicker />
      </div>

      {query.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> {query.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Total Spend"
          value={summary.totalSpend}
          previousValue={null}
          format="currency"
          icon={<DollarSign className="h-4 w-4" />}
          accentColor="#DC2626"
          loading={isLoading}
        />
        <KPICard
          label="Blended ROAS"
          value={summary.blendedRoas}
          previousValue={null}
          format="multiplier"
          icon={<Target className="h-4 w-4" />}
          accentColor="#7C3AED"
          loading={isLoading}
        />
        <KPICard
          label="Total Conversions"
          value={summary.totalConversions}
          previousValue={null}
          format="number"
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="#2563EB"
          loading={isLoading}
        />
        <div className={cn(
          'group rounded-xl bg-white p-5 shadow-card transition-all duration-200',
          isLoading && 'animate-pulse',
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Trend Summary</span>
          </div>
          {isLoading ? (
            <div className="h-7 w-28 rounded bg-gray-200" />
          ) : (
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-lg font-bold text-emerald-600">{summary.improving}</span>
                <span className="text-xs text-gray-500">improving</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-lg font-bold text-red-600">{summary.declining}</span>
                <span className="text-xs text-gray-500">declining</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RoasTrendChart trends={trends} loading={isLoading} />
        <SpendEfficiencyChart campaigns={campaigns} loading={isLoading} />
      </div>

      {/* Campaign Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Campaign Performance (Ranked by ROAS)</h3>
          <span className="text-xs text-gray-400">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No campaign data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-surface-secondary">
                  {['#', 'Campaign', 'Platform', 'Spend', 'Revenue', 'ROAS', 'Conv.', 'CPA', 'CTR', 'Trend'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedByRoas.map((c, i) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-secondary transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/finance/campaigns/${c.id}`}
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900 max-w-[200px] truncate block">{c.name}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {platformIcon(c.platform)}
                        <span className="text-gray-700 text-xs">{platformLabel(c.platform)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDollars(c.spend)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{formatDollars(c.revenue)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        roasBgColor(c.roas),
                        roasColor(c.roas),
                      )}>
                        {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatNumber(c.conversions)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {c.cpa > 0 ? formatDollars(c.cpa) : '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{trendBadge(c.roasTrend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
