'use client';

import { useRouter } from 'next/navigation';
import { Users, ArrowUpRight } from 'lucide-react';
import { CreatorAvatar } from '@/components/creators/CreatorAvatar';
import type { RecentCreator } from '@/hooks/creators/useCreatorDashboard';

interface Props {
  creators: RecentCreator[] | undefined;
  loading: boolean;
}

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `vor ${days}d`;
};

export function RecentCreatorsList({ creators, loading }: Props) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
          <Users className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Neueste Creator</h2>
      </header>

      <div className="p-2">
        {loading ? (
          <div className="space-y-1.5 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
            ))}
          </div>
        ) : !creators || creators.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <Users className="h-4 w-4 text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-xs text-gray-400 dark:text-white/30">Noch keine Creator</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {creators.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/creators/list/${c.id}`)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                >
                  <CreatorAvatar name={c.name} avatarUrl={c.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {c.name}
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-white/30">
                      {c.niche ? c.niche : c.platform ?? 'Creator'} · {relativeTime(c.createdAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
