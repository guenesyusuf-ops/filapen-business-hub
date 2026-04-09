'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Brand {
  id: string;
  orgId: string;
  name: string;
  category: string | null;
  logoUrl: string | null;
  website: string | null;
  channels: string[];
  competitors: string[];
  totalMentions: number;
  totalInfluencers: number;
  createdAt: string;
}

export interface BrandDetail extends Brand {
  totalReach: number;
  avgEngagement: number;
  typeBreakdown: {
    organic: number;
    paid: number;
    link: number;
    affiliate: number;
  };
  timeline: {
    month: string;
    organic: number;
    paid: number;
    link: number;
    affiliate: number;
  }[];
  topInfluencers: BrandInfluencer[];
}

export interface BrandInfluencer {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  followerCount: number;
  engagementRate: number;
  avatarUrl: string | null;
  isVerified: boolean;
  brandedContentPct: number | null;
  niche: string | null;
  score?: number;
  totalMentions: number;
  mentionTypes?: string[];
  firstMention?: string;
  lastMention?: string;
}

export interface BrandTimeline {
  brandId: string;
  brandName: string;
  influencers: {
    id: string;
    name: string;
    handle: string;
    platform: string;
    points: {
      date: string;
      type: string;
      engagementRate: number | null;
      estimatedReach: number | null;
      postUrl: string | null;
    }[];
  }[];
}

export interface CompetitorOverlap {
  competitors: {
    competitor: { id: string; name: string; category: string | null };
    overlapCount: number;
    influencers: {
      id: string;
      displayName: string;
      handle: string;
      platform: string;
      followerCount: number;
      engagementRate: number;
      avatarUrl: string | null;
      isVerified: boolean;
    }[];
  }[];
}

export interface InfluencerBrandRelation {
  brand: {
    id: string;
    name: string;
    category: string | null;
    logoUrl: string | null;
  };
  totalMentions: number;
  mentionTypes: string[];
  firstMention: string;
  lastMention: string;
  mentions: {
    id: string;
    type: string;
    platform: string;
    mentionDate: string;
    engagementRate: number | null;
    estimatedReach: number | null;
    postUrl: string | null;
  }[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api';

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API error: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBrands(search?: string, category?: string) {
  return useQuery<Brand[]>({
    queryKey: ['brands', 'list', search, category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      return fetchApi<Brand[]>(`${API_BASE}/brands`, params);
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useBrandDetail(id: string | undefined) {
  return useQuery<BrandDetail>({
    queryKey: ['brands', 'detail', id],
    enabled: !!id,
    queryFn: () => fetchApi<BrandDetail>(`${API_BASE}/brands/${id}`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useBrandInfluencers(id: string | undefined) {
  return useQuery<BrandInfluencer[]>({
    queryKey: ['brands', 'influencers', id],
    enabled: !!id,
    queryFn: () => fetchApi<BrandInfluencer[]>(`${API_BASE}/brands/${id}/influencers`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useBrandTimeline(id: string | undefined) {
  return useQuery<BrandTimeline>({
    queryKey: ['brands', 'timeline', id],
    enabled: !!id,
    queryFn: () => fetchApi<BrandTimeline>(`${API_BASE}/brands/${id}/timeline`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useBrandCompetitors(id: string | undefined) {
  return useQuery<CompetitorOverlap>({
    queryKey: ['brands', 'competitors', id],
    enabled: !!id,
    queryFn: () => fetchApi<CompetitorOverlap>(`${API_BASE}/brands/${id}/competitors`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useInfluencerBrands(influencerId: string | undefined) {
  return useQuery<InfluencerBrandRelation[]>({
    queryKey: ['influencers', 'brands', influencerId],
    enabled: !!influencerId,
    queryFn: () => fetchApi<InfluencerBrandRelation[]>(`${API_BASE}/influencers/${influencerId}/brands`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category?: string; website?: string; channels?: string[]; competitors?: string[] }) =>
      postApi<Brand>('/brands', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}
