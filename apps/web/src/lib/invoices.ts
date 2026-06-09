import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const baseHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/invoices${path}`, { headers: baseHeaders(), ...init });
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

export type InvoiceStatus = 'open' | 'due_soon' | 'due_today' | 'overdue' | 'paid';
export type OcrStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface Invoice {
  id: string;
  orgId: string;

  supplierName: string | null;
  supplierAddress: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWebsite: string | null;
  supplierVatId: string | null;

  invoiceNumber: string | null;
  invoiceDate: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  paymentTerms: string | null;
  currency: string;

  netAmount: string | number | null;
  vatAmount: string | number | null;
  grossAmount: string | number | null;
  taxRate: string | number | null;
  discountAmount: string | number | null;

  iban: string | null;
  bic: string | null;
  bankName: string | null;
  paymentReference: string | null;

  category: string;
  status: InvoiceStatus;
  paidAt: string | null;
  paidById: string | null;
  paymentProofPath: string | null;

  fileName: string;
  fileMime: string;
  fileSize: number;
  storagePath: string;
  storageUrl: string | null;

  ocrStatus: OcrStatus;
  ocrRawText: string | null;
  ocrConfidence: number | null;
  ocrError: string | null;
  reviewed: boolean;

  notes: string | null;
  uploadedById: string | null;
  archived: boolean;

  createdAt: string;
  updatedAt: string;

  events?: InvoiceEvent[];
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  type: string;
  actorId: string | null;
  note: string | null;
  metadata: any;
  createdAt: string;
}

export interface InvoiceListResult {
  items: Invoice[];
  total: number;
  limit: number;
  offset: number;
}

export interface InvoiceStatusCounts {
  open: number;
  due_soon: number;
  due_today: number;
  overdue: number;
  paid: number;
  archived: number;
  all: number;
}

export interface InvoiceSettings {
  id: string;
  orgId: string;
  reminderDaysBefore: number[];
  reminderRecipients: string[];
  defaultCategory: string;
  retentionMonths: number;
  customCategories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierEntry {
  supplierName: string;
  invoiceCount: number;
  totalSpend: number;
  openSpend: number;
  paidSpend: number;
  avgInvoice: number;
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
}

export interface InvoiceStatsDashboard {
  kpis: {
    open: number;
    due_soon: number;
    due_today: number;
    overdue: number;
    paid: number;
    sumOpen: number;
    sumPaid: number;
  };
  monthly: Array<{ month: string; paid: number; unpaid: number; total: number }>;
  byCategory: Array<{ category: string; total: number; count: number }>;
  topSuppliers: Array<{ supplierName: string; total: number; count: number }>;
  cashflow: {
    next7d: { total: number; count: number };
    next30d: { total: number; count: number };
    overdue: { total: number; count: number };
    thisMonth: { total: number; count: number };
  };
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

export const invoicesApi = {
  list: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v != null && v !== '') p.set(k, String(v)); });
    return call<InvoiceListResult>(`${p.toString() ? `?${p.toString()}` : ''}`);
  },
  statusCounts: () => call<InvoiceStatusCounts>('/status-counts'),
  suppliers: () => call<SupplierEntry[]>('/suppliers'),
  get: (id: string) => call<Invoice>(`/${id}`),
  update: (id: string, data: Partial<Invoice>) =>
    call<Invoice>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  markPaid: (id: string, opts: { paidAt?: string; note?: string } = {}) =>
    call<Invoice>(`/${id}/paid`, { method: 'POST', body: JSON.stringify(opts) }),
  markUnpaid: (id: string) => call<Invoice>(`/${id}/unpaid`, { method: 'POST' }),
  archive: (id: string) => call(`/${id}/archive`, { method: 'POST' }),
  restore: (id: string) => call(`/${id}/restore`, { method: 'POST' }),
  remove: (id: string) => call(`/${id}`, { method: 'DELETE' }),
  duplicates: (id: string) => call<Array<{ id: string; invoiceNumber: string | null; supplierName: string | null; invoiceDate: string | null; grossAmount: string | null }>>(`/${id}/duplicates`),

  // Stats / Dashboard
  statsDashboard: () => call<InvoiceStatsDashboard>('/stats/dashboard'),

  // Settings
  getSettings: () => call<InvoiceSettings>('/settings'),
  updateSettings: (data: Partial<InvoiceSettings>) =>
    call<InvoiceSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  upload: async (file: File): Promise<{ id: string; ocrStatus: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/api/invoices/upload`, {
      method: 'POST',
      headers: getAuthHeaders(), // KEIN Content-Type — Browser setzt multipart boundary selbst
      body: form,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  /** Holt die Datei als Blob (via Auth-Proxy) — fuer PDF-/Bild-Viewer. */
  fetchFileBlob: async (id: string, download = false): Promise<{ blob: Blob; mime: string }> => {
    const res = await fetch(`${API_URL}/api/invoices/${id}/file${download ? '?download=1' : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return { blob, mime: blob.type };
  },
};

// -----------------------------------------------------------------------------
// Helpers / Formatters
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

// -----------------------------------------------------------------------------
// Status-Metadaten — Farbsystem + Labels (zentral, damit Liste + Detail gleich aussehen)
// -----------------------------------------------------------------------------

export const STATUS_META: Record<InvoiceStatus, {
  label: string;
  dot: string;        // background dot color
  badge: string;      // full badge class
  badgeDark: string;  // dark mode classes
}> = {
  open: {
    label: 'Offen',
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    badgeDark: 'dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700',
  },
  due_soon: {
    label: 'Bald fällig',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    badgeDark: 'dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-500/30',
  },
  due_today: {
    label: 'Heute fällig',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDark: 'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500/30',
  },
  overdue: {
    label: 'Überfällig',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    badgeDark: 'dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30',
  },
  paid: {
    label: 'Bezahlt',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeDark: 'dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-500/30',
  },
};

// -----------------------------------------------------------------------------
// Kategorien
// -----------------------------------------------------------------------------

export const DEFAULT_CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'marketing', label: 'Marketing', color: '#ec4899' },
  { key: 'software', label: 'Software', color: '#8b5cf6' },
  { key: 'office', label: 'Bürobedarf', color: '#f59e0b' },
  { key: 'vehicles', label: 'Fahrzeuge', color: '#0ea5e9' },
  { key: 'rent', label: 'Miete', color: '#10b981' },
  { key: 'personnel', label: 'Personal', color: '#3b82f6' },
  { key: 'insurance', label: 'Versicherungen', color: '#06b6d4' },
  { key: 'other', label: 'Sonstiges', color: '#64748b' },
];

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return 'Sonstiges';
  const found = DEFAULT_CATEGORIES.find((c) => c.key === key);
  return found?.label ?? key;
}

export function categoryColor(key: string | null | undefined): string {
  if (!key) return '#64748b';
  const found = DEFAULT_CATEGORIES.find((c) => c.key === key);
  return found?.color ?? '#64748b';
}
