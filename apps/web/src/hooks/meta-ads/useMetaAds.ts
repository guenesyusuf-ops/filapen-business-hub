'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

const API_BASE = `${API_URL}/api/meta-ads`;

// ---------------------------------------------------------------------------
// Fetch-Helper — senden IMMER den Auth-Header (Modul ist AUTHENTICATED)
// ---------------------------------------------------------------------------

async function getApi<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function sendApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try { const j = await res.json(); if (j?.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodRange =
  | 'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'last30' | 'lifetime' | 'custom';

export type MaFormat = 'video' | 'static' | 'carousel' | 'gif' | 'ugc' | 'vsl' | 'image' | 'collection';
export type MaAwareness = 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | 'most_aware';
export type MaAdStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

export interface MetaAd {
  id: string;
  productId: string;
  name: string;
  metaAdId: string | null;
  startDate: string | null;
  format: MaFormat;
  angleId: string | null;
  angleName: string | null;
  hookText: string | null;
  awareness: MaAwareness | null;
  offerId: string | null;
  offerName: string | null;
  adLink: string | null;
  status: MaAdStatus;
  videoLengthSeconds: number | null;
  parentAdId: string | null;
  changeType: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AggregatedMetrics {
  spend: number;
  impressions: number;
  videoViews3s: number;
  videoViews25: number;
  videoViews50: number;
  videoViews75: number;
  videoViews95: number;
  videoViews100: number;
  thruplays: number;
  totalSales: number;
  uniqueSales: number;
  revenue: number;
  cpaUnique: number | null;
  cpaTotal: number | null;
  calculatedRoas: number | null;
  hyrosRoas: null;
  hookRate: number | null;
  holdRate: number | null;
  ctrAll: number | null;
  outboundCtr: number | null;
  cpcAll: number | null;
  averageWatchTimeSeconds: number | null;
  retention25to50: number | null;
  retention50to75: number | null;
  retention75to95: number | null;
  retention95to100: number | null;
  completion25to100: number | null;
  drop25to50: number | null;
  drop50to75: number | null;
  drop75to95: number | null;
  drop95to100: number | null;
  dataPoints: number;
}

export interface DerivedRowMetrics {
  cpaUnique: number | null;
  cpaTotal: number | null;
  calculatedRoas: number | null;
  watchPercentage: number | null;
  retention25to50: number | null;
  retention50to75: number | null;
  retention75to95: number | null;
  retention95to100: number | null;
  completion25to100: number | null;
  drop25to50: number | null;
  drop50to75: number | null;
  drop75to95: number | null;
  drop95to100: number | null;
}

export interface DailyMetric {
  id: string;
  adId: string;
  date: string;
  spend: number | null;
  impressions: number | null;
  hookRate: number | null;
  holdRate: number | null;
  videoViews3s: number | null;
  videoViews25: number | null;
  videoViews50: number | null;
  videoViews75: number | null;
  videoViews95: number | null;
  videoViews100: number | null;
  thruplays: number | null;
  averageWatchTimeSeconds: number | null;
  cpcAll: number | null;
  ctrAll: number | null;
  outboundCtr: number | null;
  totalSales: number | null;
  uniqueSales: number | null;
  hyrosRoas: number | null;
  revenue: number | null;
}

export interface Period { from?: string; to?: string; range: PeriodRange }
export interface AdWithMetrics extends MetaAd { metrics: AggregatedMetrics }
export interface NamedRef { id: string; name: string }
export interface ProductRef { id: string; title: string }

export interface AdListParams {
  productId?: string;
  format?: string;
  angleId?: string;
  offerId?: string;
  status?: string;
  search?: string;
  range?: PeriodRange;
  start?: string;
  end?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useMetaProducts() {
  return useQuery({
    queryKey: ['meta-ads', 'products'],
    queryFn: () => getApi<{ items: ProductRef[] }>('/products'),
  });
}

export function useMetaAngles() {
  return useQuery({
    queryKey: ['meta-ads', 'angles'],
    queryFn: () => getApi<{ items: NamedRef[] }>('/angles'),
  });
}

export function useMetaOffers() {
  return useQuery({
    queryKey: ['meta-ads', 'offers'],
    queryFn: () => getApi<{ items: NamedRef[] }>('/offers'),
  });
}

export function useMetaOverview(params: { productId?: string; range?: PeriodRange; start?: string; end?: string }) {
  return useQuery({
    queryKey: ['meta-ads', 'overview', params],
    queryFn: () =>
      getApi<{ kpis: AggregatedMetrics; counts: Record<string, number>; period: Period }>('/overview', {
        productId: params.productId,
        range: params.range,
        start: params.start,
        end: params.end,
      }),
  });
}

export function useMetaAdsList(params: AdListParams) {
  return useQuery({
    queryKey: ['meta-ads', 'ads', params],
    queryFn: () =>
      getApi<{ items: AdWithMetrics[]; total: number; page: number; pageSize: number; totalPages: number; period: Period }>(
        '/ads',
        {
          productId: params.productId,
          format: params.format,
          angleId: params.angleId,
          offerId: params.offerId,
          status: params.status,
          search: params.search,
          range: params.range,
          start: params.start,
          end: params.end,
          page: params.page ? String(params.page) : undefined,
          pageSize: params.pageSize ? String(params.pageSize) : undefined,
        },
      ),
  });
}

export function useMetaAd(id: string | null) {
  return useQuery({
    queryKey: ['meta-ads', 'ad', id],
    queryFn: () => getApi<MetaAd & { angleName: string | null; offerName: string | null }>(`/ads/${id}`),
    enabled: !!id,
  });
}

export function useMetaAdMetrics(id: string | null, params: { range?: PeriodRange; start?: string; end?: string }) {
  return useQuery({
    queryKey: ['meta-ads', 'ad-metrics', id, params],
    queryFn: () =>
      getApi<{
        items: (DailyMetric & { derived: DerivedRowMetrics })[];
        aggregate: AggregatedMetrics;
        videoLengthSeconds: number | null;
        period: Period;
      }>(`/ads/${id}/metrics`, { range: params.range, start: params.start, end: params.end }),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<MetaAd>) => sendApi<MetaAd>('POST', '/ads', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
    },
  });
}

export function useUpdateAd(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<MetaAd>) => sendApi<MetaAd>('PUT', `/ads/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ad', id] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
    },
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendApi<{ ok: boolean }>('DELETE', `/ads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
    },
  });
}

