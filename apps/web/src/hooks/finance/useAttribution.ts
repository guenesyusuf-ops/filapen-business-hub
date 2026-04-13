'use client';

import { useQuery } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';
import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api/finance`;

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
// Types
// ---------------------------------------------------------------------------

export type AttributionModel = 'last_touch' | 'linear' | 'time_decay' | 'data_driven';

export interface ChannelAttribution {
  channel: string;
  revenue: number;
  spend: number;
  orders: number;
  newCustomers: number;
  revenueShare: number;
  roas: number;
  cac: number;
  incrementalRevenue: number;
  contribution: number;
}

export interface AttributionResult {
  model: AttributionModel;
  totalRevenue: number;
  totalSpend: number;
  channels: ChannelAttribution[];
  insights: string[];
}

export interface ChannelEfficiency {
  channel: string;
  efficiency: number;
  correlation: number;
  avgDailySpend: number;
  avgDailyRevenue: number;
  revenuePerDollarSpent: number;
  diminishingReturnsThreshold: number;
}

export interface OptimalBudgetItem {
  channel: string;
  currentSpend: number;
  suggestedSpend: number;
  expectedRevenueLift: number;
}

export interface SpendRevenueCurve {
  channel: string;
  points: Array<{ spend: number; revenue: number }>;
}

export interface MarketingMixResult {
  channelEfficiency: ChannelEfficiency[];
  optimalBudget: OptimalBudgetItem[];
  spendVsRevenueCurves: SpendRevenueCurve[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAttribution(model: AttributionModel) {
  const { dateRange } = useFinanceUI();

  return useQuery<AttributionResult>({
    queryKey: [
      'finance',
      'attribution',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      model,
    ],
    queryFn: async () => {
      return fetchApi<AttributionResult>(`${API_BASE}/attribution`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
        model,
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useMarketingMix() {
  const { dateRange } = useFinanceUI();

  return useQuery<MarketingMixResult>({
    queryKey: [
      'finance',
      'marketing-mix',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return fetchApi<MarketingMixResult>(`${API_BASE}/marketing-mix`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
