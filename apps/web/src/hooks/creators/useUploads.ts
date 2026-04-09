'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorUpload {
  id: string;
  orgId: string;
  creatorId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType?: string;
  fileSize?: number;
  tab: string;
  category?: string;
  product?: string;
  label?: string;
  batch?: string;
  storageKey?: string;
  seenByAdmin: boolean;
  liveStatus?: string | null;
  liveDate?: string | null;
  liveApprovedAt?: string | null;
  liveApprovedBy?: string | null;
  commentCount: number;
  createdAt: string;
  creator?: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
  };
}

export interface UploadComment {
  id: string;
  orgId: string;
  uploadId: string;
  creatorId?: string;
  authorRole: string;
  authorName: string;
  message: string;
  readByAdmin: boolean;
  readByCreator: boolean;
  createdAt: string;
}

export const UPLOAD_TABS = ['bilder', 'videos', 'roh', 'auswertung'] as const;
export type UploadTab = (typeof UPLOAD_TABS)[number];

export const UPLOAD_TAB_LABELS: Record<UploadTab, string> = {
  bilder: 'Bilder',
  videos: 'Videos',
  roh: 'Roh',
  auswertung: 'Auswertung',
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api';

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

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function putApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function deleteApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
// Upload Hooks
// ---------------------------------------------------------------------------

export function useCreatorUploads(creatorId: string | undefined, tab?: string) {
  return useQuery<CreatorUpload[]>({
    queryKey: ['creator-uploads', creatorId, tab],
    enabled: !!creatorId,
    queryFn: async () => {
      const params: Record<string, string> = { creatorId: creatorId! };
      if (tab) params.tab = tab;
      return fetchApi<CreatorUpload[]>(`${API_BASE}/creator-uploads`, params);
    },
    staleTime: 15 * 1000,
    retry: 1,
  });
}

export function useAllUploads(params: { tab?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['creator-uploads', 'all', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.tab) queryParams.tab = params.tab;
      if (params.page) queryParams.page = String(params.page);
      if (params.pageSize) queryParams.pageSize = String(params.pageSize);
      return fetchApi<{
        items: CreatorUpload[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`${API_BASE}/creator-uploads/all`, queryParams);
    },
    staleTime: 15 * 1000,
    retry: 1,
  });
}

export function useCreateUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      creatorId: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType?: string;
      fileSize?: number;
      tab: string;
      category?: string;
      product?: string;
      label?: string;
      batch?: string;
      storageKey?: string;
    }) => {
      return postApi<CreatorUpload>('/creator-uploads', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

export function useDeleteUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uploadId: string) => {
      return deleteApi<{ success: boolean }>(`/creator-uploads/${uploadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

export function useMarkUploadsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creatorId: string) => {
      return patchApi<{ success: boolean }>('/creator-uploads/mark-seen', { creatorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Comment Hooks
// ---------------------------------------------------------------------------

export function useUploadComments(uploadId: string | undefined) {
  return useQuery<UploadComment[]>({
    queryKey: ['upload-comments', uploadId],
    enabled: !!uploadId,
    queryFn: async () => {
      return fetchApi<UploadComment[]>(`${API_BASE}/upload-comments`, {
        uploadId: uploadId!,
      });
    },
    staleTime: 10 * 1000,
    retry: 1,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      uploadId: string;
      creatorId?: string;
      authorRole: string;
      authorName: string;
      message: string;
    }) => {
      return postApi<UploadComment>('/upload-comments', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upload-comments', variables.uploadId] });
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

export function useMarkCommentsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { uploadId: string; role: 'admin' | 'creator' }) => {
      return patchApi<{ success: boolean }>('/upload-comments/mark-read', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upload-comments', variables.uploadId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Unseen Count Hook
// ---------------------------------------------------------------------------

export function useUnseenUploadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['creator-uploads', 'unseen-count'],
    queryFn: async () => {
      return fetchApi<{ count: number }>(`${API_BASE}/creator-uploads/unseen-count`);
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Go Live / Go Offline Hooks
// ---------------------------------------------------------------------------

export function useGoLiveUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uploadId, liveDate }: { uploadId: string; liveDate: string }) => {
      return putApi<CreatorUpload>(`/creator-uploads/${uploadId}/go-live`, { liveDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

export function useGoOfflineUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uploadId: string) => {
      return putApi<CreatorUpload>(`/creator-uploads/${uploadId}/go-offline`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-uploads'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Live Uploads Hook
// ---------------------------------------------------------------------------

export function useLiveUploads() {
  return useQuery<CreatorUpload[]>({
    queryKey: ['creator-uploads', 'live'],
    queryFn: async () => {
      return fetchApi<CreatorUpload[]>(`${API_BASE}/creator-uploads/live`);
    },
    staleTime: 15 * 1000,
    retry: 1,
  });
}
