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

export interface ChannelRevenue {
  channel: string;
  revenue: number;
  orders: number;
}

export interface CountryRevenue {
  country_code: string;
  orders: number;
  revenue: number;
}

export interface ProductRevenue {
  title: string | null;
  image_url: string | null;
  revenue: number;
  units: number;
}

export interface RevenueBreakdownResponse {
  byChannel: ChannelRevenue[];
  byCountry: CountryRevenue[];
  byProduct: ProductRevenue[];
}

export function useRevenueBreakdown() {
  const { dateRange } = useFinanceUI();

  return useQuery<RevenueBreakdownResponse>({
    queryKey: [
      'finance',
      'revenue-breakdown',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: () =>
      fetchApi<RevenueBreakdownResponse>(`${API_BASE}/revenue/breakdown`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
      }),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Shopify-style Aufschlüsselung des Gesamtumsatzes + stündlicher Verlauf
// ---------------------------------------------------------------------------

export interface ShopifyBreakdownTotals {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  shipping: number;
  returnFees: number;
  taxes: number;
  totalSales: number;
}

export interface ShopifyHourlyPoint {
  hour: number;
  revenue: number;
  orders: number;
  aov: number;
}

export interface ShopifyRevenueBreakdownResponse {
  range: { start: string; end: string; timezone: string };
  breakdown: ShopifyBreakdownTotals;
  hourly: ShopifyHourlyPoint[];
}

export function useShopifyRevenueBreakdown() {
  const { dateRange } = useFinanceUI();

  return useQuery<ShopifyRevenueBreakdownResponse>({
    queryKey: [
      'finance',
      'shopify-revenue-breakdown',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
    ],
    queryFn: () =>
      fetchApi<ShopifyRevenueBreakdownResponse>(`${API_BASE}/revenue-breakdown`, {
        date: formatDate(dateRange.start),
        end: formatDate(dateRange.end),
      }),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
