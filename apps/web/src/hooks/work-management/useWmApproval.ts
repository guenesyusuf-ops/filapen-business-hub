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
  } catch { /* ignore */ }
  return { 'Content-Type': 'application/json' };
}

async function wmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/wm${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `API error ${res.status}`);
  }
  return res.json();
}

// -------------------- Categories -------------------- //

export interface WmCategory {
  id: string;
  name: string;
  position: number;
}

export function useWmCategories() {
  return useQuery<WmCategory[]>({
    queryKey: ['wm', 'categories'],
    queryFn: () => wmFetch('/categories'),
  });
}

export function useCreateWmCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      wmFetch<WmCategory>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm', 'categories'] }),
  });
}

export function useDeleteWmCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wmFetch<{ deleted: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm', 'categories'] }),
  });
}

// -------------------- Approval Projects -------------------- //

export function useCreateApprovalProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string; approverIds: string[] }) =>
      wmFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ ...data, projectType: 'approval' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm', 'projects'] }),
  });
}

// -------------------- Approval Tasks -------------------- //

export interface ApprovalStep {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  position: number;
  status: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  deadline: string | null;
  decidedAt: string | null;
  version: number;
}

export interface ApprovalTaskDetail {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  columnId: string;
  createdById: string;
  createdByName: string;
  createdByAvatarUrl: string | null;
  approvalStatus: 'draft' | 'in_review' | 'approved' | 'rejected' | null;
  approvalVersion: number;
  approvalSteps: ApprovalStep[];
  approvalProgress: { approved: number; total: number };
  attachments: any[];
  activities: any[];
  comments: any[];
}

export function useCreateApprovalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      projectId: string;
      title: string;
      description?: string;
      approverIds: string[];
      deadlineHours?: number;
    }) => wmFetch<ApprovalTaskDetail>('/tasks/approval', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

export function useSubmitForApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      wmFetch<ApprovalTaskDetail>(`/tasks/${taskId}/approval/submit`, { method: 'POST' }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', result.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'approval', result.id] });
      qc.invalidateQueries({ queryKey: ['wm', 'approvals-pending'] });
    },
  });
}

export function useApprovalDecide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, action, comment }: { taskId: string; action: 'approved' | 'rejected'; comment?: string }) =>
      wmFetch<ApprovalTaskDetail>(`/tasks/${taskId}/approval/decide`, {
        method: 'POST',
        body: JSON.stringify({ action, comment }),
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', result.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'approval', result.id] });
      qc.invalidateQueries({ queryKey: ['wm', 'approvals-pending'] });
      qc.invalidateQueries({ queryKey: ['wm', 'my-tasks'] });
    },
  });
}

export function useApprovalDetail(taskId: string | null) {
  return useQuery<ApprovalTaskDetail>({
    queryKey: ['wm', 'approval', taskId],
    queryFn: () => wmFetch(`/tasks/${taskId}/approval`),
    enabled: !!taskId,
  });
}

// -------------------- Pending Approvals (Dashboard) -------------------- //

export interface PendingApproval {
  taskId: string;
  title: string;
  projectName: string;
  projectColor: string;
  createdByName: string;
  progress: string;
  deadline: string | null;
  version: number;
}

export function usePendingApprovals() {
  return useQuery<PendingApproval[]>({
    queryKey: ['wm', 'approvals-pending'],
    queryFn: () => wmFetch('/approvals/pending'),
    refetchInterval: 30_000,
  });
}
