'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PaymentMethod,
  FixedCost,
} from '@filapen/shared/src/types/finance';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Generic fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = `${API_URL}/api/finance/costs`;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function mutateApi<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  // DELETE may return 204
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Payment Methods
// ---------------------------------------------------------------------------

export function usePaymentMethods() {
  return useQuery<PaymentMethod[]>({
    queryKey: ['finance', 'costs', 'payment-methods'],
    queryFn: () => fetchApi<PaymentMethod[]>(`${API_BASE}/payment-methods`),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      fixedFeePerTransaction: number;
      percentageFee: number;
      currency: string;
    }) => mutateApi<PaymentMethod>(`${API_BASE}/payment-methods`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'payment-methods'] });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name: string;
      fixedFeePerTransaction: number;
      percentageFee: number;
      currency: string;
    }) => mutateApi<PaymentMethod>(`${API_BASE}/payment-methods/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'payment-methods'] });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateApi<void>(`${API_BASE}/payment-methods/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'payment-methods'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Fixed Costs
// ---------------------------------------------------------------------------

export function useFixedCosts() {
  return useQuery<FixedCost[]>({
    queryKey: ['finance', 'costs', 'fixed'],
    queryFn: () => fetchApi<FixedCost[]>(`${API_BASE}/fixed`),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useCreateFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      amount: number;
      currency: string;
      frequency: string;
      category: string;
      startDate: string;
      endDate?: string;
    }) => mutateApi<FixedCost>(`${API_BASE}/fixed`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'fixed'] });
    },
  });
}

export function useUpdateFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name: string;
      amount: number;
      currency: string;
      frequency: string;
      category: string;
      startDate: string;
      endDate?: string;
    }) => mutateApi<FixedCost>(`${API_BASE}/fixed/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'fixed'] });
    },
  });
}

export function useDeleteFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateApi<void>(`${API_BASE}/fixed/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'costs', 'fixed'] });
    },
  });
}
