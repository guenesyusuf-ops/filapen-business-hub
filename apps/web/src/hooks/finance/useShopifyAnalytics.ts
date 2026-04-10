'use client';

import { useQuery } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';

// ---------------------------------------------------------------------------
// Types — mirror ShopifyAnalyticsService response
// ---------------------------------------------------------------------------

export interface RevenueBreakdown {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  shipping: number;
  returnFees: number;
  taxes: number;
  totalSales: number;
}

export interface HourlyPoint {
  hour: number;
  revenue: number;
  orders: number;
  aov: number;
}

export interface ShopifyAnalyticsOverview {
  range: { start: string; end: string; timezone: string };
  revenueBreakdown: RevenueBreakdown;
  hourlyRevenue: HourlyPoint[];
  ordersTimeSeries: Array<{ date: string; orders: number }>;
  aovTimeSeries: Array<{ date: string; aov: number }>;
  returningCustomerRate: Array<{ date: string; rate: number }>;
  revenueByProduct: Array<{
    productId: string | null;
    title: string;
    revenue: number;
  }>;
  revenueByVariant: Array<{
    variantId: string | null;
    title: string;
    sku: string | null;
    revenue: number;
  }>;
  ordersByProduct: Array<{
    productId: string | null;
    title: string;
    orderCount: number;
  }>;
  topVariantsByUnits: Array<{
    variantId: string | null;
    title: string;
    sku: string | null;
    units: number;
  }>;
  itemsOrderedTimeSeries: Array<{ date: string; items: number }>;
  avgItemsPerOrder: Array<{ date: string; avg: number }>;
  returnRateTimeSeries: Array<{ date: string; rate: number }>;
  returnedItemsTimeSeries: Array<{ date: string; count: number }>;
  returns: Array<{
    date: string;
    orderNumber: string;
    productTitle: string;
    status: string;
  }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const API_BASE = '/api/finance/shopify-analytics';

async function fetchOverview(
  start: string,
  end: string,
): Promise<ShopifyAnalyticsOverview> {
  const url = new URL(`${API_BASE}/overview`, window.location.origin);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useShopifyAnalytics() {
  const { dateRange } = useFinanceUI();

  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return useQuery<ShopifyAnalyticsOverview>({
    queryKey: ['channels', 'shopify-analytics', start, end],
    queryFn: () => fetchOverview(start, end),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
