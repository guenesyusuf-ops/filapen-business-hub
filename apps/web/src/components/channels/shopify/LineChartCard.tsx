'use client';

import ReactECharts from 'echarts-for-react';
import {
  AnalyticsCard,
  formatEur,
  formatInt,
  intFormatter,
  eurCompactFormatter,
  decFormatter,
} from './AnalyticsCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ValueFormat = 'currency' | 'count' | 'percent' | 'decimal';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartCardProps {
  title: string;
  bigNumber?: string;
  bigNumberSubLabel?: string;
  data: DataPoint[];
  color?: string;
  format?: ValueFormat;
  chartType?: 'line' | 'bar';
  height?: number;
  labelEvery?: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatValue(v: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return formatEur(v);
    case 'count':
      return formatInt(v);
    case 'percent':
      return `${decFormatter.format(v)} %`;
    case 'decimal':
      return decFormatter.format(v);
  }
}

function axisFormatter(v: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return v >= 1000
        ? eurCompactFormatter.format(v)
        : new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          }).format(v);
    case 'count':
      return intFormatter.format(v);
    case 'percent':
      return `${decFormatter.format(v)}%`;
    case 'decimal':
      return decFormatter.format(v);
  }
}

// ---------------------------------------------------------------------------
// LineChartCard
// ---------------------------------------------------------------------------

export function LineChartCard({
  title,
  bigNumber,
  bigNumberSubLabel,
  data,
  color = '#22c55e',
  format = 'currency',
  chartType = 'line',
  height = 220,
  labelEvery,
}: LineChartCardProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);

  const interval = labelEvery ?? Math.max(0, Math.floor(labels.length / 8) - 1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (
        params: Array<{ data: number; axisValueLabel: string; color: string }>,
      ) => {
        const p = params[0];
        if (!p) return '';
        return `<div style="font-weight:600;margin-bottom:4px">${p.axisValueLabel}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <strong>${formatValue(p.data, format)}</strong>
          </div>`;
      },
    },
    grid: { left: '3%', right: '3%', bottom: '10%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: labels,
      boundaryGap: chartType === 'bar',
      axisLabel: {
        color: '#6b7280',
        fontSize: 10,
        interval,
        hideOverlap: true,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: '#6b7280',
        fontSize: 10,
        formatter: (v: number) => axisFormatter(v, format),
      },
      splitLine: {
        lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const },
      },
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
    <AnalyticsCard
      title={title}
      bigNumber={bigNumber}
      bigNumberSubLabel={bigNumberSubLabel}
    >
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </AnalyticsCard>
  );
}
