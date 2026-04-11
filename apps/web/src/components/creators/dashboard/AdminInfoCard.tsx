'use client';

import { User } from 'lucide-react';

// ---------------------------------------------------------------------------
// AdminInfoCard — compact profile card in the right sidebar.
// ---------------------------------------------------------------------------

interface Props {
  name?: string;
  role?: string;
}

export function AdminInfoCard({ name = 'Admin', role = 'Administrator' }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-5 shadow-card dark:shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</div>
          <div className="truncate text-xs text-gray-500 dark:text-white/40">{role}</div>
        </div>
      </div>
    </section>
  );
}
