import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const baseHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/dropshipping${path}`, { headers: baseHeaders(), ...init });
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

export type DsOrderStatus = 'new' | 'shipped_cn' | 'in_de' | 'delivered' | 'on_hold';

export interface DsSkuRow {
  sku: string;
  title: string | null;
  productTitle: string;
  variantExternalId: string | null;
  dropship: boolean;
}

export interface DsOrderItem {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
}

export interface DsOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  shippingAddress: any;
  countryCode: string | null;
  status: DsOrderStatus;
  cnTracking: string | null;
  deTracking: string | null;
  carrier: string | null;
  note: string | null;
  items: DsOrderItem[];
  partner: { id: string; name: string } | null;
}

export interface DsStats {
  byStatus: Record<DsOrderStatus, number>;
  overdue: number;
  total: number;
  activeSkus: number;
}

export interface DsSyncLog {
  id: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  ordersScanned: number;
  ordersCreated: number;
  ordersUpdated: number;
  status: string;
  error: string | null;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

export const dropshippingApi = {
  listSkus: (q?: string) =>
    call<DsSkuRow[]>(`/skus${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  toggleSku: (input: { sku: string; title?: string | null; variantExternalId?: string | null; active: boolean }) =>
    call<{ sku: string; active: boolean }>(`/skus/toggle`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listOrders: (status?: string) =>
    call<DsOrder[]>(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  stats: () => call<DsStats>(`/stats`),

  lastSync: () => call<DsSyncLog | null>(`/sync/status`),

  runSync: () => call<{ ok: boolean; scanned: number; created: number; updated: number }>(`/sync`, {
    method: 'POST',
  }),
};

export const DS_STATUS_LABELS: Record<DsOrderStatus, string> = {
  new: 'Neu',
  shipped_cn: 'Versandt (CN)',
  in_de: 'In Deutschland',
  delivered: 'Zugestellt',
  on_hold: 'Problem / Wartet',
};
