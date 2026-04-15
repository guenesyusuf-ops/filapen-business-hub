'use client';

import ReactECharts from 'echarts-for-react';
import { useWmBurndown } from '@/hooks/work-management/useWmDashboard';

interface BurndownChartProps {
  projectId: string;
}

export function BurndownChart({ projectId }: BurndownChartProps) {
  const { data, isLoading, error } = useWmBurndown(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
        Burndown-Daten konnten nicht geladen werden.
      </div>
    );
  }

  if (!data || data.dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Noch keine Daten fuer das Burndown-Chart vorhanden.
        </p>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30, 30, 40, 0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#e5e7eb', fontSize: 12 },
      formatter(params: Array<{ seriesName: string; value: number; axisValue: string }>) {
        const date = params[0]?.axisValue ?? '';
        let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
        for (const p of params) {
          const color = p.seriesName === 'Ideal' ? '#3B82F6' : '#10B981';
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            ${p.seriesName}: <strong>${p.value}</strong>
          </div>`;
        }
        return html;
      },
    },
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: 40,
    },
    xAxis: {
      type: 'category' as const,
      data: data.dates,
      axisLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        rotate: data.dates.length > 14 ? 45 : 0,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Offene Aufgaben',
      nameTextStyle: { color: '#9CA3AF', fontSize: 11 },
      axisLabel: { fontSize: 11, color: '#9CA3AF' },
      splitLine: { lineStyle: { color: 'rgba(107,114,128,0.2)' } },
      min: 0,
    },
    series: [
      {
        name: 'Ideal',
        type: 'line',
        data: data.ideal,
        smooth: false,
        lineStyle: { color: '#3B82F6', width: 2, type: 'dashed' as const },
        itemStyle: { color: '#3B82F6' },
        symbol: 'none',
      },
      {
        name: 'Tatsaechlich',
        type: 'line',
        data: data.actual,
        smooth: true,
        lineStyle: { color: '#10B981', width: 2.5 },
        itemStyle: { color: '#10B981' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16,185,129,0.15)' },
              { offset: 1, color: 'rgba(16,185,129,0.01)' },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 4,
      },
    ],
    legend: {
      data: ['Ideal', 'Tatsaechlich'],
      top: 4,
      textStyle: { color: '#9CA3AF', fontSize: 12 },
    },
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Burndown Chart
      </h3>
      <ReactECharts
        option={option}
        style={{ height: 360, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

export default BurndownChart;
