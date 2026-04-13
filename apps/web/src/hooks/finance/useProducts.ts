'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFinanceUI } from '@/stores/finance-ui';
import { formatDate } from '@filapen/shared/src/utils/date';
import type { ProductsListResponse } from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Generic fetch helper (mirrors useDashboard pattern)
// ---------------------------------------------------------------------------

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

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function patchApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Products list hook
// ---------------------------------------------------------------------------

export type SortField = 'revenue' | 'grossProfit' | 'grossMarginPercent' | 'unitsSold' | 'refundRate' | 'totalCogs' | 'title';

export function useProducts() {
  const { dateRange } = useFinanceUI();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const query = useQuery<ProductsListResponse>({
    queryKey: [
      'finance',
      'products',
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      page,
      search,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      fetchApi<ProductsListResponse>(`${API_BASE}/products`, {
        startDate: formatDate(dateRange.start),
        endDate: formatDate(dateRange.end),
        page: String(page),
        pageSize: '25',
        search,
        sortBy,
        sortOrder,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: (prev) => prev,
  });

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortBy) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy],
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return {
    ...query,
    page,
    setPage,
    search,
    setSearch: handleSearch,
    sortBy,
    sortOrder,
    handleSort,
  };
}

// ---------------------------------------------------------------------------
// Update product COGS
// ---------------------------------------------------------------------------

export function useUpdateCogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, cogs }: { productId: string; cogs: number }) =>
      patchApi(`${API_BASE}/products/${productId}/cogs`, { cogs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'products'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Import COGS CSV
// ---------------------------------------------------------------------------

export function useImportCogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        new URL(`${API_BASE}/products/import-cogs`, window.location.origin).toString(),
        { method: 'POST', body: formData },
      );
      if (!res.ok) {
        throw new Error(`Import failed: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'products'] });
    },
  });
}
