'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentTemplate {
  id: string;
  orgId: string | null;
  name: string;
  type: string;
  promptTemplate: string;
  variables: { name: string; type: string; required: boolean }[];
  category: string | null;
  productName: string | null;
  performanceNotes: string | null;
  isSystem: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateListParams {
  type?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api';

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
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

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTemplates(params: TemplateListParams = {}) {
  return useQuery({
    queryKey: ['content', 'templates', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.type && params.type !== 'all') queryParams.type = params.type;
      if (params.category) queryParams.category = params.category;
      if (params.search) queryParams.search = params.search;
      if (params.page) queryParams.page = String(params.page);
      if (params.pageSize) queryParams.pageSize = String(params.pageSize);

      return await fetchApi<{
        items: ContentTemplate[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`${API_BASE}/content/templates`, queryParams);
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ContentTemplate>) => {
      return postApi<ContentTemplate>('/content/templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'templates'] });
    },
  });
}
