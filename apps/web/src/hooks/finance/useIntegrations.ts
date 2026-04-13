'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Generic fetch helpers — point to the absolute API URL (Railway)
// ---------------------------------------------------------------------------

const API_BASE = `${API_URL}/api/integrations`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function mutateApi<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Integration {
  id: string;
  type: string;
  status: string;
  syncStatus?: 'idle' | 'syncing' | 'failed';
  lastSyncedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query: list integrations
// ---------------------------------------------------------------------------

export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ['finance', 'integrations'],
    queryFn: () => fetchApi<Integration[]>(API_BASE),
    staleTime: 60_000,
    retry: 2,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((i) => i.syncStatus === 'syncing')) {
        return 5000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: disconnect integration
// ---------------------------------------------------------------------------

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateApi<void>(`${API_BASE}/${id}/disconnect`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'integrations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: sync integration
// ---------------------------------------------------------------------------

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateApi<void>(`${API_BASE}/${id}/sync`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'integrations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: rebuild aggregates (computes daily_aggregates from orders)
// ---------------------------------------------------------------------------

export function useRebuildAggregates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      mutateApi<{ success: boolean }>(`${API_BASE}/rebuild-aggregates`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// ---------------------------------------------------------------------------
// Connect: redirect to OAuth flow
// ---------------------------------------------------------------------------

export function useConnectIntegration() {
  const apiUrl = API_URL || 'http://localhost:4000';
  const orgId = '00000000-0000-0000-0000-000000000001';

  const connect = (type: string, shopDomain?: string) => {
    if (type === 'shopify' && shopDomain) {
      window.open(
        `${apiUrl}/api/auth/shopify/install?shop=${encodeURIComponent(shopDomain)}&orgId=${orgId}`,
        '_self',
      );
    }
    // Other types will be added later
  };

  return { connect };
}
