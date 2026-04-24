'use client';

import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Target,
  DollarSign,
  Users,
  TrendingUp,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import {
  useAttribution,
  useMarketingMix,
  type AttributionModel,
} from '@/hooks/finance/useAttribution';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';

// ---------------------------------------------------------------------------
// Model selector
// ---------------------------------------------------------------------------

const MODELS: Array<{ key: AttributionModel; label: string }> = [
  { key: 'linear', label: 'Linear' },
  { key: 'last_touch', label: 'Last Touch' },
  { key: 'time_decay', label: 'Time Decay' },
  { key: 'data_driven', label: 'Data Driven' },
];

const CHANNEL_COLORS: Record<string, string> = {
  meta_ads: '#3b82f6',
  google_ads: '#ef4444',
  tiktok: '#111827',
  organic: '#22c55e',
  direct: '#a855f7',
  email: '#f59e0b',
  amazon: '#f97316',
  referral: '#06b6d4',
};

function getChannelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? '#6b7280';
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    tiktok: 'TikTok',
    organic: 'Organic',
    direct: 'Direct',
    email: 'Email',
    amazon: 'Amazon',
    referral: 'Referral',
  };
  return labels[channel] ?? channel;
}

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
// Contribution Bar Chart
// ---------------------------------------------------------------------------

