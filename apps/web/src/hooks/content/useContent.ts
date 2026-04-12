'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentPiece {
  id: string;
  orgId: string;
  type: string;
  title: string;
  body: string;
  platform: string | null;
  status: string;
  brandVoiceId: string | null;
  brandVoiceName: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  tags: string[];
  rating: number | null;
  campaign: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentStats {
  total: number;
  published: number;
  aiGenerated: number;
  templates: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface ContentListParams {
  search?: string;
  type?: string;
  status?: string;
  platform?: string;
  campaign?: string;
  aiGenerated?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GenerateContentDto {
  type: string;
  language?: string;
  product?: string;
  productDescription?: string;
  keyBenefits?: string;
  pricePoint?: string;
  usps?: string;
  audience?: string;
  targetPersona?: string;
  painPoints?: string;
  desiresGoals?: string;
  awarenessLevel?: string;
  funnelStage?: string;
  competitorNames?: string;
  keyDifferentiators?: string;
  angle?: string;
  emotionalTrigger?: string;
  ctaType?: string;
  tone?: string;
  bestPerformingHook?: string;
  topCompetitorAdCopy?: string;
  marketInsights?: string;
  brandVoiceId?: string;
  count?: number;
  useEmojis?: boolean;
  headlineRequirements?: string;
  primaryTextRequirements?: string;
  linkDescriptionRequirements?: string;
  ctaRequirements?: string;
  headlineCount?: number;
  primaryTextCount?: number;
  linkDescriptionCount?: number;
  ctaCount?: number;
}

export interface GeneratedItem {
  type: string;
  title: string;
  body: string;
  framework: string;
  platform: string;
  tone: string;
  wordCount: number;
  charCount: number;
  aiGenerated: boolean;
  aiModel: string;
}

export interface AngleSuggestion {
  name: string;
  description: string;
  emotion: string;
  bestFor: string;
  example: string;
}

export interface GenerateContentResult {
  items: GeneratedItem[];
  angles?: AngleSuggestion[];
  meta?: {
    totalGenerated: number;
    frameworks: string[];
    language: string;
  };
}

// ---------------------------------------------------------------------------
// Content type / status constants
// ---------------------------------------------------------------------------

export const CONTENT_TYPES = [
  'headline',
  'primary_text',
  'ugc_script',
  'video_concept',
  'hook',
  'cta',
  'brief',
  'landing_page',
  'social_caption',
] as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  headline: 'Headline',
  primary_text: 'Primary Text',
  ugc_script: 'UGC Script',
  video_concept: 'Video Concept',
  hook: 'Hook',
  cta: 'CTA',
  brief: 'Brief',
  landing_page: 'Landing Page',
  social_caption: 'Social Caption',
};

export const CONTENT_TYPE_COLORS: Record<string, string> = {
  headline: 'bg-orange-100 text-orange-700',
  primary_text: 'bg-blue-100 text-blue-700',
  ugc_script: 'bg-purple-100 text-purple-700',
  video_concept: 'bg-pink-100 text-pink-700',
  hook: 'bg-amber-100 text-amber-700',
  cta: 'bg-green-100 text-green-700',
  brief: 'bg-gray-100 text-gray-700',
  landing_page: 'bg-cyan-100 text-cyan-700',
  social_caption: 'bg-indigo-100 text-indigo-700',
};

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
};

export const CONTENT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-gray-50 text-gray-400',
};

export const PLATFORMS = ['meta', 'google', 'tiktok', 'universal'] as const;

export const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  universal: 'Universal',
};

export const ANGLES = ['AIDA', 'PAS', 'BAB', 'Story', '4P', 'Before-After', 'Social Proof', 'Authority', 'Urgency', 'Curiosity'] as const;

export const FRAMEWORK_LABELS: Record<string, string> = {
  AIDA: 'AIDA',
  PAS: 'PAS',
  BAB: 'BAB',
  Story: 'Story',
  '4P': '4P',
  pattern_interrupt: 'Pattern Interrupt',
  question: 'Question',
  statistic: 'Statistic',
  curiosity_gap: 'Curiosity Gap',
  social_proof: 'Social Proof',
  urgency_scarcity: 'Urgency',
  benefit_led: 'Benefit-Led',
  pain_point: 'Pain Point',
  transformation: 'Transformation',
  authority: 'Authority',
  urgency: 'Urgency',
  benefit: 'Benefit',
  fomo: 'FOMO',
  guarantee: 'Guarantee',
  exclusive: 'Exclusive',
  command: 'Command',
  trend: 'Trend',
  curiosity: 'Curiosity',
  direct: 'Direct',
  pov: 'POV',
};

