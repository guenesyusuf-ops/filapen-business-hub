'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { WmTask } from '@/hooks/work-management/useWm';
import { Calendar, User, CheckSquare } from 'lucide-react';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-blue-500 text-white',
  low: 'bg-gray-400 text-white',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Dringend',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

interface KanbanTaskCardProps {
  task: WmTask;
  onClick: () => void;
}

export function KanbanTaskCard({ task, onClick }: KanbanTaskCardProps) {
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
        'group rounded-lg border bg-white dark:bg-[var(--card-bg,#1a1d2e)] p-3 cursor-grab active:cursor-grabbing',
        'border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-150',
        'hover:border-primary-300 dark:hover:border-primary-500/40',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary-400',
        task.color && 'border-l-4',
      )}
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority */}
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', PRIORITY_STYLES[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </span>

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

        {/* Assignee */}
        {task.assigneeName && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
              {task.assigneeName.charAt(0).toUpperCase()}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
