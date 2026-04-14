'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMyWmTasks, useUpdateWmTask } from '@/hooks/work-management/useWm';
import type { WmTask } from '@/hooks/work-management/useWm';
import { CheckCircle2, Circle, Calendar, Flag, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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

interface TaskGroup {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  tasks: WmTask[];
}

function categorize(tasks: WmTask[]): TaskGroup[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const overdue: WmTask[] = [];
  const today: WmTask[] = [];
  const thisWeek: WmTask[] = [];
  const later: WmTask[] = [];
  const noDue: WmTask[] = [];

  for (const t of tasks) {
    if (t.completed) continue;
    if (!t.dueDate) {
      noDue.push(t);
      continue;
    }
    const d = t.dueDate.split('T')[0];
    if (d < todayStr) overdue.push(t);
    else if (d === todayStr) today.push(t);
    else if (d <= weekEndStr) thisWeek.push(t);
    else later.push(t);
  }

  const groups: TaskGroup[] = [];
  if (overdue.length > 0) groups.push({ label: 'Ueberfaellig', icon: AlertTriangle, iconColor: 'text-red-500', tasks: overdue });
  if (today.length > 0) groups.push({ label: 'Heute faellig', icon: Calendar, iconColor: 'text-orange-500', tasks: today });
  if (thisWeek.length > 0) groups.push({ label: 'Diese Woche', icon: Clock, iconColor: 'text-blue-500', tasks: thisWeek });
  if (later.length > 0) groups.push({ label: 'Spaeter', icon: ArrowRight, iconColor: 'text-gray-400', tasks: later });
  if (noDue.length > 0) groups.push({ label: 'Ohne Datum', icon: Flag, iconColor: 'text-gray-400', tasks: noDue });

  return groups;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export default function MyTasksPage() {
  const { data: tasks, isLoading, error } = useMyWmTasks();
  const updateTask = useUpdateWmTask();

  const groups = useMemo(() => categorize(tasks ?? []), [tasks]);

  function toggleComplete(task: WmTask) {
    updateTask.mutate({ id: task.id, completed: !task.completed });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meine Aufgaben</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Alle dir zugewiesenen Aufgaben ueber alle Projekte
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          Fehler beim Laden der Aufgaben.
        </div>
      )}

      {!isLoading && !error && groups.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Alles erledigt!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Dir sind aktuell keine offenen Aufgaben zugewiesen.</p>
        </div>
      )}

      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-3">
              <GroupIcon className={cn('h-4 w-4', group.iconColor)} />
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {group.label}
              </h2>
              <span className="text-xs text-gray-400 font-medium">{group.tasks.length}</span>
            </div>

            <div className="space-y-1">
              {group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] hover:shadow-sm transition-all"
                >
                  <button
                    onClick={() => toggleComplete(task)}
                    className="text-gray-400 hover:text-primary-500 transition-colors flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>

                  <Link
                    href={`/work-management/${task.projectId}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      {task.title}
                    </p>
                  </Link>

                  {task.dueDate && (
                    <span className={cn(
                      'text-xs flex-shrink-0',
                      new Date(task.dueDate) < new Date(new Date().toDateString())
                        ? 'text-red-500 font-semibold'
                        : 'text-gray-400',
                    )}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}

                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', PRIORITY_STYLES[task.priority])}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
