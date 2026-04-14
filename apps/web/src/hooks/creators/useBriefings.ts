'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string; // pdf | image | video | sonstige
  storageKey?: string;
  fileSize?: number;
  createdAt: string;
}

export interface BriefingProduct {
  id: string;
  title: string;
  imageUrl?: string;
}

export interface Briefing {
  id: string;
  orgId: string;
  title: string;
  productId?: string;
  notes?: string;
  content?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  product?: BriefingProduct | null;
  attachmentCount?: number;
  attachments?: BriefingAttachment[];
  deal?: { id: string; title: string; stage: string } | null;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function deleteApi<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List all briefings (admin). Optionally filter by dealId (legacy). */
export function useBriefings(dealId?: string) {
  const url = dealId
    ? `${API_BASE}/briefings?dealId=${encodeURIComponent(dealId)}`
    : `${API_BASE}/briefings`;
  return useQuery<Briefing[]>({
    queryKey: ['briefings', dealId ?? 'all'],
    queryFn: () => fetchJson<Briefing[]>(url),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Get single briefing with attachments */
export function useBriefing(id?: string) {
  return useQuery<Briefing>({
    queryKey: ['briefing', id],
    queryFn: () => fetchJson<Briefing>(`${API_BASE}/briefings/${id}`),
    enabled: !!id,
    staleTime: 15_000,
    retry: 1,
  });
}

/** List all briefings for creator portal */
export function useBriefingsForCreator() {
  return useQuery<Briefing[]>({
    queryKey: ['briefings-for-creator'],
    queryFn: () => fetchJson<Briefing[]>(`${API_BASE}/briefings/for-creator`),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Create briefing */
export function useCreateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; productId?: string; notes?: string }) =>
      postJson<Briefing>(`${API_BASE}/briefings`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefings'] });
    },
  });
}

/** Delete briefing */
export function useDeleteBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApi<{ success: boolean }>(`${API_BASE}/briefings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefings'] });
    },
  });
}

/** Upload a single file as briefing attachment */
export function useUploadBriefingAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ briefingId, file }: { briefingId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/briefings/${briefingId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json() as Promise<BriefingAttachment>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['briefing', variables.briefingId] });
      qc.invalidateQueries({ queryKey: ['briefings'] });
    },
  });
}

/** Delete a briefing attachment */
export function useDeleteBriefingAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ briefingId, attachmentId }: { briefingId: string; attachmentId: string }) =>
      deleteApi<{ success: boolean }>(`${API_BASE}/briefings/${briefingId}/attachments/${attachmentId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['briefing', variables.briefingId] });
      qc.invalidateQueries({ queryKey: ['briefings'] });
    },
  });
}
