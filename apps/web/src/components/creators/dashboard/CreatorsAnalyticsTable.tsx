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

// ---------------------------------------------------------------------------
// Compensation badge helpers
// ---------------------------------------------------------------------------

function getCompensationBadge(row: CreatorAnalyticsRow): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  const comp = row.compensation?.toLowerCase() ?? '';

  if (comp.includes('fix') || comp === 'fixpreis') {
    const amount = row.fixAmount != null ? ` ${Number(row.fixAmount).toLocaleString('de-DE')} \u20AC` : '';
    return {
      label: `Fixpreis${amount}`,
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-50 dark:bg-blue-500/10',
    };
  }

  if (comp.includes('revenue') || comp.includes('share') || comp === 'revenue share') {
    const prov = row.provision ? ` ${row.provision}` : '';
    return {
      label: `Rev. Share${prov}`,
      colorClass: 'text-green-600 dark:text-green-400',
      bgClass: 'bg-green-50 dark:bg-green-500/10',
    };
  }

  if (comp.includes('gratis') || comp.includes('produkt') || comp === 'gratisprodukt') {
    return {
      label: 'Gratisprodukt',
      colorClass: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-50 dark:bg-orange-500/10',
    };
  }

  if (comp) {
    const extra = row.provision ? ` ${row.provision}` : row.fixAmount != null ? ` ${Number(row.fixAmount).toLocaleString('de-DE')} \u20AC` : '';
    return {
      label: `${row.compensation}${extra}`,
      colorClass: 'text-gray-600 dark:text-white/60',
      bgClass: 'bg-gray-100 dark:bg-white/5',
    };
  }

  return {
    label: '\u2014',
    colorClass: 'text-gray-400 dark:text-white/30',
    bgClass: 'bg-gray-100 dark:bg-white/5',
  };
}

export function CreatorsAnalyticsTable({ rows, loading }: Props) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]">
      <header className="flex items-center justify-between border-b border-gray-200 dark:border-white/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Analytics</h2>
            <p className="text-xs text-gray-500 dark:text-white/40">
              Creator mit Uploads, sortiert nach neuestem Upload
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-white/40">
          {loading ? '...' : `${rows?.length ?? 0} Eintraege`}
        </div>
      </header>

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-[var(--card-bg)]">
            <tr className="border-b border-gray-200 dark:border-white/8 text-xs uppercase tracking-wide text-gray-500 dark:text-white/40">
              <th className="px-5 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Produkt</th>
              <th className="px-4 py-3 text-left font-medium">Batch</th>
              <th className="px-4 py-3 text-left font-medium">Verguetung</th>
              <th className="px-5 py-3 text-right font-medium">Letzter Upload</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/5">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-6 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                  </td>
                </tr>
              ))
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-gray-500 dark:text-white/40"
                >
                  Noch keine Uploads vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const uploadDate = new Date(row.latestUploadAt);
                const badge = getCompensationBadge(row);
                return (
                  <tr
                    key={row.creatorId}
                    onClick={() => router.push(`/creators/list/${row.creatorId}`)}
                    className="cursor-pointer border-b border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-xs font-semibold text-gray-900 dark:text-white">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {row.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white/40">
                            ({row.uploadCount} Upload{row.uploadCount === 1 ? '' : 's'})
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-white/70">
                      {row.product || <span className="text-gray-400 dark:text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-white/70">
                      {row.batch || <span className="text-gray-400 dark:text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bgClass} ${badge.colorClass}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-white/60">
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
