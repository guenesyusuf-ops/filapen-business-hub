'use client';

import { useQuery } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/finance`;

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

export interface CampaignSummary {
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
}

export interface CampaignDailyMetric {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface CampaignDetailResponse {
  campaign: {
    id: string;
    name: string;
    status: string;
    externalId: string;
    platform: string;
    objective: string | null;
    dailyBudget: number | null;
  };
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
    cpa: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  daily: CampaignDailyMetric[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCampaigns(platform?: string) {
  const { dateRange } = useFinanceUI();

  return useQuery<CampaignSummary[]>({
    queryKey: [
      'finance',
      'campaigns',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      platform,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      };
      if (platform && platform !== 'all') {
        params.platform = platform;
      }
      return fetchApi<CampaignSummary[]>(`${API_BASE}/campaigns`, params);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useCampaignDetail(id: string) {
  const { dateRange } = useFinanceUI();

  return useQuery<CampaignDetailResponse>({
    queryKey: [
      'finance',
      'campaign-detail',
      id,
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: async () => {
      return fetchApi<CampaignDetailResponse>(`${API_BASE}/campaigns/${id}`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!id,
  });
}
