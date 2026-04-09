'use client';

import ReactECharts from 'echarts-for-react';
import { formatDollars, formatDollarsFull } from '@filapen/shared/src/utils/money';

interface TimeChartProps {
  dates: string[];
  revenue: number[];
  profit: number[];
  adSpend?: number[];
  loading?: boolean;
}

function TimeChartSkeleton() {
  return (
    <div className="relative rounded-xl bg-white p-5 shadow-card overflow-hidden">
      <div className="absolute inset-0 shimmer-bg animate-shimmer" />
      <div className="relative">
        <div className="h-4 w-44 rounded-full bg-gray-200/60 mb-4" />
        <div className="h-[400px] bg-gray-100/40 rounded-lg" />
      </div>
    </div>
  );
}

export function RevenueTimeChart({
  dates,
  revenue,
  profit,
  adSpend,
  loading,
}: TimeChartProps) {
  if (loading) {
    return <TimeChartSkeleton />;
  }

  if (!dates || dates.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Profit Trend</h3>
        <div className="h-[400px] flex items-center justify-center text-gray-400 text-sm">
          No data available
        </div>
      </div>
    );
  }

  // Values are in DOLLARS from the API
  const series: Array<Record<string, unknown>> = [
    {
      name: 'Revenue',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: '#2563EB' },
      emphasis: {
        focus: 'series',
        itemStyle: {
          color: '#2563EB',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(37, 99, 235, 0.4)',
        },
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(37, 99, 235, 0.15)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.01)' },
          ],
        },
      },
      data: revenue,
    },
    {
      name: 'Profit',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: '#059669' },
      emphasis: {
        focus: 'series',
        itemStyle: {
          color: '#059669',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(5, 150, 105, 0.4)',
        },
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(5, 150, 105, 0.12)' },
            { offset: 1, color: 'rgba(5, 150, 105, 0.01)' },
          ],
        },
      },
      data: profit,
    },
  ];

  if (adSpend && adSpend.length > 0) {
    series.push({
      name: 'Ad Spend',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2, color: '#DC2626', type: 'dashed' },
      emphasis: {
        focus: 'series',
        itemStyle: {
          color: '#DC2626',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(220, 38, 38, 0.4)',
        },
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(220, 38, 38, 0.06)' },
            { offset: 1, color: 'rgba(220, 38, 38, 0.01)' },
          ],
        },
      },
      data: adSpend,
    });
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.06)',
      borderRadius: 12,
      padding: [12, 16],
      extraCssText: 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.08);',
      textStyle: { color: '#111827', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' },
      formatter: (params: Array<{ seriesName: string; data: number; axisValueLabel: string; color: string }>) => {
        let html = `<div style="font-weight:600;margin-bottom:8px;font-size:13px;color:#111827">${params[0]?.axisValueLabel ?? ''}</div>`;
        for (const p of params) {
          html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block;box-shadow:0 0 0 2px ${p.color}20"></span>
            <span style="flex:1;color:#6B7280">${p.seriesName}</span>
            <strong style="color:#111827">${formatDollarsFull(p.data)}</strong>
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: series.map((s) => s.name as string),
      bottom: 0,
      textStyle: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter, system-ui, sans-serif' },
      itemWidth: 16,
      itemHeight: 2,
      itemGap: 20,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '14%',
      top: '6%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: dates,
      boundaryGap: false,
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'Inter, system-ui, sans-serif',
        formatter: (v: string) => {
          const parts = v.split('-');
          return `${parts[1]}/${parts[2]}`;
        },
      },
      axisLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'Inter, system-ui, sans-serif',
        formatter: (v: number) => formatDollars(v),
      },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.04)', type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    animationDuration: 600,
    animationEasing: 'cubicInOut',
    series,
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Profit Trend</h3>
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
