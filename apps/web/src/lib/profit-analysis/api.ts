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
  channels: Channel[];
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
      channel?: Channel;
      limit?: number;
      offset?: number;
    } = {}) => {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.status) qs.set('status', params.status);
      if (params.missingCosts) qs.set('missingCosts', 'true');
      if (params.missingFulfillment) qs.set('missingFulfillment', 'true');
      if (params.channel) qs.set('channel', params.channel);
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

    setChannels: (productId: string, channels: Channel[]) =>
      call<{ channels: Channel[] }>(`/product-costs/${productId}/channels`, {
        method: 'PUT',
        body: JSON.stringify({ channels }),
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

  // Phase 6: Grosshandel ----------------------------------------------------
  wholesale: {
    list: (from?: string, to?: string) => {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const s = qs.toString();
      return call<{ items: WholesaleListRow[] }>(`/wholesale${s ? '?' + s : ''}`);
    },
    get: (id: string) => call<WholesaleDetail>(`/wholesale/${id}`),
    create: (body: WholesaleOrderInput) =>
      call<WholesaleDetail>('/wholesale', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<WholesaleOrderInput>) =>
      call<WholesaleDetail>(`/wholesale/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) =>
      call(`/wholesale/${id}`, { method: 'DELETE' }),
  },

  // Phase 7: Gemeinkosten ---------------------------------------------------
  overhead: {
    categories: () => call<{ items: Array<{ key: string; label: string }> }>('/overhead/categories'),
    listTemplates: () => call<{ items: OverheadTemplate[] }>('/overhead/templates'),
    createTemplate: (body: OverheadTemplateInput) =>
      call<OverheadTemplate>('/overhead/templates', { method: 'POST', body: JSON.stringify(body) }),
    updateTemplate: (id: string, body: Partial<OverheadTemplateInput>) =>
      call<OverheadTemplate>(`/overhead/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteTemplate: (id: string) =>
      call(`/overhead/templates/${id}`, { method: 'DELETE' }),
    listEntries: (year: number, month: number) =>
      call<{ entries: OverheadEntry[] }>(`/overhead/months/${year}/${month}/entries`),
    createEntry: (year: number, month: number, body: OverheadEntryInput) =>
      call<OverheadEntry>(`/overhead/months/${year}/${month}/entries`, { method: 'POST', body: JSON.stringify(body) }),
    updateEntry: (id: string, body: Partial<OverheadEntryInput>) =>
      call<OverheadEntry>(`/overhead/entries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteEntry: (id: string) =>
      call(`/overhead/entries/${id}`, { method: 'DELETE' }),
    applyTemplates: (year: number, month: number) =>
      call(`/overhead/months/${year}/${month}/apply-templates`, { method: 'POST' }),
  },

  // Phase 10: Monatsabschluss ----------------------------------------------
  months: {
    preflight: (year: number, month: number) =>
      call<PreflightResult>(`/months/${year}/${month}/preflight`),
    close: (year: number, month: number, lock = false) =>
      call<{ ok: true; status: string }>(`/months/${year}/${month}/close?lock=${lock}`, { method: 'POST' }),
    reopen: (year: number, month: number) =>
      call<{ ok: true; status: string }>(`/months/${year}/${month}/reopen`, { method: 'POST' }),
    snapshot: (year: number, month: number) =>
      call<any>(`/months/${year}/${month}/snapshot`),
    exportCsvUrl:  (year: number, month: number) => `/api/profit-analysis/months/${year}/${month}/export.csv`,
    exportXlsxUrl: (year: number, month: number) => `/api/profit-analysis/months/${year}/${month}/export.xlsx`,
    exportPdfUrl:  (year: number, month: number) => `/api/profit-analysis/months/${year}/${month}/export.pdf`,
  },

  // Import (CSV)
  import: {
    preview: (csv: string) =>
      call<ImportPreviewResult>('/import/preview', { method: 'POST', body: JSON.stringify({ csv }) }),
    confirm: (rows: any[]) =>
      call<{ written: number; skipped: number }>('/import/confirm', { method: 'POST', body: JSON.stringify({ rows }) }),
  },

  // Zeitraum-Vergleiche (YTD, Quartal, Jahr, Custom)
  periods: {
    compute: (input: PeriodInput) =>
      call<PeriodTotal>('/periods/compute', { method: 'POST', body: JSON.stringify(input) }),
    compare: (a: PeriodInput, b: PeriodInput) =>
      call<{ a: PeriodTotal; b: PeriodTotal }>('/periods/compare', { method: 'POST', body: JSON.stringify({ a, b }) }),
  },

  // Ziele
  targets: {
    list: () => call<{ items: TargetItem[] }>('/targets'),
    listForMonth: (year: number, month: number) =>
      call<{ items: TargetItem[] }>(`/targets/months/${year}/${month}`),
    set: (key: string, value: string, year: number | null = null, month: number | null = null) =>
      call(`/targets/${key}`, { method: 'PUT', body: JSON.stringify({ value, year, month }) }),
  },

  // Rankings
  rankings: {
    lastMonths: (count?: number) =>
      call<RankingsResult>(`/rankings${count ? '?count=' + count : ''}`),
  },

  // Audit-Log
  audit: {
    list: (params: { entityType?: string; entityId?: string; action?: string; limit?: number; offset?: number } = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
      const s = qs.toString();
      return call<{ items: AuditEntry[]; total: number }>(`/audit${s ? '?' + s : ''}`);
    },
  },
};

// ---------------------------------------------------------------------------
// Target / Rankings / Audit types
// ---------------------------------------------------------------------------

export interface TargetItem {
  key: string; value: string; year: number | null; month: number | null;
}
export interface RankingMonthEntry {
  year: number; month: number;
  netSales: string; profit: string; margin: string | null;
}
export interface RankingsResult {
  months: RankingMonthEntry[];
  bestRevenueMonth: RankingMonthEntry | null;
  worstRevenueMonth: RankingMonthEntry | null;
  bestProfitMonth: RankingMonthEntry | null;
  worstProfitMonth: RankingMonthEntry | null;
  bestMarginMonth: RankingMonthEntry | null;
  worstMarginMonth: RankingMonthEntry | null;
}
export interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string;
  changes: any; createdAt: string; userId: string | null; userName: string | null;
}
export interface ImportPreviewRow {
  rowIndex: number; date: string; channel?: 'shopify' | 'amazon' | 'tiktok';
  raw: Record<string, string>;
  parsed: {
    gross19?: string; gross7?: string; returns19?: string; returns7?: string;
    meta?: string; google?: string; influencer?: string;
    amazonPpc?: string; tiktokAds?: string;
    shopifyPackages?: number; tiktokPackages?: number;
  };
  errors: string[];
}
export interface ImportPreviewResult {
  rows: ImportPreviewRow[]; totalRows: number; errorCount: number; warnings: string[];
}

export type PeriodKind = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';
export interface PeriodInput {
  kind: PeriodKind; year: number;
  month?: number; quarter?: number;
  fromYear?: number; fromMonth?: number;
  toYear?: number; toMonth?: number;
}
export interface PeriodTotal {
  label: string; monthCount: number;
  grossSalesTotal: string; netSalesTotal: string; netSalesWithWholesale: string;
  vatTotal: string; adsTotal: string;
  productCostsTotal: string; shippingCostsTotal: string; platformFeesTotal: string;
  wholesaleProfit: string; overheadTotal: string;
  profitBeforeOverhead: string; operatingProfit: string;
  marginBeforeOverhead: string | null; operatingMargin: string | null;
}

export interface PreflightResult {
  status: 'open' | 'closed' | 'locked' | null;
  summary: {
    dayCount: number; grossSalesTotal: string; netSalesTotal: string;
    profitBeforeOverhead: string; operatingProfit: string;
    marginBeforeOverhead: string | null; operatingMargin: string | null;
    wholesaleOrderCount: number; overheadEntryCount: number;
  };
  warnings: string[];
  warningsByDay: Array<{ date: string; warning: string }>;
}

// ---------------------------------------------------------------------------
// Wholesale types
// ---------------------------------------------------------------------------

export interface WholesaleListRow {
  id: string; orderDate: string; orderNumber: string | null; customerName: string | null;
  status: string; note: string | null; itemCount: number;
  totalGross: string; totalNet: string; totalCost: string; totalProfit: string; margin: string | null;
  createdAt: string;
}
export interface WholesaleItemInput {
  productId: string; quantity: number; unitPriceGross: string; vatRate?: string;
}
export interface WholesaleOrderInput {
  orderDate: string; orderNumber?: string; customerName?: string;
  status?: 'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'paid' | 'cancelled';
  note?: string; items: WholesaleItemInput[];
}
export interface WholesaleItemRow {
  id: string; productId: string; productTitle: string | null;
  productSku: string | null; productImageUrl: string | null;
  quantity: number; unitPriceGross: string; vatRate: string;
  productCostSnapshot: string;
  totalGross: string; totalNet: string; totalCost: string; totalProfit: string;
}
export interface WholesaleDetail extends WholesaleListRow {
  items: WholesaleItemRow[];
}

// ---------------------------------------------------------------------------
// Overhead types
// ---------------------------------------------------------------------------

export interface OverheadTemplate {
  id: string; category: string; label: string;
  amount: string; isGross: boolean; vatRate: string; active: boolean;
}
export interface OverheadTemplateInput {
  category: string; label: string;
  amount: string; isGross: boolean; vatRate: string; active?: boolean;
}
export interface OverheadEntry {
  id: string; category: string; label: string;
  enteredAmount: string; isGross: boolean; vatRate: string;
  note: string | null; templateId: string | null;
}
export interface OverheadEntryInput {
  category: string; label: string;
  enteredAmount: string; isGross: boolean; vatRate: string; note?: string;
}

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
  wholesale: {
    orderCount: number;
    totalGross: string; totalNet: string; totalVat: string;
    totalCost: string; totalProfit: string; margin: string | null;
  };
  overhead: {
    entries: Array<{
      id: string; category: string; label: string;
      enteredAmount: string; isGross: boolean; vatRate: string;
      netAmount: string; grossAmount: string; vatAmount: string;
      note: string | null;
    }>;
    totalNet: string; totalGross: string; totalVat: string;
    byCategory: Array<{ category: string; totalNet: string; ratioOfNetSales: string | null }>;
  };
  profitBeforeOverheadWithWholesale: string;
  operatingProfit: string;
  operatingMargin: string | null;
  netSalesWithWholesale: string;
}
