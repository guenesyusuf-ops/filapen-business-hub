'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Facebook,
  Search,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useCampaignDetail } from '@/hooks/finance/useCampaigns';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function platformIcon(platform: string) {
  if (platform === 'meta') return <Facebook className="h-5 w-5 text-blue-600" />;
  if (platform === 'google') return <Search className="h-5 w-5 text-red-600" />;
  return null;
}

function platformBadge(platform: string) {
  const color = platform === 'meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700';
  const label = platform === 'meta' ? 'Meta Ads' : 'Google Ads';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', color)}>
      {platformIcon(platform)}
      {label}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    paused: 'bg-amber-50 text-amber-700',
    deleted: 'bg-gray-100 text-gray-500',
    archived: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', map[status] ?? 'bg-gray-100 text-gray-500')}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-card">
            <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
            <div className="h-7 w-24 rounded bg-gray-200 mb-2" />
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
// Component
// ---------------------------------------------------------------------------

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const { data, isLoading, isError, error } = useCampaignDetail(campaignId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/finance/campaigns" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <PageSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <Link href="/finance/campaigns" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading campaign.</strong> {error?.message ?? 'Campaign not found.'}
        </div>
      </div>
    );
  }

  const { campaign, totals, daily } = data;

  // Build chart
  const dates = daily.map((d) => d.date);
  const spendData = daily.map((d) => d.spend);
  const revenueData = daily.map((d) => d.revenue);
  const roasData = daily.map((d) => d.roas);

  const chartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; data: number; axisValueLabel: string; color: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${params[0]?.axisValueLabel ?? ''}</div>`;
        for (const p of params) {
          const formatted = p.seriesName === 'ROAS' ? `${p.data.toFixed(2)}x` : formatDollarsFull(p.data);
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <span style="flex:1">${p.seriesName}</span>
            <strong>${formatted}</strong>
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['Spend', 'Revenue', 'ROAS'],
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6B7280' },
      itemWidth: 16,
      itemHeight: 2,
    },
    grid: { left: '3%', right: '6%', bottom: '14%', top: '6%', containLabel: true },
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
    yAxis: [
      {
        type: 'value' as const,
        name: 'Dollars',
        axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: 'value' as const,
        name: 'ROAS',
        axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v.toFixed(1)}x` },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: 'Spend',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '40%',
        itemStyle: { color: '#FCA5A5', borderRadius: [3, 3, 0, 0] },
        data: spendData,
      },
      {
        name: 'Revenue',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '40%',
        itemStyle: { color: '#6EE7B7', borderRadius: [3, 3, 0, 0] },
        data: revenueData,
      },
      {
        name: 'ROAS',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2.5, color: '#7C3AED' },
        itemStyle: { color: '#7C3AED' },
        data: roasData,
      },
    ],
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/finance/campaigns"
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">{campaign.name}</h1>
              {platformBadge(campaign.platform)}
              {statusBadge(campaign.status)}
            </div>
            {campaign.objective && (
              <p className="text-sm text-gray-500">
                Objective: {campaign.objective}
                {campaign.dailyBudget !== null && (
                  <span className="ml-3">Daily budget: {formatDollars(campaign.dailyBudget)}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <DateRangePicker />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Spend"
          value={totals.spend}
          previousValue={null}
          format="currency"
          icon={<DollarSign className="h-4 w-4" />}
          accentColor="#DC2626"
        />
        <KPICard
          label="Revenue"
          value={totals.revenue}
          previousValue={null}
          format="currency"
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="#059669"
        />
        <KPICard
          label="ROAS"
          value={totals.roas}
          previousValue={null}
          format="multiplier"
          icon={<Target className="h-4 w-4" />}
          accentColor="#7C3AED"
        />
        <KPICard
          label="CPA"
          value={totals.cpa}
          previousValue={null}
          format="currency"
          icon={<MousePointerClick className="h-4 w-4" />}
          accentColor="#D97706"
        />
        <KPICard
          label="CTR"
          value={totals.ctr}
          previousValue={null}
          format="percentage"
          icon={<BarChart3 className="h-4 w-4" />}
          accentColor="#2563EB"
        />
        <KPICard
          label="CPM"
          value={totals.cpm}
          previousValue={null}
          format="currency"
          icon={<Eye className="h-4 w-4" />}
          accentColor="#0891B2"
        />
      </div>

      {/* Daily Metrics Chart */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Spend, Revenue & ROAS</h3>
        {dates.length > 0 ? (
          <ReactECharts
            option={chartOption}
            style={{ height: '400px', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-400">
            No daily data available for this period
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Impressions</span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(totals.impressions)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Clicks</span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(totals.clicks)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Conversions</span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(totals.conversions)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">CPC</span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {totals.cpc > 0 ? formatDollars(totals.cpc) : '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
