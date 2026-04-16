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

/** A single task assignee as returned by the backend enrichment. */
export interface WmTaskAssignee {
  userId: string;
  userName: string;
  avatarUrl?: string;
}

export interface WmMember {
  /** WmProjectMember row id — NOT the user id. Use `userId` for assignments. */
  id: string;
  /** User id that is referenced by WmTask.assigneeId and similar foreign keys. */
  userId: string;
  /** Display name (first + last). Prefer this over `name`. */
  userName: string;
  role?: string;
  // Backwards-compat aliases (some code paths still read these):
  name?: string;
  email?: string;
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
  parentTaskId?: string;
  title: string;
  description?: string;
  position: number;
  assigneeId?: string;
  /** All assignees resolved from wm_task_assignees join table. */
  assignees?: WmTaskAssignee[];
  /** Convenience list of just the user IDs (mirrors assignees[].userId). */
  assigneeIds?: string[];
  assigneeName?: string;
  dueDate?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  labels: WmLabel[];
  subtasks: WmSubtask[];
  attachments: WmAttachment[];
  estimateMinutes?: number;
  completed: boolean;
  color?: string | null;
  section?: string | null;
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

export interface WmProjectMember {
  id: string;
  userId: string;
  userName: string;
  role: string;
}

export interface WmProjectDetail extends WmProject {
  columns: WmColumn[];
  tasks: WmTask[];
  members: WmProjectMember[];
  labels: WmLabel[];
}

export function useWmProject(id: string) {
  return useQuery<WmProjectDetail>({
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
    mutationFn: (data: { projectId: string; columnId: string; title: string; assigneeId?: string; assigneeIds?: string[]; priority?: string; position?: number }) =>
      wmFetch<WmTask>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        const tasks = [...(old.tasks ?? [])];
        const optimisticTask: Partial<WmTask> = {
          id: `temp-${Date.now()}`,
          projectId: vars.projectId,
          columnId: vars.columnId,
          title: vars.title,
          priority: (vars.priority as WmTask['priority']) || 'medium',
          position: vars.position ?? tasks.filter((t: any) => t.columnId === vars.columnId).length,
          labels: [],
          subtasks: [],
          attachments: [],
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tasks.push(optimisticTask);
        return { ...old, tasks };
      });
      return { prev };
    },
    onError: (_, vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['wm', 'project', vars.projectId], context.prev);
      }
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'tasks', vars.projectId] });
    },
  });
}

