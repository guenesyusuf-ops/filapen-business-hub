'use client';

import { Settings } from 'lucide-react';

export default function InvoiceSettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-gray-500 to-gray-700 items-center justify-center shadow-md">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
          Rechnungs-Einstellungen
        </h1>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-16 text-center bg-white/40 dark:bg-white/[0.02]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Einstellungen (Erinnerungen, Kategorien, Aufbewahrung) kommen in Phase 10.</p>
      </div>
    </div>
  );
}
