'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const DEAL_STAGES = [
  'lead',
  'outreach',
  'negotiation',
  'contracted',
  'in_progress',
  'review',
  'completed',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  outreach: 'Outreach',
  negotiation: 'Negotiation',
  contracted: 'Contracted',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead: '#6B7280',
  outreach: '#7C3AED',
  negotiation: '#D97706',
  contracted: '#2563EB',
  in_progress: '#059669',
  review: '#DB2777',
  completed: '#10B981',
};

export interface Deal {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatarUrl?: string;
  stage: DealStage;
  type: 'sponsored_post' | 'video' | 'story' | 'campaign' | 'ambassador';
  amount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  deadline?: string;
  deliverables: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  stage: DealStage;
  label: string;
  deals: Deal[];
  totalValue: number;
}

export interface PipelineStats {
  stages: {
    stage: DealStage;
    label: string;
    count: number;
    totalValue: number;
  }[];
  totalValue: number;
  totalDeals: number;
  conversionRate: number;
}

export interface DealsListParams {
  stage?: string;
  creatorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_DEALS: Deal[] = [
  {
    id: 'd1',
    title: 'Spring Fashion Campaign',
    creatorId: '1',
    creatorName: 'Sarah Chen',
    creatorHandle: '@sarahcreates',
    stage: 'in_progress',
    type: 'campaign',
    amount: 8500,
    paymentStatus: 'partial',
    deadline: '2024-04-15',
    deliverables: ['3 Instagram posts', '5 Stories', '1 Reel'],
    notes: 'Focus on spring collection launch.',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'd2',
    title: 'Fitness Product Review',
    creatorId: '2',
    creatorName: 'Marcus Rivera',
    creatorHandle: '@marcusfit',
    stage: 'negotiation',
    type: 'video',
    amount: 5000,
    paymentStatus: 'pending',
    deadline: '2024-04-01',
    deliverables: ['1 TikTok video', '2 Story mentions'],
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: '2024-03-18T00:00:00Z',
  },
  {
    id: 'd3',
    title: 'Summer Beauty Collection',
    creatorId: '5',
    creatorName: 'Mia Zhang',
    creatorHandle: '@miabeauty',
    stage: 'review',
    type: 'sponsored_post',
    amount: 3200,
    paymentStatus: 'pending',
    deadline: '2024-03-25',
    deliverables: ['2 Instagram posts', '3 Stories'],
    createdAt: '2024-02-20T00:00:00Z',
    updatedAt: '2024-03-19T00:00:00Z',
  },
  {
    id: 'd4',
    title: 'Tech Gadget Unboxing',
    creatorId: '4',
    creatorName: 'Jake Thompson',
    creatorHandle: '@jaketechtips',
    stage: 'contracted',
    type: 'video',
    amount: 6000,
    paymentStatus: 'pending',
    deadline: '2024-04-10',
    deliverables: ['1 YouTube video', '1 Community post'],
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'd5',
    title: 'Brand Ambassador Q2',
    creatorId: '1',
    creatorName: 'Sarah Chen',
    creatorHandle: '@sarahcreates',
    stage: 'lead',
    type: 'ambassador',
    amount: 15000,
    paymentStatus: 'pending',
    deliverables: ['Monthly content', 'Event appearances'],
    createdAt: '2024-03-18T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'd6',
    title: 'Travel Vlog Series',
    creatorId: '6',
    creatorName: 'Alex Morales',
    creatorHandle: '@alexwanders',
    stage: 'completed',
    type: 'campaign',
    amount: 4500,
    paymentStatus: 'paid',
    deliverables: ['3 TikTok videos', '1 Instagram Reel'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'd7',
    title: 'New Product Launch Teaser',
    creatorId: '2',
    creatorName: 'Marcus Rivera',
    creatorHandle: '@marcusfit',
    stage: 'outreach',
    type: 'story',
    amount: 1500,
    paymentStatus: 'pending',
    deliverables: ['3 TikTok stories'],
    createdAt: '2024-03-19T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'd8',
    title: 'Food Review Collab',
    creatorId: '3',
    creatorName: 'Emily Park',
    creatorHandle: '@emilyeats',
    stage: 'lead',
    type: 'video',
    amount: 8000,
    paymentStatus: 'pending',
    deliverables: ['1 YouTube video'],
    createdAt: '2024-03-20T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
];

const MOCK_PIPELINE: PipelineStats = {
  stages: DEAL_STAGES.map((stage) => {
    const deals = MOCK_DEALS.filter((d) => d.stage === stage);
    return {
      stage,
      label: DEAL_STAGE_LABELS[stage],
      count: deals.length,
      totalValue: deals.reduce((sum, d) => sum + d.amount, 0),
    };
  }),
  totalValue: MOCK_DEALS.reduce((sum, d) => sum + d.amount, 0),
  totalDeals: MOCK_DEALS.length,
  conversionRate: 12.5,
};

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

async function putApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDeals(params: DealsListParams = {}) {
  return useQuery<Deal[]>({
    queryKey: ['deals', 'list', params],
    queryFn: async () => {
      try {
        const queryParams: Record<string, string> = {};
        if (params.stage) queryParams.stage = params.stage;
        if (params.creatorId) queryParams.creatorId = params.creatorId;
        if (params.search) queryParams.search = params.search;
        return await fetchApi<Deal[]>(`${API_BASE}/deals`, queryParams);
      } catch {
        let filtered = [...MOCK_DEALS];
        if (params.stage) filtered = filtered.filter((d) => d.stage === params.stage);
        if (params.creatorId) filtered = filtered.filter((d) => d.creatorId === params.creatorId);
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.creatorName.toLowerCase().includes(q),
          );
        }
        return filtered;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useDealKanban() {
  return useQuery<KanbanColumn[]>({
    queryKey: ['deals', 'kanban'],
    queryFn: async () => {
      try {
        return await fetchApi<KanbanColumn[]>(`${API_BASE}/deals/kanban`);
      } catch {
        return DEAL_STAGES.map((stage) => {
          const deals = MOCK_DEALS.filter((d) => d.stage === stage);
          return {
            stage,
            label: DEAL_STAGE_LABELS[stage],
            deals,
            totalValue: deals.reduce((sum, d) => sum + d.amount, 0),
          };
        });
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useDeal(id: string | undefined) {
  return useQuery<Deal>({
    queryKey: ['deals', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      try {
        return await fetchApi<Deal>(`${API_BASE}/deals/${id}`);
      } catch {
        const deal = MOCK_DEALS.find((d) => d.id === id);
        if (!deal) throw new Error('Deal not found');
        return deal;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function usePipelineStats() {
  return useQuery<PipelineStats>({
    queryKey: ['deals', 'pipeline'],
    queryFn: async () => {
      try {
        return await fetchApi<PipelineStats>(`${API_BASE}/deals/pipeline`);
      } catch {
        return MOCK_PIPELINE;
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      return postApi<Deal>('/deals', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['creators'] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Deal> }) => {
      return putApi<Deal>(`/deals/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useMoveDealStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: DealStage }) => {
      return putApi<Deal>(`/deals/${id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
