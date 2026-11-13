import { API_URL } from './api';

// Separate auth storage for the external partner portal (not the hub login).
const TOKEN_KEY = 'ds_partner_token';
const NAME_KEY = 'ds_partner_name';

export function getPartnerToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function getPartnerName(): string | null {
  try { return localStorage.getItem(NAME_KEY); } catch { return null; }
}
export function setPartnerSession(token: string, name: string) {
  try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(NAME_KEY, name); } catch {}
}
export function clearPartnerSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); } catch {}
}

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getPartnerToken();
  const res = await fetch(`${API_URL}/api/dropshipping/portal${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearPartnerSession();
    throw new Error('Session expired — please sign in again.');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type PortalOrderStatus = 'new' | 'shipped_cn' | 'in_de' | 'delivered' | 'on_hold';

export interface PortalItem {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  imageUrl: string | null;
}

export interface PortalOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddress: any;
  countryCode: string | null;
  status: PortalOrderStatus;
  cnTracking: string | null;
  deTracking: string | null;
  carrier: string | null;
  note: string | null;
  items: PortalItem[];
}

export const portalApi = {
  login: (email: string, password: string) =>
    call<{ token: string; partner: { name: string } }>(`/login`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  summary: () => call<{ total: number; openCount: number; lastUpdatedAt: string | null }>(`/summary`),
  listOrders: (status?: string) =>
    call<PortalOrder[]>(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  async exportCsv(status?: string): Promise<void> {
    const token = getPartnerToken();
    const res = await fetch(`${API_URL}/api/dropshipping/portal/orders/export${status ? `?status=${encodeURIComponent(status)}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
  ship: (id: string, cnTracking: string) =>
    call(`/orders/${id}/ship`, { method: 'POST', body: JSON.stringify({ cnTracking }) }),
  arrived: (id: string, deTracking: string, carrier: string) =>
    call(`/orders/${id}/arrived`, { method: 'POST', body: JSON.stringify({ deTracking, carrier }) }),
  delivered: (id: string) => call(`/orders/${id}/delivered`, { method: 'POST' }),
  hold: (id: string, note: string) => call(`/orders/${id}/hold`, { method: 'POST', body: JSON.stringify({ note }) }),
};

export const CARRIERS = ['DHL', 'DHL Express', 'DPD', 'GLS', 'Hermes', 'UPS', 'FedEx', 'Deutsche Post'];

export const PORTAL_STATUS_LABEL: Record<PortalOrderStatus, string> = {
  new: 'New',
  shipped_cn: 'Shipped (CN)',
  in_de: 'In Germany',
  delivered: 'Delivered',
  on_hold: 'On hold',
};
