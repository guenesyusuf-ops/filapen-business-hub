import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

export type SalesOrderStatus = 'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'completed' | 'cancelled';
export type SalesDocumentKind = 'original' | 'confirmation' | 'invoice' | 'other';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/sales${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const salesApi = {
  dashboard: () => call<{ open: number; urgent: number; overdue: number; monthRevenue: number }>('/dashboard'),

  // Customers
  listCustomers: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) p.set(k, v); });
    return call<{ items: any[]; total: number }>(`/customers${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getCustomer: (id: string) => call<any>(`/customers/${id}`),
  createCustomer: (data: any) => call<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => call<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => call(`/customers/${id}`, { method: 'DELETE' }),

  // Orders
  listOrders: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) p.set(k, v); });
    return call<{ items: any[]; total: number }>(`/orders${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getOrder: (id: string) => call<any>(`/orders/${id}`),
  createOrder: (data: any) => call<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: any) => call<any>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  replaceLineItems: (id: string, items: any[]) => call<any>(`/orders/${id}/line-items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  deleteOrder: (id: string) => call(`/orders/${id}`, { method: 'DELETE' }),

  // Status toggles
  toggleConfirmation: (id: string, on: boolean) =>
    call<any>(`/orders/${id}/status/confirmation-sent`, { method: 'POST', body: JSON.stringify({ on }) }),
  toggleShipped: (id: string, on: boolean) =>
    call<any>(`/orders/${id}/status/shipped`, { method: 'POST', body: JSON.stringify({ on }) }),
  toggleInvoice: (id: string, on: boolean) =>
    call<any>(`/orders/${id}/status/invoice-sent`, { method: 'POST', body: JSON.stringify({ on }) }),
  togglePaid: (id: string, on: boolean) =>
    call<any>(`/orders/${id}/status/paid`, { method: 'POST', body: JSON.stringify({ on }) }),
  updateShipping: (id: string, data: { trackingNumbers?: string[]; shippingCarrierNote?: string | null; shippedAt?: string | null }) =>
    call<any>(`/orders/${id}/shipping`, { method: 'PUT', body: JSON.stringify(data) }),

  // Documents
  listDocuments: (orderId: string) => call<any[]>(`/orders/${orderId}/documents`),
  uploadDocument: async (orderId: string, file: File, kind: SalesDocumentKind = 'other') => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await fetch(`${API_URL}/api/sales/orders/${orderId}/documents`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: form,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },
  deleteDocument: (orderId: string, docId: string) =>
    call(`/orders/${orderId}/documents/${docId}`, { method: 'DELETE' }),

  // Import
  importOrder: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/api/sales/orders/import`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: form,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json() as Promise<{
      extracted: any;
      confidence: number;
      matchedCustomerId: string | null;
      matchedLineItems: Array<{ index: number; productVariantId: string; sku: string | null; ean: string | null }>;
      rawModel: string;
      sourceDocumentId: string;
    }>;
  },
  confirmImport: (data: any) => call<any>('/orders/import/confirm', { method: 'POST', body: JSON.stringify(data) }),

  // easybill
  easybillStatus: () => call<{ connected: boolean; error?: string }>('/easybill/status'),
  createConfirmation: (id: string) => call<any>(`/orders/${id}/easybill/create-confirmation`, { method: 'POST' }),
  sendConfirmation: (id: string) => call<any>(`/orders/${id}/easybill/send-confirmation`, { method: 'POST' }),
  createInvoice: (id: string) => call<any>(`/orders/${id}/easybill/create-invoice`, { method: 'POST' }),
  sendInvoice: (id: string) => call<any>(`/orders/${id}/easybill/send-invoice`, { method: 'POST' }),
};

export const STATUS_LABELS: Record<SalesOrderStatus, { label: string; color: string }> = {
  draft:     { label: 'Entwurf',    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  confirmed: { label: 'Bestätigt',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  shipped:   { label: 'Versendet',  color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  invoiced:  { label: 'Berechnet',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Abgeschlossen', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Storniert',  color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE');
}

export function fmtMoney(n: number | string | null | undefined, currency: string = 'EUR'): string {
  const v = typeof n === 'string' ? parseFloat(n) : n ?? 0;
  return (v || 0).toLocaleString('de-DE', { style: 'currency', currency });
}

/**
 * Urgency helpers for list rows — mirrors the server-side reminder logic so
 * both stay consistent. Returns one of: null | 'urgent' | 'overdue'.
 */
export function urgencyOf(order: { requiredDeliveryDate?: string | null; shippedAt?: string | null }): null | 'urgent' | 'overdue' {
  if (!order.requiredDeliveryDate || order.shippedAt) return null;
  const due = new Date(order.requiredDeliveryDate);
  const now = new Date();
  const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'urgent';
  return null;
}
