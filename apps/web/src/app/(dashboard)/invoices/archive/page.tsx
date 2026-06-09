'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Archive, Loader2, Search, X, ArrowUpDown, ArrowUp, ArrowDown,
  FileText, Image as ImageIcon, RotateCcw, Trash2,
} from 'lucide-react';
import {
  invoicesApi, type Invoice, type InvoiceStatus,
  STATUS_META, fmtEUR, fmtDate,
} from '@/lib/invoices';

type SortKey = 'invoiceDate' | 'dueDate' | 'grossAmount' | 'supplierName' | 'createdAt' | 'updatedAt';

const PAGE_SIZE = 50;

export default function InvoiceArchivePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const q = useQuery({
    queryKey: ['invoices-archive', { search, sortKey, sortDir, page }],
    queryFn: () => invoicesApi.list({
      archived: 'true',
      search: search.trim() || undefined,
      sort: sortKey,
      dir: sortDir,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  async function restoreOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await invoicesApi.restore(id);
      q.refetch();
    } catch (err: any) {
      alert(err?.message ?? 'Wiederherstellen fehlgeschlagen');
    }
  }

  async function deleteOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Rechnung dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      await invoicesApi.remove(id);
      q.refetch();
    } catch (err: any) {
      alert(err?.message ?? 'Loeschen fehlgeschlagen');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 items-center justify-center shadow-md">
          <Archive className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            Archiv
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} archivierte Rechnung{total === 1 ? '' : 'en'} · Klick auf eine Zeile öffnet die Detailansicht
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Im Archiv suchen …"
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500/30"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {q.isLoading ? (
          <div className="p-16 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] items-center justify-center mb-3">
              <Archive className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {search ? 'Keine passenden Einträge' : 'Das Archiv ist leer'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {search ? 'Versuche eine andere Suche.' : 'Archivierte Rechnungen werden hier angezeigt — du kannst sie jederzeit wiederherstellen oder dauerhaft loeschen.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left">Status</th>
                    <SortHeader label="Lieferant" k="supplierName" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <th className="px-3 py-3 text-left">Rechnungsnr</th>
                    <SortHeader label="Rechnungsdatum" k="invoiceDate" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortHeader label="Betrag" k="grossAmount" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
                    <th className="w-24 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <Row
                      key={inv.id}
                      inv={inv}
                      onOpen={() => router.push(`/invoices/${inv.id}`)}
                      onRestore={(e) => restoreOne(e, inv.id)}
                      onDelete={(e) => deleteOne(e, inv.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500 dark:text-gray-400">
              <div>Seite <strong className="tabular-nums">{page + 1}</strong> / {totalPages}</div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Zurueck</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Weiter</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SortHeader({ label, k, current, dir, onToggle, align = 'left' }: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onToggle: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = current === k;
  return (
    <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button onClick={() => onToggle(k)} className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 ${active ? 'text-gray-700 dark:text-white' : ''}`}>
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function Row({ inv, onOpen, onRestore, onDelete }: {
  inv: Invoice;
  onOpen: () => void;
  onRestore: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const status = inv.status as InvoiceStatus;
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const isImage = inv.fileMime?.startsWith('image/');

  return (
    <tr
      onClick={onOpen}
      className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] cursor-pointer transition-colors group"
    >
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${meta.badge} ${meta.badgeDark}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3 max-w-[260px]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0">
            {isImage ? <ImageIcon className="h-3.5 w-3.5 text-gray-400" /> : <FileText className="h-3.5 w-3.5 text-gray-400" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate" title={inv.supplierName ?? undefined}>
              {inv.supplierName ?? <span className="italic text-gray-400">Unbekannt</span>}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{inv.fileName}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
        {inv.invoiceNumber ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
        {fmtDate(inv.invoiceDate)}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
        {fmtEUR(inv.grossAmount as any)}
      </td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onRestore} title="Wiederherstellen" className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} title="Endgültig löschen" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
