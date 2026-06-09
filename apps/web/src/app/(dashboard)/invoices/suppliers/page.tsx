'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, Loader2, ExternalLink } from 'lucide-react';
import { invoicesApi, fmtEUR, fmtDate, type SupplierEntry } from '@/lib/invoices';

type SortBy = 'totalSpend' | 'invoiceCount' | 'openSpend' | 'lastInvoiceDate' | 'avgInvoice' | 'name';

export default function SuppliersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('totalSpend');

  const q = useQuery({
    queryKey: ['invoice-suppliers-detailed'],
    queryFn: () => invoicesApi.suppliers(),
    staleTime: 30_000,
  });

  const data = q.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = s ? data.filter((r) => r.supplierName.toLowerCase().includes(s)) : [...data];
    rows.sort((a, b) => sortRows(a, b, sortBy));
    return rows;
  }, [data, search, sortBy]);

  const totalSpend = data.reduce((s, r) => s + r.totalSpend, 0);
  const totalOpen = data.reduce((s, r) => s + r.openSpend, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center shadow-md">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Lieferanten
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {data.length} Lieferanten · Gesamtausgaben {fmtEUR(totalSpend)} · {fmtEUR(totalOpen)} offen
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Lieferant suchen …"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="totalSpend">Sortierung: Gesamtausgaben</option>
          <option value="openSpend">Offen-Betrag</option>
          <option value="invoiceCount">Anzahl Rechnungen</option>
          <option value="lastInvoiceDate">Letzte Rechnung</option>
          <option value="avgInvoice">Ø Rechnung</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      {q.isLoading ? (
        <div className="p-16 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SupplierCard
              key={s.supplierName}
              s={s}
              onOpen={() => router.push(`/invoices?supplier=${encodeURIComponent(s.supplierName)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function sortRows(a: SupplierEntry, b: SupplierEntry, by: SortBy): number {
  switch (by) {
    case 'totalSpend': return b.totalSpend - a.totalSpend;
    case 'openSpend': return b.openSpend - a.openSpend;
    case 'invoiceCount': return b.invoiceCount - a.invoiceCount;
    case 'avgInvoice': return b.avgInvoice - a.avgInvoice;
    case 'lastInvoiceDate': {
      const av = a.lastInvoiceDate ? new Date(a.lastInvoiceDate).getTime() : 0;
      const bv = b.lastInvoiceDate ? new Date(b.lastInvoiceDate).getTime() : 0;
      return bv - av;
    }
    case 'name': return a.supplierName.localeCompare(b.supplierName);
    default: return 0;
  }
}

function SupplierCard({ s, onOpen }: { s: SupplierEntry; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-lg transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={s.supplierName}>
            {s.supplierName}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {s.invoiceCount} Rechnung{s.invoiceCount === 1 ? '' : 'en'} · Ø {fmtEUR(s.avgInvoice)}
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-indigo-500 flex-shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Cell label="Gesamt" value={fmtEUR(s.totalSpend)} bold />
        <Cell label="Offen" value={fmtEUR(s.openSpend)} color={s.openSpend > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'} />
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 pt-2 border-t border-gray-100 dark:border-white/5">
        <div className="flex justify-between"><span>Letzte Rechnung</span><span className="tabular-nums">{fmtDate(s.lastInvoiceDate)}</span></div>
        <div className="flex justify-between"><span>Letzte Zahlung</span><span className="tabular-nums">{fmtDate(s.lastPaymentDate)}</span></div>
      </div>
    </button>
  );
}

function Cell({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className={`tabular-nums ${bold ? 'text-base font-bold text-gray-900 dark:text-white' : 'text-sm'} ${color ?? ''}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-16 text-center bg-white/40 dark:bg-white/[0.02]">
      <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center mb-3">
        <Building2 className="h-5 w-5 text-indigo-500" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Noch keine Lieferanten</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Sobald Rechnungen verarbeitet sind, erscheinen die Lieferanten hier mit Statistiken.
      </p>
    </div>
  );
}
