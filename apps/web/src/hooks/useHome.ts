'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

export interface PersonalNote {
  id: string;
  userId: string;
  content: string;
  pinned: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalCalendarEvent {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  reminderAt: string | null;
  color: string | null;
  createdAt: string;
}

async function homeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/home${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// -------------------- Notes -------------------- //

export function usePersonalNotes() {
  return useQuery<PersonalNote[]>({
    queryKey: ['home', 'notes'],
    queryFn: () => homeFetch<PersonalNote[]>('/notes'),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; color?: string }) =>
      homeFetch<PersonalNote>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'notes'] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; content?: string; pinned?: boolean; color?: string | null }) =>
      homeFetch<PersonalNote>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'notes'] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => homeFetch<{ deleted: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'notes'] }),
  });
}

// -------------------- Calendar -------------------- //

export function usePersonalEvents(from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const path = qs.toString() ? `/calendar?${qs.toString()}` : '/calendar';
  return useQuery<PersonalCalendarEvent[]>({
    queryKey: ['home', 'calendar', from, to],
    queryFn: () => homeFetch<PersonalCalendarEvent[]>(path),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      startsAt: string;
      endsAt?: string;
      allDay?: boolean;
      reminderAt?: string;
      color?: string;
    }) => homeFetch<PersonalCalendarEvent>('/calendar', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'calendar'] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      homeFetch<PersonalCalendarEvent>(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'calendar'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => homeFetch<{ deleted: boolean }>(`/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['home', 'calendar'] }),
  });
}