export const FRAMEWORK_COLORS: Record<string, string> = {
  AIDA: 'bg-blue-100 text-blue-700',
  PAS: 'bg-red-100 text-red-700',
  BAB: 'bg-emerald-100 text-emerald-700',
  Story: 'bg-purple-100 text-purple-700',
  '4P': 'bg-amber-100 text-amber-700',
  pattern_interrupt: 'bg-rose-100 text-rose-700',
  question: 'bg-sky-100 text-sky-700',
  statistic: 'bg-teal-100 text-teal-700',
  curiosity_gap: 'bg-violet-100 text-violet-700',
  social_proof: 'bg-lime-100 text-lime-700',
  urgency_scarcity: 'bg-orange-100 text-orange-700',
  benefit_led: 'bg-cyan-100 text-cyan-700',
  pain_point: 'bg-pink-100 text-pink-700',
  transformation: 'bg-indigo-100 text-indigo-700',
  authority: 'bg-slate-100 text-slate-700',
  urgency: 'bg-orange-100 text-orange-700',
  benefit: 'bg-cyan-100 text-cyan-700',
  fomo: 'bg-red-100 text-red-600',
  guarantee: 'bg-green-100 text-green-700',
  exclusive: 'bg-amber-100 text-amber-700',
  command: 'bg-gray-100 text-gray-700',
  trend: 'bg-fuchsia-100 text-fuchsia-700',
  curiosity: 'bg-violet-100 text-violet-700',
  direct: 'bg-gray-100 text-gray-700',
  pov: 'bg-pink-100 text-pink-700',
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function putApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function deleteApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock data (fallback)
// ---------------------------------------------------------------------------

const MOCK_STATS: ContentStats = {
  total: 30,
  published: 12,
  aiGenerated: 18,
  templates: 15,
  byType: [
    { type: 'headline', count: 8 },
    { type: 'primary_text', count: 6 },
    { type: 'ugc_script', count: 5 },
    { type: 'hook', count: 4 },
    { type: 'video_concept', count: 3 },
    { type: 'social_caption', count: 2 },
    { type: 'cta', count: 2 },
  ],
  byStatus: [
    { status: 'published', count: 12 },
    { status: 'approved', count: 7 },
    { status: 'in_review', count: 4 },
    { status: 'draft', count: 5 },
    { status: 'archived', count: 2 },
  ],
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useContentList(params: ContentListParams = {}) {
  return useQuery<PaginatedResponse<ContentPiece>>({
    queryKey: ['content', 'list', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.search) queryParams.search = params.search;
      if (params.type && params.type !== 'all') queryParams.type = params.type;
      if (params.status && params.status !== 'all') queryParams.status = params.status;
      if (params.platform && params.platform !== 'all') queryParams.platform = params.platform;
      if (params.campaign) queryParams.campaign = params.campaign;
      if (params.aiGenerated !== undefined) queryParams.aiGenerated = String(params.aiGenerated);
      if (params.sortBy) queryParams.sortBy = params.sortBy;
      if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
      if (params.page) queryParams.page = String(params.page);
      if (params.pageSize) queryParams.pageSize = String(params.pageSize);

      return await fetchApi<PaginatedResponse<ContentPiece>>(
        `${API_BASE}/content`,
        queryParams,
      );
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useContentPiece(id: string | undefined) {
  return useQuery<ContentPiece>({
    queryKey: ['content', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      return await fetchApi<ContentPiece>(`${API_BASE}/content/${id}`);
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useContentStats() {
  return useQuery<ContentStats>({
    queryKey: ['content', 'stats'],
    queryFn: async () => {
      try {
        return await fetchApi<ContentStats>(`${API_BASE}/content/stats`);
      } catch {
        return MOCK_STATS;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ContentPiece>) => {
      return postApi<ContentPiece>('/content', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContentPiece> }) => {
      return putApi<ContentPiece>(`/content/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useDeleteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return deleteApi(`/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (data: GenerateContentDto) => {
      return postApi<GenerateContentResult>('/content/generate', data);
    },
  });
}
