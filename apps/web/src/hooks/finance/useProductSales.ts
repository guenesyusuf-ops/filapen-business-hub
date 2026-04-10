'use client';

import { useQuery } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';

// ---------------------------------------------------------------------------
// Types — mirror dashboard.controller getProductSalesSummary response
// ---------------------------------------------------------------------------

export interface ProductSalesRow {
  productId: string | null;
  title: string;
  salesCount: number;
  revenue: number;
  percentage: number;
}

export interface ProductSalesSummary {
  totalRevenue: number;
  products: ProductSalesRow[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = `${API_URL}/api/finance/products/sales-summary`;

async function fetchProductSales(
  start: string,
  end: string,
  channel: string | null,
): Promise<ProductSalesSummary> {
  const params = new URLSearchParams({ start, end });
  if (channel) params.set('channel', channel);
  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useProductSales() {
  const { dateRange, selectedChannel } = useFinanceUI();

  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);
  const channel = selectedChannel ?? null;

  return useQuery<ProductSalesSummary>({
    queryKey: ['finance', 'products', 'sales-summary', start, end, channel],
    queryFn: () => fetchProductSales(start, end, channel),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
