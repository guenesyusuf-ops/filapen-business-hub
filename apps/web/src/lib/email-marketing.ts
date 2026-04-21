import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

export type MarketingConsent = 'never_subscribed' | 'subscribed' | 'confirmed' | 'unsubscribed';
export type EmailCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'archived';
export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type FlowTriggerType =
  | 'customer_created' | 'order_placed' | 'checkout_started'
  | 'viewed_product' | 'added_to_cart' | 'segment_entered' | 'custom_event';
export type FlowStepType = 'delay' | 'condition' | 'send_email' | 'end';
export type SuppressionReason = 'unsubscribed' | 'bounced_hard' | 'bounced_soft' | 'complained' | 'manual';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/email-marketing${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const emailApi = {
  ping: () => call('/ping'),
  dashboard: () => call('/dashboard'),
  // Will be extended in later phases: contacts, segments, campaigns, flows, templates, settings.
};

export const CONSENT_LABELS: Record<MarketingConsent, { label: string; color: string }> = {
  never_subscribed: { label: 'Nicht angemeldet', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  subscribed: { label: 'Angemeldet', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  confirmed: { label: 'Doppel-Opt-In', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  unsubscribed: { label: 'Abgemeldet', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};
