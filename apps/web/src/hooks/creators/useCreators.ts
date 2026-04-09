'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Creator {
  id: string;
  name: string;
  handle: string;
  email: string;
  phone?: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  avatarUrl?: string;
  followers: number;
  followerCount?: number;
  engagementRate: number;
  niche: string;
  status: 'active' | 'prospect' | 'outreach' | 'inactive';
  location?: string;
  ratePerPost?: number;
  ratePerVideo?: number;
  totalDeals: number;
  totalSpend: number;
  avgEngagement: number;
  score: number;
  tags: string[];
  notes?: string;
  inviteCode?: string;
  kids?: boolean;
  kidsAges?: string;
  kidsOnVideo?: boolean;
  compensation?: string;
  provision?: string;
  fixAmount?: number;
  firstContact?: string;
  contracts?: any;
  creatorNotes?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorStats {
  totalCreators: number;
  activeDeals: number;
  totalSpend: number;
  avgDealValue: number;
  statusDistribution: { status: string; count: number }[];
  nicheDistribution: { niche: string; count: number }[];
  recentActivity: {
    id: string;
    type: string;
    description: string;
    creatorName: string;
    timestamp: string;
  }[];
}

export interface CreatorsListParams {
  search?: string;
  status?: string;
  niche?: string;
  platform?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_CREATORS: Creator[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    handle: '@sarahcreates',
    email: 'sarah@example.com',
    phone: '+1 555-0101',
    platform: 'instagram',
    avatarUrl: undefined,
    followers: 245000,
    engagementRate: 4.2,
    niche: 'Lifestyle',
    status: 'active',
    location: 'Los Angeles, CA',
    ratePerPost: 2500,
    ratePerVideo: 5000,
    totalDeals: 8,
    totalSpend: 32000,
    avgEngagement: 4.2,
    score: 92,
    tags: ['premium', 'fashion', 'lifestyle'],
    notes: 'Great collaboration partner. Always delivers on time.',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: '2',
    name: 'Marcus Rivera',
    handle: '@marcusfit',
    email: 'marcus@example.com',
    platform: 'tiktok',
    followers: 890000,
    engagementRate: 6.8,
    niche: 'Fitness',
    status: 'active',
    location: 'Miami, FL',
    ratePerPost: 3500,
    ratePerVideo: 7000,
    totalDeals: 5,
    totalSpend: 28000,
    avgEngagement: 6.8,
    score: 88,
    tags: ['fitness', 'health', 'viral'],
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-18T00:00:00Z',
  },
  {
    id: '3',
    name: 'Emily Park',
    handle: '@emilyeats',
    email: 'emily@example.com',
    platform: 'youtube',
    followers: 1200000,
    engagementRate: 3.5,
    niche: 'Food',
    status: 'prospect',
    location: 'New York, NY',
    ratePerPost: 5000,
    ratePerVideo: 12000,
    totalDeals: 0,
    totalSpend: 0,
    avgEngagement: 3.5,
    score: 85,
    tags: ['food', 'cooking', 'premium'],
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z',
  },
  {
    id: '4',
    name: 'Jake Thompson',
    handle: '@jaketechtips',
    email: 'jake@example.com',
    platform: 'youtube',
    followers: 560000,
    engagementRate: 5.1,
    niche: 'Tech',
    status: 'outreach',
    location: 'Austin, TX',
    ratePerPost: 3000,
    ratePerVideo: 8000,
    totalDeals: 2,
    totalSpend: 12000,
    avgEngagement: 5.1,
    score: 79,
    tags: ['tech', 'gadgets'],
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-03-19T00:00:00Z',
  },
  {
    id: '5',
    name: 'Mia Zhang',
    handle: '@miabeauty',
    email: 'mia@example.com',
    platform: 'instagram',
    followers: 380000,
    engagementRate: 5.6,
    niche: 'Beauty',
    status: 'active',
    location: 'San Francisco, CA',
    ratePerPost: 2800,
    ratePerVideo: 5500,
    totalDeals: 6,
    totalSpend: 24500,
    avgEngagement: 5.6,
    score: 91,
    tags: ['beauty', 'skincare', 'premium'],
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-03-15T00:00:00Z',
  },
  {
    id: '6',
    name: 'Alex Morales',
    handle: '@alexwanders',
    email: 'alex@example.com',
    platform: 'tiktok',
    followers: 720000,
    engagementRate: 7.2,
    niche: 'Travel',
    status: 'inactive',
    location: 'Denver, CO',
    ratePerPost: 2200,
    ratePerVideo: 4500,
    totalDeals: 3,
    totalSpend: 9800,
    avgEngagement: 7.2,
    score: 74,
    tags: ['travel', 'adventure'],
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-02-28T00:00:00Z',
  },
];

