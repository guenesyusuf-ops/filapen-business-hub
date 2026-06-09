'use client';

import { BarChart2 } from 'lucide-react';

export default function InvoiceStatsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-md">
          <BarChart2 className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
          Statistiken
        </h1>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-16 text-center bg-white/40 dark:bg-white/[0.02]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Statistik-Dashboard kommt in Phase 9.</p>
      </div>
    </div>
  );
}
