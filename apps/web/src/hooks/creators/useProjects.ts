'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectCampaignType = 'discount' | 'launch' | 'push' | 'other';

export const CAMPAIGN_TYPE_LABELS: Record<ProjectCampaignType, string> = {
  discount: 'Rabatt',
  launch: 'Launch',
  push: 'Push',
  other: 'Sonstiges',
};

export const CAMPAIGN_TYPE_COLORS: Record<ProjectCampaignType, string> = {
  discount: '#F59E0B',
  launch: '#8B5CF6',
  push: '#10B981',
  other: '#6B7280',
};

export interface CreatorProject {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: string;
  // Campaign fields (new)
  campaignType?: ProjectCampaignType;
  action?: string;
  startDate?: string;
  productId?: string;
  productName?: string;
  neededCreators?: number;
  // Legacy / shared
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
  // Invitation counts (server-computed when available)
  invitationCounts?: {
    total: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  };
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: '#059669',
  paused: '#D97706',
  completed: '#2563EB',
  archived: '#6B7280',
};

// Invitations
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Ausstehend',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
};

export const INVITATION_STATUS_COLORS: Record<InvitationStatus, string> = {
  pending: '#2563EB',
  accepted: '#059669',
  declined: '#DC2626',
  expired: '#6B7280',
};

export interface ProjectInvitation {
  id: string;
  projectId: string;
  creatorId: string;
  status: InvitationStatus;
  message?: string;
  invitedAt: string;
  respondedAt?: string;
  expiresAt?: string;
  project?: {
    id: string;
    name: string;
    campaignType?: ProjectCampaignType;
    action?: string;
    startDate?: string;
    productName?: string;
  };
  creator?: {
    id: string;
    name: string;
    handle?: string;
    platform?: string;
    avatarUrl?: string;
    niche?: string;
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

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

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error: ${res.status} ${text}`);
  }
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

// ---------------------------------------------------------------------------
// Projects: list / detail / create / update / delete
// ---------------------------------------------------------------------------

/**
 * Try the new /api/creator/projects endpoint first, fall back to the legacy
 * /api/creator-projects endpoint so the page keeps working while the backend
 * agent is rolling out the new routes.
 */
async function fetchProjects(): Promise<CreatorProject[]> {
  try {
    const res = await fetch(`${API_BASE}/creator/projects`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      // Accept either {data: [...]} or [...] response shapes
      return Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    }
  } catch {
    /* ignore and try legacy */
  }
  const legacy = await fetchApi<any>('/creator-projects');
  return Array.isArray(legacy) ? legacy : (legacy.data ?? legacy.items ?? []);
}

async function fetchProject(id: string): Promise<CreatorProject> {
  try {
    const res = await fetch(`${API_BASE}/creator/projects/${id}`, {
      headers: authHeaders(),
    });
    if (res.ok) return res.json();
  } catch {
    /* ignore */
  }
  return fetchApi<CreatorProject>(`/creator-projects/${id}`);
}

export function useProjects() {
  return useQuery<CreatorProject[]>({
    queryKey: ['creator-projects'],
    queryFn: fetchProjects,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useProject(id: string | undefined) {
  return useQuery<CreatorProject>({
    queryKey: ['creator-projects', id],
    enabled: !!id,
    queryFn: () => fetchProject(id!),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  status?: string;
  campaignType?: ProjectCampaignType;
  action?: string;
  startDate?: string;
  productId?: string;
  neededCreators?: number;
  // Backwards compatible
  deadline?: string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProjectPayload) => {
      // Prefer new endpoint; gracefully fall back.
      try {
        const res = await fetch(`${API_BASE}/creator/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(data),
        });
        if (res.ok) return (await res.json()) as CreatorProject;
      } catch {
        /* fall through */
      }
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
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatorProject>;
    }) => {
      try {
        const res = await fetch(`${API_BASE}/creator/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(data),
        });
        if (res.ok) return (await res.json()) as CreatorProject;
      } catch {
        /* fall through */
      }
      return putApi<CreatorProject>(`/creator-projects/${id}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
      queryClient.invalidateQueries({
        queryKey: ['creator-projects', variables.id],
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/creator/projects/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) return res.json();
      } catch {
        /* fall through */
      }
      return deleteApi<{ success: boolean }>(`/creator-projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export function useProjectInvitations(projectId: string | undefined) {
  return useQuery<ProjectInvitation[]>({
    queryKey: ['project-invitations', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/creator-projects/${projectId}/invitations`,
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

export interface BulkInvitePayload {
  projectId: string;
  creatorIds: string[];
  message?: string;
}

export function useBulkInviteCreators() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, creatorIds, message }: BulkInvitePayload) => {
      const res = await fetch(
        `${API_BASE}/creator-projects/${projectId}/invitations/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ creatorIds, message }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API error: ${res.status} ${text}`);
      }
      return res.json() as Promise<{
        created: ProjectInvitation[];
        skipped?: string[];
      }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['project-invitations', variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ['creator-projects', variables.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ['creator-projects'] });
    },
  });
}

export function useCreatorInvitations(creatorId: string | undefined) {
  return useQuery<ProjectInvitation[]>({
    queryKey: ['creator-invitations', creatorId],
    enabled: !!creatorId,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/creator/invitations/for-creator/${creatorId}`,
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

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(
        `${API_BASE}/creator/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        },
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['project-invitations'] });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(
        `${API_BASE}/creator/invitations/${invitationId}/decline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        },
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['project-invitations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Products catalog (for product selection in CreateProjectModal)
// ---------------------------------------------------------------------------

export interface ProductCatalogEntry {
  id: string;
  title: string;
  sku?: string;
  imageUrl?: string;
}

export function useProductCatalog() {
  return useQuery<ProductCatalogEntry[]>({
    queryKey: ['finance', 'products', 'catalog'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      };

      // Prefer dedicated /catalog endpoint; fall back to /api/finance/products.
      try {
        const data = await tryFetch(`${API_BASE}/finance/products/catalog`);
        const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
        return items.map((p: any) => ({
          id: p.id ?? p.productId,
          title: p.title ?? p.name ?? 'Unbenanntes Produkt',
          sku: p.sku,
          imageUrl: p.imageUrl ?? p.image,
        }));
      } catch {
        /* fall through */
      }

      try {
        const data = await tryFetch(`${API_BASE}/finance/products`);
        const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
        return items.map((p: any) => ({
          id: p.id ?? p.productId,
          title: p.title ?? p.name ?? 'Unbenanntes Produkt',
          sku: p.sku,
          imageUrl: p.imageUrl ?? p.image,
        }));
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
