'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import {
  isTempId,
  registerTempTask,
  resolveTempTask,
  rejectTempTask,
  resolveTaskId,
} from './temp-task-bridge';

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

/**
 * Normalisiert eine WmTask vom Server (raw Prisma-Shape mit
 * `taskLabels: [{ label: {...} }]`) auf das Frontend-Schema (`labels: WmLabel[]`).
 * Wenn die Task schon flach kommt, ist das ein no-op.
 *
 * WICHTIG: Wird ueberall aufgerufen wo eine Task vom Server in den Cache
 * oder ins selectedTask-State geschrieben wird — sonst sieht das TaskDetail
 * Modal die Labels nicht und der "active"-Highlight bleibt aus.
 */
export function normalizeWmTask(t: any): any {
  if (!t || typeof t !== 'object') return t;
  // Wenn nur taskLabels vorhanden ist, daraus labels bauen.
  if (Array.isArray(t.taskLabels) && !Array.isArray(t.labels)) {
    return {
      ...t,
      labels: t.taskLabels.map((tl: any) => tl.label).filter(Boolean),
    };
  }
  return t;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WmProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  projectType?: 'kanban' | 'approval';
  category?: string | null;
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
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
  createdAt: string;
}

export interface WmComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  message: string;
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
    queryFn: async () => {
      const data = await wmFetch<any>(`/projects/${id}`);
      // Tasks gleich beim Cache-Eintritt normalisieren — sonst muss jeder
      // Consumer (Page-Render, Resync-Effect, optimistic Mutations)
      // taskLabels → labels selbst mappen, was zu Inkonsistenzen fuehrt.
      if (data?.tasks) {
        data.tasks = data.tasks.map((t: any) => normalizeWmTask(t));
      }
      return data;
    },
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
    mutationFn: async (data: { projectId: string; columnId: string; title: string; assigneeId?: string; assigneeIds?: string[]; priority?: string; position?: number }) => {
      const raw = await wmFetch<WmTask>('/tasks', { method: 'POST', body: JSON.stringify(data) });
      return normalizeWmTask(raw) as WmTask;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      const tempId = `temp-${Date.now()}`;
      // Bruecke registrieren — alle Folge-Calls (Description, Comment,
      // Attachment) blocken auf dieser Promise bis die echte ID da ist.
      registerTempTask(tempId);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        const tasks = [...(old.tasks ?? [])];
        const optimisticTask: Partial<WmTask> = {
          id: tempId,
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
      return { prev, tempId };
    },
    onSuccess: (realTask, vars, ctx: any) => {
      // Server-Antwort: echte ID ist da. Bruecke resolven, damit alle
      // gequeueten Update/Comment/Attachment-Calls jetzt durchlaufen.
      if (ctx?.tempId) {
        resolveTempTask(ctx.tempId, realTask.id);
      }
      // Sofort den Cache patchen (tempId → realId), damit die offene
      // TaskDetailModal nahtlos die echte ID sieht und kuenftige Calls
      // auch ohne Bruecke direkt richtig adressiert sind.
      // WICHTIG: Lokale Edits (Beschreibung, Titel, Labels etc.) die der
      // User waehrend der temp-Phase getippt hat MUESSEN gewinnen — die
      // gequeueten Update-Calls schicken sie eh gleich an den Server, aber
      // bis dahin darf die UI nicht "leer" flackern.
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) => {
            if (t.id !== ctx?.tempId) return t;
            return {
              ...realTask,
              description: t.description ?? realTask.description,
              title: t.title ?? realTask.title,
              labels: (t.labels && t.labels.length > 0) ? t.labels : (realTask.labels ?? []),
              attachments: t.attachments ?? (realTask as any).attachments ?? [],
              subtasks: t.subtasks ?? (realTask as any).subtasks ?? [],
            };
          }),
        };
      });
    },
    onError: (err, vars, context: any) => {
      if (context?.tempId) {
        rejectTempTask(context.tempId, err);
      }
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
    mutationFn: async ({ id, ...data }: Partial<WmTask> & { id: string; assigneeIds?: string[] }) => {
      // Wenn es eine temp-ID ist, warten wir bis der CREATE-Call resolvt —
      // dann gehen die Updates auf die echte ID statt im Noop zu landen
      // (sonst geht z.B. eine getippte Beschreibung verloren).
      const realId = await resolveTaskId(id);
      const raw = await wmFetch<WmTask>(`/tasks/${realId}`, { method: 'PUT', body: JSON.stringify(data) });
      // Normalize taskLabels → labels schon hier, dann sehen alle Consumer
      // (mutation onSuccess, handleUpdateTask, mutateAsync-callers) die
      // korrekte Frontend-Shape. Sonst zeigt die Modal beim naechsten Open
      // keine aktiven Labels mehr (siehe Bug-Report).
      return normalizeWmTask(raw) as WmTask;
    },
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
    onSuccess: (rawTask, vars) => {
      // Server liefert taskLabels[]; das Frontend braucht labels[]. Normalize
      // bevor wir das Ergebnis in den Cache (oder spaeter ins selectedTask-
      // State) schreiben, sonst verschwindet der Active-Highlight im Modal.
      const task = normalizeWmTask(rawTask);
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
    mutationFn: async ({ id }: { id: string; projectId: string }) => {
      const realId = await resolveTaskId(id);
      return wmFetch(`/tasks/${realId}`, { method: 'DELETE' });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

export function useMoveWmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; projectId: string; columnId: string; position: number }) => {
      const realId = await resolveTaskId(data.taskId);
      return wmFetch(`/tasks/${realId}/move`, { method: 'PATCH', body: JSON.stringify({ ...data, taskId: realId }) });
    },
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
      qc.refetchQueries({ queryKey: ['wm', 'project', vars.projectId] });
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
    // temp-IDs koennen wir nicht abfragen — Task existiert in der DB noch
    // gar nicht. Liste ist eh leer, daher disabled.
    enabled: !!taskId && !isTempId(taskId),
  });
}

