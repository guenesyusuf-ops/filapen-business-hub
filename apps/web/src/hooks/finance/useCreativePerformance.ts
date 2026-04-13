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

export interface CampaignWithTrend {
  id: string;
  name: string;
  status: string;
  externalId: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  roasTrend: 'improving' | 'declining' | 'stable';
}

export interface CampaignTrend {
  campaignId: string;
  campaignName: string;
  daily: Array<{
    date: string;
    spend: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
}

export interface CreativePerformanceResult {
  campaigns: CampaignWithTrend[];
  trends: CampaignTrend[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreativePerformance() {
  const { dateRange } = useFinanceUI();

  return useQuery<CreativePerformanceResult>({
    queryKey: [
      'finance',
      'creative-performance',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return fetchApi<CreativePerformanceResult>(`${API_BASE}/creative-performance`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
