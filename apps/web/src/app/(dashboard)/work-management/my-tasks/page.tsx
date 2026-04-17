'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMyWmTasks, useUpdateWmTask, useWmProjects } from '@/hooks/work-management/useWm';
import { useAutoCompleteTask } from '@/hooks/work-management/useWmDashboard';
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
  bgColor: string;
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
  if (overdue.length > 0) groups.push({ label: 'Überfällig', icon: AlertTriangle, iconColor: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/10', tasks: overdue });
  if (today.length > 0) groups.push({ label: 'Heute fällig', icon: Calendar, iconColor: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/10', tasks: today });
  if (thisWeek.length > 0) groups.push({ label: 'Diese Woche', icon: Clock, iconColor: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/10', tasks: thisWeek });
  if (later.length > 0) groups.push({ label: 'Später', icon: ArrowRight, iconColor: 'text-gray-400', bgColor: '', tasks: later });
  if (noDue.length > 0) groups.push({ label: 'Ohne Deadline', icon: Flag, iconColor: 'text-gray-400', bgColor: '', tasks: noDue });

  return groups;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export default function MyTasksPage() {
  const { data: tasks, isLoading, error } = useMyWmTasks();
  const { data: projects } = useWmProjects();
  const updateTask = useUpdateWmTask();

  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    if (projects) {
      for (const p of projects) {
        map.set(p.id, { name: p.name, color: p.color });
      }
    }
    return map;
  }, [projects]);

  const groups = useMemo(() => categorize(tasks ?? []), [tasks]);

  const openCount = useMemo(() => (tasks ?? []).filter((t) => !t.completed).length, [tasks]);

  function toggleComplete(task: WmTask) {
    updateTask.mutate({ id: task.id, completed: !task.completed });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mein Tag</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {openCount > 0
              ? `${openCount} offene Aufgaben ueber alle Projekte`
              : 'Alle Aufgaben erledigt'}
          </p>
        </div>
        <Link
          href="/work-management"
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
        >
          Alle Projekte
        </Link>
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
          <div key={group.label} className="space-y-2">
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', group.bgColor)}>
              <GroupIcon className={cn('h-4 w-4', group.iconColor)} />
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {group.label}
              </h2>
              <span className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded-full',
                group.label === 'Überfällig'
                  ? 'bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
              )}>
                {group.tasks.length}
              </span>
            </div>

            <div className="space-y-1">
              {group.tasks.map((task) => {
                const proj = projectMap.get(task.projectId);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-white dark:bg-[var(--card-bg,#1a1d2e)] hover:shadow-sm transition-all',
                      group.label === 'Überfällig'
                        ? 'border-red-200 dark:border-red-900/30'
                        : 'border-gray-200 dark:border-white/10',
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleComplete(task)}
                      className="text-gray-400 hover:text-green-500 transition-colors flex-shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>

                    {/* Title -> link to project board */}
                    <Link
                      href={`/work-management/${task.projectId}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                        {task.title}
                      </p>
                    </Link>

                    {/* Project badge */}
                    {proj && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border"
                        style={{
                          borderColor: proj.color,
                          color: proj.color,
                          backgroundColor: `${proj.color}15`,
                        }}
                      >
                        {proj.name}
                      </span>
                    )}

                    {/* Due date */}
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

                    {/* Priority */}
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', PRIORITY_STYLES[task.priority])}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