export function useUpdateWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<WmTask> & { id: string; assigneeIds?: string[] }) =>
      wmFetch<WmTask>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onMutate: async (vars) => {
      // We need projectId to update the cache — try to find it from existing data
      const allQueries = qc.getQueriesData<any>({ queryKey: ['wm', 'project'] });
      let projectId: string | undefined;
      let members: any[] = [];
      for (const [, data] of allQueries) {
        if (data?.tasks?.some((t: any) => t.id === vars.id)) {
          projectId = data.id;
          members = data.members ?? [];
          break;
        }
      }
      if (!projectId) return {};
      await qc.cancelQueries({ queryKey: ['wm', 'project', projectId] });
      const prev = qc.getQueryData(['wm', 'project', projectId]);

      // If assigneeIds changed, also build the corresponding assignees[] array
      // so the UI (avatar stack, chips, my-tasks) updates immediately.
      let assignees: any[] | undefined;
      const assigneeIds = (vars as any).assigneeIds as string[] | undefined;
      if (Array.isArray(assigneeIds)) {
        assignees = assigneeIds.map((uid) => {
          const m = members.find((mem: any) => (mem.userId || mem.id) === uid);
          return {
            userId: uid,
            userName: m?.userName || m?.name || 'Unbekannt',
            avatarUrl: m?.avatarUrl,
          };
        });
      }

      qc.setQueryData(['wm', 'project', projectId], (old: any) => {
        if (!old) return old;
        const tasks = (old.tasks ?? []).map((t: any) =>
          t.id === vars.id
            ? {
                ...t,
                ...vars,
                ...(assignees ? { assignees, assigneeIds, assigneeName: assignees[0]?.userName } : {}),
              }
            : t,
        );
        return { ...old, tasks };
      });
      return { prev, projectId };
    },
    onError: (_, __, context: any) => {
      if (context?.prev && context?.projectId) {
        qc.setQueryData(['wm', 'project', context.projectId], context.prev);
      }
    },
    onSuccess: (task, vars) => {
      // Write the server response straight into the cache so the UI reflects
      // the final enriched state (assignees + assigneeName) without waiting
      // for the invalidation refetch.
      if (task?.projectId) {
        qc.setQueryData(['wm', 'project', task.projectId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            tasks: (old.tasks ?? []).map((t: any) => (t.id === task.id ? { ...t, ...task } : t)),
          };
        });
      }
    },
    onSettled: (task) => {
      if (task) {
        qc.invalidateQueries({ queryKey: ['wm', 'project', task.projectId] });
        qc.invalidateQueries({ queryKey: ['wm', 'task', task.id] });
        qc.invalidateQueries({ queryKey: ['wm', 'my-tasks'] });
      }
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
      wmFetch(`/tasks/${data.taskId}/move`, { method: 'PATCH', body: JSON.stringify(data) }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        const tasks = [...(old.tasks ?? [])];
        const taskIdx = tasks.findIndex((t: any) => t.id === vars.taskId);
        if (taskIdx !== -1) {
          tasks[taskIdx] = { ...tasks[taskIdx], columnId: vars.columnId, position: vars.position };
        }
        return { ...old, tasks };
      });
      return { prev };
    },
    onError: (_, vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['wm', 'project', vars.projectId], context.prev);
      }
    },
    onSettled: (_, __, vars) => {
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
      const res = await fetch(`${API_URL}/api/wm/tasks/${data.taskId}/attachments`, {
        method: 'POST',
        headers: hdrs,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Upload fehlgeschlagen (${res.status}): ${body || 'keine Details'}`);
      }
      return res.json() as Promise<WmAttachment & { projectId: string }>;
    },
    onSuccess: (attachment, vars) => {
      // Inject the new attachment into the project cache so the modal + card update
      // immediately without waiting for a full refetch.
      if (attachment.projectId) {
        qc.setQueryData(['wm', 'project', attachment.projectId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            tasks: (old.tasks ?? []).map((t: any) =>
              t.id === vars.taskId
                ? { ...t, attachments: [attachment, ...(t.attachments ?? [])] }
                : t,
            ),
          };
        });
        qc.invalidateQueries({ queryKey: ['wm', 'project', attachment.projectId] });
      }
    },
  });
}

export function useDeleteWmAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; attachmentId: string; projectId?: string }) =>
      wmFetch(`/tasks/${data.taskId}/attachments/${data.attachmentId}`, { method: 'DELETE' }),
    onMutate: async (vars) => {
      if (!vars.projectId) return {};
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) =>
            t.id === vars.taskId
              ? { ...t, attachments: (t.attachments ?? []).filter((a: any) => a.id !== vars.attachmentId) }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_, vars, ctx: any) => {
      if (vars.projectId && ctx?.prev) qc.setQueryData(['wm', 'project', vars.projectId], ctx.prev);
    },
    onSettled: (_, __, vars) => {
      if (vars.projectId) qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
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

// ---------------------------------------------------------------------------
// Label mutation hooks
// ---------------------------------------------------------------------------

export function useCreateWmLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; name: string; color: string }) =>
      wmFetch<WmLabel>(`/projects/${data.projectId}/labels`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'labels', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

export function useAddLabelToTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; labelId: string; projectId: string }) =>
      wmFetch(`/tasks/${data.taskId}/labels/${data.labelId}`, { method: 'POST' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

export function useRemoveLabelFromTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; labelId: string; projectId: string }) =>
      wmFetch(`/tasks/${data.taskId}/labels/${data.labelId}`, { method: 'DELETE' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Activity hooks
// ---------------------------------------------------------------------------

export interface WmActivity {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  createdAt: string;
}

export function useWmActivities(taskId: string) {
  return useQuery<WmActivity[]>({
    queryKey: ['wm', 'activities', taskId],
    queryFn: () => wmFetch(`/tasks/${taskId}/activities`),
    enabled: !!taskId,
  });
}
