'use client';

import { useQuery } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';
import type {
  ChannelPerformance,
  AlertItem,
  WaterfallSegment,
  KpiValue,
} from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------

const API_BASE = '/api/finance';

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// API Response Types (matches what the API actually returns)
// ---------------------------------------------------------------------------

export interface ApiKpis {
  grossRevenue: KpiValue;
  netProfit: KpiValue;
  totalAdSpend: KpiValue;
  blendedRoas: KpiValue;
  orderCount: KpiValue;
  avgOrderValue: KpiValue;
  refundRate: KpiValue;
}

export interface ApiTimeSeries {
  dates: string[];
  series: {
    revenue: number[];
    profit: number[];
    adSpend: number[];
  };
}

export interface ApiDashboardResponse {
  kpis: ApiKpis;
  timeSeries: ApiTimeSeries;
  waterfall: WaterfallSegment[];
  channels?: ChannelPerformance[];
}

// ---------------------------------------------------------------------------
// Dashboard Overview (KPIs + waterfall + timeseries - single endpoint)
// ---------------------------------------------------------------------------

export function useDashboardOverview() {
  const { dateRange, selectedChannel } = useFinanceUI();

  return useQuery<ApiDashboardResponse>({
    queryKey: [
      'finance',
      'dashboard',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      selectedChannel,
    ],
    queryFn: async () => {
      const data = await fetchApi<ApiDashboardResponse>(`${API_BASE}/dashboard`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
        ...(selectedChannel ? { channel: selectedChannel } : {}),
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Channel Performance
// ---------------------------------------------------------------------------

export function useChannelPerformance() {
  const { dateRange } = useFinanceUI();

  return useQuery<ChannelPerformance[]>({
    queryKey: [
      'finance',
      'channels',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return await fetchApi<ChannelPerformance[]>(`${API_BASE}/channels`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Revenue Time Series (standalone endpoint)
// ---------------------------------------------------------------------------

export interface TimeSeriesResponse {
  dates: string[];
  series: {
    revenue: number[];
    profit: number[];
    adSpend: number[];
  };
}

export function useRevenueTimeSeries() {
  const { dateRange } = useFinanceUI();

  return useQuery<TimeSeriesResponse>({
    queryKey: [
      'finance',
      'timeseries',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return await fetchApi<TimeSeriesResponse>(`${API_BASE}/timeseries`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
        metrics: 'revenue,profit,adSpend',
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function useFinanceAlerts() {
  return useQuery<AlertItem[]>({
    queryKey: ['finance', 'alerts'],
    queryFn: async () => {
      return await fetchApi<AlertItem[]>(`${API_BASE}/alerts`);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}
