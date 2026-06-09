'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ReceiptText, Upload, Loader2, Plus, Search, X, ChevronDown, ChevronUp,
  CheckCircle2, ArrowUpDown, ArrowDown, ArrowUp, Filter,
  FileText, Image as ImageIcon, Trash2, Archive as ArchiveIcon, MoreVertical,
} from 'lucide-react';
import {
  invoicesApi, type Invoice, type InvoiceStatusCounts, type InvoiceStatus,
  STATUS_META, DEFAULT_CATEGORIES, categoryLabel, categoryColor,
  fmtEUR, fmtDate,
} from '@/lib/invoices';
import { InvoiceUploadModal } from './InvoiceUploadModal';

const TABS: Array<{ key: string; label: string; countKey: keyof InvoiceStatusCounts | 'all' }> = [
  { key: 'all', label: 'Alle', countKey: 'all' },
  { key: 'open', label: 'Offen', countKey: 'open' },
  { key: 'due_soon', label: 'Bald fällig', countKey: 'due_soon' },
  { key: 'due_today', label: 'Heute fällig', countKey: 'due_today' },
  { key: 'overdue', label: 'Überfällig', countKey: 'overdue' },
  { key: 'paid', label: 'Bezahlt', countKey: 'paid' },
];

const DATE_PRESETS: Array<{ key: string; label: string; range: () => { from?: string; to?: string } }> = [
  { key: 'all', label: 'Gesamter Zeitraum', range: () => ({}) },
  { key: 'today', label: 'Heute', range: () => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return { from: iso(t), to: iso(new Date()) };
  } },
  { key: '7d', label: 'Letzte 7 Tage', range: () => {
    const t = new Date(); t.setDate(t.getDate() - 7);
    return { from: iso(t) };
  } },
  { key: '30d', label: 'Letzte 30 Tage', range: () => {
    const t = new Date(); t.setDate(t.getDate() - 30);
    return { from: iso(t) };
  } },
  { key: 'month', label: 'Dieser Monat', range: () => {
    const t = new Date(); t.setDate(1); t.setHours(0, 0, 0, 0);
    return { from: iso(t) };
  } },
  { key: 'year', label: 'Dieses Jahr', range: () => {
    const t = new Date(); t.setMonth(0, 1); t.setHours(0, 0, 0, 0);
    return { from: iso(t) };
  } },
];

/** Local-Date in YYYY-MM-DD — toISOString() wuerde UTC ausgeben und das
 *  "Heute"-Preset waere fuer alle ausserhalb von UTC um bis zu 1 Tag falsch. */
function iso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const PAGE_SIZE = 25;

type SortKey = 'invoiceDate' | 'dueDate' | 'grossAmount' | 'supplierName' | 'invoiceNumber' | 'createdAt' | 'status';

