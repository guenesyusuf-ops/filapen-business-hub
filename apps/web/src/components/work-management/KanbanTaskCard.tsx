'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { WmTask } from '@/hooks/work-management/useWm';
import { Calendar, CheckSquare, Star, X } from 'lucide-react';

const PRIORITY_STARS: Record<string, number> = {
  urgent: 3,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-gray-300',
};

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface KanbanTaskCardProps {
  task: WmTask;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
}

export function KanbanTaskCard({ task, onClick, onDelete }: KanbanTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const overdue = isOverdue(task.dueDate);
  const stars = PRIORITY_STARS[task.priority] ?? 2;
  const starColor = PRIORITY_COLOR[task.priority] ?? 'text-gray-300';

  const cardStyle = {
    ...style,
    ...(task.color ? { borderLeftColor: task.color, borderLeftWidth: '4px' } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'group relative rounded-lg border bg-white dark:bg-[var(--card-bg,#1a1d2e)] p-3 cursor-grab active:cursor-grabbing',
        'border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-150',
        'hover:border-primary-300 dark:hover:border-primary-500/40',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary-400',
        task.color && 'border-l-4',
      )}
    >
      {/* Delete button (hover) */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Aufgabe loeschen?')) onDelete(task.id);
          }}
          className="absolute top-1.5 right-1.5 p-0.5 rounded bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
          title="Loeschen"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Labels as colored badges */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Priority Stars */}
      <div className="flex items-center gap-0.5 mb-2">
        {[1, 2, 3].map((n) => (
          <Star
            key={n}
            className={cn('h-3 w-3', n <= stars ? `${starColor} fill-current` : 'text-gray-200 dark:text-gray-700')}
          />
        ))}
      </div>

      {/* Bottom row: Due date + Subtasks + Assignee(s) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Due date */}
        {task.dueDate && (
          <span className={cn(
            'flex items-center gap-1 text-[11px]',
            overdue ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400',
          )}>
            <Calendar className="h-3 w-3" />
            {formatDueDate(task.dueDate)}
          </span>
        )}

        {/* Subtask progress */}
        {totalSubtasks > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <CheckSquare className="h-3 w-3" />
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Person avatar — assignee if set, otherwise creator */}
        {(() => {
          const name = task.assigneeName || (task as any).createdByName || task.createdBy || '';
          if (!name) return null;
          const avatarUrl = (task as any).assigneeAvatarUrl || (task as any).createdByAvatarUrl;
          const isAssignee = !!task.assigneeName;
          return (
            <div className="flex -space-x-1.5" title={isAssignee ? `Zugewiesen: ${name}` : `Erstellt von: ${name}`}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-6 w-6 rounded-full border-2 border-white dark:border-[#1a1d2e] object-cover"
                />
              ) : (
                <span
                  className={cn(
                    'h-6 w-6 rounded-full border-2 border-white dark:border-[#1a1d2e] flex items-center justify-center text-[9px] font-bold',
                    isAssignee
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                  )}
                >
                  {getInitials(name)}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
