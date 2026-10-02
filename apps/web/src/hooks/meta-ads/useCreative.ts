'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { PeriodRange } from './useMetaAds';

const API_BASE = `${API_URL}/api/meta-ads`;

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

export type ComponentType = 'hook' | 'body' | 'cta' | 'proof' | 'testimonial' | 'product_demo' | 'offer_section' | 'problem_section' | 'solution_section' | 'transition' | 'visual_opening' | 'voiceover' | 'b_roll';
export type OpportunityType = 'FULL_WINNER' | 'HOOK_WINNER' | 'BODY_WINNER' | 'STRONG_RETENTION' | 'WEAK_HOOK' | 'MID_VIDEO_DROP' | 'LATE_DROP' | 'TRAFFIC_PROBLEM' | 'SALVAGE_BODY' | 'SALVAGE_HOOK' | 'NEEDS_ITERATION' | 'PROMISING' | 'LOW_CONFIDENCE' | null;

export interface Confidence { level: 'low' | 'medium' | 'high'; reasons: string[] }
export interface Signal { type: string; label: string; detail: string }

export interface LabCard {
  id: string; name: string; format: string; status: string;
  productGroupName: string | null; angleName: string | null;
  metrics: { spend: number; calculatedRoas: number | null; hookRate: number | null; holdRate: number | null; retention50to75: number | null; outboundCtr: number | null; uniqueSales: number };
  confidence: Confidence; signals: Signal[]; primary: OpportunityType;
}
export interface ComponentRow {
  id: string; code: string; type: ComponentType; name: string; text: string | null;
  productGroupName: string | null; sourceAdName: string | null; sourceAdId: string | null;
  startTimeSeconds: number | null; endTimeSeconds: number | null;
  adCount: number; keyMetric: number | null; keyBaseline: number | null; keyDelta: number | null;
  confidence: Confidence; signal?: ComponentSignal; metrics: Record<string, number | null>;
}

export type ComponentSignal = 'strong' | 'iteration' | 'weak' | 'promising' | 'insufficient_data';
export const COMPONENT_SIGNAL_LABELS: Record<string, string> = {
  strong: 'Strong', iteration: 'Iteration', weak: 'Weak', promising: 'Promising', insufficient_data: 'Zu wenig Daten',
};
export interface ComponentIntelligence { productGroupId: string | null; groups: Record<string, ComponentRow[]>; items: ComponentRow[] }
export interface CreativeLabData {
  sections: { winningCreatives: LabCard[]; winningHooks: ComponentRow[]; winningBodies: ComponentRow[]; strongRetention: LabCard[]; needsIteration: LabCard[]; salvage: LabCard[]; recent: LabCard[] };
  counts: Record<string, number>;
}
export interface Overlap { overlap: boolean; overlapSeconds: number; shareOfDrop: number; shareOfComponent: number }
export interface AdComponentsData {
  biggestDrop: { segment: string; fromSeconds: number | null; toSeconds: number | null; dropPct: number } | null;
  items: (ComponentRow & { role: string | null; overlap: Overlap | null })[];
}
export interface Recipe {
  id: string; name: string; status: string; productGroupId: string | null; productGroupName: string | null; notes: string | null;
  components: { id: string; componentId: string; role: string | null; position: number; code: string | null; name: string | null; type: string | null }[];
  createdAt: string | null;
}

export function useCreativeLab(params: { productGroupId?: string; format?: string; range?: PeriodRange; start?: string; end?: string }) {
  return useQuery({ queryKey: ['meta-ads', 'creative-lab', params], queryFn: () => getApi<CreativeLabData>('/creative-lab', params as any) });
}

export function useComponents(params: { type?: string; productGroupId?: string; search?: string; range?: PeriodRange }) {
  return useQuery({ queryKey: ['meta-ads', 'components', params], queryFn: () => getApi<{ items: ComponentRow[] }>('/components', params as any) });
}
export function useComponentIntelligence(params: { productGroupId?: string; range?: PeriodRange }) {
  return useQuery({ queryKey: ['meta-ads', 'component-intelligence', params], queryFn: () => getApi<ComponentIntelligence>('/components/intelligence', params as any), enabled: !!params.productGroupId });
}
export function useComponent(id: string | null, range?: PeriodRange) {
  return useQuery({ queryKey: ['meta-ads', 'component', id, range], queryFn: () => getApi<any>(`/components/${id}`, { range }), enabled: !!id });
}
export function useCreateComponent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi<ComponentRow>('POST', '/components', body), onSuccess: () => invalidate(qc) });
}
export function useUpdateComponent(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi('PUT', `/components/${id}`, body), onSuccess: () => invalidate(qc) });
}
export function useDeleteComponent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => sendApi('DELETE', `/components/${id}`), onSuccess: () => invalidate(qc) });
}

export function useAdComponents(adId: string | null, range?: PeriodRange) {
  return useQuery({ queryKey: ['meta-ads', 'ad-components', adId, range], queryFn: () => getApi<AdComponentsData>(`/ads/${adId}/components`, { range }), enabled: !!adId });
}
export function useLinkComponent(adId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { componentId: string; role?: string }) => sendApi('POST', `/ads/${adId}/components`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-components', adId] }) });
}
export function useUnlinkComponent(adId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (componentId: string) => sendApi('DELETE', `/ads/${adId}/components/${componentId}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-components', adId] }) });
}

export function useRecipes(productGroupId?: string) {
  return useQuery({ queryKey: ['meta-ads', 'recipes', productGroupId], queryFn: () => getApi<{ items: Recipe[] }>('/recipes', { productGroupId }) });
}
export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi<Recipe>('POST', '/recipes', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'recipes'] }) });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['meta-ads', 'components'] });
  qc.invalidateQueries({ queryKey: ['meta-ads', 'creative-lab'] });
}

export const COMPONENT_TYPE_LABELS: Record<string, string> = {
  hook: 'Hook', body: 'Body', cta: 'CTA', proof: 'Proof', testimonial: 'Testimonial', product_demo: 'Product Demo',
  offer_section: 'Offer', problem_section: 'Problem', solution_section: 'Solution', transition: 'Transition',
  visual_opening: 'Visual Opening', voiceover: 'Voiceover', b_roll: 'B-Roll',
};
export const OPPORTUNITY_LABELS: Record<string, string> = {
  FULL_WINNER: 'Full Winner', HOOK_WINNER: 'Hook Winner', BODY_WINNER: 'Body Winner', STRONG_RETENTION: 'Strong Retention',
  WEAK_HOOK: 'Weak Hook', MID_VIDEO_DROP: 'Mid-Video Drop', LATE_DROP: 'Late Drop', TRAFFIC_PROBLEM: 'Traffic Problem',
  SALVAGE_BODY: 'Salvage: Body', SALVAGE_HOOK: 'Salvage: Hook', NEEDS_ITERATION: 'Needs Iteration', PROMISING: 'Promising', LOW_CONFIDENCE: 'Low Confidence',
};
