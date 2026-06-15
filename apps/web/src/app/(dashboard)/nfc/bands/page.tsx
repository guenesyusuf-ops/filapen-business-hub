'use client';

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ListChecks, Search, Loader2, X, Download, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { nfcApi, fmtDateTime, STATUS_META, type NfcBand } from '@/lib/nfc';
import { useToast } from '@/components/shared/Toast';

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { key: 'all', label: 'Alle' },
  { key: 'inactive', label: 'Nicht aktiviert' },
  { key: 'active', label: 'Aktiviert' },
  { key: 'deleted', label: 'Gelöscht' },
];

export default function NfcBandsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch, status]);

  const q = useQuery({
    queryKey: ['nfc-bands', { debouncedSearch, status, page }],
    queryFn: () => nfcApi.listBands({
      search: debouncedSearch || undefined,
      status: status === 'all' ? undefined : status,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
    placeholderData: keepPreviousData,
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function downloadCsv() {
    try {
      await nfcApi.downloadCsv();
      toast.success('CSV heruntergeladen');
    } catch (e: any) { toast.error('Download fehlgeschlagen', e?.message ?? ''); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center shadow-md">
            <ListChecks className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Alle Bänder
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {total} Bänder · Status, Filter und Suche
            </p>
          </div>
        </div>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <Download className="h-4 w-4" /> Alle als CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/8 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-px">
          {STATUS_TABS.map((t) => {
            const active = status === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`relative px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  active ? 'text-cyan-700 dark:text-cyan-300 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cyan-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code suchen (z.B. k653r)…"
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Tabelle */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {q.isLoading && items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500">Keine Bänder gefunden.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left">Code</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Batch</th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell">Scans</th>
                    <th className="px-3 py-3 text-left hidden md:table-cell">Letzter Scan</th>
                    <th className="px-3 py-3 text-left hidden lg:table-cell">Aktiviert</th>
                    <th className="px-3 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => <BandRow key={b.id} band={b} />)}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500 dark:text-gray-400">
              <div><strong className="text-gray-700 dark:text-gray-200 tabular-nums">{total}</strong> Bänder · Seite {page + 1} / {totalPages}</div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Zurück</button>
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

function BandRow({ band }: { band: NfcBand }) {
  const toast = useToast();
  const meta = STATUS_META[band.status] ?? STATUS_META.inactive;
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(band.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Kopieren fehlgeschlagen'); }
  }

  return (
    <tr className="border-b border-gray-100 dark:border-white/5 last:border-0 group">
      <td className="px-3 py-3">
        <div className="font-mono font-semibold text-cyan-700 dark:text-cyan-300">{band.code}</div>
        <a href={band.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 hover:text-cyan-600 sm:hidden">
          öffnen <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border ${meta.badge}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell truncate max-w-[180px]">
        {band.batch?.name ?? <span className="italic text-gray-400">Unbenannt</span>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">{band.scanCount}</td>
      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell whitespace-nowrap">{fmtDateTime(band.lastScanAt)}</td>
      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">{fmtDateTime(band.activatedAt)}</td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button onClick={copyUrl} title="URL kopieren" className="p-1.5 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a href={band.url} target="_blank" rel="noopener noreferrer" title="URL öffnen" className="p-1.5 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hidden sm:inline-flex">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </td>
    </tr>
  );
}
