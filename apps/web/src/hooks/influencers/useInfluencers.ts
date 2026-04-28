'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InfluencerProfile {
  id: string;
  orgId: string;
  platform: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number | null;
  niche: string | null;
  location: string | null;
  language: string | null;
  isVerified: boolean;
  email: string | null;
  websiteUrl: string | null;
  audienceCountry: { country: string; pct: number }[] | null;
  audienceAge: { range: string; pct: number }[] | null;
  audienceGender: { male: number; female: number; other: number } | null;
  score: number;
  tags: string[];
  brandedContentPct: number | null;
  estimatedMediaValue: number | null;
  growthRate: number | null;
  postingFrequency: string | null;
  contentCategories: string[];
  brandFitScore: number | null;
  createdAt: string;
  updatedAt: string;
  // Populated on detail
  watchlists?: { watchlistId: string; watchlistName: string; addedAt: string }[];
}

export interface InfluencerStats {
  total: number;
  avgEngagementRate: number;
  avgScore: number;
  avgFollowers: number;
  topPlatform: string;
  watchlistCount: number;
  byPlatform: { platform: string; count: number; avgEngagement: number }[];
  byNiche: { niche: string; count: number }[];
  topInfluencers: InfluencerProfile[];
}

export interface InfluencerListParams {
  search?: string;
  platform?: string;
  niche?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxEngagement?: number;
  location?: string;
  hasEmail?: boolean;
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

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

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

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useInfluencers(params: InfluencerListParams = {}) {
  return useQuery<PaginatedResponse<InfluencerProfile>>({
    queryKey: ['influencers', 'list', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.search) queryParams.search = params.search;
      if (params.platform && params.platform !== 'all') queryParams.platform = params.platform;
      if (params.niche && params.niche !== 'all') queryParams.niche = params.niche;
      if (params.minFollowers !== undefined) queryParams.minFollowers = String(params.minFollowers);
      if (params.maxFollowers !== undefined) queryParams.maxFollowers = String(params.maxFollowers);
      if (params.minEngagement !== undefined) queryParams.minEngagement = String(params.minEngagement);
      if (params.maxEngagement !== undefined) queryParams.maxEngagement = String(params.maxEngagement);
      if (params.location) queryParams.location = params.location;
      if (params.hasEmail) queryParams.hasEmail = 'true';
      if (params.sortBy) queryParams.sortBy = params.sortBy;
      if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
      if (params.page) queryParams.page = String(params.page);
      if (params.pageSize) queryParams.pageSize = String(params.pageSize);

      return fetchApi<PaginatedResponse<InfluencerProfile>>(
        `${API_BASE}/influencers`,
        queryParams,
      );
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useInfluencer(id: string | undefined) {
  return useQuery<InfluencerProfile>({
    queryKey: ['influencers', 'detail', id],
    enabled: !!id,
    queryFn: () => fetchApi<InfluencerProfile>(`${API_BASE}/influencers/${id}`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useInfluencerStats() {
  return useQuery<InfluencerStats>({
    queryKey: ['influencers', 'stats'],
    queryFn: () => fetchApi<InfluencerStats>(`${API_BASE}/influencers/stats`),
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Phyllo Discovery — live search gegen InsightIQ
// ---------------------------------------------------------------------------

/**
 * Phyllo-Profil aus dem Discovery-Endpoint. Hat eine andere Form als unser
 * lokales InfluencerProfile — daher eigener Type. UI mappt beide vor Render.
 */
export interface PhylloProfile {
  work_platform: { id: string; name: string; logo_url: string };
  platform_username: string;
  external_id: string | null;
  url: string | null;
  image_url: string | null;
  full_name: string | null;
  introduction: string | null;
  is_verified: boolean;
  platform_account_type: string | null;
  gender: string | null;
  age_group: string | null;
  language: string | null;
  follower_count: number;
  subscriber_count: number | null;
  engagement_rate: number;
  average_likes: number | null;
  average_views: number | null;
  creator_location: { country?: string; city?: string } | null;
  contact_details: { type: string; value: string }[] | null;
}

/**
 * Flache typisierte Filter — Backend transformiert in Phyllo-Schema.
 * Frontend MUSS NICHT wissen wie z.B. engagement_rate.percentage_value
 * verschachtelt sein soll. Felder weglassen wenn nicht aktiv (kein null,
 * kein undefined explizit setzen — Backend ignoriert sowieso).
 */
export interface PhylloDiscoveryFilters {
  followerMin?: number;
  followerMax?: number;
  engagementMin?: number;
  engagementMax?: number;
  brandSponsors?: string[];
  countries?: string[];
  keywords?: string;
}

export interface PhylloSearchParams {
  platform?: 'instagram' | 'tiktok';
  sort?: 'followers' | 'engagement' | 'avg_likes';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  filters?: PhylloDiscoveryFilters;
}

import { getAuthHeaders } from '@/stores/auth';

/**
 * Phyllo-Search-Hook mit Quota-Schutz auf Frontend-Seite:
 * - retry: false → ein 400/429-Error wird NICHT in Schleifen wiederholt
 *   (das würde Phyllo-Credits verbrennen)
 * - structuredError gibt 429-Quota-Errors als typed Error zurück damit UI
 *   eine spezifische Meldung zeigen kann
 *
 * Das Backend cached + dedupliziert + rate-limitet bereits — der Hook
 * fügt nur die Frontend-Seite des Schutzes hinzu (kein Auto-Retry).
 */
export class PhylloSearchError extends Error {
  status: number;
  isQuotaError: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isQuotaError = status === 429;
  }
}

export function usePhylloSearch() {
  return useMutation<{ data: PhylloProfile[]; metadata?: any }, PhylloSearchError, PhylloSearchParams>({
    mutationFn: async (params) => {
      const res = await fetch(`${API_BASE}/influencers/discovery/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        let msg = `Discovery-Search fehlgeschlagen (${res.status})`;
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {
          // body wasn't JSON — fall through
        }
        throw new PhylloSearchError(msg, res.status);
      }
      return res.json();
    },
    // Niemals automatisch wiederholen — bei einem 429/400 würden Retries
    // weitere Phyllo-Credits verbrennen. Nutzer triggert manuell neu.
    retry: false,
  });
}
