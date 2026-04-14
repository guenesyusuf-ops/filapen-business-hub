'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import { ArrowUpDown, Calendar, User, CheckCircle2, Circle } from 'lucide-react';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

type SortKey = 'title' | 'status' | 'assignee' | 'dueDate' | 'priority';

interface ColumnWithTasks extends WmColumn {
  tasks: WmTask[];
}

interface TaskListViewProps {
  columns: ColumnWithTasks[];
  onTaskClick: (task: WmTask) => void;
  onToggleComplete: (task: WmTask) => void;
}

export function TaskListView({ columns, onTaskClick, onToggleComplete }: TaskListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(true);

  const columnMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [columns]);

  const allTasks = useMemo(() => {
    return columns.flatMap((col) =>
      col.tasks.map((t) => ({ ...t, columnName: col.name })),
    );
  }, [columns]);

  const sorted = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...allTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = a.columnName.localeCompare(b.columnName);
          break;
        case 'assignee':
          cmp = (a.assigneeName ?? '').localeCompare(b.assigneeName ?? '');
          break;
        case 'dueDate':
          cmp = (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
          break;
        case 'priority':
          cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [allTasks, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const headerCls = 'flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 select-none';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2rem_1fr_8rem_8rem_8rem_6rem_8rem] gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <span />
        <div className={headerCls} onClick={() => toggleSort('title')}>
          Titel <ArrowUpDown className="h-3 w-3" />
        </div>
        <div className={headerCls} onClick={() => toggleSort('status')}>
          Status <ArrowUpDown className="h-3 w-3" />
        </div>
        <div className={headerCls} onClick={() => toggleSort('assignee')}>
          Zugewiesen <ArrowUpDown className="h-3 w-3" />
        </div>
        <div className={headerCls} onClick={() => toggleSort('dueDate')}>
          Faellig <ArrowUpDown className="h-3 w-3" />
        </div>
        <div className={headerCls} onClick={() => toggleSort('priority')}>
          Prio <ArrowUpDown className="h-3 w-3" />
        </div>
        <span>Labels</span>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          Keine Aufgaben vorhanden
        </div>
      ) : (
        sorted.map((task) => (
          <div
            key={task.id}
            className="grid grid-cols-[2rem_1fr_8rem_8rem_8rem_6rem_8rem] gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors items-center"
          >
            {/* Checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
              className="text-gray-400 hover:text-primary-500 transition-colors"
            >
              {task.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>

            {/* Title */}
            <button
              onClick={() => onTaskClick(task)}
              className={cn(
                'text-sm text-left truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors',
                task.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {task.title}
            </button>

            {/* Status */}
            <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 truncate text-center">
              {task.columnName}
            </span>

            {/* Assignee */}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {task.assigneeName ?? '-'}
            </span>

            {/* Due date */}
            <span className={cn(
              'text-xs truncate',
              task.dueDate && isOverdue(task.dueDate) ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400',
            )}>
              {task.dueDate ? formatDate(task.dueDate) : '-'}
            </span>

            {/* Priority */}
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded text-center', PRIORITY_STYLES[task.priority])}>
              {PRIORITY_LABELS[task.priority]}
            </span>

            {/* Labels */}
            <div className="flex gap-1 overflow-hidden">
              {task.labels?.slice(0, 3).map((l) => (
                <span
                  key={l.id}
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: l.color }}
                  title={l.name}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
