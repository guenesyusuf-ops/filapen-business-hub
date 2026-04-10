'use client';

import ReactECharts from 'echarts-for-react';
import {
  AnalyticsCard,
  formatEur,
  formatInt,
  eurCompactFormatter,
  intFormatter,
} from './AnalyticsCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BarItem {
  label: string;
  value: number;
  subLabel?: string;
}

interface BarChartCardProps {
  title: string;
  data: BarItem[];
  color?: string;
  format?: 'currency' | 'count';
  orientation?: 'horizontal' | 'vertical';
  height?: number;
}

// ---------------------------------------------------------------------------
// BarChartCard
// ---------------------------------------------------------------------------

export function BarChartCard({
  title,
  data,
  color = '#22c55e',
  format = 'currency',
  orientation = 'horizontal',
  height = 320,
}: BarChartCardProps) {
  const isHorizontal = orientation === 'horizontal';

  // For horizontal bar charts ECharts renders the first category at the top
  // by default when the category axis is reversed. Shopify-style lists show
  // the largest bar at the top so we keep the natural order and reverse yAxis.
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);

  const formatValue = (v: number) =>
    format === 'currency' ? formatEur(v) : formatInt(v);

  const axisFormatter = (v: number) => {
    if (format === 'currency') {
      return v >= 1000
        ? eurCompactFormatter.format(v)
        : new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          }).format(v);
    }
    return intFormatter.format(v);
  };

  const baseAxis = {
    axisLabel: { color: '#9ca3af', fontSize: 11 },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    axisTick: { show: false },
  };

  const valueAxis = {
    ...baseAxis,
    type: 'value' as const,
    axisLabel: { ...baseAxis.axisLabel, formatter: axisFormatter },
    splitLine: {
      lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const },
    },
  };

  const categoryAxis = {
    ...baseAxis,
    type: 'category' as const,
    data: labels,
    inverse: isHorizontal,
    splitLine: { show: false },
    axisLabel: {
      ...baseAxis.axisLabel,
      formatter: (v: string) => (v.length > 28 ? v.slice(0, 28) + '…' : v),
      width: 160,
      overflow: 'truncate' as const,
    },
  };

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (
        params: Array<{ data: number; name: string; color: string }>,
      ) => {
        const p = params[0];
        if (!p) return '';
        return `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <strong>${formatValue(p.data)}</strong>
          </div>`;
      },
    },
    grid: {
      left: isHorizontal ? 140 : '3%',
      right: '5%',
      bottom: isHorizontal ? '5%' : '12%',
      top: '5%',
      containLabel: true,
    },
    xAxis: isHorizontal ? valueAxis : categoryAxis,
    yAxis: isHorizontal ? categoryAxis : valueAxis,
    series: [
      {
        type: 'bar' as const,
        data: values,
        itemStyle: {
          color,
          borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
        },
        barMaxWidth: 22,
      },
    ],
    animationDuration: 500,
  };

  return (
    <AnalyticsCard title={title}>
      {data.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-gray-500"
          style={{ height: `${height}px` }}
        >
          Keine Daten
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: `${height}px`, width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      )}
    </AnalyticsCard>
  );
}
