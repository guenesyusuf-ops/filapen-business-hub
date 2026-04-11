'use client';

import ReactECharts from 'echarts-for-react';
import {
  useShopifyRevenueBreakdown,
  type ShopifyBreakdownTotals,
  type ShopifyHourlyPoint,
} from '@/hooks/finance/useRevenueBreakdown';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

function formatEur(value: number): string {
  return eurFormatter.format(value ?? 0);
}

function formatNegative(value: number): string {
  if (!value) return eurFormatter.format(0);
  return `-${eurFormatter.format(Math.abs(value))}`;
}

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')} Uhr`;
}

// ---------------------------------------------------------------------------
// Breakdown table rows configuration
// ---------------------------------------------------------------------------

type BreakdownRow = {
  key: keyof ShopifyBreakdownTotals;
  label: string;
  sign: 'positive' | 'negative' | 'neutral';
  emphasis?: 'subtotal' | 'total';
};

const BREAKDOWN_ROWS: BreakdownRow[] = [
  { key: 'grossSales', label: 'Bruttoumsatz', sign: 'positive' },
  { key: 'discounts', label: 'Rabatte', sign: 'negative' },
  { key: 'returns', label: 'Rückgaben', sign: 'negative' },
  { key: 'netSales', label: 'Nettoumsatz', sign: 'positive', emphasis: 'subtotal' },
  { key: 'shipping', label: 'Versandgebühren', sign: 'positive' },
  { key: 'returnFees', label: 'Rückgabegebühren', sign: 'positive' },
  { key: 'taxes', label: 'Steuern', sign: 'positive' },
  { key: 'totalSales', label: 'Gesamtumsatz', sign: 'positive', emphasis: 'total' },
];

// ---------------------------------------------------------------------------
// Breakdown table
// ---------------------------------------------------------------------------

function BreakdownTable({ data }: { data: ShopifyBreakdownTotals }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-6 shadow-card dark:shadow-[var(--card-shadow)]">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
        Aufschlüsselung des Gesamtumsatzes
      </h3>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {BREAKDOWN_ROWS.map((row) => {
          const raw = data[row.key] ?? 0;
          const isEmph = row.emphasis === 'subtotal' || row.emphasis === 'total';
          const isTotal = row.emphasis === 'total';
          const display =
            row.sign === 'negative' ? formatNegative(raw) : formatEur(raw);
          return (
            <div
              key={row.key}
              className={[
                'flex items-center justify-between py-3',
                isTotal ? 'border-t border-gray-200 dark:border-white/10 pt-4 mt-1' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-sm',
                  isEmph ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
                ].join(' ')}
              >
                {row.label}
              </span>
              <span
                className={[
                  'tabular-nums',
                  isTotal
                    ? 'text-base font-bold text-gray-900 dark:text-white'
                    : isEmph
                      ? 'text-sm font-semibold text-gray-900 dark:text-white'
                      : row.sign === 'negative'
                        ? 'text-sm text-red-600 dark:text-red-400'
                        : 'text-sm text-gray-700 dark:text-gray-200',
                ].join(' ')}
              >
                {display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hourly line/bar chart
// ---------------------------------------------------------------------------

type HourlyMetric = 'revenue' | 'orders' | 'aov';

interface HourlyChartProps {
  title: string;
  hourly: ShopifyHourlyPoint[];
  metric: HourlyMetric;
  color: string;
  chartType?: 'line' | 'bar';
}

function HourlyChart({
  title,
  hourly,
  metric,
  color,
  chartType = 'line',
}: HourlyChartProps) {
  const labels = hourly.map((p) => formatHourLabel(p.hour));
  const values = hourly.map((p) => p[metric] ?? 0);

  const isCurrency = metric !== 'orders';

  const axisFormatter = (v: number) =>
    isCurrency
      ? new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          notation: v >= 1000 ? 'compact' : 'standard',
          maximumFractionDigits: v >= 1000 ? 1 : 0,
        }).format(v)
      : intFormatter.format(v);

  const tooltipFormatter = (v: number) =>
    isCurrency ? formatEur(v) : intFormatter.format(v);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: Array<{ data: number; axisValueLabel: string; color: string }>) => {
        const p = params[0];
        if (!p) return '';
        return `<div style="font-weight:600;margin-bottom:4px">${p.axisValueLabel}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <strong>${tooltipFormatter(p.data)}</strong>
          </div>`;
      },
    },
    grid: { left: '3%', right: '3%', bottom: '8%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: labels,
      boundaryGap: chartType === 'bar',
      axisLabel: {
        color: '#6b7280',
        fontSize: 10,
        interval: 3,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: '#6b7280',
        fontSize: 10,
        formatter: axisFormatter,
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      chartType === 'bar'
        ? {
            type: 'bar' as const,
            data: values,
            itemStyle: { color, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 18,
          }
        : {
            type: 'line' as const,
            smooth: true,
            symbol: 'none',
            data: values,
            lineStyle: { width: 2.5, color },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}33` },
                  { offset: 1, color: `${color}05` },
                ],
              },
            },
          },
    ],
    animationDuration: 500,
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-6 shadow-card dark:shadow-[var(--card-shadow)]">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      <ReactECharts
        option={option}
        style={{ height: '260px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function BreakdownSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[480px] animate-pulse rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]" />
        <div className="h-[330px] animate-pulse rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[330px] animate-pulse rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]" />
        <div className="h-[330px] animate-pulse rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level section
// ---------------------------------------------------------------------------

export function ShopifyRevenueBreakdownSection() {
  const { data, isLoading, isError, error } = useShopifyRevenueBreakdown();

  if (isLoading) {
    return <BreakdownSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-700 dark:text-red-300">
        <strong>Fehler beim Laden der Umsatzaufschlüsselung.</strong>{' '}
        {error instanceof Error ? error.message : 'Bitte erneut versuchen.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownTable data={data.breakdown} />
        <HourlyChart
          title="Gesamtumsatz im Zeitverlauf"
          hourly={data.hourly}
          metric="revenue"
          color="#22c55e"
          chartType="bar"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HourlyChart
          title="Bestellungen im Zeitverlauf"
          hourly={data.hourly}
          metric="orders"
          color="#3b82f6"
          chartType="bar"
        />
        <HourlyChart
          title="Durchschnittlicher Bestellwert"
          hourly={data.hourly}
          metric="aov"
          color="#a855f7"
          chartType="line"
        />
      </div>
    </div>
  );
}
