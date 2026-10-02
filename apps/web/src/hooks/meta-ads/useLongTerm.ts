'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { Confidence } from './useAiInsights';

const BASE = `${API_URL}/api/meta-ads/long-term`;

async function getJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: getAuthHeaders(), body: form });
  if (!res.ok) { let m = `API error: ${res.status}`; try { const j = await res.json(); if (j?.message) m = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* */ } throw new Error(m); }
  return res.json();
}
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(body) });
  if (!res.ok) { let m = `API error: ${res.status}`; try { const j = await res.json(); if (j?.message) m = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* */ } throw new Error(m); }
  return res.json();
}

export type SegmentKey = 'opening' | 'early' | 'mid_a' | 'mid_b' | 'late' | 'ending';
export const SEGMENT_LABELS: Record<SegmentKey, string> = { opening: 'Hook', early: '3→25%', mid_a: '25→50%', mid_b: '50→75%', late: '75→95%', ending: '95→100%' };
export const SEGMENT_ORDER: SegmentKey[] = ['opening', 'early', 'mid_a', 'mid_b', 'late', 'ending'];

export interface LtPreviewRow {
  rowIndex: number; metaAdId: string | null; adName: string | null; values: Record<string, number>;
  matchedAdId: string | null; matchedAdName: string | null; matchedBy: 'id' | 'name' | null;
  otherProduct: boolean; status: 'ready' | 'unmatched' | 'other_product' | 'invalid'; errors: string[];
}
export interface LtPreview {
  detectedType: 'historical' | 'daily'; periodStart: string | null; periodEnd: string | null; spanDays: number | null; uniqueAds: number;
  mapping: Record<string, string | null>; unmapped: string[]; rows: LtPreviewRow[];
  summary: { total: number; ready: number; unmatched: number; otherProduct: number; invalid: number; withSpend: number; withPurchases: number; withCheckpoints: number; withHookHold: number; matchedExisting: number };
  productGroupId: string;
}

export interface LtFact { adId: string; adName: string; metric: string; value: number | null }
export interface HistoricalControl { adId: string; name: string; spend: number | null; impressions: number | null; purchases: number | null; metaRoas: number | null; hookRate: number | null; confidence: Confidence; reasons: string[]; weaknesses: string[] }
export interface SegmentWinner { segment: SegmentKey; segmentLabel: string; adId: string; adName: string; retention: number | null; drop: number | null; startViewers: number; endViewers: number; confidence: Confidence; relativeRank: number; baselineDelta: number | null; startSecond: number | null; endSecond: number | null }
export interface ConversionWinner { adId: string; name: string; purchases: number | null; metaRoas: number | null; spend: number | null; hookRate: number | null; hookClass: string | null; confidence: Confidence }
export interface SalvageOpportunity { adId: string; name: string; hookRate: number | null; purchases: number | null; metaRoas: number | null; reason: string }
export interface MatrixRow { adId: string; name: string; hookRate: number | null; segmentRetention: Partial<Record<SegmentKey, number | null>>; outboundCtr: number | null; purchases: number | null; spend: number | null; metaRoas: number | null; confidence: Confidence }
export interface LtNextTest {
  id: string; recommendationType: string; priority: 'high' | 'medium' | 'low'; confidence: Confidence;
  baseAdId: string; baseAdName: string; sourceAdId: string | null; sourceAdName: string | null;
  changeSegment: SegmentKey | null; changeLabel: string; keepSegments: SegmentKey[]; keepLabels: string[];
  sourceStartPercent: number | null; sourceEndPercent: number | null; approximateStartSecond: number | null; approximateEndSecond: number | null;
  facts: LtFact[]; reason: string; title: string; why: string; hypothesis: string; expectedLearning: string; recommendationConfidence: Confidence;
}
export interface LtResult {
  version: 'lt-v1'; executiveSummary: string;
  historicalHealth: { adsAnalyzed: number; spend: string; impressions: number; purchases: number; periodStart: string | null; periodEnd: string | null; confidence: Confidence };
  historicalHealthNote: string;
  historicalControls: HistoricalControl[]; segmentWinners: SegmentWinner[];
  topOpenings: SegmentWinner[]; strongEarlySections: SegmentWinner[]; strongMidSections: SegmentWinner[]; strongLateSections: SegmentWinner[]; strongEndings: SegmentWinner[];
  conversionWinners: ConversionWinner[]; salvageOpportunities: SalvageOpportunity[]; weakAds: { adId: string; name: string; reasons: string[] }[];
  segmentMatrix: MatrixRow[];
  distribution: { hookRate: { median: number | null; p90: number | null }; outboundCtr: { median: number | null; p90: number | null }; purchases: { median: number | null; p90: number | null }; costPerPurchase: { median: number | null; p90: number | null } };
  attentionFindings: { title: string; detail: string; confidence: Confidence }[];
  recombinationCandidates: LtNextTest[]; nextProductionBatch: LtNextTest[];
  overallConfidence: Confidence;
}
export interface LtReview {
  id: string; productGroupId: string | null; productGroupName: string | null; periodStart: string | null; periodEnd: string | null;
  sourceFilename: string | null; sourceType: string | null; status: 'ok' | 'error' | 'pending'; confidence: Confidence | null;
  provider: string | null; model: string | null; error: string | null; adCount: number | null; createdAt: string | null;
  facts: any; result: LtResult | null;
}

export function useLtPreview() {
  return useMutation({
    mutationFn: ({ file, productGroupId, mapping }: { file: File; productGroupId: string; mapping?: Record<string, string | null> }) => {
      const fd = new FormData(); fd.append('file', file); fd.append('productGroupId', productGroupId);
      if (mapping) fd.append('mapping', JSON.stringify(mapping));
      return postForm<LtPreview>('/preview', fd);
    },
  });
}
export function useLtRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, productGroupId, mapping }: { file: File; productGroupId: string; mapping?: Record<string, string | null> }) => {
      const fd = new FormData(); fd.append('file', file); fd.append('productGroupId', productGroupId);
      if (mapping) fd.append('mapping', JSON.stringify(mapping));
      return postForm<LtReview>('/run', fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'lt-reviews'] }),
  });
}
export function useLtReviews(productGroupId?: string) {
  return useQuery({ queryKey: ['meta-ads', 'lt-reviews', productGroupId], queryFn: () => getJson<{ items: LtReview[] }>('/reviews', { productGroupId }) });
}
export function useLtReview(id: string | null) {
  return useQuery({ queryKey: ['meta-ads', 'lt-review', id], queryFn: () => getJson<LtReview>(`/reviews/${id}`), enabled: !!id });
}
export function useLtAccept(reviewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) => postJson<{ ideaId: string; status: string; alreadyExisted?: boolean }>(`/reviews/${reviewId}/accept`, { recommendationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ideas'] }),
  });
}
