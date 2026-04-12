'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Watchlist {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistDetail extends Omit<Watchlist, 'itemCount'> {
  items: WatchlistItemDetail[];
}

export interface WatchlistItemDetail {
  id: string;
  notes: string | null;
  addedAt: string;
  influencer: {
    id: string;
    platform: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    followerCount: number;
    engagementRate: number;
    niche: string | null;
    score: number;
    isVerified: boolean;
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API error: ${res.status}`);
  }
  return res.json();
}

async function deleteApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useWatchlists() {
  return useQuery<Watchlist[]>({
    queryKey: ['watchlists', 'list'],
    queryFn: () => fetchApi<Watchlist[]>('/watchlists'),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useWatchlist(id: string | undefined) {
  return useQuery<WatchlistDetail>({
    queryKey: ['watchlists', 'detail', id],
    enabled: !!id,
    queryFn: () => fetchApi<WatchlistDetail>(`/watchlists/${id}`),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      postApi<Watchlist>('/watchlists', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      qc.invalidateQueries({ queryKey: ['influencers', 'stats'] });
    },
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      watchlistId,
      influencerProfileId,
      notes,
    }: {
      watchlistId: string;
      influencerProfileId: string;
      notes?: string;
    }) => postApi(`/watchlists/${watchlistId}/items`, { influencerProfileId, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      watchlistId,
      influencerProfileId,
    }: {
      watchlistId: string;
      influencerProfileId: string;
    }) => deleteApi(`/watchlists/${watchlistId}/items/${influencerProfileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}
