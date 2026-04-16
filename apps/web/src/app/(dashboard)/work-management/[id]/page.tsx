'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Columns3, List, ArrowLeft, Plus, X, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import {
  useWmProject,
  useCreateWmTask,
  useUpdateWmTask,
  useDeleteWmTask,
  useMoveWmTask,
  useCreateWmColumn,
  useWmComments,
  useCreateWmComment,
  useUploadWmAttachment,
  useDeleteWmAttachment,
  useWmLabels,
  useWmMembers,
  useCreateWmLabel,
  useAddLabelToTask,
  useRemoveLabelFromTask,
  useWmActivities,
} from '@/hooks/work-management/useWm';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import dynamic from 'next/dynamic';

// Lazy-load DnD components to avoid SSR issues with @dnd-kit
const KanbanBoard = dynamic(() => import('@/components/work-management/KanbanBoard').then(m => ({ default: m.KanbanBoard })), { ssr: false });
const TaskListView = dynamic(() => import('@/components/work-management/TaskListView').then(m => ({ default: m.TaskListView })), { ssr: false });
const TaskDetailModal = dynamic(() => import('@/components/work-management/TaskDetailModal').then(m => ({ default: m.TaskDetailModal })), { ssr: false });
const BurndownChart = dynamic(() => import('@/components/work-management/BurndownChart').then(m => ({ default: m.BurndownChart })), { ssr: false });

type ViewTab = 'board' | 'list' | 'burndown';

