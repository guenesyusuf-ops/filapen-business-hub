'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

export interface ProjectDocument {
  id: string;
  orgId: string;
  projectId: string;
  type: 'briefing' | 'skript' | 'sonstige';
  fileName: string;
  fileUrl: string;
  storageKey?: string;
  fileSize?: number;
  createdAt: string;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('filapen-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useProjectDocuments(projectId: string | undefined) {
  return useQuery<ProjectDocument[]>({
    queryKey: ['project-documents', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/creator-projects/${projectId}/documents`,
        { headers: authHeaders() },
      );
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    },
    staleTime: 15 * 1000,
    retry: 1,
  });
}

export function useUploadProjectDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      type,
      file,
    }: {
      projectId: string;
      type: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `${API_BASE}/creator-projects/${projectId}/documents?type=${type}`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload fehlgeschlagen: ${res.status} ${text}`);
      }
      return res.json() as Promise<ProjectDocument>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['project-documents', variables.projectId],
      });
    },
  });
}

export function useDeleteProjectDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      docId,
    }: {
      projectId: string;
      docId: string;
    }) => {
      const res = await fetch(
        `${API_BASE}/creator-projects/${projectId}/documents/${docId}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        },
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['project-documents', variables.projectId],
      });
    },
  });
}
