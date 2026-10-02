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

// ---- Increment H/I: Creative Strategy (v2) ----
export type StrategyActionType =
  | 'NEW_HOOK_VARIANTS' | 'REPLACE_HOOK' | 'KEEP_HOOK_REPLACE_BODY' | 'REPLACE_BODY' | 'REPLACE_PROOF' | 'REPLACE_CTA'
  | 'BUILD_COMPONENT_COMBINATION' | 'ITERATE_WINNING_HOOK' | 'ITERATE_WINNING_BODY' | 'TEST_AWARENESS_STAGE'
  | 'RETEST_LOW_CONFIDENCE' | 'INSUFFICIENT_DATA';
export interface StratFact {
  entityType: 'ad' | 'component' | 'product_group'; entityId: string | null; entityLabel: string;
  metric: string; value: number | null; baseline: number | null; deltaPp: number | null;
  unit: 'pct' | 'pp' | 'x' | 'eur' | 'count';
}
export interface StrategyFinding { title: string; detail: string; confidence: Confidence }
export interface WinningPattern { pattern: string; detail: string; confidence: Confidence }
export interface NextTest { title: string; variable: string; detail: string }
export interface ProductionRecommendation {
  id: string; actionType: StrategyActionType; actionLabel: string; priority: 'high' | 'medium' | 'low'; title: string;
  affectedAds: { id: string; name: string }[]; affectedComponents: { code: string; type: string; name: string }[];
  keepComponents: string[]; changeComponents: string[]; suggestedComponents: string[];
  testVariable: string | null; variantCount: number | null; facts: StratFact[];
  dataConfidence: Confidence; recommendationConfidence: Confidence;
  observation: string; interpretation: string; hypothesis: string; why: string; expectedLearning: string; suggestedTest: string;
}
export interface AdComparison {
  adId: string; name: string; hookRatePct: number | null; hookClass: 'strong' | 'iteration' | 'weak' | null; hookDeltaPp: number | null;
  retention50to75: number | null; bodyDeltaPp: number | null; bodySignal: 'strong' | 'weak' | 'neutral';
  biggestDrop: { segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null } | null; confidence: Confidence;
}
export interface CombinationBlock {
  componentIds: string[]; label: 'recommended' | 'promising'; confidence: Confidence; reason: string;
  slots: { bucket: string; code: string; name: string; sourceAdName: string | null; keyMetric: number | null; keyDelta: number | null }[];
}
export interface AttentionProblem {
  adId: string; adName: string; segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null;
  overlapComponent: { code: string; type: string; name: string } | null; recommendation: string;
}
export interface CreativeHealth {
  adsAnalyzed: number; spend: string; uniqueSales: number; confidence: Confidence;
  baselineHookRatePct: number | null; baselineRetention50to75Pct: number | null;
}
export interface CreativeStrategyResult {
  version: 'v2'; executiveSummary: string; creativeHealth: CreativeHealth; creativeHealthNote: string;
  adsCompared: AdComparison[]; winningPatterns: WinningPattern[];
  hookFindings: StrategyFinding[]; bodyFindings: StrategyFinding[]; retentionFindings: StrategyFinding[];
  attentionFindings: StrategyFinding[]; dropFindings: StrategyFinding[]; componentFindings: StrategyFinding[];
  salvageOpportunities: StrategyFinding[]; awarenessFindings: StrategyFinding[]; nextTests: NextTest[];
  productionRecommendations: ProductionRecommendation[]; componentCombination: CombinationBlock | null;
  attentionProblems: AttentionProblem[]; overallConfidence: Confidence;
}

export interface Analysis {
  id: string; scopeType: 'ad' | 'product_group'; productGroupId: string | null; productGroupName: string | null;
  adId: string | null; adName: string | null; rangeLabel: string | null; provider: string | null; model: string | null;
  status: 'ok' | 'error'; confidence: Confidence | null; error: string | null;
  facts: AiAnalysisContext | null; result: (AiAnalysisResult & CreativeStrategyResult) | AiAnalysisResult | CreativeStrategyResult | null; createdAt: string | null;
}
export function isStrategy(r: Analysis['result']): r is CreativeStrategyResult {
  return !!r && (r as CreativeStrategyResult).version === 'v2';
}
export const ACTION_TYPE_LABELS: Record<StrategyActionType, string> = {
  NEW_HOOK_VARIANTS: 'Neue Hooks', REPLACE_HOOK: 'Hook ersetzen', KEEP_HOOK_REPLACE_BODY: 'Hook behalten · Body ersetzen',
  REPLACE_BODY: 'Body ersetzen', REPLACE_PROOF: 'Proof neu testen', REPLACE_CTA: 'CTA ersetzen',
  BUILD_COMPONENT_COMBINATION: 'Kombination bauen', ITERATE_WINNING_HOOK: 'Winner iterieren', ITERATE_WINNING_BODY: 'Body iterieren',
  TEST_AWARENESS_STAGE: 'Awareness vertiefen', RETEST_LOW_CONFIDENCE: 'Erneut testen', INSUFFICIENT_DATA: 'Zu wenig Daten',
};

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
    mutationFn: (ref: number | { recommendationId?: string; index?: number }) =>
      sendApi<{ ideaId: string; status: string; alreadyExisted?: boolean }>('POST', `/analyses/${analysisId}/accept`, typeof ref === 'number' ? { index: ref } : ref),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ideas'] }),
  });
}
export function useCreateRecipeFromAnalysis(analysisId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendApi<{ recipeId: string; alreadyExisted?: boolean }>('POST', `/analyses/${analysisId}/recipe`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'recipes'] }),
  });
}

export const CONF_LABELS: Record<string, string> = { low: 'Geringe', medium: 'Mittlere', high: 'Hohe' };
