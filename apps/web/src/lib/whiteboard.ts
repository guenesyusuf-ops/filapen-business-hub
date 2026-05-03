import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/whiteboard${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface WhiteboardListItem {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  createdById: string;
  lastEditedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhiteboardDetail extends WhiteboardListItem {
  state: any;
  liveblocksRoomId: string | null;
}

export const whiteboardApi = {
  list: () => call<WhiteboardListItem[]>('/boards'),
  get: (id: string) => call<WhiteboardDetail>(`/boards/${id}`),
  create: (data: { title: string; description?: string; template?: string }) =>
    call<WhiteboardDetail>('/boards', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; description?: string; state?: any; thumbnailUrl?: string | null }) =>
    call<WhiteboardDetail>(`/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call<void>(`/boards/${id}`, { method: 'DELETE' }),

  listSnapshots: (id: string) => call<Array<{ id: string; capturedById: string; capturedAt: string }>>(`/boards/${id}/snapshots`),
  restoreSnapshot: (id: string, snapshotId: string) =>
    call<WhiteboardDetail>(`/boards/${id}/snapshots/${snapshotId}/restore`, { method: 'POST' }),

  /** Liveblocks-Auth-Token holen — null wenn LIVEBLOCKS_SECRET_KEY nicht gesetzt */
  liveblocksAuth: (id: string) =>
    call<{ token: string | null; reason?: string }>(`/boards/${id}/liveblocks-auth`, { method: 'POST' }),
};
