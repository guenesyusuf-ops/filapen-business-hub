import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/home/vacations${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface VacationRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null; firstName: string | null; lastName: string | null; avatarUrl: string | null };
  reviewedBy?: { id: string; name: string | null; email: string | null } | null;
}

export const vacationApi = {
  listMine: () => call<VacationRequest[]>('/mine'),
  listPending: () => call<VacationRequest[]>('/pending'),
  listApproved: (from: string, to: string) => call<VacationRequest[]>(`/approved?from=${from}&to=${to}`),
  create: (data: { startDate: string; endDate: string; reason?: string }) =>
    call<VacationRequest>('', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: string, note?: string) =>
    call<VacationRequest>(`/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  reject: (id: string, note?: string) =>
    call<VacationRequest>(`/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  cancel: (id: string) => call(`/${id}`, { method: 'DELETE' }),
};
