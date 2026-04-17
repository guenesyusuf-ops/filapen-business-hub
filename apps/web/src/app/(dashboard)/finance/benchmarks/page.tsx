'use client';

import ReactECharts from 'echarts-for-react';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useBenchmarks, type MetricComparison } from '@/hooks/finance/useBenchmarks';
import { formatDollars, formatDollarsFull } from '@filapen/shared/src/utils/money';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: MetricComparison['status']) {
  switch (status) {
    case 'above_avg':
      return <TrendingUp className="h-4 w-4 text-emerald-600" />;
    case 'below_avg':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-amber-600" />;
  }
}

function statusColor(status: MetricComparison['status']): string {
  switch (status) {
    case 'above_avg':
      return 'border-emerald-200 bg-emerald-50';
    case 'below_avg':
      return 'border-red-200 bg-red-50';
    default:
      return 'border-amber-200 bg-amber-50';
  }
}

function statusTextColor(status: MetricComparison['status']): string {
  switch (status) {
    case 'above_avg':
      return 'text-emerald-700';
    case 'below_avg':
      return 'text-red-700';
    default:
      return 'text-amber-700';
  }
}

function formatMetricValue(value: number, format: MetricComparison['format']): string {
  switch (format) {
    case 'currency':
      return formatDollarsFull(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'multiplier':
      return `${value.toFixed(2)}x`;
    default:
      return value.toFixed(2);
  }
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
// Radar Chart
// ---------------------------------------------------------------------------

function BenchmarkRadarChart({
  comparison,
  loading,
}: {
  comparison: MetricComparison[];
  loading: boolean;
}) {
  if (loading) return <CardSkeleton height="h-[400px]" />;
  if (!comparison.length) return null;

  // Normalize values to 0-100 scale for radar
  const indicators = comparison.map((c) => ({
    name: c.label,
    max: Math.max(c.top25Value * 1.2, c.orgValue * 1.2, 100),
  }));

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6B7280' },
      data: ['Your Business', 'Industry Average', 'Top 25%'],
    },
    radar: {
      indicator: indicators,
      shape: 'polygon' as const,
      splitArea: {
        areaStyle: {
          color: ['rgba(59, 130, 246, 0.02)', 'rgba(59, 130, 246, 0.04)', 'rgba(59, 130, 246, 0.06)', 'rgba(59, 130, 246, 0.08)'],
        },
      },
      splitLine: { lineStyle: { color: '#E5E7EB' } },
      axisLine: { lineStyle: { color: '#D1D5DB' } },
      axisName: {
        color: '#6B7280',
        fontSize: 11,
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: comparison.map((c) => c.orgValue),
            name: 'Your Business',
            lineStyle: { color: '#3b82f6', width: 2 },
            areaStyle: { color: 'rgba(59, 130, 246, 0.15)' },
            itemStyle: { color: '#3b82f6' },
          },
          {
            value: comparison.map((c) => c.avgValue),
            name: 'Industry Average',
            lineStyle: { color: '#9CA3AF', width: 1.5, type: 'dashed' },
            itemStyle: { color: '#9CA3AF' },
          },
          {
            value: comparison.map((c) => c.top25Value),
            name: 'Top 25%',
            lineStyle: { color: '#059669', width: 1.5, type: 'dotted' },
            itemStyle: { color: '#059669' },
          },
        ],
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance vs. Industry</h3>
      <ReactECharts option={option} style={{ height: '400px', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Cards
// ---------------------------------------------------------------------------

function MetricBenchmarkCard({ metric }: { metric: MetricComparison }) {
  return (
    <div className={cn(
      'rounded-xl bg-white p-4 shadow-card border-l-4 hover:shadow-card-hover transition-all duration-200',
      metric.status === 'above_avg' ? 'border-l-emerald-500' :
      metric.status === 'below_avg' ? 'border-l-red-500' :
      'border-l-amber-500',
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{metric.label}</span>
        {statusIcon(metric.status)}
      </div>
      <div className="text-xl font-bold text-gray-900 mb-2">
        {formatMetricValue(metric.orgValue, metric.format)}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Industry Avg</span>
          <span className="text-gray-700 font-medium">{formatMetricValue(metric.avgValue, metric.format)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Top 25%</span>
          <span className="text-emerald-700 font-medium">{formatMetricValue(metric.top25Value, metric.format)}</span>
        </div>
        {/* Percentile bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Percentile</span>
            <span className={cn('font-semibold', statusTextColor(metric.status))}>
              P{Math.round(metric.percentile)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                metric.status === 'above_avg' ? 'bg-emerald-500' :
                metric.status === 'below_avg' ? 'bg-red-500' :
                'bg-amber-500',
              )}
              style={{ width: `${Math.min(metric.percentile, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
            <span>0</span>
            <span>25th</span>
            <span>50th</span>
            <span>75th</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BenchmarksPage() {
  const benchmarkQuery = useBenchmarks();
  const data = benchmarkQuery.data;
  const isLoading = benchmarkQuery.isLoading;

  // Count above/below
  const aboveCount = data?.comparison.filter((c) => c.status === 'above_avg').length ?? 0;
  const belowCount = data?.comparison.filter((c) => c.status === 'below_avg').length ?? 0;
  const totalMetrics = data?.comparison.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Industry Benchmarks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Compare your metrics against e-commerce industry standards
          </p>
        </div>
        <DateRangePicker />
      </div>

      {benchmarkQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> {benchmarkQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Summary Banner */}
      {!isLoading && data && (
        <div className="rounded-xl bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-5 w-5 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Performance Summary</h2>
          </div>
          <p className="text-sm text-gray-700">
            You are <span className="font-semibold text-emerald-600">above average</span> in{' '}
            <span className="font-bold">{aboveCount}</span> of {totalMetrics} metrics
            {belowCount > 0 && (
              <>
                {' '}and <span className="font-semibold text-red-600">below average</span> in{' '}
                <span className="font-bold">{belowCount}</span>
              </>
            )}.
          </p>
        </div>
      )}

      {/* Radar Chart */}
      <BenchmarkRadarChart
        comparison={data?.comparison ?? []}
        loading={isLoading}
      />

      {/* Metric Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card animate-pulse">
              <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
              <div className="h-6 w-24 rounded bg-gray-200 mb-3" />
              <div className="h-16 w-full rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {data?.comparison.map((metric) => (
            <MetricBenchmarkCard key={metric.metric} metric={metric} />
          ))}
        </div>
      )}

      {/* Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recommendations</h3>
          </div>
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary">
                <span className="mt-0.5 flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
