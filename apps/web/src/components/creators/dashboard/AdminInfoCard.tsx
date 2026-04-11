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
    <section className="rounded-2xl border border-white/5 bg-[#111] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{name}</div>
          <div className="truncate text-xs text-white/40">{role}</div>
        </div>
      </div>
    </section>
  );
}
