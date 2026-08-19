import { API_URL } from '../api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/profit-analysis${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type SettingUnit = 'percent' | 'eur';
export type SettingCategory = 'fees' | 'shipping' | 'vat';

export interface SettingItem {
  key: string;
  label: string;
  unit: SettingUnit;
  category: SettingCategory;
  description: string;
  formula: string;
  currentValue: string;              // Decimal-String
  currentEffectiveFrom: string | null; // "YYYY-MM-DD"
}

export interface SettingHistoryEntry {
  id: string;
  key: string;
  value: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Produktkosten (Phase 2)
// ---------------------------------------------------------------------------

export type CostKind = 'cost' | 'fulfillment';

export interface ProductCostRow {
  productId: string;
  externalId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  status: string;
  currentCost: string | null;
  currentCostEffectiveFrom: string | null;
  currentFulfillment: string | null;
  currentFulfillmentEffectiveFrom: string | null;
}

export interface CostHistoryEntry {
  id: string;
  value: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ProductCostListResponse {
  items: ProductCostRow[];
  total: number;
  missingCostsCount: number;
  missingFulfillmentCount: number;
}

export const profitAnalysisApi = {
  settings: {
    list: () =>
      call<{ items: SettingItem[] }>('/settings'),

    history: (key: string) =>
      call<{ items: SettingHistoryEntry[] }>(`/settings/${encodeURIComponent(key)}/history`),

    set: (key: string, body: { value: string; effectiveFrom: string; note?: string }) =>
      call(`/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  productCosts: {
    list: (params: {
      search?: string;
      status?: 'active' | 'archived' | 'draft' | 'all';
      missingCosts?: boolean;
      missingFulfillment?: boolean;
      limit?: number;
      offset?: number;
    } = {}) => {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.status) qs.set('status', params.status);
      if (params.missingCosts) qs.set('missingCosts', 'true');
      if (params.missingFulfillment) qs.set('missingFulfillment', 'true');
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      if (params.offset !== undefined) qs.set('offset', String(params.offset));
      const s = qs.toString();
      return call<ProductCostListResponse>(`/product-costs${s ? '?' + s : ''}`);
    },

    history: (productId: string, kind: CostKind) =>
      call<{ items: CostHistoryEntry[] }>(`/product-costs/${productId}/${kind}/history`),

    set: (productId: string, kind: CostKind, body: { value: string; effectiveFrom: string; note?: string }) =>
      call(`/product-costs/${productId}/${kind}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },
};
