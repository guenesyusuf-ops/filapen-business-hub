'use client';

import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api/finance';

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface Integration {
  id: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ['finance', 'integrations'],
    queryFn: () => fetchApi<Integration[]>(`${API_BASE}/integrations`),
    staleTime: 60_000,
    retry: 2,
  });
}
