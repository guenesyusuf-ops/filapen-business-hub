import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

export type Currency = 'EUR' | 'USD';

export type PoStatus = 'draft' | 'ordered' | 'shipped' | 'invoiced' | 'partially_received' | 'received' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'paypal' | 'sepa_debit' | 'cash' | 'other';
export type DocumentType = 'invoice' | 'proforma' | 'delivery_note' | 'receipt' | 'other';

export interface Shipment {
  id: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  shippedAt?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
  items: Array<{ id: string; purchaseOrderItemId: string; quantity: string }>;
  createdBy?: { id: string; name: string | null };
  createdAt: string;
}

export interface Supplier {
  id: string;
  supplierNumber: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  vatId?: string | null;
  taxNumber?: string | null;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  country?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  paymentTermDays?: number | null;
  defaultCurrency: string;
  notes?: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  _count?: { purchaseOrders: number };
}

export interface PoItem {
  id?: string;
  productId?: string | null;
  productVariantId?: string | null;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  lineSubtotal?: string;
  lineTax?: string;
  lineTotal?: string;
  position?: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: { id: string; supplierNumber: string; companyName: string; vatId?: string | null };
  orderDate: string;
  expectedDelivery?: string | null;
  receivedAt?: string | null;
  currency: Currency;
  exchangeRate?: string | null;
  subtotal: string;
  taxTotal: string;
  shippingCost?: string | null;
  customsCost?: string | null;
  totalAmount: string;
  paidAmount: string;
  openAmount: string;
  status: PoStatus;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  internalNotes?: string | null;
  createdById: string;
  createdBy?: { id: string; name: string | null; email: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
  items?: PoItem[];
  invoices?: Array<{ id: string; invoiceNumber: string; invoiceDate: string; dueDate?: string | null; amount: string }>;
  payments?: Array<{ id: string; paymentDate: string; amount: string; method: PaymentMethod; reference?: string | null; note?: string | null; createdBy?: { name: string | null } }>;
  documents?: Array<{ id: string; fileName: string; fileUrl: string; mimeType: string; documentType: DocumentType; uploadedAt?: string; uploadedBy?: { name: string | null } }>;
  shipments?: Shipment[];
  _count?: { documents: number; payments: number; shipments?: number };
}

const headers = (extra?: Record<string, string>) => ({
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
  ...(extra || {}),
});

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/purchase${path}`, {
    headers: headers(),
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const purchasesApi = {
  // Dashboard
  dashboard: () => call('/dashboard'),

  // Suppliers
  listSuppliers: (q?: { search?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (q?.search) params.set('search', q.search);
    if (q?.status) params.set('status', q.status);
    const qs = params.toString();
    return call<Supplier[]>(`/suppliers${qs ? `?${qs}` : ''}`);
  },
  getSupplier: (id: string) => call(`/suppliers/${id}`),
  createSupplier: (data: Partial<Supplier>) => call('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: Partial<Supplier>) => call(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => call(`/suppliers/${id}`, { method: 'DELETE' }),

  // Products
  searchProducts: (q?: string) => call(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  // Orders
  listOrders: (q: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    return call<{ items: PurchaseOrder[]; total: number }>(`/orders${qs ? `?${qs}` : ''}`);
  },
  getOrder: (id: string) => call<PurchaseOrder>(`/orders/${id}`),
  createOrder: (data: any) => call<PurchaseOrder>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: any) => call(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setOrderStatus: (id: string, status: PoStatus) => call(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteOrder: (id: string) => call(`/orders/${id}`, { method: 'DELETE' }),
  orderAudit: (id: string) => call(`/orders/${id}/audit`),

  // Invoices
  addInvoice: (orderId: string, data: any) => call(`/orders/${orderId}/invoices`, { method: 'POST', body: JSON.stringify(data) }),
  deleteInvoice: (invoiceId: string) => call(`/invoices/${invoiceId}`, { method: 'DELETE' }),

  // Payments
  listPayments: (orderId: string) => call(`/orders/${orderId}/payments`),
  addPayment: (orderId: string, data: any) => call(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (paymentId: string, data: any) => call(`/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (paymentId: string) => call(`/payments/${paymentId}`, { method: 'DELETE' }),

  // Shipments
  listShipments: (orderId: string) => call<Shipment[]>(`/orders/${orderId}/shipments`),
  addShipment: (orderId: string, data: any) => call<Shipment>(`/orders/${orderId}/shipments`, { method: 'POST', body: JSON.stringify(data) }),
  updateShipment: (shipmentId: string, data: any) => call(`/shipments/${shipmentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  markShipmentReceived: (shipmentId: string, receivedAt?: string) =>
    call(`/shipments/${shipmentId}/received`, { method: 'PATCH', body: JSON.stringify({ receivedAt: receivedAt || null }) }),
  deleteShipment: (shipmentId: string) => call(`/shipments/${shipmentId}`, { method: 'DELETE' }),

  // Documents
  listDocuments: (orderId: string) => call(`/orders/${orderId}/documents`),
  uploadDocument: async (orderId: string, file: File, documentType: DocumentType) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', documentType);
    const res = await fetch(`${API_URL}/api/purchase/orders/${orderId}/documents`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: fd,
    });
    if (!res.ok) {
      let msg = `Upload failed (${res.status})`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },
  deleteDocument: (docId: string) => call(`/documents/${docId}`, { method: 'DELETE' }),

  // Export — returns blob URL or preview JSON
  exportPreview: async (type: string, params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams({ preview: '1' });
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return call(`/export/${type}?${qs.toString()}`);
  },
  exportDownloadUrl: (type: string, params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return `${API_URL}/api/purchase/export/${type}${qs.toString() ? `?${qs.toString()}` : ''}`;
  },
};

// Formatters
export function fmtMoney(n: string | number | null | undefined, currency: string = 'EUR'): string {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(num);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE');
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_LABELS: Record<PoStatus, { label: string; color: string }> = {
  draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  ordered: { label: 'Bestellung aufgegeben', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  shipped: { label: 'Unterwegs', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  invoiced: { label: 'Bestellung aufgegeben', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  partially_received: { label: 'Teilweise angekommen', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  received: { label: 'Erledigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  completed: { label: 'Erledigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export const CARRIERS = [
  'DHL', 'DPD', 'GLS', 'UPS', 'FedEx', 'Hermes', 'Post/DHL Express',
  'DB Schenker', 'Kühne+Nagel', 'Dachser', 'Luftfracht', 'Seefracht', 'Sonstiges',
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid: { label: 'Offen', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  partially_paid: { label: 'Teilweise bezahlt', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  paid: { label: 'Vollständig bezahlt', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  overpaid: { label: 'Überzahlt', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Überweisung',
  credit_card: 'Kreditkarte',
  paypal: 'PayPal',
  sepa_debit: 'SEPA-Lastschrift',
  cash: 'Bar',
  other: 'Sonstiges',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Rechnung',
  proforma: 'Proforma',
  delivery_note: 'Lieferschein',
  receipt: 'Zahlungsbeleg',
  other: 'Sonstiges',
};
