'use client';

import { useRouter } from 'next/navigation';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatorAvatar } from '@/components/creators/CreatorAvatar';
import type { CreatorAnalyticsRow } from '@/hooks/creators/useCreatorDashboard';

interface Props {
  rows: CreatorAnalyticsRow[] | undefined;
  loading: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const BADGE = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';

function CompensationBadges({ row }: { row: CreatorAnalyticsRow }) {
  const badges: React.ReactNode[] = [];

  if (row.fixAmount != null && Number(row.fixAmount) > 0) {
    badges.push(
      <span key="fix" className={`${BADGE} bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300`}>
        {Number(row.fixAmount).toLocaleString('de-DE')} €
      </span>,
    );
  }
  if (row.provision) {
    const prov = row.provision.trim().endsWith('%') ? row.provision.trim() : `${row.provision.trim()}%`;
    badges.push(
      <span key="prov" className={`${BADGE} bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300`}>
        {prov}
      </span>,
    );
  }
  if (badges.length === 0 && row.compensation) {
    badges.push(
      <span key="comp" className={`${BADGE} bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400`}>
        {row.compensation}
      </span>,
    );
  }
  if (badges.length === 0) return <span className="text-gray-300 dark:text-white/20">&mdash;</span>;
  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

export function CreatorsAnalyticsTable({ rows, loading }: Props) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Creator mit Uploads</h2>
            <p className="text-[11px] text-gray-400 dark:text-white/30">
              Sortiert nach neuestem Upload
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
          {loading ? '...' : rows?.length ?? 0}
        </span>
      </header>

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/80 dark:bg-[#1a1d2e]/80 backdrop-blur-sm">
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-white/30">
              <th className="px-5 py-3 text-left font-medium">Creator</th>
              <th className="px-4 py-3 text-left font-medium">Produkt</th>
              <th className="px-4 py-3 text-left font-medium">Batch</th>
              <th className="px-4 py-3 text-left font-medium">Vergütung</th>
              <th className="px-5 py-3 text-right font-medium">Letzter Upload</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03]">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-6 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
                  </td>
                </tr>
              ))
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-gray-300 dark:text-white/20" />
                    </div>
                    <p className="text-sm text-gray-400 dark:text-white/30">Noch keine Uploads vorhanden</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.creatorId}
                  onClick={() => router.push(`/creators/list/${row.creatorId}`)}
                  className="group cursor-pointer border-b border-gray-50 dark:border-white/[0.03] transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <CreatorAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {row.name}
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-gray-300 dark:text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-white/30">
                          {row.uploadCount} Upload{row.uploadCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-white/60">
                    {row.product || <span className="text-gray-300 dark:text-white/15">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-white/60">
                    {row.batch || <span className="text-gray-300 dark:text-white/15">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3">
                    <CompensationBadges row={row} />
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500 dark:text-white/40 tabular-nums">
                    {dateFormatter.format(new Date(row.latestUploadAt))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
