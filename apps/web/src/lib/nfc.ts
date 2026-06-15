import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const baseHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/nfc${path}`, { headers: baseHeaders(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NfcDashboard {
  totalBands: number;
  active: number;
  inactive: number;
  activatedToday: number;
  activatedLast7: number;
  totalScansLast30: number;
}

export interface NfcBatch {
  id: string;
  name: string | null;
  notes: string | null;
  count: number;
  bandCount: number;
  activeCount: number;
  createdAt: string;
  createdById: string | null;
}

export interface NfcBand {
  id: string;
  batchId: string;
  code: string;
  url: string;
  status: 'inactive' | 'active' | 'deleted';
  activatedAt: string | null;
  lastScanAt: string | null;
  scanCount: number;
  createdAt: string;
  batch?: { id: string; name: string | null };
}

export interface NfcBandListResult {
  items: NfcBand[];
  total: number;
  limit: number;
  offset: number;
}

export interface NfcCustomerSummary {
  id: string;
  bandCode: string;
  bandStatus: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;       // maskiert
  email: string | null;       // maskiert
  city: string | null;
  createdAt: string;
  updatedAt: string;
  lastScanAt: string | null;
  scanCount: number;
  hasPin: boolean;
}

export interface NfcCustomerDetail {
  id: string;
  bandCode: string;
  bandStatus: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;        // voll!
  phone2: string | null;
  notes: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  email: string | null;
  hasPin: boolean;
  consentGivenAt: string;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  lastScanAt: string | null;
  scanCount: number;
  activationIp: string | null;
}

export interface NfcAuditEntry {
  id: string;
  bandId: string | null;
  type: string;
  actorId: string | null;
  ipAddress: string | null;
  metadata: any;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

export const nfcApi = {
  dashboard: () => call<NfcDashboard>('/dashboard'),

  listBatches: () => call<NfcBatch[]>('/batches'),
  createBatch: (data: { count: number; name?: string; notes?: string }) =>
    call<NfcBatch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  getBatch: (id: string) => call<NfcBatch>(`/batches/${id}`),

  listBands: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return call<NfcBandListResult>(`/bands${p.toString() ? `?${p.toString()}` : ''}`);
  },

  /** CSV-Download via Auth-Proxy */
  downloadCsv: async (batchId?: string) => {
    const qs = batchId ? `?batchId=${batchId}` : '';
    const res = await fetch(`${API_URL}/api/nfc/bands/export${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const filename = `nfc-bands-${batchId ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  listCustomers: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return call<{ items: NfcCustomerSummary[]; total: number; limit: number; offset: number }>(`/customer-data${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getCustomer: (id: string) => call<NfcCustomerDetail>(`/customer-data/${id}`),
  deleteCustomer: (id: string, reason?: string) =>
    call(`/customer-data/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  auditLog: (limit = 100) => call<NfcAuditEntry[]>(`/audit-log?limit=${limit}`),
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const STATUS_META: Record<string, { label: string; badge: string }> = {
  inactive: { label: 'Nicht aktiviert', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
  active:   { label: 'Aktiv',           badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
  deleted:  { label: 'Gelöscht',        badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-500/30' },
};
