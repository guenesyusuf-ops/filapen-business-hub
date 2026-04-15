'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem('filapen-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.token;
      if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    }
  } catch {
    // ignore
  }
  return { 'Content-Type': 'application/json' };
}

async function wmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/wm${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WmDashboardData {
  totalOpen: number;
  totalCompleted: number;
  completedLast7Days: number;
  overdue: number;
  dueThisWeek: number;
  dueToday: number;
  byPriority: Record<string, number>;
  byProject: { projectId: string; name: string; open: number; completed: number }[];
}

export interface WmProjectWithCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard hook
// ---------------------------------------------------------------------------

export function useWmDashboard() {
  return useQuery<WmDashboardData>({
    queryKey: ['wm', 'dashboard'],
    queryFn: () => wmFetch('/dashboard'),
    refetchInterval: 30000, // refresh every 30s
  });
}

// ---------------------------------------------------------------------------
// Auto-complete trigger hook
// ---------------------------------------------------------------------------

export function useAutoCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      wmFetch<{ autoCompleted: boolean; task: unknown }>(`/tasks/${taskId}/auto-complete`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wm'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Project category hooks
// ---------------------------------------------------------------------------

export function useUpdateProjectCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, category }: { projectId: string; category: string | null }) =>
      wmFetch(`/projects/${projectId}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ category }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wm', 'projects'] });
      qc.invalidateQueries({ queryKey: ['wm', 'projects-with-category'] });
    },
  });
}

export function useWmProjectsWithCategory() {
  return useQuery<WmProjectWithCategory[]>({
    queryKey: ['wm', 'projects-with-category'],
    queryFn: () => wmFetch('/projects-with-category'),
  });
}
