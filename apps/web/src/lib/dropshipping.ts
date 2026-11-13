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
export type DsRuleMode = 'subset' | 'exact';

export interface DsSkuRow {
  sku: string;
  title: string | null;
  productTitle: string;
  variantExternalId: string | null;
  imageUrl: string | null;
}

export interface DsRuleSku {
  id?: string;
  sku: string;
  title?: string | null;
  imageUrl?: string | null;
  variantExternalId?: string | null;
}

export interface DsRule {
  id: string;
  name: string;
  mode: DsRuleMode;
  active: boolean;
  skus: DsRuleSku[];
}

export interface DsOrderItem {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  imageUrl: string | null;
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
  shopifyFulfilledAt: string | null;
  items: DsOrderItem[];
  partner: { id: string; name: string } | null;
}

export interface DsPartner {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count?: { orders: number };
}

export interface DsStats {
  byStatus: Record<DsOrderStatus, number>;
  overdue: number;
  total: number;
  activeRules: number;
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
  listSkus: (q?: string) => call<DsSkuRow[]>(`/skus${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  listRules: () => call<DsRule[]>(`/rules`),
  createRule: (input: { name?: string; mode: DsRuleMode; active?: boolean; skus: DsRuleSku[] }) =>
    call<DsRule>(`/rules`, { method: 'POST', body: JSON.stringify(input) }),
  updateRule: (id: string, input: Partial<{ name: string; mode: DsRuleMode; active: boolean; skus: DsRuleSku[] }>) =>
    call<DsRule>(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteRule: (id: string) => call<{ ok: boolean }>(`/rules/${id}`, { method: 'DELETE' }),

  listOrders: (status?: string) => call<DsOrder[]>(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  importOrder: (orderNumber: string) =>
    call<{ id: string; itemCount: number }>(`/orders/import`, { method: 'POST', body: JSON.stringify({ orderNumber }) }),
  retryFulfillment: (id: string) =>
    call<{ ok: boolean; status?: string; error?: string }>(`/orders/${id}/retry-fulfillment`, { method: 'POST' }),

  // Partner-Verwaltung (Owner)
  listPartners: () => call<DsPartner[]>(`/partners`),
  createPartner: (input: { name: string; email: string; password: string }) =>
    call<DsPartner>(`/partners`, { method: 'POST', body: JSON.stringify(input) }),
  updatePartner: (id: string, input: Partial<{ name: string; active: boolean; password: string }>) =>
    call<{ ok: boolean }>(`/partners/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deletePartner: (id: string) => call<{ ok: boolean }>(`/partners/${id}`, { method: 'DELETE' }),

  stats: () => call<DsStats>(`/stats`),
  lastSync: () => call<DsSyncLog | null>(`/sync/status`),
  runSync: () => call<{ ok: boolean; scanned: number; created: number; updated: number }>(`/sync`, { method: 'POST' }),

  /** CSV-Download (authentifiziert → via Blob). */
  async exportCsv(status?: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/dropshipping/orders/export${status ? `?status=${encodeURIComponent(status)}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Export fehlgeschlagen (HTTP ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropshipping-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const DS_STATUS_LABELS: Record<DsOrderStatus, string> = {
  new: 'Neu',
  shipped_cn: 'Versandt (CN)',
  in_de: 'In Deutschland',
  delivered: 'Zugestellt',
  on_hold: 'Problem / Wartet',
};

export const DS_MODE_LABELS: Record<DsRuleMode, string> = {
  subset: 'Erlaubte Produkte',
  exact: 'Exakte Kombination',
};
