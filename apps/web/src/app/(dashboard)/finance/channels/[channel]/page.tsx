'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  Facebook,
  Search,
  DollarSign,
  TrendingUp,
  Target,
  ShoppingCart,
  BarChart3,
  MousePointerClick,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useDashboardOverview, useChannelPerformance } from '@/hooks/finance/useDashboard';
import { useCampaigns, type CampaignSummary } from '@/hooks/finance/useCampaigns';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';
import { cn } from '@/lib/utils';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@filapen/shared/src/utils/date';

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

const CHANNEL_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string; isAd: boolean; campaignPlatform?: string }
> = {
  shopify_dtc: {
    label: 'Shopify DTC',
    icon: ShoppingBag,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: '#16a34a',
    isAd: false,
  },
  meta_ads: {
    label: 'Meta Ads',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: '#2563eb',
    isAd: true,
    campaignPlatform: 'meta',
  },
  google_ads: {
    label: 'Google Ads',
    icon: Search,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: '#dc2626',
    isAd: true,
    campaignPlatform: 'google',
  },
};

function roasColor(roas: number): string {
  if (roas >= 2.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

// ---------------------------------------------------------------------------
// Time series hook for a specific channel
// ---------------------------------------------------------------------------

function useChannelTimeSeries(channel: string) {
  const { dateRange } = useFinanceUI();

  return useQuery<{ dates: string[]; series: Record<string, number[]> }>({
    queryKey: ['finance', 'timeseries', 'channel', channel, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const url = new URL('/api/finance/timeseries', window.location.origin);
      url.searchParams.set('startDate', formatDate(dateRange.start));
      url.searchParams.set('endDate', formatDate(dateRange.end));
      url.searchParams.set('metrics', 'revenue,profit,adSpend');
      url.searchParams.set('channel', channel);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-card">
            <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
            <div className="h-7 w-28 rounded bg-gray-200 mb-2" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white p-5 shadow-card">
        <div className="h-[400px] bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Table
// ---------------------------------------------------------------------------

function CampaignBreakdownTable({ campaigns, loading }: { campaigns: CampaignSummary[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white shadow-card overflow-hidden animate-pulse">
        <div className="p-5">
          <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign Breakdown</h3>
        <div className="py-8 text-center text-gray-400">No campaign data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Campaign Breakdown</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-200">
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Campaign</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Spend</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ROAS</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Conv.</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">CPA</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="border-b border-gray-100 transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={() => window.location.href = `/finance/campaigns/${c.id}`}
              >
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      c.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : c.status === 'paused'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-gray-700">{formatDollars(c.spend)}</td>
                <td className="px-5 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{formatDollars(c.revenue)}</td>
                <td className={cn('px-5 py-3 whitespace-nowrap font-medium', roasColor(c.roas))}>
                  {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '--'}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-gray-700">{formatNumber(c.conversions)}</td>
                <td className="px-5 py-3 whitespace-nowrap text-gray-700">
                  {c.cpa > 0 ? formatDollars(c.cpa) : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChannelDetailPage() {
  const params = useParams();
  const channelSlug = params.channel as string;
  const meta = CHANNEL_META[channelSlug];
  const { setChannel } = useFinanceUI();

  // Set selected channel on mount, reset on unmount
  useEffect(() => {
    setChannel(channelSlug);
    return () => setChannel(null);
  }, [channelSlug, setChannel]);

  const channelsQuery = useChannelPerformance();
  const timeSeriesQuery = useChannelTimeSeries(channelSlug);
  const campaignsQuery = useCampaigns(meta?.campaignPlatform);

  // Find this channel's data from the channels array
  const channelData = useMemo(() => {
    if (!channelsQuery.data) return null;
    // The channel name in the API might differ from slug
    const nameMap: Record<string, string> = {
      shopify_dtc: 'Shopify DTC',
      meta_ads: 'Meta Ads',
      google_ads: 'Google Ads',
    };
    const targetName = nameMap[channelSlug];
    return channelsQuery.data.find((c) => c.channel === targetName) ?? null;
  }, [channelsQuery.data, channelSlug]);

  if (!meta) {
    return (
      <div className="space-y-6">
        <Link href="/finance/channels" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Channels
        </Link>
        <div className="rounded-xl bg-white p-12 shadow-card text-center">
          <p className="text-gray-400">Unknown channel: {channelSlug}</p>
        </div>
      </div>
    );
  }

  const Icon = meta.icon;
  const isLoading = channelsQuery.isLoading || timeSeriesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/finance/channels" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Channels
        </Link>
        <PageSkeleton />
      </div>
    );
  }

  const profit = channelData ? channelData.revenue - channelData.spend : 0;
  const margin = channelData && channelData.revenue > 0 ? (profit / channelData.revenue) * 100 : 0;

  // Chart options
  const dates = timeSeriesQuery.data?.dates ?? [];
  const revenue = timeSeriesQuery.data?.series?.revenue ?? [];
  const profitSeries = timeSeriesQuery.data?.series?.profit ?? [];
  const adSpend = timeSeriesQuery.data?.series?.adSpend ?? [];

  const chartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; data: number; axisValueLabel: string; color: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${params[0]?.axisValueLabel ?? ''}</div>`;
        for (const p of params) {
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <span style="flex:1">${p.seriesName}</span>
            <strong>${formatDollarsFull(p.data)}</strong>
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['Revenue', 'Profit', 'Ad Spend'],
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6B7280' },
      itemWidth: 16,
      itemHeight: 2,
    },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: dates,
      boundaryGap: false,
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        formatter: (v: string) => { const p = v.split('-'); return `${p[1]}/${p[2]}`; },
      },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: meta.borderColor },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: `${meta.borderColor}30` },
            { offset: 1, color: `${meta.borderColor}05` },
          ] },
        },
        data: revenue,
      },
      {
        name: 'Profit',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: '#059669' },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(5,150,105,0.14)' },
            { offset: 1, color: 'rgba(5,150,105,0.02)' },
          ] },
        },
        data: profitSeries,
      },
      {
        name: 'Ad Spend',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#DC2626' },
        data: adSpend,
      },
    ],
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/finance/channels"
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg', meta.bgColor)}>
              <Icon className={cn('h-5 w-5', meta.color)} />
            </div>
            <div>
              <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">{meta.label}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Channel performance details</p>
            </div>
          </div>
        </div>
        <DateRangePicker />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Revenue"
          value={channelData?.revenue ?? 0}
          previousValue={null}
          format="currency"
          icon={<DollarSign className="h-4 w-4" />}
          accentColor={meta.borderColor}
        />
        <KPICard
          label="Ad Spend"
          value={channelData?.spend ?? 0}
          previousValue={null}
          format="currency"
          icon={<BarChart3 className="h-4 w-4" />}
          accentColor="#DC2626"
          invertTrend
        />
        <KPICard
          label="ROAS"
          value={channelData?.roas ?? 0}
          previousValue={null}
          format="multiplier"
          icon={<Target className="h-4 w-4" />}
          accentColor="rgb(var(--accent-2))"
        />
        <KPICard
          label="Profit"
          value={profit}
          previousValue={null}
          format="currency"
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="rgb(var(--accent-3))"
        />
        <KPICard
          label="Orders"
          value={channelData?.conversions ?? 0}
          previousValue={null}
          format="number"
          icon={<ShoppingCart className="h-4 w-4" />}
          accentColor="rgb(var(--accent-4))"
        />
      </div>

      {/* Time Series Chart */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {meta.label} Revenue & Profit Trend
        </h3>
        {dates.length > 0 ? (
          <ReactECharts
            option={chartOption}
            style={{ height: '400px', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-400">
            No data available for this period
          </div>
        )}
      </div>

      {/* Campaign Breakdown (ad channels only) */}
      {meta.isAd && (
        <CampaignBreakdownTable
          campaigns={campaignsQuery.data ?? []}
          loading={campaignsQuery.isLoading}
        />
      )}
    </div>
  );
}
