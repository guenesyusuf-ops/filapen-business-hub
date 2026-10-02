'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { PeriodRange } from './useMetaAds';

const API_BASE = `${API_URL}/api/meta-ads/ai`;

async function getApi<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
async function sendApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) { let m = `API error: ${res.status}`; try { const j = await res.json(); if (j?.message) m = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* */ } throw new Error(m); }
  return res.json();
}

export type Confidence = 'low' | 'medium' | 'high';
export interface AiFact { label: string; value: string }
export interface AiStatement { text: string; confidence: Confidence }
export interface AiRecommendation { title: string; action: string; suggestedTest: string; confidence: Confidence; componentHint?: string | null }
export interface AiContextComponent { code: string; type: string; name: string; keyMetric?: string | null; keyDelta?: string | null }
export interface AiAnalysisContext {
  scopeType: 'ad' | 'product_group'; productGroupName?: string | null; adName?: string | null; periodLabel: string;
  confidenceLevel: Confidence; confidenceReasons: string[];
  facts: AiFact[]; baselines: AiFact[];
  retention?: { segment: string; retentionPct: number; dropPct: number }[];
  biggestDrop?: { segment: string; fromSeconds?: number | null; toSeconds?: number | null; dropPct: number } | null;
  signals: { opportunityType: string; label: string; detail: string }[];
  components: AiContextComponent[]; dataVolumeLow: boolean;
}
export interface AiAnalysisResult {
  summary: string; observations: AiStatement[]; interpretations: AiStatement[]; hypotheses: AiStatement[];
  recommendations: AiRecommendation[]; overallConfidence: Confidence;
}
export interface Analysis {
  id: string; scopeType: 'ad' | 'product_group'; productGroupId: string | null; productGroupName: string | null;
  adId: string | null; adName: string | null; rangeLabel: string | null; provider: string | null; model: string | null;
  status: 'ok' | 'error'; confidence: Confidence | null; error: string | null;
  facts: AiAnalysisContext | null; result: AiAnalysisResult | null; createdAt: string | null;
}

export function useAnalyses(params: { scopeType?: string; productGroupId?: string; adId?: string }) {
  return useQuery({ queryKey: ['meta-ads', 'ai-analyses', params], queryFn: () => getApi<{ items: Analysis[] }>('/analyses', params as any) });
}
export function useAnalysis(id: string | null) {
  return useQuery({ queryKey: ['meta-ads', 'ai-analysis', id], queryFn: () => getApi<Analysis>(`/analyses/${id}`), enabled: !!id });
}
export function useAnalyze() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi<Analysis>('POST', '/analyze', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ai-analyses'] }) });
}
export function useAcceptRecommendation(analysisId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (index: number) => sendApi<{ ideaId: string; status: string }>('POST', `/analyses/${analysisId}/accept`, { index }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ideas'] }),
  });
}

export const CONF_LABELS: Record<string, string> = { low: 'Geringe', medium: 'Mittlere', high: 'Hohe' };
