'use client';

import ReactECharts from 'echarts-for-react';
import type { WaterfallSegment } from '@filapen/shared/src/types/finance';
import { formatDollars, formatDollarsFull } from '@filapen/shared/src/utils/money';

interface WaterfallChartProps {
  segments: WaterfallSegment[];
  loading?: boolean;
}

function WaterfallSkeleton() {
  return (
    <div className="relative rounded-xl bg-white p-5 shadow-card overflow-hidden">
      <div className="absolute inset-0 shimmer-bg animate-shimmer" />
      <div className="relative">
        <div className="h-4 w-40 rounded-full bg-gray-200/60 mb-4" />
        <div className="h-[400px] flex items-end gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-lg bg-gray-200/60"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PnLWaterfallChart({ segments, loading }: WaterfallChartProps) {
  if (loading) {
    return <WaterfallSkeleton />;
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">P&L Waterfall</h3>
        <div className="h-[400px] flex items-center justify-center text-gray-400 text-sm">
          No data available
        </div>
      </div>
    );
  }

  // Values are in DOLLARS from the API
  const labels = segments.map((s) => s.label);

  const placeholder: (number | string)[] = [];
  const increase: (number | string)[] = [];
  const decrease: (number | string)[] = [];
  const total: (number | string)[] = [];

  let runningTotal = 0;

  for (const seg of segments) {
    const absVal = Math.abs(seg.value);

    if (seg.type === 'total' || seg.type === 'subtotal') {
      placeholder.push(0);
      increase.push('-');
      decrease.push('-');
      total.push(absVal);
      runningTotal = seg.value;
    } else if (seg.type === 'positive' || seg.value > 0) {
      placeholder.push(runningTotal);
      increase.push(absVal);
      decrease.push('-');
      total.push('-');
      runningTotal += seg.value;
    } else {
      placeholder.push(Math.max(0, runningTotal - absVal));
      increase.push('-');
      decrease.push(absVal);
      total.push('-');
      runningTotal -= absVal;
    }
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.06)',
      borderRadius: 12,
      padding: [12, 16],
      extraCssText: 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.08);',
      textStyle: { color: '#111827', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' },
      formatter: (params: Array<{ seriesName: string; data: number | string; name: string }>) => {
        const item = params.find((p) => typeof p.data === 'number' && p.seriesName !== 'Placeholder');
        if (!item) return '';
        const seg = segments.find((s) => s.label === item.name);
        if (!seg) return '';
        const prefix = seg.value < 0 ? '-' : seg.type === 'positive' ? '+' : '';
        return `<strong>${item.name}</strong><br/>${prefix}${formatDollarsFull(Math.abs(seg.value))}`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: {
        rotate: 35,
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      axisLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        formatter: (v: number) => formatDollars(v),
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.04)', type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    animationDuration: 600,
    animationEasing: 'cubicInOut',
    series: [
      {
        name: 'Placeholder',
        type: 'bar' as const,
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: placeholder,
      },
      {
        name: 'Increase',
        type: 'bar' as const,
        stack: 'waterfall',
        itemStyle: { color: '#059669', borderRadius: [6, 6, 0, 0] },
        emphasis: {
          itemStyle: {
            color: '#047857',
            shadowBlur: 8,
            shadowColor: 'rgba(5, 150, 105, 0.3)',
          },
        },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#059669',
          fontFamily: 'Inter, system-ui, sans-serif',
          formatter: (p: { data: number | string }) => {
            if (typeof p.data !== 'number') return '';
            return formatDollars(p.data);
          },
        },
        data: increase,
      },
      {
        name: 'Decrease',
        type: 'bar' as const,
        stack: 'waterfall',
        itemStyle: { color: '#DC2626', borderRadius: [6, 6, 0, 0] },
        emphasis: {
          itemStyle: {
            color: '#B91C1C',
            shadowBlur: 8,
            shadowColor: 'rgba(220, 38, 38, 0.3)',
          },
        },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#DC2626',
          fontFamily: 'Inter, system-ui, sans-serif',
          formatter: (p: { data: number | string }) => {
            if (typeof p.data !== 'number') return '';
            return `-${formatDollars(p.data)}`;
          },
        },
        data: decrease,
      },
      {
        name: 'Total',
        type: 'bar' as const,
        stack: 'waterfall',
        itemStyle: { color: '#2563EB', borderRadius: [6, 6, 0, 0] },
        emphasis: {
          itemStyle: {
            color: '#1D4ED8',
            shadowBlur: 8,
            shadowColor: 'rgba(37, 99, 235, 0.3)',
          },
        },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#2563EB',
          fontFamily: 'Inter, system-ui, sans-serif',
          formatter: (p: { data: number | string }) => {
            if (typeof p.data !== 'number') return '';
            return formatDollars(p.data);
          },
        },
        data: total,
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">P&L Waterfall</h3>
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
