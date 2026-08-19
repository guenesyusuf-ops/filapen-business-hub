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
};
