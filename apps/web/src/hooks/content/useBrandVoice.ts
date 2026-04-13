'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandVoice {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  toneAttributes: Record<string, number> | null;
  examples: string[];
  bannedWords: string[];
  isDefault: boolean;
  contentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandVoiceDto {
  name: string;
  description?: string;
  toneAttributes?: Record<string, number>;
  examples?: string[];
  bannedWords?: string[];
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

export function useBrandVoices() {
  return useQuery({
    queryKey: ['content', 'brand-voices'],
    queryFn: async () => {
      return await fetchApi<{ items: BrandVoice[] }>(`${API_BASE}/content/brand-voices`);
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateBrandVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBrandVoiceDto) => {
      return postApi<BrandVoice>('/content/brand-voices', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'brand-voices'] });
    },
  });
}

export function useUpdateBrandVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateBrandVoiceDto> }) => {
      return putApi<BrandVoice>(`/content/brand-voices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'brand-voices'] });
    },
  });
}

export function useDeleteBrandVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteApi(`/content/brand-voices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'brand-voices'] });
    },
  });
}
