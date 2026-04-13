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

export interface OrgMetrics {
  roas: number;
  grossMargin: number;
  netMargin: number;
  cac: number;
  aov: number;
  refundRate: number;
  repeatPurchaseRate: number;
  conversionRate: number;
}

export interface BenchmarkTier {
  roas: number;
  grossMargin: number;
  netMargin: number;
  cac: number;
  aov: number;
  refundRate: number;
  repeatPurchaseRate: number;
  conversionRate: number;
}

export interface MetricComparison {
  metric: string;
  label: string;
  orgValue: number;
  avgValue: number;
  top25Value: number;
  bottom25Value: number;
  percentile: number;
  status: 'above_avg' | 'at_avg' | 'below_avg';
  format: 'currency' | 'percent' | 'multiplier';
}

export interface BenchmarkResult {
  org: OrgMetrics;
  benchmarks: {
    ecommerce_avg: BenchmarkTier;
    ecommerce_top25: BenchmarkTier;
    ecommerce_bottom25: BenchmarkTier;
  };
  comparison: MetricComparison[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBenchmarks() {
  const { dateRange } = useFinanceUI();

  return useQuery<BenchmarkResult>({
    queryKey: [
      'finance',
      'benchmarks',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return fetchApi<BenchmarkResult>(`${API_BASE}/benchmarks`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