const MOCK_STATS: CreatorStats = {
  totalCreators: 6,
  activeDeals: 12,
  totalSpend: 106300,
  avgDealValue: 4420,
  statusDistribution: [
    { status: 'active', count: 3 },
    { status: 'prospect', count: 1 },
    { status: 'outreach', count: 1 },
    { status: 'inactive', count: 1 },
  ],
  nicheDistribution: [
    { niche: 'Lifestyle', count: 1 },
    { niche: 'Fitness', count: 1 },
    { niche: 'Food', count: 1 },
    { niche: 'Tech', count: 1 },
    { niche: 'Beauty', count: 1 },
    { niche: 'Travel', count: 1 },
  ],
  recentActivity: [
    {
      id: '1',
      type: 'deal_stage',
      description: 'Deal moved to "In Progress"',
      creatorName: 'Sarah Chen',
      timestamp: '2024-03-20T14:30:00Z',
    },
    {
      id: '2',
      type: 'new_deal',
      description: 'New deal created: Spring Campaign',
      creatorName: 'Marcus Rivera',
      timestamp: '2024-03-19T10:15:00Z',
    },
    {
      id: '3',
      type: 'deal_stage',
      description: 'Deal moved to "Review"',
      creatorName: 'Mia Zhang',
      timestamp: '2024-03-18T16:45:00Z',
    },
    {
      id: '4',
      type: 'new_creator',
      description: 'New creator added to CRM',
      creatorName: 'Emily Park',
      timestamp: '2024-03-17T09:00:00Z',
    },
    {
      id: '5',
      type: 'deal_completed',
      description: 'Deal completed: Winter Collection',
      creatorName: 'Sarah Chen',
      timestamp: '2024-03-16T11:30:00Z',
    },
  ],
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

export function useCreators(params: CreatorsListParams = {}) {
  return useQuery<PaginatedResponse<Creator>>({
    queryKey: ['creators', 'list', params],
    queryFn: async () => {
      try {
        const queryParams: Record<string, string> = {};
        if (params.search) queryParams.search = params.search;
        if (params.status && params.status !== 'all') queryParams.status = params.status;
        if (params.niche && params.niche !== 'all') queryParams.niche = params.niche;
        if (params.platform && params.platform !== 'all') queryParams.platform = params.platform;
        if (params.sortBy) queryParams.sortBy = params.sortBy;
        if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
        if (params.page) queryParams.page = String(params.page);
        if (params.pageSize) queryParams.pageSize = String(params.pageSize);

        const raw = await fetchApi<any>(`${API_BASE}/creators`, queryParams);
        // The API returns { items, total, page, pageSize, totalPages }
        // but the frontend expects { data, total, page, pageSize, totalPages }
        // Also normalize followerCount -> followers
        const items = (raw.items ?? raw.data ?? []).map((c: any) => ({
          ...c,
          followers: c.followers ?? c.followerCount ?? 0,
          engagementRate: c.engagementRate ?? 0,
          avgEngagement: c.avgEngagement ?? c.engagementRate ?? 0,
          score: c.score ?? 0,
          totalDeals: c.totalDeals ?? 0,
          totalSpend: c.totalSpend ?? 0,
        }));
        return {
          data: items,
          total: raw.total ?? 0,
          page: raw.page ?? 1,
          pageSize: raw.pageSize ?? 25,
          totalPages: raw.totalPages ?? 1,
        } as PaginatedResponse<Creator>;
      } catch {
        // Fallback to mock data
        let filtered = [...MOCK_CREATORS];
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.handle.toLowerCase().includes(q) ||
              c.email.toLowerCase().includes(q),
          );
        }
        if (params.status && params.status !== 'all') {
          filtered = filtered.filter((c) => c.status === params.status);
        }
        if (params.niche && params.niche !== 'all') {
          filtered = filtered.filter((c) => c.niche === params.niche);
        }
        if (params.platform && params.platform !== 'all') {
          filtered = filtered.filter((c) => c.platform === params.platform);
        }
        if (params.sortBy) {
          const key = params.sortBy as keyof Creator;
          const order = params.sortOrder === 'desc' ? -1 : 1;
          filtered.sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
            return String(aVal).localeCompare(String(bVal)) * order;
          });
        }
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 25;
        const start = (page - 1) * pageSize;
        return {
          data: filtered.slice(start, start + pageSize),
          total: filtered.length,
          page,
          pageSize,
          totalPages: Math.ceil(filtered.length / pageSize),
        };
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCreator(id: string | undefined) {
  return useQuery<Creator>({
    queryKey: ['creators', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const raw = await fetchApi<any>(`${API_BASE}/creators/${id}`);
        // Normalize followerCount -> followers
        return {
          ...raw,
          followers: raw.followers ?? raw.followerCount ?? 0,
          engagementRate: raw.engagementRate ?? 0,
          avgEngagement: raw.avgEngagement ?? raw.engagementRate ?? 0,
          score: raw.score ?? 0,
          totalDeals: raw.totalDeals ?? 0,
          totalSpend: raw.totalSpend ?? 0,
        } as Creator;
      } catch {
        const creator = MOCK_CREATORS.find((c) => c.id === id);
        if (!creator) throw new Error('Creator not found');
        return creator;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCreatorStats() {
  return useQuery<CreatorStats>({
    queryKey: ['creators', 'stats'],
    queryFn: async () => {
      try {
        return await fetchApi<CreatorStats>(`${API_BASE}/creators/stats`);
      } catch {
        return MOCK_STATS;
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Creator>) => {
      return postApi<Creator>('/creators', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (creatorId: string) => {
      return postApi<{ success: boolean; emailSent: boolean }>(`/creators/${creatorId}/resend-invite`, {});
    },
  });
}

export function useUpdateCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Creator> }) => {
      return putApi<Creator>(`/creators/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
    },
  });
}
