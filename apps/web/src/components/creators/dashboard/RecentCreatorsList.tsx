'use client';

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import type { RecentCreator } from '@/hooks/creators/useCreatorDashboard';

// ---------------------------------------------------------------------------
// RecentCreatorsList — top 5 newest creators in the right sidebar.
// ---------------------------------------------------------------------------

interface Props {
  creators: RecentCreator[] | undefined;
  loading: boolean;
}

export function RecentCreatorsList({ creators, loading }: Props) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-5 shadow-card dark:shadow-[var(--card-shadow)]">
      <header className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
          <Users className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Neueste Creator</h2>
      </header>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
          ))}
        </ul>
      ) : !creators || creators.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-500 dark:text-white/40">
          Noch keine Creator angelegt.
        </p>
      ) : (
        <ul className="space-y-1">
          {creators.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => router.push(`/creators/list/${c.id}`)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-sm font-semibold text-gray-900 dark:text-white">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-900 dark:text-white">{c.name}</div>
                  <div className="truncate text-xs text-gray-500 dark:text-white/40">
                    {c.niche
                      ? `${c.niche} Creator`
                      : c.platform
                        ? `${c.platform} Creator`
                        : 'Creator'}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
