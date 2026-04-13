'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Calendar notes API client (absolute URL; avoids Vercel proxy issues)
// ---------------------------------------------------------------------------

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api/calendar-notes`;

export interface CalendarNote {
  id: string;
  orgId: string;
  date: string; // YYYY-MM-DD
  content: string;
  reminderAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarNoteInput {
  date: string;
  content: string;
  reminderAt?: string | null;
}

export interface UpdateCalendarNoteInput {
  content?: string;
  reminderAt?: string | null;
  date?: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCalendarNotesForMonth(month: string) {
  return useQuery<CalendarNote[]>({
    queryKey: ['calendar-notes', 'month', month],
    queryFn: () => fetchJson<CalendarNote[]>(`${API_BASE}?month=${month}`),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateCalendarNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarNoteInput) =>
      fetchJson<CalendarNote>(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-notes'] });
    },
  });
}

export function useUpdateCalendarNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCalendarNoteInput }) =>
      fetchJson<CalendarNote>(`${API_BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-notes'] });
    },
  });
}

export function useDeleteCalendarNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-notes'] });
    },
  });
}
