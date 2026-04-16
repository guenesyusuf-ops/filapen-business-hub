'use client';

import { cn } from '@/lib/utils';
import { useWmWorkload } from '@/hooks/work-management/useWm';
import { Users, AlertTriangle, Clock, Flag, ListChecks } from 'lucide-react';

export default function WorkloadPage() {
  const { data: workload, isLoading, error } = useWmWorkload();

  const maxTasks = Math.max(...(workload ?? []).map((w) => w.openTasks), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auslastung</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Uebersicht der Aufgabenverteilung im Team
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          Fehler beim Laden der Auslastungs-Daten.
        </div>
      )}

      {!isLoading && !error && workload && workload.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Keine Auslastungs-Daten</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Erstelle Projekte und weise Aufgaben zu.</p>
        </div>
      )}

      {!isLoading && !error && workload && workload.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_6rem_5rem_5rem_5rem_1fr] gap-2 px-5 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>Mitglied</span>
            <span className="text-center">Offene Tasks</span>
            <span className="text-center">Heute</span>
            <span className="text-center">Ueberfaellig</span>
            <span className="text-center">Prio Hoch</span>
            <span>Auslastung</span>
          </div>

          {/* Rows */}
          {workload.map((entry) => {
            const barWidth = (entry.openTasks / maxTasks) * 100;
            const barColor = entry.overdue > 0
              ? 'bg-red-400'
              : entry.highPriority > 2
                ? 'bg-orange-400'
                : 'bg-primary-400';

            return (
              <div
                key={entry.memberId}
                className="grid grid-cols-[1fr_6rem_5rem_5rem_5rem_1fr] gap-2 px-5 py-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors items-center"
              >
                {/* Name */}
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                    {entry.memberName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {entry.memberName}
                  </span>
                </div>

                {/* Open tasks */}
                <div className="flex items-center justify-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{entry.openTasks}</span>
                </div>

                {/* Due today */}
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{entry.dueToday}</span>
                </div>

                {/* Overdue */}
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className={cn('h-3.5 w-3.5', entry.overdue > 0 ? 'text-red-500' : 'text-gray-300 dark:text-gray-600')} />
                  <span className={cn('text-sm font-semibold', entry.overdue > 0 ? 'text-red-500' : 'text-gray-400')}>
                    {entry.overdue}
                  </span>
                </div>

                {/* High priority */}
                <div className="flex items-center justify-center gap-1">
                  <Flag className={cn('h-3.5 w-3.5', entry.highPriority > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600')} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{entry.highPriority}</span>
                </div>

                {/* Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-8 text-right">
                    {entry.openTasks}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
