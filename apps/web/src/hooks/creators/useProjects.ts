'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorProject {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: string;
  deadline?: string;
  creatorIds: string[];
  tags: string[];
  creators?: {
    id: string;
    name: string;
    handle: string;
    platform: string;
    avatarUrl?: string;
    status: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: '#059669',
  paused: '#D97706',
  completed: '#2563EB',
  archived: '#6B7280',
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api';

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function putApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

export function useProjects() {
  return useQuery<CreatorProject[]>({
    queryKey: ['creator-projects'],
    queryFn: async () => {
      return fetchApi<CreatorProject[]>(`${API_BASE}/creator-projects`);
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useProject(id: string | undefined) {
  return useQuery<CreatorProject>({
    queryKey: ['creator-projects', id],
    enabled: !!id,
    queryFn: async () => {
      return fetchApi<CreatorProject>(`${API_BASE}/creator-projects/${id}`);
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreatorProject>) => {
      return postApi<CreatorProject>('/creator-projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatorProject> }) => {
      return putApi<CreatorProject>(`/creator-projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteApi<{ success: boolean }>(`/creator-projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
    },
  });
}
