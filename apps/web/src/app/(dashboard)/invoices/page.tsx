'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ReceiptText, Upload, Loader2, Plus } from 'lucide-react';
import { invoicesApi, type InvoiceStatusCounts, fmtEUR } from '@/lib/invoices';

const TABS: Array<{ key: string; label: string; countKey: keyof InvoiceStatusCounts | 'all' }> = [
  { key: 'all', label: 'Alle', countKey: 'all' },
  { key: 'open', label: 'Offen', countKey: 'open' },
  { key: 'due_soon', label: 'Bald fällig', countKey: 'due_soon' },
  { key: 'due_today', label: 'Heute fällig', countKey: 'due_today' },
  { key: 'overdue', label: 'Überfällig', countKey: 'overdue' },
  { key: 'paid', label: 'Bezahlt', countKey: 'paid' },
];

export default function InvoicesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') ?? 'all';

  const [counts, setCounts] = useState<InvoiceStatusCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoicesApi.statusCounts()
      .then(setCounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setTab(next: string) {
    const url = next === 'all' ? '/invoices' : `/invoices?tab=${next}`;
    router.push(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center shadow-md">
              <ReceiptText className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Rechnungen
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xl">
            Lade Eingangsrechnungen hoch — die KI liest Lieferant, Betrag, IBAN und Fälligkeit automatisch aus.
          </p>
        </div>
        <button
          onClick={() => alert('Upload kommt in der nächsten Phase')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-all"
        >
          <Upload className="h-4 w-4" /> Rechnung hochladen
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/8 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-px">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts ? (counts as any)[t.countKey] : undefined;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'text-amber-700 dark:text-amber-300 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
                {typeof count === 'number' && (
                  <span className={`ml-1.5 text-[11px] tabular-nums px-1.5 py-0.5 rounded-full ${
                    active
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-gray-400'
                  }`}>{count}</span>
                )}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skeleton-Empty-State — Tabelle kommt in P3 */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-16 sm:py-20 text-center bg-white/40 dark:bg-white/[0.02]">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-950/30 items-center justify-center mb-4">
          <ReceiptText className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-1">
          Noch keine Rechnungen
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
          {loading
            ? 'Laedt …'
            : 'Lade deine erste Eingangsrechnung hoch — PDF, JPG oder PNG. Die KI extrahiert alle relevanten Daten automatisch.'}
        </p>
        <button
          onClick={() => alert('Upload kommt in der nächsten Phase')}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Erste Rechnung hochladen
        </button>
        {counts && counts.all > 0 && (
          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            {counts.all} Rechnung{counts.all === 1 ? '' : 'en'} in der Datenbank — Tabellenansicht wird gerade gebaut.
          </div>
        )}
      </div>
    </div>
  );
}
