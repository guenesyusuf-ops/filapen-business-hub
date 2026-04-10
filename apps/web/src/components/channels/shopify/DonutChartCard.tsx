'use client';

import ReactECharts from 'echarts-for-react';
import { AnalyticsCard, formatInt } from './AnalyticsCard';

interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartCardProps {
  title: string;
  data: DonutSlice[];
  height?: number;
}

const DEFAULT_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

export function DonutChartCard({
  title,
  data,
  height = 260,
}: DonutChartCardProps) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
         <div>${formatInt(p.value)} <span style="color:#9ca3af">(${p.percent.toFixed(1)}%)</span></div>`,
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['55%', '80%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#111',
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        data: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
        })),
      },
    ],
  };

  return (
    <AnalyticsCard title={title}>
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </AnalyticsCard>
  );
}
