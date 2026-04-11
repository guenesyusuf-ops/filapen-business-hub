'use client';

import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import type { CreatorAnalyticsRow } from '@/hooks/creators/useCreatorDashboard';

// ---------------------------------------------------------------------------
// CreatorsAnalyticsTable
// Scrollable table of creators that have at least one upload.
// Sorted by newest upload desc (already done on the server).
// ---------------------------------------------------------------------------

interface Props {
  rows: CreatorAnalyticsRow[] | undefined;
  loading: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function isOnline(row: CreatorAnalyticsRow): boolean {
  // Fallback heuristic: active status or recent login -> online.
  if (row.status === 'active') return true;
  if (!row.lastLogin) return false;
  const diff = Date.now() - new Date(row.lastLogin).getTime();
  return diff < 1000 * 60 * 60 * 24 * 7;
}

export function CreatorsAnalyticsTable({ rows, loading }: Props) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-white/5 bg-[#111]">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Analytics</h2>
            <p className="text-xs text-white/40">
              Creator mit Uploads, sortiert nach neuestem Upload
            </p>
          </div>
        </div>
        <div className="text-xs text-white/40">
          {loading ? '...' : `${rows?.length ?? 0} Eintraege`}
        </div>
      </header>

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#111]">
            <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-white/40">
              <th className="px-5 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Produkt</th>
              <th className="px-4 py-3 text-left font-medium">Batch</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Online seit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-6 animate-pulse rounded bg-white/5" />
                  </td>
                </tr>
              ))
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-white/40"
                >
                  Noch keine Uploads vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const online = isOnline(row);
                const uploadDate = new Date(row.latestUploadAt);
                return (
                  <tr
                    key={row.creatorId}
                    onClick={() => router.push(`/creators/list/${row.creatorId}`)}
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-white">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {row.name}
                          </div>
                          <div className="text-xs text-white/40">
                            ({row.uploadCount} Upload{row.uploadCount === 1 ? '' : 's'})
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {row.product || <span className="text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {row.batch || <span className="text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-xs">
                        <span
                          className={[
                            'h-1.5 w-1.5 rounded-full',
                            online ? 'bg-green-400' : 'bg-white/30',
                          ].join(' ')}
                        />
                        <span className={online ? 'text-green-400' : 'text-white/50'}>
                          {online ? 'online' : 'offline'}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-white/60">
                      {dateFormatter.format(uploadDate)}
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
