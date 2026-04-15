'use client';

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Columns3, List, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import {
  useWmProject,
  useCreateWmTask,
  useUpdateWmTask,
  useMoveWmTask,
  useCreateWmColumn,
  useWmComments,
  useCreateWmComment,
  useUploadWmAttachment,
  useDeleteWmAttachment,
  useWmLabels,
  useWmMembers,
} from '@/hooks/work-management/useWm';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import dynamic from 'next/dynamic';

// Lazy-load DnD components to avoid SSR issues with @dnd-kit
const KanbanBoard = dynamic(() => import('@/components/work-management/KanbanBoard').then(m => ({ default: m.KanbanBoard })), { ssr: false });
const TaskListView = dynamic(() => import('@/components/work-management/TaskListView').then(m => ({ default: m.TaskListView })), { ssr: false });
const TaskDetailModal = dynamic(() => import('@/components/work-management/TaskDetailModal').then(m => ({ default: m.TaskDetailModal })), { ssr: false });

type ViewTab = 'board' | 'list';

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
  const moveTask = useMoveWmTask();
  const createColumn = useCreateWmColumn();
  const { data: labels = [] } = useWmLabels(projectId);
  const { data: members = [] } = useWmMembers(projectId);

  const [activeTab, setActiveTab] = useState<ViewTab>('board');
  const [selectedTask, setSelectedTask] = useState<WmTask | null>(null);

  // Comments for selected task
  const { data: comments = [] } = useWmComments(selectedTask?.id ?? '');
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
    (columnId: string, data: { title: string; assigneeId?: string; priority?: string }) => {
      createTask.mutate({ projectId, columnId, ...data });
    },
    [createTask, projectId],
  );

  const handleAddColumn = useCallback(() => {
    const name = prompt('Spaltenname:');
    if (!name?.trim()) return;
    createColumn.mutate({ projectId, name: name.trim() });
  }, [createColumn, projectId]);

  const handleTaskClick = useCallback((task: WmTask) => {
    setSelectedTask(task);
  }, []);

  const handleUpdateTask = useCallback(
    (data: Partial<WmTask> & { id: string }) => {
      updateTask.mutate(data, {
        onSuccess: (updated) => {
          if (selectedTask?.id === updated.id) {
            setSelectedTask(updated);
          }
        },
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
  const allTasks = project.tasks ?? [];
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <WmErrorBoundary>
        {activeTab === 'board' ? (
          <KanbanBoard
            columns={columns}
            members={members}
            onMoveTask={handleMoveTask}
            onAddTask={handleAddTask}
            onTaskClick={handleTaskClick}
            onAddColumn={handleAddColumn}
          />
        ) : (
          <TaskListView
            columns={columns}
            onTaskClick={handleTaskClick}
            onToggleComplete={handleToggleComplete}
          />
        )}
        </WmErrorBoundary>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          members={members}
          labels={labels}
          comments={comments}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onAddComment={(content) => createComment.mutate({ taskId: selectedTask.id, content })}
          onUploadAttachment={(file) => uploadAttachment.mutate({ taskId: selectedTask.id, file })}
          onDeleteAttachment={(attachmentId) => deleteAttachment.mutate({ taskId: selectedTask.id, attachmentId })}
        />
      )}
    </div>
  );
}
