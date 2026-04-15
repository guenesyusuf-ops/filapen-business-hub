'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

function authHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem('filapen-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.token;
      if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    }
  } catch {
    // ignore
  }
  return { 'Content-Type': 'application/json' };
}

async function chatFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/wm${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface WmChatMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export function useProjectChat(projectId: string) {
  return useQuery<WmChatMessage[]>({
    queryKey: ['wm', 'chat', projectId],
    queryFn: () => chatFetch(`/projects/${projectId}/chat`),
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; message: string }) =>
      chatFetch<WmChatMessage>(`/projects/${data.projectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: data.message }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'chat', vars.projectId] });
    },
  });
}
