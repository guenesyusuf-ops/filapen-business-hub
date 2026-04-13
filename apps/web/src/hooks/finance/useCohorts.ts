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

export interface CohortCell {
  cohortMonth: string;
  activityMonth: string;
  monthsSinceFirst: number;
  activeCustomers: number;
  revenue: number;
  orders: number;
  retentionRate: number;
}

export interface CohortRow {
  cohortMonth: string;
  cohortSize: number;
  cells: CohortCell[];
}

export interface CohortResult {
  cohorts: CohortRow[];
  maxMonthsSinceFirst: number;
  overallRetentionByMonth: Array<{ month: number; rate: number }>;
}

export interface LTVSegment {
  segment: string;
  customerCount: number;
  avgLtv: number;
  avgOrders: number;
  avgAov: number;
  avgLifespanDays: number;
}

export interface LTVResult {
  segments: LTVSegment[];
  overallLTV: number;
  totalCustomers: number;
  repeatPurchaseRate: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCohorts() {
  const { dateRange } = useFinanceUI();

  return useQuery<CohortResult>({
    queryKey: [
      'finance',
      'cohorts',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return fetchApi<CohortResult>(`${API_BASE}/cohorts`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useLTV() {
  return useQuery<LTVResult>({
    queryKey: ['finance', 'ltv'],
    queryFn: async () => {
      return fetchApi<LTVResult>(`${API_BASE}/ltv`);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