export default function InvoicesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') ?? 'all';

  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [amountMin, setAmountMin] = useState<string>('');
  const [amountMax, setAmountMax] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce Search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page wenn Filter sich ändern
  useEffect(() => { setPage(0); }, [debouncedSearch, tab, supplierFilter, categoryFilter, datePreset, amountMin, amountMax, sortKey, sortDir]);

  const dateRange = useMemo(() => DATE_PRESETS.find((p) => p.key === datePreset)!.range(), [datePreset]);

  const listQuery = useQuery({
    queryKey: ['invoices', { tab, debouncedSearch, supplierFilter, categoryFilter, datePreset, amountMin, amountMax, sortKey, sortDir, page }],
    queryFn: () => invoicesApi.list({
      tab: tab === 'all' ? undefined : tab,
      search: debouncedSearch || undefined,
      supplier: supplierFilter || undefined,
      category: categoryFilter || undefined,
      from: dateRange.from,
      to: dateRange.to,
      amountMin: amountMin || undefined,
      amountMax: amountMax || undefined,
      sort: sortKey,
      dir: sortDir,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
    placeholderData: keepPreviousData,
  });

  const countsQuery = useQuery({
    queryKey: ['invoice-counts'],
    queryFn: () => invoicesApi.statusCounts(),
    staleTime: 30_000,
  });

  const suppliersQuery = useQuery({
    queryKey: ['invoice-suppliers'],
    queryFn: () => invoicesApi.suppliers(),
    staleTime: 60_000,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setTab(next: string) {
    const url = next === 'all' ? '/invoices' : `/invoices?tab=${next}`;
    router.push(url);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function clearFilters() {
    setSearch('');
    setSupplierFilter('');
    setCategoryFilter('');
    setDatePreset('all');
    setAmountMin('');
    setAmountMax('');
  }

  const hasActiveFilters = !!(debouncedSearch || supplierFilter || categoryFilter || datePreset !== 'all' || amountMin || amountMax);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  async function bulkArchive() {
    if (!confirm(`${selected.size} Rechnungen ins Archiv verschieben?`)) return;
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => invoicesApi.archive(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSelected(new Set());
    listQuery.refetch();
    countsQuery.refetch();
    if (failed > 0) {
      alert(`${failed} von ${ids.length} Rechnungen konnten nicht archiviert werden.`);
    }
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
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-all"
        >
          <Upload className="h-4 w-4" /> Rechnung hochladen
        </button>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200 dark:border-white/8 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-px">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = countsQuery.data ? (countsQuery.data as any)[t.countKey] : undefined;
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
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suchleiste + Filter-Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen: Lieferant, Rechnungsnr, Verwendungszweck …"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            showFilters || hasActiveFilters
              ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-amber-500 text-white rounded-full">
              {[supplierFilter, categoryFilter, datePreset !== 'all' && datePreset, amountMin || amountMax].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2">
            Alle zurücksetzen
          </button>
        )}
        <div className="flex-1" />
        {selected.size > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <span>{selected.size} ausgewählt</span>
            <button onClick={bulkArchive} className="inline-flex items-center gap-1 hover:underline">
              <ArchiveIcon className="h-3 w-3" /> Archivieren
            </button>
            <button onClick={() => setSelected(new Set())} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Filter-Drawer */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            label="Zeitraum"
            value={datePreset}
            onChange={setDatePreset}
            options={DATE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
          <FilterSelect
            label="Lieferant"
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={[
              { value: '', label: 'Alle Lieferanten' },
              ...((suppliersQuery.data ?? []).map((s) => ({ value: s.supplierName, label: s.supplierName }))),
            ]}
          />
          <FilterSelect
            label="Kategorie"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: '', label: 'Alle Kategorien' },
              ...DEFAULT_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
            ]}
          />
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">Betrag €</label>
            <div className="flex items-center gap-1">
              <input
                type="number" placeholder="Min"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <span className="text-gray-400">–</span>
              <input
                type="number" placeholder="Max"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {listQuery.isLoading && items.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
          </div>
        ) : items.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} filtered={hasActiveFilters || tab !== 'all'} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="w-9 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selected.size === items.length}
                        onChange={selectAll}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <SortHeader label="Lieferant" k="supplierName" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortHeader label="Rechnungsnr" k="invoiceNumber" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortHeader label="Rechnungsdatum" k="invoiceDate" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortHeader label="Fällig" k="dueDate" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortHeader label="Betrag" k="grossAmount" current={sortKey} dir={sortDir} onToggle={toggleSort} align="right" />
                    <th className="px-3 py-3 text-left">Kategorie</th>
                    <th className="w-12 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <Row
                      key={inv.id}
                      inv={inv}
                      checked={selected.has(inv.id)}
                      onToggleSelect={() => toggleSelect(inv.id)}
                      onOpen={() => router.push(`/invoices/${inv.id}`)}
                      onChanged={() => { listQuery.refetch(); countsQuery.refetch(); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <strong className="text-gray-700 dark:text-gray-200 tabular-nums">{total}</strong> {total === 1 ? 'Rechnung' : 'Rechnungen'}
                {totalPages > 1 && <> · Seite <strong className="tabular-nums">{page + 1}</strong> / {totalPages}</>}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5"
                  >Zurück</button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5"
                  >Weiter</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {uploadOpen && (
        <InvoiceUploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { listQuery.refetch(); countsQuery.refetch(); suppliersQuery.refetch(); }}
          onOpenInvoice={(id) => router.push(`/invoices/${id}`)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
      <button
        onClick={() => onToggle(k)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 ${active ? 'text-amber-700 dark:text-amber-300' : ''}`}
      >
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function Row({ inv, checked, onToggleSelect, onOpen, onChanged }: {
  inv: Invoice;
  checked: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const status = inv.status as InvoiceStatus;
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const isImage = inv.fileMime?.startsWith('image/');
  const ocrPending = inv.ocrStatus === 'pending' || inv.ocrStatus === 'processing';
  const ocrFailed = inv.ocrStatus === 'failed';

  async function quickMarkPaid(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await invoicesApi.markPaid(inv.id);
      onChanged();
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }
  async function quickArchive(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Rechnung ins Archiv verschieben?')) return;
    try {
      await invoicesApi.archive(inv.id);
      onChanged();
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }
  async function quickDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Rechnung dauerhaft löschen?')) return;
    try {
      await invoicesApi.remove(inv.id);
      onChanged();
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }

  return (
    <tr
      onClick={onOpen}
      className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 cursor-pointer transition-colors group"
    >
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${meta.badge} ${meta.badgeDark}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {ocrPending && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> OCR …
          </div>
        )}
        {ocrFailed && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
            OCR fehlgeschlagen
          </div>
        )}
      </td>
      <td className="px-3 py-3 max-w-[220px]">
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
      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
        {inv.dueDate ? (
          <span className={status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>
            {fmtDate(inv.dueDate)}
          </span>
        ) : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
        {fmtEUR(inv.grossAmount as any)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-md bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8"
          style={{ color: categoryColor(inv.category) }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(inv.category) }} />
          {categoryLabel(inv.category)}
        </span>
      </td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {status !== 'paid' && (
            <button onClick={quickMarkPaid} title="Als bezahlt markieren" className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={quickArchive} title="Archivieren" className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/8">
            <ArchiveIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={quickDelete} title="Löschen" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ onUpload, filtered }: { onUpload: () => void; filtered: boolean }) {
  if (filtered) {
    return (
      <div className="p-16 text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] items-center justify-center mb-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Keine passenden Rechnungen</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Versuche es mit einem anderen Filter oder einer anderen Suche.</p>
      </div>
    );
  }
  return (
    <div className="p-20 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-950/30 items-center justify-center mb-4">
        <ReceiptText className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-1">
        Noch keine Rechnungen
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
        Lade deine erste Eingangsrechnung hoch — PDF, JPG oder PNG. Die KI extrahiert alle relevanten Daten automatisch.
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" /> Erste Rechnung hochladen
      </button>
    </div>
  );
}
