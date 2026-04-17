'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Users,
  Repeat,
  DollarSign,
  Clock,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useCohorts, useLTV } from '@/hooks/finance/useCohorts';
import { formatDollars, formatDollarsFull, formatNumber } from '@filapen/shared/src/utils/money';

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
// Heatmap color helper
// ---------------------------------------------------------------------------

function retentionColor(rate: number): string {
  if (rate >= 80) return 'bg-emerald-600 text-white';
  if (rate >= 60) return 'bg-emerald-500 text-white';
  if (rate >= 40) return 'bg-emerald-400 text-white';
  if (rate >= 25) return 'bg-emerald-300 text-gray-900';
  if (rate >= 15) return 'bg-emerald-200 text-gray-900';
  if (rate >= 5) return 'bg-emerald-100 text-gray-700';
  if (rate > 0) return 'bg-emerald-50 text-gray-600';
  return 'bg-gray-50 text-gray-400';
}

// ---------------------------------------------------------------------------
// Cohort Heatmap Table
// ---------------------------------------------------------------------------

function CohortHeatmap({
  cohorts,
  maxMonths,
  loading,
}: {
  cohorts: Array<{ cohortMonth: string; cohortSize: number; cells: Array<{ monthsSinceFirst: number; retentionRate: number; activeCustomers: number }> }>;
  maxMonths: number;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[400px]" />;
  if (!cohorts.length) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Cohort Retention Heatmap</h3>
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
          No cohort data available
        </div>
      </div>
    );
  }

  const monthHeaders = Array.from({ length: Math.min(maxMonths + 1, 13) }, (_, i) =>
    i === 0 ? 'M0' : `M${i}`,
  );

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cohort Retention Heatmap</h3>
        <p className="text-xs text-gray-500 mt-0.5">Each cell shows the % of customers from each cohort who returned</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-white z-10">Cohort</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Size</th>
              {monthHeaders.map((h) => (
                <th key={h} className="px-2 py-2 text-center font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cohorts.map((cohort) => (
              <tr key={cohort.cohortMonth}>
                <td className="px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  {cohort.cohortMonth}
                </td>
                <td className="px-3 py-1.5 text-center text-gray-600">
                  {formatNumber(cohort.cohortSize)}
                </td>
                {monthHeaders.map((_, monthIndex) => {
                  const cell = cohort.cells.find((c) => c.monthsSinceFirst === monthIndex);
                  if (!cell) {
                    return <td key={monthIndex} className="px-2 py-1.5" />;
                  }
                  return (
                    <td key={monthIndex} className="px-1 py-1">
                      <div
                        className={cn(
                          'rounded px-1.5 py-1 text-center font-medium text-[10px] leading-tight',
                          retentionColor(cell.retentionRate),
                        )}
                        title={`${cell.activeCustomers} customers (${cell.retentionRate.toFixed(1)}%)`}
                      >
                        {cell.retentionRate.toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LTV Bar Chart
// ---------------------------------------------------------------------------

function LTVChart({
  segments,
  loading,
}: {
  segments: Array<{ segment: string; customerCount: number; avgLtv: number }>;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton />;
  if (!segments.length) return null;

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        const seg = segments.find((s) => s.segment === p?.name);
        return `<div style="font-weight:600;margin-bottom:4px">${p?.name ?? ''}</div>
          <div>Avg LTV: <strong>${formatDollarsFull(p?.value ?? 0)}</strong></div>
          <div>Customers: <strong>${formatNumber(seg?.customerCount ?? 0)}</strong></div>`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: segments.map((s) => s.segment),
      axisLabel: { fontSize: 11, color: '#374151' },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => formatDollars(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        type: 'bar',
        data: segments.map((s, i) => ({
          value: s.avgLtv,
          itemStyle: {
            color: ['#3b82f6', '#8b5cf6', '#f59e0b', '#059669'][i % 4],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 48,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Average LTV by Segment</h3>
      <ReactECharts option={option} style={{ height: '280px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retention Curve Chart
// ---------------------------------------------------------------------------

function RetentionCurveChart({
  data,
  loading,
}: {
  data: Array<{ month: number; rate: number }>;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton />;
  if (!data.length) return null;

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => `Month ${d.month}`),
      axisLabel: { fontSize: 10, color: '#9CA3AF' },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { fontSize: 10, color: '#9CA3AF', formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        type: 'line',
        data: data.map((d) => d.rate),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
            ],
          },
        },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Average Retention Curve</h3>
      <ReactECharts option={option} style={{ height: '280px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Breakdown Pie
// ---------------------------------------------------------------------------

function CustomerBreakdownChart({
  repeatRate,
  totalCustomers,
  loading,
}: {
  repeatRate: number;
  totalCustomers: number;
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[250px]" />;

  const newRate = 100 - repeatRate;

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '75%'],
        data: [
          { value: repeatRate, name: 'Returning', itemStyle: { color: '#3b82f6' } },
          { value: newRate, name: 'New', itemStyle: { color: '#93c5fd' } },
        ],
        label: {
          show: true,
          fontSize: 12,
          formatter: (params: { name: string; value: number }) =>
            `${params.name}\n${params.value.toFixed(1)}%`,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.1)' },
        },
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">New vs Returning Customers</h3>
      <p className="text-xs text-gray-500 mb-3">{formatNumber(totalCustomers)} total customers</p>
      <ReactECharts option={option} style={{ height: '220px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CohortsPage() {
  const cohortsQuery = useCohorts();
  const ltvQuery = useLTV();

  const cohortData = cohortsQuery.data;
  const ltvData = ltvQuery.data;
  const isLoading = cohortsQuery.isLoading;
  const hasError = cohortsQuery.isError || ltvQuery.isError;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Cohort & Retention Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Understand customer retention patterns and lifetime value
          </p>
        </div>
        <DateRangePicker />
      </div>

      {hasError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong>{' '}
          {cohortsQuery.error?.message ?? ltvQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall LTV',
            value: ltvData ? formatDollars(ltvData.overallLTV) : '--',
            icon: <DollarSign className="h-4 w-4" />,
            color: '#059669',
            loading: ltvQuery.isLoading,
          },
          {
            label: 'Total Customers',
            value: ltvData ? formatNumber(ltvData.totalCustomers) : '--',
            icon: <Users className="h-4 w-4" />,
            color: '#2563EB',
            loading: ltvQuery.isLoading,
          },
          {
            label: 'Repeat Purchase Rate',
            value: ltvData ? `${ltvData.repeatPurchaseRate.toFixed(1)}%` : '--',
            icon: <Repeat className="h-4 w-4" />,
            color: '#7C3AED',
            loading: ltvQuery.isLoading,
          },
          {
            label: 'Active Cohorts',
            value: cohortData ? formatNumber(cohortData.cohorts.length) : '--',
            icon: <Clock className="h-4 w-4" />,
            color: '#D97706',
            loading: isLoading,
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(
            'group rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200',
            kpi.loading && 'animate-pulse',
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{kpi.label}</span>
              <span className="flex items-center justify-center h-7 w-7 rounded-lg opacity-80"
                style={{ backgroundColor: `${kpi.color}12`, color: kpi.color }}>
                {kpi.icon}
              </span>
            </div>
            {kpi.loading ? (
              <div className="h-7 w-28 rounded bg-gray-200" />
            ) : (
              <div className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</div>
            )}
          </div>
        ))}
      </div>

      {/* Cohort Heatmap */}
      <CohortHeatmap
        cohorts={cohortData?.cohorts ?? []}
        maxMonths={cohortData?.maxMonthsSinceFirst ?? 0}
        loading={isLoading}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LTVChart
          segments={ltvData?.segments ?? []}
          loading={ltvQuery.isLoading}
        />
        <RetentionCurveChart
          data={cohortData?.overallRetentionByMonth ?? []}
          loading={isLoading}
        />
      </div>

      {/* Customer Breakdown + LTV Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <CustomerBreakdownChart
          repeatRate={ltvData?.repeatPurchaseRate ?? 0}
          totalCustomers={ltvData?.totalCustomers ?? 0}
          loading={ltvQuery.isLoading}
        />
        <div className="xl:col-span-2">
          <div className="rounded-xl bg-white shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">LTV by Customer Segment</h3>
            </div>
            {ltvQuery.isLoading ? (
              <div className="p-5 space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-gray-100" />
                ))}
              </div>
            ) : !ltvData?.segments.length ? (
              <div className="py-12 text-center text-sm text-gray-400">No LTV data available.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-surface-secondary">
                      {['Segment', 'Customers', 'Avg LTV', 'Avg Orders', 'Avg AOV', 'Avg Lifespan'].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ltvData.segments.map((seg) => (
                      <tr key={seg.segment} className="hover:bg-surface-secondary transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{seg.segment}</td>
                        <td className="px-5 py-3 text-gray-700">{formatNumber(seg.customerCount)}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{formatDollarsFull(seg.avgLtv)}</td>
                        <td className="px-5 py-3 text-gray-700">{seg.avgOrders.toFixed(1)}</td>
                        <td className="px-5 py-3 text-gray-700">{formatDollarsFull(seg.avgAov)}</td>
                        <td className="px-5 py-3 text-gray-700">
                          {seg.avgLifespanDays > 0 ? `${Math.round(seg.avgLifespanDays)} days` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