export function useCreateWmComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; content: string }) => {
      const realId = await resolveTaskId(data.taskId);
      return wmFetch<WmComment>(`/tasks/${realId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ ...data, taskId: realId }),
      });
    },
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
      // Wenn Task gerade erst optimistisch angelegt wurde: warten bis CREATE
      // den realen UUID liefert. Sonst kommt der POST mit "temp-XXX" und
      // das Backend antwortet 500 ("Failed to upload attachment").
      const realId = await resolveTaskId(data.taskId);
      const formData = new FormData();
      formData.append('file', data.file);
      const hdrs = authHeaders();
      delete (hdrs as Record<string, string>)['Content-Type'];
      const res = await fetch(`${API_URL}/api/wm/tasks/${realId}/attachments`, {
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
      wmFetch(`/attachments/${data.attachmentId}`, { method: 'DELETE' }),
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
    mutationFn: async (data: { taskId: string; labelId: string; projectId: string }) => {
      const realId = await resolveTaskId(data.taskId);
      return wmFetch(`/tasks/${realId}/labels/${data.labelId}`, { method: 'POST' });
    },
    onMutate: async (vars) => {
      // Optimistic: Label sofort an die labels[]-Liste der Task pinnen, damit
      // die UI auf Klick reagiert und nicht erst nach dem Network-Roundtrip.
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      // Echte Label-Daten (Name + Farbe) aus dem Project-Cache pulle, sonst
      // wuerde das Label nur als nackte ID erscheinen.
      const projectData = prev as any;
      const labelObj = projectData?.labels?.find((l: any) => l.id === vars.labelId)
        ?? { id: vars.labelId, name: '', color: '#999' };
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  labels: t.labels?.some((l: any) => l.id === vars.labelId)
                    ? t.labels
                    : [...(t.labels ?? []), labelObj],
                }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_, vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['wm', 'project', vars.projectId], ctx.prev);
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

export function useRemoveLabelFromTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; labelId: string; projectId: string }) => {
      const realId = await resolveTaskId(data.taskId);
      return wmFetch(`/tasks/${realId}/labels/${data.labelId}`, { method: 'DELETE' });
    },
    onMutate: async (vars) => {
      // Optimistic-Remove — selber Pfad wie Add, nur in die andere Richtung.
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) =>
            t.id === vars.taskId
              ? { ...t, labels: (t.labels ?? []).filter((l: any) => l.id !== vars.labelId) }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_, vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['wm', 'project', vars.projectId], ctx.prev);
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['wm', 'task', vars.taskId] });
    },
  });
}

// =============================================================================
// SUBTASKS — eigene Endpoints! Vorher wurden Subtasks via PUT /tasks/:id mit
// `body.subtasks` geschickt, das Backend hat das Feld aber komplett ignoriert
// → silent data loss. Ab jetzt nur noch ueber diese Hooks.
// =============================================================================

export function useCreateWmSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; title: string; projectId: string; assigneeId?: string }) => {
      const realId = await resolveTaskId(data.taskId);
      return wmFetch<WmSubtask>(`/tasks/${realId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title: data.title, assigneeId: data.assigneeId }),
      });
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      const optimistic: WmSubtask = {
        id: `temp-sub-${Date.now()}`,
        title: vars.title,
        completed: false,
      };
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) =>
            t.id === vars.taskId
              ? { ...t, subtasks: [...(t.subtasks ?? []), optimistic] }
              : t,
          ),
        };
      });
      return { prev, optimisticId: optimistic.id };
    },
    onError: (_, vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['wm', 'project', vars.projectId], ctx.prev);
    },
    onSuccess: (real, vars, ctx: any) => {
      // Replace optimistic temp-sub-... mit echter ID, damit Toggle danach klappt.
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) => {
            if (t.id !== vars.taskId) return t;
            return {
              ...t,
              subtasks: (t.subtasks ?? []).map((s: any) =>
                s.id === ctx?.optimisticId ? { ...s, ...real } : s,
              ),
            };
          }),
        };
      });
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
    },
  });
}

export function useToggleWmSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subtaskId: string; taskId: string; projectId: string }) => {
      // Subtask muss bereits den echten Server-UUID haben — wenn der CREATE
      // noch nicht zurueck ist, hat der User auch noch nichts zum togglen.
      // Trotzdem defensive: temp-sub-... blockieren statt 500 zu werfen.
      if (data.subtaskId.startsWith('temp-')) {
        return Promise.reject(new Error('Subtask wird noch gespeichert — bitte gleich nochmal versuchen.'));
      }
      return wmFetch<WmSubtask>(`/subtasks/${data.subtaskId}/toggle`, { method: 'PATCH' });
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['wm', 'project', vars.projectId] });
      const prev = qc.getQueryData(['wm', 'project', vars.projectId]);
      qc.setQueryData(['wm', 'project', vars.projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: (old.tasks ?? []).map((t: any) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  subtasks: (t.subtasks ?? []).map((s: any) =>
                    s.id === vars.subtaskId ? { ...s, completed: !s.completed } : s,
                  ),
                }
              : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_, vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['wm', 'project', vars.projectId], ctx.prev);
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['wm', 'project', vars.projectId] });
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
