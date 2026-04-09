'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Briefing {
  id: string;
  title: string;
  dealId: string;
  dealTitle: string;
  creatorId: string;
  creatorName: string;
  status: 'draft' | 'sent' | 'approved' | 'revision';
  content: string;
  objectives: string[];
  keyMessages: string[];
  dosAndDonts?: { dos: string[]; donts: string[] };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_BRIEFINGS: Briefing[] = [
  {
    id: 'b1',
    title: 'Spring Fashion Campaign Brief',
    dealId: 'd1',
    dealTitle: 'Spring Fashion Campaign',
    creatorId: '1',
    creatorName: 'Sarah Chen',
    status: 'approved',
    content: 'Showcase the new spring collection with focus on pastel colors and lightweight fabrics.',
    objectives: ['Drive awareness for spring line', 'Generate 50K impressions', 'Achieve 3%+ engagement'],
    keyMessages: ['Sustainable materials', 'Limited edition', 'Free shipping this week'],
    dosAndDonts: {
      dos: ['Show product in natural lighting', 'Include try-on content', 'Tag our brand'],
      donts: ['No competitor mentions', 'No heavy filters', 'No political content'],
    },
    createdAt: '2024-03-02T00:00:00Z',
    updatedAt: '2024-03-05T00:00:00Z',
  },
  {
    id: 'b2',
    title: 'Fitness Product Review Guidelines',
    dealId: 'd2',
    dealTitle: 'Fitness Product Review',
    creatorId: '2',
    creatorName: 'Marcus Rivera',
    status: 'sent',
    content: 'Honest review of our new fitness tracker with emphasis on workout tracking features.',
    objectives: ['Product awareness', 'Drive pre-orders', 'Technical credibility'],
    keyMessages: ['7-day battery life', 'Real-time heart monitoring', 'Water resistant'],
    createdAt: '2024-03-12T00:00:00Z',
    updatedAt: '2024-03-12T00:00:00Z',
  },
  {
    id: 'b3',
    title: 'Summer Beauty Look Book',
    dealId: 'd3',
    dealTitle: 'Summer Beauty Collection',
    creatorId: '5',
    creatorName: 'Mia Zhang',
    status: 'revision',
    content: 'Create a summer look book featuring our new collection of foundations and lip products.',
    objectives: ['Showcase range of shades', 'Tutorial style content', 'Drive website traffic'],
    keyMessages: ['12-hour wear', 'Cruelty-free', 'SPF protection'],
    createdAt: '2024-02-22T00:00:00Z',
    updatedAt: '2024-03-18T00:00:00Z',
  },
  {
    id: 'b4',
    title: 'Tech Unboxing Script',
    dealId: 'd4',
    dealTitle: 'Tech Gadget Unboxing',
    creatorId: '4',
    creatorName: 'Jake Thompson',
    status: 'draft',
    content: 'Unboxing and first impressions of our flagship product with technical deep-dive.',
    objectives: ['Generate hype', '100K views target', 'Pre-order link clicks'],
    keyMessages: ['Revolutionary design', '5nm chip', '2-year warranty'],
    createdAt: '2024-03-16T00:00:00Z',
    updatedAt: '2024-03-16T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

const API_BASE = '/api';

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

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBriefings(dealId?: string) {
  return useQuery<Briefing[]>({
    queryKey: ['briefings', dealId ?? 'all'],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (dealId) params.dealId = dealId;
        return await fetchApi<Briefing[]>(`${API_BASE}/briefings`, params);
      } catch {
        if (dealId) {
          return MOCK_BRIEFINGS.filter((b) => b.dealId === dealId);
        }
        return MOCK_BRIEFINGS;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCreateBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Briefing>) => {
      return postApi<Briefing>('/briefings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefings'] });
    },
  });
}
