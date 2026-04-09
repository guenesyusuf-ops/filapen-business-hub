'use client';

import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdLibraryAd {
  id: string;
  pageName: string;
  pageId: string;
  creativeBody: string;
  headline: string;
  linkCaption: string;
  linkDescription: string;
  snapshotUrl: string;
  startDate: string;
  platforms: string[];
  impressionsMin: number;
  impressionsMax: number;
  spendMin: number;
  spendMax: number;
  currency: string;
  demographics: Array<{ age: string; gender: string; percentage: number }>;
  languages: string[];
  regions: Array<{ region: string; percentage: number }>;
}

export interface AdLibraryResult {
  data: AdLibraryAd[];
  hasMore: boolean;
  configured: boolean;
}

export interface AdLibrarySearchParams {
  searchTerm: string;
  country: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Country options
// ---------------------------------------------------------------------------

export const AD_LIBRARY_COUNTRIES = [
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Oesterreich' },
  { code: 'CH', label: 'Schweiz' },
  { code: 'US', label: 'USA' },
  { code: 'GB', label: 'UK' },
  { code: 'FR', label: 'Frankreich' },
] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAdLibrarySearch(params: AdLibrarySearchParams | null) {
  return useQuery<AdLibraryResult>({
    queryKey: ['ad-library', params],
    enabled: !!params && !!params.searchTerm.trim(),
    queryFn: async () => {
      if (!params || !params.searchTerm.trim()) {
        return { data: [], hasMore: false, configured: true };
      }

      const url = new URL('/api/content/ad-library/search', window.location.origin);
      url.searchParams.set('q', params.searchTerm);
      url.searchParams.set('country', params.country);
      if (params.limit) {
        url.searchParams.set('limit', String(params.limit));
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });
}