const COLUMN_COLORS = [
  { value: '#6B7280', label: 'Grau' },
  { value: '#3B82F6', label: 'Blau' },
  { value: '#10B981', label: 'Gruen' },
  { value: '#F59E0B', label: 'Gelb' },
  { value: '#EF4444', label: 'Rot' },
  { value: '#8B5CF6', label: 'Lila' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#F97316', label: 'Orange' },
];

function AddColumnPopover({ onAdd, onClose }: { onAdd: (name: string, color: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLUMN_COLORS[0].value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="relative w-72 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Neue Spalte</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim(), color); onClose(); } }}
        placeholder="Spaltenname..."
        autoFocus
        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      <div>
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Farbe</span>
        <div className="flex gap-2 flex-wrap">
          {COLUMN_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-all',
                color === c.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>
      <button
        onClick={() => { if (name.trim()) { onAdd(name.trim(), color); onClose(); } }}
        disabled={!name.trim()}
        className="w-full rounded-lg bg-primary-600 text-white text-sm font-semibold py-2 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Erstellen
      </button>
    </div>
  );
}

// Error boundary to catch @dnd-kit runtime crashes
class WmErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Fehler im Board</p>
          <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })} className="mt-3 text-xs text-red-600 underline">Erneut versuchen</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project, isLoading, error } = useWmProject(projectId);
  const createTask = useCreateWmTask();
  const updateTask = useUpdateWmTask();
  const deleteTask = useDeleteWmTask();
  const moveTask = useMoveWmTask();
  const createColumn = useCreateWmColumn();
  const { data: labels = [] } = useWmLabels(projectId);
  const { data: members = [] } = useWmMembers(projectId);
  const createLabel = useCreateWmLabel();
  const addLabelToTask = useAddLabelToTask();
  const removeLabelFromTask = useRemoveLabelFromTask();

  const [activeTab, setActiveTab] = useState<ViewTab>('board');
  const [selectedTask, setSelectedTask] = useState<WmTask | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);

  // Comments and activities for selected task
  const { data: comments = [] } = useWmComments(selectedTask?.id ?? '');
  const { data: activities = [] } = useWmActivities(selectedTask?.id ?? '');
  const createComment = useCreateWmComment();
  const uploadAttachment = useUploadWmAttachment();
  const deleteAttachment = useDeleteWmAttachment();

  const handleMoveTask = useCallback(
    (taskId: string, columnId: string, position: number) => {
      moveTask.mutate({ taskId, projectId, columnId, position });
    },
    [moveTask, projectId],
  );

  const handleAddTask = useCallback(
    (columnId: string, data: { title: string; assigneeIds?: string[]; priority?: string }) => {
      createTask.mutate({ projectId, columnId, ...data });
    },
    [createTask, projectId],
  );

  const handleAddColumn = useCallback(() => {
    setShowAddColumn(true);
  }, []);

  const handleCreateColumn = useCallback((name: string, color: string) => {
    createColumn.mutate({ projectId, name, color });
  }, [createColumn, projectId]);

  const handleTaskClick = useCallback((task: WmTask) => {
    setSelectedTask(task);
  }, []);

  const handleUpdateTask = useCallback(
    (data: Partial<WmTask> & { id: string }) => {
      // Return a promise so TaskDetailModal's save-button spinner can await success/failure
      return new Promise<WmTask>((resolve, reject) => {
        updateTask.mutate(data, {
          onSuccess: (updated) => {
            if (selectedTask?.id === updated.id) {
              setSelectedTask(updated);
            }
            resolve(updated);
          },
          onError: (err) => reject(err),
        });
      });
    },
    [updateTask, selectedTask],
  );

  const handleToggleComplete = useCallback(
    (task: WmTask) => {
      updateTask.mutate({ id: task.id, completed: !task.completed });
    },
    [updateTask],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link href="/work-management" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurueck zu Projekte
        </Link>
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          Projekt konnte nicht geladen werden.
        </div>
      </div>
    );
  }

  // Map tasks into their columns (API returns tasks separately)
  // Map API tasks to frontend shape (taskLabels → labels, subtask mapping)
  const allTasks = (project.tasks ?? []).map((t: any) => ({
    ...t,
    labels: (t.taskLabels ?? []).map((tl: any) => tl.label).filter(Boolean),
    subtasks: t.subtasks ?? [],
    attachments: t.attachments ?? [],
    assignees: t.assignees ?? [],
    assigneeIds: t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []),
    assigneeName: t.assigneeName ?? t.assignees?.[0]?.userName,
  })) as WmTask[];

  const columns = (project.columns ?? []).map((col: WmColumn) => ({
    ...col,
    tasks: allTasks
      .filter((t: WmTask) => t.columnId === col.id && !t.parentTaskId)
      .sort((a: WmTask, b: WmTask) => (a.position ?? 0) - (b.position ?? 0)),
  }));

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/work-management" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{project.name}</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] p-0.5">
          <button
            onClick={() => setActiveTab('board')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeTab === 'board'
                ? 'bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeTab === 'list'
                ? 'bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            <List className="h-3.5 w-3.5" />
            Liste
          </button>
          <button
            onClick={() => setActiveTab('burndown')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeTab === 'burndown'
                ? 'bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Burndown
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6 relative">
        <WmErrorBoundary>
        {activeTab === 'board' ? (
          <KanbanBoard
            columns={columns}
            members={members}
            onMoveTask={handleMoveTask}
            onAddTask={handleAddTask}
            onTaskClick={handleTaskClick}
            onDeleteTask={(taskId) => deleteTask.mutate({ id: taskId, projectId })}
            onAddColumn={handleAddColumn}
          />
        ) : activeTab === 'list' ? (
          <TaskListView
            columns={columns}
            onTaskClick={handleTaskClick}
            onToggleComplete={handleToggleComplete}
          />
        ) : (
          <BurndownChart projectId={projectId} />
        )}
        </WmErrorBoundary>

        {/* Add column popover */}
        {showAddColumn && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0" onClick={() => setShowAddColumn(false)} />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2">
              <AddColumnPopover
                onAdd={handleCreateColumn}
                onClose={() => setShowAddColumn(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          members={members}
          labels={labels}
          comments={comments}
          activities={activities}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onAddComment={(content) => createComment.mutate({ taskId: selectedTask.id, content })}
          onUploadAttachment={(file) => uploadAttachment.mutate({ taskId: selectedTask.id, file })}
          onDeleteAttachment={(attachmentId) => deleteAttachment.mutate({ taskId: selectedTask.id, attachmentId })}
          onAddLabel={(taskId, labelId) => addLabelToTask.mutate({ taskId, labelId, projectId })}
          onRemoveLabel={(taskId, labelId) => removeLabelFromTask.mutate({ taskId, labelId, projectId })}
          onCreateLabel={(name, color) => createLabel.mutate({ projectId, name, color })}
        />
      )}
    </div>
  );
}
