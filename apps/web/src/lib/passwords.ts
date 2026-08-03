import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/passwords${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface PasswordCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
}

export interface PasswordEntryListItem {
  id: string;
  title: string;
  url: string | null;
  username: string | null;
  faviconUrl: string | null;
  passwordStrength: number | null;
  passwordUpdatedAt: string;
  lastUsedAt: string | null;
  hasTotp: boolean;
  hasNotes: boolean;
  attachmentCount: number;
  category: { id: string; name: string; color: string; icon: string | null } | null;
  createdBy: { id: string; name: string | null; email: string };
  sharedWith: Array<{ id: string; name: string | null; email: string; permission: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordEntryCreate {
  title: string;
  url?: string | null;
  username?: string | null;
  password: string;
  notes?: string | null;
  totpSeed?: string | null;
  categoryId?: string | null;
  faviconUrl?: string | null;
  sharedWithUserIds?: string[];
}

export const passwordsApi = {
  // Kategorien
  listCategories: () => call<PasswordCategory[]>('/categories'),
  createCategory: (data: { name: string; color?: string; icon?: string | null }) =>
    call<PasswordCategory>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; color?: string; icon?: string | null; sortOrder?: number }) =>
    call<PasswordCategory>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    call<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),

  // Entries
  list: (params?: { search?: string; categoryId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    const qs = q.toString();
    return call<PasswordEntryListItem[]>(qs ? `?${qs}` : '');
  },
  create: (data: PasswordEntryCreate) =>
    call<{ id: string }>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PasswordEntryCreate>) =>
    call<{ ok: boolean }>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call<{ ok: boolean }>(`/${id}`, { method: 'DELETE' }),

  reveal: (id: string) =>
    call<{ password: string; totpSeed: string | null; notes: string | null }>(
      `/${id}/reveal`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  setAccess: (id: string, userIds: string[]) =>
    call<{ added: number; removed: number }>(
      `/${id}/access`,
      { method: 'POST', body: JSON.stringify({ userIds }) },
    ),

  audit: (params?: { entryId?: string; userId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entryId) q.set('entryId', params.entryId);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return call<any[]>(`/audit/list${qs ? `?${qs}` : ''}`);
  },

  health: () =>
    call<{ total: number; weak: number; old: number; neverUsed: number; averageStrength: number }>(
      '/health/summary',
    ),

  // Team + Bulk-Sharing
  team: () =>
    call<Array<{ id: string; name: string | null; email: string; avatarUrl: string | null; role: string }>>(
      '/team/users',
    ),

  bulkGrant: (data: { entryIds: string[]; userIds: string[] }) =>
    call<{ granted: number; entries: number; users: number }>(
      '/bulk/grant',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  bulkRevoke: (data: { targetUserId: string; entryIds?: string[] }) =>
    call<{ removed: number }>('/bulk/revoke', { method: 'POST', body: JSON.stringify(data) }),
};

// Wandelt eine URL in ein Favicon-URL (Google-Service). Fallback: null.
export function faviconFor(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`;
  } catch {
    return null;
  }
}

// Passwort-Generator: 20 Zeichen mit gemischtem Charset.
export function generatePassword(length = 20, opts?: { symbols?: boolean; digits?: boolean }): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}?';
  let charset = upper + lower;
  if (opts?.digits !== false) charset += digits;
  if (opts?.symbols !== false) charset += symbols;
  const arr = new Uint32Array(length);
  (globalThis.crypto || (window as any).crypto).getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) out += charset[arr[i] % charset.length];
  return out;
}
