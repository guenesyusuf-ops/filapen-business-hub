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

export interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  tags: string[];
  marketingConsent: MarketingConsent;
  totalSpent: string;
  ordersCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  avgOrderValue: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: any;
  memberCount: number;
  lastRefreshedAt: string | null;
  createdAt: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  triggerType: FlowTriggerType;
  segmentId: string | null;
  reentryDays: number;
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
  activatedAt: string | null;
  _count?: { steps: number; enrollments: number };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  description: string | null;
  blocks: any;
  htmlOverride: string | null;
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  status: EmailCampaignStatus;
  templateId: string | null;
  segmentId: string | null;
  fromName: string;
  fromEmail: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientsCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  revenueAttributed: string;
  template?: { id: string; name: string };
  segment?: { id: string; name: string; memberCount: number };
}

export interface EmailSettings {
  id: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  sendingDomain: string | null;
  domainVerified: boolean;
  publicTrackingKey: string | null;
  defaultConsentMode: string;
  doubleOptInEnabled: boolean;
  maxEmailsPerContactPerDay: number;
  unsubscribeCopy: string | null;
  footerHtml: string | null;
}

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

  // Settings
  getSettings: () => call<EmailSettings>('/settings'),
  updateSettings: (data: Partial<EmailSettings>) =>
    call<EmailSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  rotateTrackingKey: () => call<EmailSettings>('/settings/rotate-tracking-key', { method: 'POST' }),

  // Contacts
  listContacts: (q: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) p.set(k, v); });
    return call<{ items: Contact[]; total: number }>(`/contacts${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getContact: (id: string) => call<{ contact: Contact; events: any[]; messages: any[] }>(`/contacts/${id}`),
  updateContactConsent: (id: string, consent: MarketingConsent) =>
    call(`/contacts/${id}/consent`, { method: 'PUT', body: JSON.stringify({ consent }) }),
  resyncContactStats: (id: string) => call(`/contacts/${id}/resync-stats`, { method: 'POST' }),

  // Events
  recentEvents: (limit = 100) => call(`/events/recent?limit=${limit}`),

  // Suppressions
  listSuppressions: () => call('/suppressions'),
  addSuppression: (data: { email: string; reason?: string; note?: string }) =>
    call('/suppressions', { method: 'POST', body: JSON.stringify(data) }),
  removeSuppression: (id: string) => call(`/suppressions/${id}`, { method: 'DELETE' }),

  // Segments
  listSegments: () => call<Segment[]>('/segments'),
  getSegment: (id: string) => call<Segment>(`/segments/${id}`),
  createSegment: (data: any) => call<Segment>('/segments', { method: 'POST', body: JSON.stringify(data) }),
  updateSegment: (id: string, data: any) => call(`/segments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSegment: (id: string) => call(`/segments/${id}`, { method: 'DELETE' }),
  previewSegment: (rules: any) => call<{ count: number; sample: Contact[] }>('/segments/preview', { method: 'POST', body: JSON.stringify({ rules }) }),
  refreshSegment: (id: string) => call(`/segments/${id}/refresh`, { method: 'POST' }),

  // Flows
  listFlows: () => call<Flow[]>('/flows'),
  flowCatalog: () => call<Array<{ kind: string; name: string; description: string; triggerType: string; emailCount: number }>>('/flows/catalog'),
  getFlow: (id: string) => call(`/flows/${id}`),
  createFlow: (data: any) => call('/flows', { method: 'POST', body: JSON.stringify(data) }),
  updateFlow: (id: string, data: any) => call(`/flows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  installFlow: (kind: string) => call(`/flows/install/${kind}`, { method: 'POST' }),
  setFlowStatus: (id: string, status: FlowStatus) => call(`/flows/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteFlow: (id: string) => call(`/flows/${id}`, { method: 'DELETE' }),

  // Templates
  listTemplates: () => call<EmailTemplate[]>('/templates'),
  getTemplate: (id: string) => call<EmailTemplate>(`/templates/${id}`),
  createTemplate: (data: Partial<EmailTemplate>) => call<EmailTemplate>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<EmailTemplate>) => call<EmailTemplate>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => call(`/templates/${id}`, { method: 'DELETE' }),

  // Campaigns
  listCampaigns: () => call<EmailCampaign[]>('/campaigns'),
  getCampaign: (id: string) => call<EmailCampaign>(`/campaigns/${id}`),
  createCampaign: (data: any) => call<EmailCampaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id: string, data: any) => call(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendCampaign: (id: string) => call(`/campaigns/${id}/send`, { method: 'POST' }),
  testSendCampaign: (id: string, email: string) => call(`/campaigns/${id}/test-send`, { method: 'POST', body: JSON.stringify({ email }) }),
  deleteCampaign: (id: string) => call(`/campaigns/${id}`, { method: 'DELETE' }),
};

export const CONSENT_LABELS: Record<MarketingConsent, { label: string; color: string }> = {
  never_subscribed: { label: 'Nicht angemeldet', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  subscribed: { label: 'Angemeldet', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  confirmed: { label: 'Doppel-Opt-In', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  unsubscribed: { label: 'Abgemeldet', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export const FLOW_STATUS_LABELS: Record<FlowStatus, { label: string; color: string }> = {
  draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: 'Aktiv', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  paused: { label: 'Pausiert', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  archived: { label: 'Archiviert', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export const CAMPAIGN_STATUS_LABELS: Record<EmailCampaignStatus, { label: string; color: string }> = {
  draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  scheduled: { label: 'Geplant', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  sending: { label: 'Versendet…', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  sent: { label: 'Versendet', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  paused: { label: 'Pausiert', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  archived: { label: 'Archiviert', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export const TRIGGER_LABELS: Record<FlowTriggerType, string> = {
  customer_created: 'Neuer Kunde',
  order_placed: 'Bestellung aufgegeben',
  checkout_started: 'Checkout begonnen',
  viewed_product: 'Produkt angesehen',
  added_to_cart: 'In den Warenkorb',
  segment_entered: 'Segment betreten',
  custom_event: 'Benutzerdefiniert',
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
