import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

export type ShippingCarrier = 'dhl' | 'ups' | 'dpd' | 'hermes' | 'gls' | 'custom';
export type OrderShipmentStatus =
  | 'label_created' | 'handed_to_carrier' | 'in_transit' | 'out_for_delivery'
  | 'delivered' | 'delivery_failed' | 'ready_for_pickup' | 'returned' | 'exception' | 'cancelled';
export type LabelFormat = 'pdf_a4' | 'pdf_100x150' | 'pdf_103x199' | 'zpl_100x150' | 'zpl_103x199';
export type CarrierAccountStatus = 'active' | 'inactive';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/shipping${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const shippingApi = {
  dashboard: () => call('/dashboard'),
  // More endpoints added in S2-S8
};

export const SHIPMENT_STATUS_LABELS: Record<OrderShipmentStatus, { label: string; color: string }> = {
  label_created: { label: 'Label erstellt', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  handed_to_carrier: { label: 'Übergeben', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_transit: { label: 'Unterwegs', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  out_for_delivery: { label: 'In Zustellung', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  delivered: { label: 'Zugestellt', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  delivery_failed: { label: 'Zustellung fehlgeschlagen', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  ready_for_pickup: { label: 'Abholbereit', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  returned: { label: 'Retoure', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  exception: { label: 'Ausnahme', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cancelled: { label: 'Storniert', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export const CARRIER_LABELS: Record<ShippingCarrier, string> = {
  dhl: 'DHL',
  ups: 'UPS',
  dpd: 'DPD',
  hermes: 'Hermes',
  gls: 'GLS',
  custom: 'Sonstige',
};

export const LABEL_FORMAT_LABELS: Record<LabelFormat, string> = {
  pdf_a4: 'PDF A4',
  pdf_100x150: 'PDF 100×150 mm (Thermo)',
  pdf_103x199: 'PDF 103×199 mm (Thermo)',
  zpl_100x150: 'ZPL 100×150 mm (direkt)',
  zpl_103x199: 'ZPL 103×199 mm (direkt)',
};

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