function ContributionChart({
  channels,
  loading,
}: {
  channels: Array<{ channel: string; contribution: number; revenue: number }>;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[350px]" />;
  if (!channels.length) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Contribution</h3>
        <div className="h-[350px] flex items-center justify-center text-gray-400 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number; seriesName: string; color: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.name ?? ''}</div>`;
        params.forEach((p) => {
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: <strong>${p.value.toFixed(1)}%</strong></span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6B7280' },
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '4%', containLabel: true },
    xAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'category' as const,
      data: ['Attribution'],
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: channels.map((c) => ({
      name: channelLabel(c.channel),
      type: 'bar' as const,
      stack: 'total',
      data: [c.contribution],
      itemStyle: { color: getChannelColor(c.channel), borderRadius: 0 },
      barWidth: 40,
    })),
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Contribution</h3>
      <ReactECharts option={option} style={{ height: '120px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue Share Treemap
// ---------------------------------------------------------------------------

function RevenueTreemap({
  channels,
  loading,
}: {
  channels: Array<{ channel: string; revenue: number; revenueShare: number }>;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[350px]" />;
  if (!channels.length) return null;

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: { name: string; value: number; data: { revenueShare: number } }) => {
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
          <div>Revenue: <strong>${formatDollarsFull(params.value)}</strong></div>
          <div>Share: <strong>${params.data?.revenueShare?.toFixed(1) ?? 0}%</strong></div>`;
      },
    },
    series: [
      {
        type: 'treemap',
        data: channels.map((c) => ({
          name: channelLabel(c.channel),
          value: c.revenue,
          revenueShare: c.revenueShare,
          itemStyle: { color: getChannelColor(c.channel), borderColor: '#fff', borderWidth: 2 },
        })),
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          formatter: (params: { name: string; data: { revenueShare: number } }) =>
            `${params.name}\n${params.data?.revenueShare?.toFixed(1) ?? 0}%`,
        },
        breadcrumb: { show: false },
        roam: false,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Share</h3>
      <ReactECharts option={option} style={{ height: '300px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketing Mix Efficiency Chart
// ---------------------------------------------------------------------------

function EfficiencyChart({
  data,
  loading,
}: {
  data: Array<{ channel: string; efficiency: number; avgDailySpend: number }>;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton />;
  if (!data.length) return null;

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: { data: [number, number, string] }) => {
        const [spend, efficiency, name] = params.data;
        return `<div style="font-weight:600;margin-bottom:4px">${name}</div>
          <div>Avg Daily Spend: <strong>${formatDollarsFull(spend)}</strong></div>
          <div>Efficiency (Revenue/$): <strong>${efficiency.toFixed(2)}x</strong></div>`;
      },
    },
    grid: { left: '8%', right: '4%', bottom: '10%', top: '6%', containLabel: true },
    xAxis: {
      type: 'value' as const,
      name: 'Avg Daily Spend',
      nameLocation: 'center' as const,
      nameGap: 30,
      nameTextStyle: { fontSize: 11, color: '#6B7280' },
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Revenue / $ Spent',
      nameLocation: 'center' as const,
      nameGap: 40,
      nameTextStyle: { fontSize: 11, color: '#6B7280' },
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v}x` },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        type: 'scatter',
        data: data.map((d) => ({
          value: [d.avgDailySpend, d.efficiency, channelLabel(d.channel)],
          itemStyle: { color: getChannelColor(d.channel) },
          symbolSize: Math.max(20, Math.min(60, d.efficiency * 10)),
        })),
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#374151',
          formatter: (params: { data: { value: [number, number, string] } }) => params.data.value[2],
        },
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Efficiency (Spend vs. Return)</h3>
      <ReactECharts option={option} style={{ height: '300px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttributionPage() {
  const [model, setModel] = useState<AttributionModel>('linear');
  const attributionQuery = useAttribution(model);
  const mixQuery = useMarketingMix();

  const attribution = attributionQuery.data;
  const mix = mixQuery.data;
  const isLoading = attributionQuery.isLoading;
  const hasError = attributionQuery.isError || mixQuery.isError;

  // Summary KPIs
  const summary = useMemo(() => {
    if (!attribution) return null;
    const bestChannel = attribution.channels.reduce(
      (best, c) => (c.roas > best.roas ? c : best),
      attribution.channels[0] ?? { channel: '-', roas: 0, cac: 0, revenueShare: 0 },
    );
    return {
      totalRevenue: attribution.totalRevenue,
      totalSpend: attribution.totalSpend,
      blendedRoas: attribution.totalSpend > 0 ? attribution.totalRevenue / attribution.totalSpend : 0,
      bestChannel: bestChannel.channel,
      bestRoas: bestChannel.roas,
    };
  }, [attribution]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Multi-Touch Attribution</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Understand which channels drive revenue and optimize budget allocation
          </p>
        </div>
        <DateRangePicker />
      </div>

      {hasError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong>{' '}
          {attributionQuery.error?.message ?? mixQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Model Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Model:</span>
        <div className="inline-flex items-center rounded-lg border border-border bg-surface-secondary">
          {MODELS.map((m) => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                'first:rounded-l-lg last:rounded-r-lg',
                'border-r border-border last:border-r-0',
                model === m.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Revenue',
            value: summary ? formatDollars(summary.totalRevenue) : '--',
            icon: <DollarSign className="h-4 w-4" />,
            color: '#059669',
          },
          {
            label: 'Total Ad Spend',
            value: summary ? formatDollars(summary.totalSpend) : '--',
            icon: <Target className="h-4 w-4" />,
            color: '#DC2626',
          },
          {
            label: 'Blended ROAS',
            value: summary ? `${summary.blendedRoas.toFixed(2)}x` : '--',
            icon: <TrendingUp className="h-4 w-4" />,
            color: '#7C3AED',
          },
          {
            label: 'Best Channel',
            value: summary ? `${channelLabel(summary.bestChannel)} (${summary.bestRoas.toFixed(2)}x)` : '--',
            icon: <BarChart3 className="h-4 w-4" />,
            color: '#2563EB',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(
            'group rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200',
            isLoading && 'animate-pulse',
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{kpi.label}</span>
              <span className="flex items-center justify-center h-7 w-7 rounded-lg opacity-80"
                style={{ backgroundColor: `${kpi.color}12`, color: kpi.color }}>
                {kpi.icon}
              </span>
            </div>
            {isLoading ? (
              <div className="h-7 w-28 rounded bg-gray-200" />
            ) : (
              <div className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ContributionChart
          channels={attribution?.channels ?? []}
          loading={isLoading}
        />
        <RevenueTreemap
          channels={attribution?.channels ?? []}
          loading={isLoading}
        />
      </div>

      {/* Attribution Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Channel Attribution Details</h3>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : !attribution?.channels.length ? (
          <div className="py-16 text-center text-sm text-gray-400">No attribution data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-surface-secondary">
                  {['Channel', 'Revenue', 'Spend', 'ROAS', 'Orders', 'CAC', 'Revenue Share', 'Contribution', 'Incremental Rev.'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attribution.channels.map((c) => (
                  <tr key={c.channel} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getChannelColor(c.channel) }} />
                        <span className="font-medium text-gray-900 dark:text-white">{channelLabel(c.channel)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{formatDollars(c.revenue)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDollars(c.spend)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        c.roas >= 2 ? 'bg-emerald-50 text-emerald-600' : c.roas >= 1 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600',
                      )}>
                        {c.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatNumber(c.orders)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{c.cac > 0 ? formatDollars(c.cac) : '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(c.revenueShare, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{c.revenueShare.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{c.contribution.toFixed(1)}%</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={c.incrementalRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {c.incrementalRevenue >= 0 ? '+' : ''}{formatDollars(c.incrementalRevenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Marketing Mix Efficiency */}
      <EfficiencyChart
        data={mix?.channelEfficiency ?? []}
        loading={mixQuery.isLoading}
      />

      {/* Insights */}
      {attribution?.insights && attribution.insights.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Insights</h3>
          </div>
          <ul className="space-y-2">
            {attribution.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
