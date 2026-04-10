'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Generic fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/finance';

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
  lastSyncedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query: list integrations
// ---------------------------------------------------------------------------

export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ['finance', 'integrations'],
    queryFn: () => fetchApi<Integration[]>(`${API_BASE}/integrations`),
    staleTime: 60_000,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Mutation: disconnect integration
// ---------------------------------------------------------------------------

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateApi<void>(`${API_BASE}/integrations/${id}/disconnect`, 'POST'),
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
      mutateApi<void>(`${API_BASE}/integrations/${id}/sync`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'integrations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Connect: redirect to OAuth flow
// ---------------------------------------------------------------------------

export function useConnectIntegration() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
