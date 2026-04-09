'use client';

import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  DollarSign,
  TrendingUp,
  Tag,
  RotateCcw,
  Package,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useDashboardOverview, useRevenueTimeSeries } from '@/hooks/finance/useDashboard';
import { useRevenueBreakdown } from '@/hooks/finance/useRevenueBreakdown';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';

// ---------------------------------------------------------------------------
// KPI Card (simple inline version for revenue page)
// ---------------------------------------------------------------------------

function RevenueKPICard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
        <div className="h-7 w-28 rounded bg-gray-200" />
      </div>
    );
  }
  return (
    <div className="group rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <span
          className="flex items-center justify-center h-7 w-7 rounded-lg opacity-80"
          style={{ backgroundColor: `${color}12`, color }}
        >
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue Over Time Chart
// ---------------------------------------------------------------------------

type Granularity = 'daily' | 'weekly' | 'monthly';

function RevenueOverTimeChart({
  dates,
  revenue,
  loading,
}: {
  dates: string[];
  revenue: number[];
  loading: boolean;
}) {
  const [granularity, setGranularity] = useState<Granularity>('daily');

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
        <div className="h-[350px] bg-gray-100 rounded" />
      </div>
    );
  }

  // Aggregate data based on granularity
  let chartDates = dates;
  let chartRevenue = revenue;

  if (granularity === 'weekly' && dates.length > 7) {
    const weekDates: string[] = [];
    const weekRevenue: number[] = [];
    for (let i = 0; i < dates.length; i += 7) {
      const chunk = revenue.slice(i, i + 7);
      weekDates.push(dates[i]!);
      weekRevenue.push(chunk.reduce((a, b) => a + b, 0));
    }
    chartDates = weekDates;
    chartRevenue = weekRevenue;
  } else if (granularity === 'monthly' && dates.length > 28) {
    const monthMap = new Map<string, number>();
    dates.forEach((d, i) => {
      const month = d.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + (revenue[i] ?? 0));
    });
    chartDates = Array.from(monthMap.keys());
    chartRevenue = Array.from(monthMap.values());
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ data: number; axisValueLabel: string }>) => {
        const p = params[0];
        return `<div style="font-weight:600;margin-bottom:4px">${p?.axisValueLabel ?? ''}</div>
          <div><strong>${formatDollarsFull(p?.data ?? 0)}</strong></div>`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: chartDates,
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        formatter: (v: string) => {
          const parts = v.split('-');
          return granularity === 'monthly'
            ? `${parts[0]}-${parts[1]}`
            : `${parts[1]}/${parts[2]}`;
        },
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
        type: 'bar',
        data: chartRevenue,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#2563EB' },
              { offset: 1, color: '#93C5FD' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 32,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Revenue Over Time</h3>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                granularity === g
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-500 hover:bg-surface-secondary',
              )}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <ReactECharts option={option} style={{ height: '350px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue by Channel (horizontal bar)
// ---------------------------------------------------------------------------

function RevenueByChannelChart({
  data,
  loading,
}: {
  data: Array<{ channel: string; revenue: number; orders: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-36 rounded bg-gray-200 mb-4" />
        <div className="h-[280px] bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Channel</h3>
        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
          No channel data available
        </div>
      </div>
    );
  }

  const colors = ['#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED', '#EC4899'];

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ name: string; data: number }>) => {
        const p = params[0];
        const item = data.find((d) => d.channel === p?.name);
        return `<div style="font-weight:600;margin-bottom:4px">${p?.name ?? ''}</div>
          <div>Revenue: <strong>${formatDollarsFull(p?.data ?? 0)}</strong></div>
          <div>Orders: <strong>${formatNumber(item?.orders ?? 0)}</strong></div>`;
      },
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category' as const,
      data: data.map((d) => d.channel),
      axisLabel: { fontSize: 11, color: '#374151' },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d, i) => ({
          value: Number(d.revenue),
          itemStyle: { color: colors[i % colors.length], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 24,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Channel</h3>
      <ReactECharts option={option} style={{ height: '280px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue by Country Table
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
  AU: 'Australia',
  NL: 'Netherlands',
  JP: 'Japan',
  SE: 'Sweden',
  IT: 'Italy',
  ES: 'Spain',
  BR: 'Brazil',
  MX: 'Mexico',
  IN: 'India',
  KR: 'South Korea',
};

function RevenueByCountryTable({
  data,
  loading,
}: {
  data: Array<{ country_code: string; orders: number; revenue: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white shadow-card animate-pulse">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-36 rounded bg-gray-200" />
        </div>
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + Number(d.revenue), 0);

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Globe className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Revenue by Country</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">No country data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="px-5 py-2.5 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Country
                </th>
                <th className="px-5 py-2.5 text-right text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-5 py-2.5 text-right text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Orders
                </th>
                <th className="px-5 py-2.5 text-right text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => {
                const pct = total > 0 ? (Number(row.revenue) / total) * 100 : 0;
                return (
                  <tr key={row.country_code} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-5 py-2.5 text-sm text-gray-900">
                      {COUNTRY_NAMES[row.country_code] ?? row.country_code}
                    </td>
                    <td className="px-5 py-2.5 text-sm text-gray-900 text-right font-medium">
                      {formatDollarsFull(Number(row.revenue))}
                    </td>
                    <td className="px-5 py-2.5 text-sm text-gray-500 text-right">
                      {formatNumber(Number(row.orders))}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue by Product Table
// ---------------------------------------------------------------------------

function RevenueByProductTable({
  data,
  loading,
}: {
  data: Array<{ title: string | null; image_url: string | null; revenue: number; units: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white shadow-card animate-pulse">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-36 rounded bg-gray-200" />
        </div>
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Package className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Top Products by Revenue</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">No product data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="px-5 py-2.5 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="px-5 py-2.5 text-right text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-5 py-2.5 text-right text-xxs font-medium uppercase tracking-wider text-gray-500">
                  Units
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      {row.image_url ? (
                        <img
                          src={row.image_url}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center">
                          <Package className="h-4 w-4 text-gray-300" />
                        </div>
                      )}
                      <span className="text-sm text-gray-900 font-medium truncate max-w-[200px]">
                        {row.title ?? 'Unknown Product'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-sm text-gray-900 text-right font-medium">
                    {formatDollarsFull(Number(row.revenue))}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-gray-500 text-right">
                    {formatNumber(Number(row.units))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RevenuePage() {
  const dashboardQuery = useDashboardOverview();
  const timeSeriesQuery = useRevenueTimeSeries();
  const breakdownQuery = useRevenueBreakdown();

  const kpis = dashboardQuery.data?.kpis;
  const isLoading = dashboardQuery.isLoading;
  const hasError = dashboardQuery.isError || timeSeriesQuery.isError || breakdownQuery.isError;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Deep-dive into revenue performance across channels, countries, and products
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Error */}
      {hasError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong>{' '}
          {dashboardQuery.error?.message ?? breakdownQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <RevenueKPICard
          label="Gross Revenue"
          value={kpis ? formatDollars(kpis.grossRevenue.value) : '--'}
          icon={<DollarSign className="h-4 w-4" />}
          color="#2563EB"
          loading={isLoading}
        />
        <RevenueKPICard
          label="Net Profit"
          value={kpis ? formatDollars(kpis.netProfit.value) : '--'}
          icon={<TrendingUp className="h-4 w-4" />}
          color="#059669"
          loading={isLoading}
        />
        <RevenueKPICard
          label="Discounts"
          value={kpis ? formatDollars(Math.abs(kpis.grossRevenue.value - kpis.netProfit.value - (kpis.totalAdSpend?.value ?? 0))) : '--'}
          icon={<Tag className="h-4 w-4" />}
          color="#D97706"
          loading={isLoading}
        />
        <RevenueKPICard
          label="Refund Rate"
          value={kpis ? `${kpis.refundRate.value.toFixed(1)}%` : '--'}
          icon={<RotateCcw className="h-4 w-4" />}
          color="#DC2626"
          loading={isLoading}
        />
      </div>

      {/* Revenue Over Time */}
      <RevenueOverTimeChart
        dates={timeSeriesQuery.data?.dates ?? []}
        revenue={timeSeriesQuery.data?.series?.revenue ?? []}
        loading={timeSeriesQuery.isLoading}
      />

      {/* Charts + Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RevenueByChannelChart
          data={breakdownQuery.data?.byChannel ?? []}
          loading={breakdownQuery.isLoading}
        />
        <RevenueByCountryTable
          data={breakdownQuery.data?.byCountry ?? []}
          loading={breakdownQuery.isLoading}
        />
      </div>

      {/* Product Table */}
      <RevenueByProductTable
        data={breakdownQuery.data?.byProduct ?? []}
        loading={breakdownQuery.isLoading}
      />
    </div>
  );
}
