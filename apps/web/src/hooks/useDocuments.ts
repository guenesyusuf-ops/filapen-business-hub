'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

async function docFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/documents${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Error ${res.status}`);
  }
  return res.json();
}

// ---------- Types ----------

export interface DocFolder {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  parentId: string | null;
  createdBy: string;
  locked: boolean;
  lockedBy: string | null;
  tags: string[];
  childCount: number;
  fileCount: number;
  createdAt: string;
}

export interface DocFile {
  id: string;
  folderId: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
  mimeType: string | null;
  createdBy: string;
  createdByName?: string;
  status: string;
  tags: string[];
  createdAt: string;
}

export interface DocActivity {
  id: string;
  userName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

// ---------- Folders ----------

export function useDocFolders(parentId: string | null) {
  return useQuery<DocFolder[]>({
    queryKey: ['docs', 'folders', parentId ?? 'root'],
    queryFn: () => docFetch(`/folders${parentId ? `?parentId=${parentId}` : ''}`),
  });
}

export function useCreateDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string; color?: string }) =>
      docFetch<DocFolder>('/folders', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['docs', 'folders', vars.parentId ?? 'root'] });
    },
  });
}

export function useUpdateDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      docFetch<DocFolder>(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'folders'] }),
  });
}

export function useTrashDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => docFetch(`/folders/${id}/trash`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

export function useLockDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => docFetch(`/folders/${id}/lock`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'folders'] }),
  });
}

export function useUnlockDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => docFetch(`/folders/${id}/unlock`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', 'folders'] }),
  });
}

// ---------- Files ----------

export function useDocFiles(folderId: string | null, search?: string) {
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  if (search) params.set('search', search);
  const qs = params.toString();
  return useQuery<DocFile[]>({
    queryKey: ['docs', 'files', folderId ?? 'root', search ?? ''],
    queryFn: () => docFetch(`/files${qs ? `?${qs}` : ''}`),
  });
}

export function useUploadDocFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { folderId?: string; file: File; tags?: string[] }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.folderId) formData.append('folderId', data.folderId);
      if (data.tags?.length) formData.append('tags', JSON.stringify(data.tags));
      const hdrs = getAuthHeaders();
      delete (hdrs as any)['Content-Type'];
      const res = await fetch(`${API_URL}/api/documents/files/upload`, {
        method: 'POST',
        headers: hdrs,
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json() as Promise<DocFile>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

export function useTrashDocFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => docFetch(`/files/${id}/trash`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

export function useUpdateDocFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; fileName?: string; status?: string; tags?: string[] }) =>
      docFetch<DocFile>(`/files/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

// ---------- Favorites ----------

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { folderId?: string; fileId?: string }) =>
      docFetch<{ favorited: boolean }>('/favorites', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

export function useDocFavorites() {
  return useQuery<any[]>({
    queryKey: ['docs', 'favorites'],
    queryFn: () => docFetch('/favorites'),
  });
}

// ---------- Search ----------

export function useDocSearch(query: string) {
  return useQuery<{ folders: DocFolder[]; files: DocFile[] }>({
    queryKey: ['docs', 'search', query],
    queryFn: () => docFetch(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}

// ---------- Activities ----------

export function useDocActivities(folderId?: string) {
  const qs = folderId ? `?folderId=${folderId}` : '';
  return useQuery<DocActivity[]>({
    queryKey: ['docs', 'activities', folderId ?? 'all'],
    queryFn: () => docFetch(`/activities${qs}`),
  });
}

// ---------- Trash ----------

export function useDocTrash() {
  return useQuery<{ folders: DocFolder[]; files: DocFile[] }>({
    queryKey: ['docs', 'trash'],
    queryFn: () => docFetch('/trash'),
  });
}
