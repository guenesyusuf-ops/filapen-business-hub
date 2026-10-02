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

export type IdeaSource = 'manual' | 'ai';
export type IdeaType = 'new' | 'iteration';
export type IdeaStatus = 'draft' | 'approved' | 'in_production' | 'shipped' | 'archived';

export interface IdeaRow {
  id: string; title: string; ideaType: IdeaType; source: IdeaSource; status: IdeaStatus;
  productGroupId: string | null; productGroupName: string | null;
  basedOnAdId: string | null; basedOnAdName: string | null; opportunityType: string | null;
  componentCount: number; taskCount: number; createdAt: string | null;
}
export interface IdeaComponentRef { id: string; componentId: string; role: string | null; position: number; code: string | null; name: string | null; type: string | null; startTimeSeconds: number | null; endTimeSeconds: number | null }
export interface IdeaTaskRef { id: string; wmTaskId: string; title: string | null; createdAt: string | null }
export interface IdeaDetail extends IdeaRow {
  body: string | null; angleId: string | null; angleName: string | null; awareness: string | null;
  offerId: string | null; offerName: string | null; recipeId: string | null; recipeName: string | null;
  rationale: string | null; aiModel: string | null; components: IdeaComponentRef[]; tasks: IdeaTaskRef[];
}
export interface IdeaSeed {
  basedOnAdId: string; basedOnAdName: string; productGroupName: string | null; ideaType: 'iteration';
  opportunityType: string; title: string; rationale: string; suggestedRole: 'hook' | 'body' | 'cta' | null; alreadyHasIdea: boolean;
}

export function useIdeas(params: { status?: string; source?: string; type?: string; productGroupId?: string; search?: string }) {
  return useQuery({ queryKey: ['meta-ads', 'ideas', params], queryFn: () => getApi<{ items: IdeaRow[] }>('/ideas', params as any) });
}
export function useIdea(id: string | null) {
  return useQuery({ queryKey: ['meta-ads', 'idea', id], queryFn: () => getApi<IdeaDetail>(`/ideas/${id}`), enabled: !!id });
}
export function useIdeaSuggestions(params: { productGroupId?: string; range?: PeriodRange; start?: string; end?: string }) {
  return useQuery({ queryKey: ['meta-ads', 'idea-suggestions', params], queryFn: () => getApi<{ items: IdeaSeed[] }>('/ideas/suggestions', params as any) });
}
export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi<IdeaDetail>('POST', '/ideas', body), onSuccess: () => invalidate(qc) });
}
export function useUpdateIdea(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => sendApi('PUT', `/ideas/${id}`, body), onSuccess: () => { invalidate(qc); qc.invalidateQueries({ queryKey: ['meta-ads', 'idea', id] }); } });
}
export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => sendApi('DELETE', `/ideas/${id}`), onSuccess: () => invalidate(qc) });
}
export function useCreateTaskFromIdea(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body?: { projectId?: string; columnId?: string }) => sendApi<{ taskId: string; alreadyLinked?: boolean }>('POST', `/ideas/${id}/task`, body ?? {}), onSuccess: () => { invalidate(qc); qc.invalidateQueries({ queryKey: ['meta-ads', 'idea', id] }); } });
}
export function useCreateTaskFromRecipe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recipeId: string) => sendApi<{ taskId: string; alreadyLinked?: boolean }>('POST', `/recipes/${recipeId}/task`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta-ads', 'recipes'] }) });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['meta-ads', 'ideas'] });
  qc.invalidateQueries({ queryKey: ['meta-ads', 'idea-suggestions'] });
}

export const IDEA_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf', approved: 'Freigegeben', in_production: 'In Produktion', shipped: 'Live', archived: 'Archiviert',
};
export const IDEA_STATUS_FLOW: IdeaStatus[] = ['draft', 'approved', 'in_production', 'shipped', 'archived'];
export const IDEA_SOURCE_LABELS: Record<string, string> = { manual: 'Manuell', ai: 'KI' };
export const IDEA_TYPE_LABELS: Record<string, string> = { new: 'Neu', iteration: 'Iteration' };
