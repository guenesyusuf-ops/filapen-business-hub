import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const baseHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/returns${path}`, { headers: baseHeaders(), ...init });
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

export type ReturnStatus = 'open' | 'in_review' | 'accepted' | 'rejected' | 'refunded';
export type ReturnPlatform = 'tiktok' | 'shopify';
export type RejectionReason = 'used' | 'customer_damaged' | 'incomplete' | 'wrong_product' | 'other';

export interface ReturnActor {
  id: string;
  name: string;
  email: string;
}

export interface ReturnProduct {
  id: string;
  title: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  productId: string | null;
  productFreetext: string | null;
  quantity: number;
  notes: string | null;
  createdAt: string;
  product?: ReturnProduct | null;
}

export interface ReturnImage {
  id: string;
  returnId: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  storagePath: string;
  storageUrl: string | null;
  uploadedById: string | null;
  uploadedBy?: ReturnActor | null;
  createdAt: string;
}

export interface ReturnEvent {
  id: string;
  returnId: string;
  type: string;
  actorId: string | null;
  actor?: ReturnActor | null;
  note: string | null;
  metadata: any;
  createdAt: string;
}

export interface Return {
  id: string;
  orgId: string;
  platform: ReturnPlatform;
  orderNumber: string;
  requestDate: string;
  customerName: string | null;
  customerEmail: string | null;
  trackingNumber: string | null;
  status: ReturnStatus;
  rejectionReason: RejectionReason | null;
  rejectionNote: string | null;
  refundAmount: string | number | null;
  refundDate: string | null;
  damaged: boolean;
  notes: string | null;
  createdById: string | null;
  createdBy?: ReturnActor | null;
  decidedById: string | null;
  decidedBy?: ReturnActor | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnItem[];
  images: ReturnImage[];
  events?: ReturnEvent[];
  _count?: { images: number };
}

export interface ReturnListResult {
  items: Return[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReturnStatusCounts {
  open: number;
  in_review: number;
  accepted: number;
  rejected: number;
  refunded: number;
  all: number;
}

export interface ReturnStatsDashboard {
  perPlatform: Array<{
    platform: 'tiktok' | 'shopify';
    open: number; in_review: number; accepted: number; rejected: number; refunded: number;
    total: number;
  }>;
  refunds: { total: number; count: number };
  topRejectReasons: Array<{ reason: string | null; count: number }>;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

export const returnsApi = {
  list: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v != null && v !== '') p.set(k, String(v)); });
    return call<ReturnListResult>(`${p.toString() ? `?${p.toString()}` : ''}`);
  },
  statusCounts: (platform?: string) => {
    const qs = platform ? `?platform=${platform}` : '';
    return call<ReturnStatusCounts>(`/status-counts${qs}`);
  },
  statsDashboard: () => call<ReturnStatsDashboard>('/stats/dashboard'),
  searchProducts: (q?: string) => call<ReturnProduct[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  get: (id: string) => call<Return>(`/${id}`),
  create: (data: any) => call<Return>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => call<Return>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call(`/${id}`, { method: 'DELETE' }),

  // Workflow
  submitForReview: (id: string) => call<Return>(`/${id}/submit-review`, { method: 'POST' }),
  accept: (id: string, opts: { refundAmount?: number; refundDate?: string; damaged?: boolean; note?: string } = {}) =>
    call<Return>(`/${id}/accept`, { method: 'POST', body: JSON.stringify(opts) }),
  reject: (id: string, opts: { reason: RejectionReason; note?: string }) =>
    call<Return>(`/${id}/reject`, { method: 'POST', body: JSON.stringify(opts) }),
  refund: (id: string, opts: { refundAmount?: number; refundDate?: string } = {}) =>
    call<Return>(`/${id}/refund`, { method: 'POST', body: JSON.stringify(opts) }),
  revert: (id: string, status: ReturnStatus) =>
    call<Return>(`/${id}/revert`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Items
  addItem: (id: string, item: any) =>
    call<Return>(`/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),
  removeItem: (id: string, itemId: string) =>
    call<Return>(`/${id}/items/${itemId}`, { method: 'DELETE' }),

  // Bilder
  uploadImages: async (id: string, files: File[]): Promise<{ uploaded: number }> => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`${API_URL}/api/returns/${id}/images`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: form,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },
  removeImage: (id: string, imageId: string) =>
    call(`/${id}/images/${imageId}`, { method: 'DELETE' }),
  imageUrl: (id: string, imageId: string) => `${API_URL}/api/returns/${id}/images/${imageId}/file`,
  fetchImageBlob: async (id: string, imageId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/api/returns/${id}/images/${imageId}/file`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
};

// -----------------------------------------------------------------------------
// Helpers / Meta
// -----------------------------------------------------------------------------

export const fmtEUR = (n: number | string | null | undefined): string => {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Local YYYY-MM-DD (kein UTC)
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const STATUS_META: Record<ReturnStatus, { label: string; dot: string; badge: string; badgeDark: string }> = {
  open: {
    label: 'Offen',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDark: 'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500/30',
  },
  in_review: {
    label: 'Zu prüfen',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeDark: 'dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/30',
  },
  accepted: {
    label: 'Akzeptiert',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeDark: 'dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  rejected: {
    label: 'Abgelehnt',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    badgeDark: 'dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30',
  },
  refunded: {
    label: 'Erstattet',
    dot: 'bg-teal-500',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    badgeDark: 'dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-500/30',
  },
};

export const PLATFORM_META: Record<ReturnPlatform, { label: string; color: string }> = {
  tiktok: { label: 'TikTok', color: '#000000' },
  shopify: { label: 'Shopify', color: '#7AB55C' },
};

export const REJECTION_REASONS: Array<{ key: RejectionReason; label: string }> = [
  { key: 'used', label: 'Produkt benutzt' },
  { key: 'customer_damaged', label: 'Produkt vom Kunden beschädigt' },
  { key: 'incomplete', label: 'Nicht vollständig' },
  { key: 'wrong_product', label: 'Falsches Produkt' },
  { key: 'other', label: 'Anderer Grund' },
];

export function reasonLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return REJECTION_REASONS.find((r) => r.key === key)?.label ?? key;
}
