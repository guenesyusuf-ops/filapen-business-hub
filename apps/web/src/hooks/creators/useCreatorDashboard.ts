'use client';

import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// API base — mirrors the finance hooks pattern to avoid the Vercel
// server-to-server routing bug (we always hit the absolute API URL).
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = `${API_URL}/api`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  creatorCount: number;
  productCount: number;
  projectCount: number;
  uploadCount: number;
  creatorsWithoutUploads: number;
  totalCreators: number;
}

export interface CreatorWithoutUploads {
  id: string;
  name: string;
  email: string | null;
  niche: string | null;
  avatarUrl: string | null;
  platform: string | null;
  createdAt: string;
}

export interface CreatorAnalyticsRow {
  creatorId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastLogin: string | null;
  uploadCount: number;
  latestUploadAt: string;
  product: string | null;
  batch: string | null;
}

export interface RecentCreator {
  id: string;
  name: string;
  niche: string | null;
  platform: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['creator-dashboard', 'stats'],
    queryFn: () => fetchApi<DashboardStats>('/creator/dashboard-stats'),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreatorsWithoutUploads(enabled = true) {
  return useQuery<CreatorWithoutUploads[]>({
    queryKey: ['creator-dashboard', 'without-uploads'],
    queryFn: () => fetchApi<CreatorWithoutUploads[]>('/creator/creators-without-uploads'),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreatorsWithUploads() {
  return useQuery<CreatorAnalyticsRow[]>({
    queryKey: ['creator-dashboard', 'with-uploads'],
    queryFn: () => fetchApi<CreatorAnalyticsRow[]>('/creator/creators-with-uploads'),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useRecentCreators() {
  return useQuery<RecentCreator[]>({
    queryKey: ['creator-dashboard', 'recent'],
    queryFn: () => fetchApi<RecentCreator[]>('/creator/recent'),
    staleTime: 60_000,
    retry: 1,
  });
}