export function useUpsertMetric(adId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<DailyMetric> & { date: string }) =>
      sendApi<{ metric: DailyMetric; warnings: string[] }>('POST', `/ads/${adId}/metrics`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-metrics', adId] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
    },
  });
}

export function useDeleteMetric(adId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => sendApi<{ ok: boolean }>('DELETE', `/ads/${adId}/metrics/${date}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-metrics', adId] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
    },
  });
}

export function useCreateAngle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sendApi<NamedRef>('POST', '/angles', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'angles'] }),
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sendApi<NamedRef>('POST', '/offers', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'offers'] }),
  });
}

// ---------------------------------------------------------------------------
// Konstanten für die UI (Labels)
// ---------------------------------------------------------------------------

export const FORMAT_LABELS: Record<MaFormat, string> = {
  video: 'Video', static: 'Static', carousel: 'Carousel', gif: 'GIF',
  ugc: 'UGC', vsl: 'VSL', image: 'Image', collection: 'Collection',
};
export const AWARENESS_LABELS: Record<MaAwareness, string> = {
  unaware: 'Unaware', problem_aware: 'Problem Aware', solution_aware: 'Solution Aware',
  product_aware: 'Product Aware', most_aware: 'Most Aware',
};
export const STATUS_LABELS: Record<MaAdStatus, string> = {
  draft: 'Entwurf', active: 'Aktiv', paused: 'Pausiert', ended: 'Beendet', archived: 'Archiviert',
};
export const RANGE_LABELS: Record<PeriodRange, string> = {
  today: 'Heute', yesterday: 'Gestern', last3: 'Letzte 3 Tage', last7: 'Letzte 7 Tage',
  last14: 'Letzte 14 Tage', last30: 'Letzte 30 Tage', lifetime: 'Lifetime', custom: 'Benutzerdefiniert',
};
