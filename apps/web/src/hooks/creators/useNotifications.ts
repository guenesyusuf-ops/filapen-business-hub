'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorNotification {
  id: string;
  orgId: string;
  creatorId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = `${API_URL}/api`;

function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('filapen-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function patchApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCreatorNotifications(creatorId: string | undefined) {
  return useQuery<CreatorNotification[]>({
    queryKey: ['creator-notifications', creatorId],
    enabled: !!creatorId,
    queryFn: async () => {
      return fetchApi<CreatorNotification[]>(
        `${API_BASE}/creator-notifications/${creatorId}?limit=20`,
      );
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}

export function useUnreadNotificationCount(creatorId: string | undefined) {
  return useQuery<{ count: number }>({
    queryKey: ['creator-notifications', creatorId, 'unread-count'],
    enabled: !!creatorId,
    queryFn: async () => {
      return fetchApi<{ count: number }>(
        `${API_BASE}/creator-notifications/${creatorId}/unread-count`,
      );
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      return patchApi<CreatorNotification>(
        `/creator-notifications/${notificationId}/read`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creatorId: string) => {
      return patchApi<{ success: boolean }>(
        `/creator-notifications/${creatorId}/read-all`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-notifications'] });
    },
  });
}
