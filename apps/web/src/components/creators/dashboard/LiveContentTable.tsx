'use client';

import { Radio } from 'lucide-react';
import type { LiveContentItem } from '@/hooks/creators/useCreatorDashboard';

// ---------------------------------------------------------------------------
// LiveContentTable
// Shows all uploads with liveStatus = 'live'. Includes an "Offline" button
// per row that triggers the go-offline mutation after confirmation.
// ---------------------------------------------------------------------------

interface Props {
  rows: LiveContentItem[] | undefined;
  loading: boolean;
  onGoOffline: (uploadId: string, label: string) => void;
  offlineLoading?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function LiveContentTable({ rows, loading, onGoOffline, offlineLoading }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]">
      <header className="flex items-center justify-between border-b border-gray-200 dark:border-white/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Live Content</h2>
            <p className="text-xs text-gray-500 dark:text-white/40">
              Aktuell veroeffentlichte Inhalte
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-white/40">
          {loading ? '...' : `${rows?.length ?? 0} Eintraege`}
        </div>
      </header>

      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-[var(--card-bg)]">
            <tr className="border-b border-gray-200 dark:border-white/8 text-xs uppercase tracking-wide text-gray-500 dark:text-white/40">
              <th className="px-5 py-3 text-left font-medium">Creator</th>
              <th className="px-4 py-3 text-left font-medium">Content</th>
              <th className="px-4 py-3 text-left font-medium">Produkt</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Datum</th>
              <th className="px-5 py-3 text-right font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/5">
                  <td colSpan={6} className="px-5 py-4">
                    <div className="h-6 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                  </td>
                </tr>
              ))
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-gray-500 dark:text-white/40"
                >
                  Kein Live Content vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((item) => {
                const label = item.label || item.fileName;
                const liveDateStr = item.liveDate
                  ? dateFormatter.format(new Date(item.liveDate))
                  : '\u2014';

                return (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-xs font-semibold text-gray-900 dark:text-white">
                          {(item.creator?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {item.creator?.name ?? 'Unbekannt'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-white/70 max-w-[180px] truncate">
                      {label}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-white/70">
                      {item.product || <span className="text-gray-400 dark:text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                        <span className="text-green-600 dark:text-green-400">Online</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-white/60">
                      {liveDateStr}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        disabled={offlineLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Bist du sicher? Der Creator wird benachrichtigt.`)) {
                            onGoOffline(item.id, label);
                          }
                        }}
                        className="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Offline
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
