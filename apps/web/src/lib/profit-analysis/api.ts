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

  daily: {
    /** Rohdaten + Berechnungen fuer einen ganzen Monat. */
    getMonth: (year: number, month: number) =>
      call<{ raw: RawMonth; computed: ComputedMonth }>(`/months/${year}/${month}`),

    /** Nur die Berechnung eines einzelnen Tages (praktisch fuer Autosave-Response). */
    getComputedDay: (date: string) =>
      call<{ computed: ComputedDay | null }>(`/days/${date}/computed`),

    /** Feld-granulares Autosave: Kanal-Umsatz. */
    patchSales: (date: string, channel: Channel, patch: Partial<ChannelSalesPatch>) =>
      call<{ updated: any; computed: ComputedDay | null }>(`/days/${date}/sales/${channel}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    patchAds: (date: string, patch: Partial<AdsPatch>) =>
      call<{ updated: any; computed: ComputedDay | null }>(`/days/${date}/ads`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    patchShipping: (date: string, patch: Partial<ShippingPatch>) =>
      call<{ updated: any; computed: ComputedDay | null }>(`/days/${date}/shipping`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    patchProductSale: (date: string, channel: Channel, productId: string, quantity: number) =>
      call<{ updated: any; computed: ComputedDay | null }>(
        `/days/${date}/product-sales/${channel}/${productId}`,
        { method: 'PATCH', body: JSON.stringify({ quantity }) },
      ),
  },
};

// ---------------------------------------------------------------------------
// Tagesdaten-Typen (Phase 3)
// ---------------------------------------------------------------------------

export type Channel = 'shopify' | 'amazon' | 'tiktok';

export interface ChannelSalesPatch {
  gross19: string;
  gross7: string;
  returns19: string;
  returns7: string;
}
export interface AdsPatch {
  meta: string;
  google: string;
  influencer: string;
  amazonPpc: string;
  tiktokAds: string;
}
export interface ShippingPatch {
  shopifyPackages: number;
  tiktokPackages: number;
}

export interface RawChannelSales {
  channel: Channel;
  gross19: string; gross7: string; returns19: string; returns7: string;
}
export interface RawAds {
  meta: string; google: string; influencer: string; amazonPpc: string; tiktokAds: string;
}
export interface RawShipping {
  shopifyPackages: number; tiktokPackages: number;
}
export interface RawProductSale {
  channel: Channel; productId: string; quantity: number;
}
export interface RawDay {
  date: string;
  monthId: string;
  monthStatus: 'open' | 'closed' | 'locked';
  channelSales: Record<Channel, RawChannelSales>;
  ads: RawAds;
  shipping: RawShipping;
  productSales: RawProductSale[];
}
export interface RawMonth {
  monthId: string | null;
  status: 'open' | 'closed' | 'locked' | null;
  days: RawDay[];
}

export interface ComputedMixedVat {
  grossTotal: string; returnsTotal: string; grossAdjusted: string;
  net19: string; net7: string; netAdjusted: string;
  vat19: string; vat7: string; vatTotal: string;
}
export interface ComputedChannelProfit {
  netSales: string; productCosts: string; shippingCosts: string;
  platformFees: string; totalCostsWithoutAds: string;
  adsAttributed: string; profit: string;
  margin: string | null; roasGross: string | null; roasNet: string | null;
}
export interface ComputedChannel {
  vat: ComputedMixedVat;
  profit: ComputedChannelProfit;
}
export interface ComputedDay {
  date: string;
  monthStatus: 'open' | 'closed' | 'locked';
  shopify: ComputedChannel;
  amazon: ComputedChannel;
  tiktok: ComputedChannel;
  aggregate: { totalNetSales: string; totalProfit: string; totalMargin: string | null };
  warnings: string[];
}
export interface ComputedMonth {
  year: number;
  month: number;
  status: 'open' | 'closed' | 'locked' | null;
  days: ComputedDay[];
  totals: {
    netSalesTotal: string; grossSalesTotal: string; vatTotal: string;
    adsTotal: string; productCostsTotal: string; shippingCostsTotal: string;
    platformFeesTotal: string; profitBeforeOverhead: string;
    marginBeforeOverhead: string | null;
  };
}
