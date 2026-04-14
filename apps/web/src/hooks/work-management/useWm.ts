'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function wmFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WmProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  taskCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WmColumn {
  id: string;
  projectId: string;
  name: string;
  position: number;
  color?: string;
}

export interface WmLabel {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface WmMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface WmSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface WmAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export interface WmComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface WmTask {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  labels: WmLabel[];
  subtasks: WmSubtask[];
  attachments: WmAttachment[];
  estimateMinutes?: number;
  completed: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WmWorkloadEntry {
  memberId: string;
  memberName: string;
  openTasks: number;
  dueToday: number;
  overdue: number;
  highPriority: number;
}

// ---------------------------------------------------------------------------
// Project hooks
// ---------------------------------------------------------------------------

export function useWmProjects() {
  return useQuery<WmProject[]>({
    queryKey: ['wm', 'projects'],
    queryFn: () => wmFetch('/projects'),
  });
}

export function useWmProject(id: string) {
  return useQuery<WmProject & { columns: (WmColumn & { tasks: WmTask[] })[] }>({
    queryKey: ['wm', 'project', id],
    queryFn: () => wmFetch(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateWmProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color: string }) =>
      wmFetch<WmProject>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm', 'projects'] }),
  });
}

export function useUpdateWmProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; color?: string }) =>
      wmFetch<WmProject>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'projects'] });
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.id] });
    },
  });
}

export function useDeleteWmProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wmFetch(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm', 'projects'] }),
  });
}

// ---------------------------------------------------------------------------
// Task hooks
// ---------------------------------------------------------------------------

export function useWmTasks(projectId: string) {
  return useQuery<WmTask[]>({
    queryKey: ['wm', 'tasks', projectId],
    queryFn: () => wmFetch(`/projects/${projectId}/tasks`),
    enabled: !!projectId,
  });
}

export function useWmTask(id: string) {
  return useQuery<WmTask>({
    queryKey: ['wm', 'task', id],
    queryFn: () => wmFetch(`/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; columnId: string; title: string; position?: number }) =>
      wmFetch<WmTask>(`/projects/${data.projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'tasks', vars.projectId] });
    },
  });
}

export function useUpdateWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<WmTask> & { id: string }) =>
      wmFetch<WmTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', task.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'task', task.id] });
      qc.invalidateQueries({ queryKey: ['wm', 'my-tasks'] });
    },
  });
}

export function useDeleteWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      wmFetch(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

export function useMoveWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; projectId: string; columnId: string; position: number }) =>
      wmFetch(`/tasks/${data.taskId}/move`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Column hooks
// ---------------------------------------------------------------------------

export function useWmColumns(projectId: string) {
  return useQuery<WmColumn[]>({
    queryKey: ['wm', 'columns', projectId],
    queryFn: () => wmFetch(`/projects/${projectId}/columns`),
    enabled: !!projectId,
  });
}

export function useCreateWmColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; name: string; color?: string }) =>
      wmFetch<WmColumn>(`/projects/${data.projectId}/columns`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'columns', vars.projectId] });
    },
  });
}

export function useReorderWmColumns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; columnIds: string[] }) =>
      wmFetch(`/projects/${data.projectId}/columns/reorder`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Comment hooks
// ---------------------------------------------------------------------------

export function useWmComments(taskId: string) {
  return useQuery<WmComment[]>({
    queryKey: ['wm', 'comments', taskId],
    queryFn: () => wmFetch(`/tasks/${taskId}/comments`),
    enabled: !!taskId,
  });
}

export function useCreateWmComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; content: string }) =>
      wmFetch<WmComment>(`/tasks/${data.taskId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'comments', vars.taskId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Attachment hooks
// ---------------------------------------------------------------------------

export function useUploadWmAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      const hdrs = authHeaders();
      delete (hdrs as Record<string, string>)['Content-Type'];
      const res = await fetch(`${API_URL}/api/work-management/tasks/${data.taskId}/attachments`, {
        method: 'POST',
        headers: hdrs,
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json() as Promise<WmAttachment>;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

export function useDeleteWmAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; attachmentId: string }) =>
      wmFetch(`/tasks/${data.taskId}/attachments/${data.attachmentId}`, { method: 'DELETE' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Labels, Members, Workload, My Tasks
// ---------------------------------------------------------------------------

export function useWmLabels(projectId: string) {
  return useQuery<WmLabel[]>({
    queryKey: ['wm', 'labels', projectId],
    queryFn: () => wmFetch(`/projects/${projectId}/labels`),
    enabled: !!projectId,
  });
}

export function useWmMembers(projectId: string) {
  return useQuery<WmMember[]>({
    queryKey: ['wm', 'members', projectId],
    queryFn: () => wmFetch(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useWmWorkload(projectId?: string) {
  const path = projectId ? `/workload?projectId=${projectId}` : '/workload';
  return useQuery<WmWorkloadEntry[]>({
    queryKey: ['wm', 'workload', projectId ?? 'all'],
    queryFn: () => wmFetch(path),
  });
}

export function useMyWmTasks() {
  return useQuery<WmTask[]>({
    queryKey: ['wm', 'my-tasks'],
    queryFn: () => wmFetch('/my-tasks'),
  });
}
