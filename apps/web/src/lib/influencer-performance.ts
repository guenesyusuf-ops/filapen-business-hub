import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/influencer-performance${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type EntryStatus =
  | 'planned' | 'contacted' | 'negotiating' | 'booked'
  | 'posted' | 'completed' | 'cancelled' | 'blacklisted';

/** DB-Felder + computed Felder die das Backend mitliefert. */
export interface PerformanceEntry {
  id: string;
  orgId: string;
  influencerProfileId: string | null;
  influencerName: string;
  platform: string;
  category: string | null;
  managerContact: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  engagementRate: number | null;
  storyViews: number | null;
  avgViews: number | null;
  country: string | null;
  language: string | null;

  campaignName: string | null;
  postedAt: string | null;
  storyAt: string | null;
  productName: string | null;
  discountCode: string | null;
  discountPct: number | null;
  landingPageUrl: string | null;
  affiliateLink: string | null;
  status: EntryStatus;

  influencerFee: number;
  productCost: number;
  shippingCost: number;
  cogs: number;
  extraCost: number;

  revenue: number;
  orders: number;
  clicks: number;
  views: number;
  profitMarginOverride: number | null;

  trackingLink: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  trackingStatus: string | null;
  attributionConfirmed: boolean;

  hookWorked: boolean | null;
  ctaQuality: number | null;
  videoQuality: number | null;
  brandingScore: number | null;
  performanceRating: number | null;
  bookable: boolean | null;

  learnings: string | null;
  whatWorked: string | null;
  whatDidntWork: string | null;
  improvementIdeas: string | null;

  whitelist: boolean;
  blacklist: boolean;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Computed
  totalCost: number;
  profit: number;
  roas: number | null;
  roi: number | null;
  cpa: number | null;
  cpm: number | null;
  conversionRate: number | null;
  epc: number | null;
  aov: number | null;
  profitMargin: number | null;
  breakEvenRoas: number | null;
  perfFlag: '🔥' | '✅' | '⚠️' | '❌' | null;
}

export interface KpiSnapshot {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalOrders: number;
  totalViews: number;
  totalClicks: number;
  influencerCount: number;
  avgRevenuePerInfluencer: number;
  overallRoas: number | null;
  avgRoas: number | null;
  breakEvenRoas: number | null;
  avgStoryViews: number | null;
  avgConversionRate: number | null;
  cogsShare: number | null;
  cpa: number | null;
  cpm: number | null;
  roi: number | null;
}

export const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitch', 'snapchat', 'twitter', 'andere'] as const;
export const STATUS_OPTIONS: { value: EntryStatus; label: string; color: string }[] = [
  { value: 'planned',      label: 'Geplant',          color: 'bg-gray-100 text-gray-700' },
  { value: 'contacted',    label: 'Kontaktiert',      color: 'bg-blue-100 text-blue-700' },
  { value: 'negotiating',  label: 'Verhandlung',      color: 'bg-amber-100 text-amber-700' },
  { value: 'booked',       label: 'Gebucht',          color: 'bg-violet-100 text-violet-700' },
  { value: 'posted',       label: 'Gepostet',         color: 'bg-cyan-100 text-cyan-700' },
  { value: 'completed',    label: 'Abgeschlossen',    color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',    label: 'Abgebrochen',      color: 'bg-red-100 text-red-700' },
  { value: 'blacklisted',  label: 'Blacklist',        color: 'bg-rose-200 text-rose-900' },
];

export const influencerPerformanceApi = {
  list: (q: Record<string, string | number | boolean | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    return call<{ items: PerformanceEntry[]; total: number }>(p.toString() ? `?${p.toString()}` : '');
  },
  kpis: (q: Record<string, string | number | boolean | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    return call<KpiSnapshot>(`/kpis${p.toString() ? `?${p.toString()}` : ''}`);
  },
  get: (id: string) => call<PerformanceEntry>(`/${id}`),
  create: (data: Partial<PerformanceEntry>) =>
    call<PerformanceEntry>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PerformanceEntry>) =>
    call<PerformanceEntry>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) =>
    call<{ ok: boolean }>(`/${id}`, { method: 'DELETE' }),
};
