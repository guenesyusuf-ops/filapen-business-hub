'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, FileText, Paperclip, Filter as FilterIcon, ChevronDown, ChevronLeft, ChevronRight, X, Download, Archive } from 'lucide-react';
import {
  purchasesApi, fmtDate, STATUS_LABELS, PAYMENT_STATUS_LABELS,
  type PurchaseOrder,
} from '@/lib/purchases';
import { Badge, btn, input, label, Money, PageHeader, Empty } from '@/components/purchases/PurchaseUI';

const QUICK_FILTERS = [
  { key: '', label: 'Alle' },
  { key: 'unpaid', label: 'Offen' },
  { key: 'partially_paid', label: 'Teilweise bezahlt' },
] as const;

const PAGE_SIZE = 25;

export default function PurchaseOrdersPage() {
  const initialParams = useSearchParams();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>(initialParams.get('paymentStatus') || '');
  const [status, setStatus] = useState<string>(initialParams.get('status') || '');
  const [supplierFilter, setSupplierFilter] = useState<string>(initialParams.get('supplierId') || '');
  const [hasDoc, setHasDoc] = useState<string>(initialParams.get('hasDocument') || '');
  const [from, setFrom] = useState(initialParams.get('from') || '');
  const [to, setTo] = useState(initialParams.get('to') || '');
  const [sort, setSort] = useState<string>('orderDate');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [onlyCancelled, setOnlyCancelled] = useState(false);
  const [onTheWay, setOnTheWay] = useState(initialParams.get('onTheWay') === '1');

  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string; mimeType: string } | null>(null);

  useEffect(() => {
    purchasesApi.listSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const params = useMemo(() => ({
    search: search || undefined,
    paymentStatus: paymentStatus || undefined,
    status: status || undefined,
    supplierId: supplierFilter || undefined,
    hasDocument: hasDoc as any || undefined,
    onTheWay: onTheWay ? '1' : undefined,
    includeCancelled: includeCancelled ? '1' : undefined,
    onlyCancelled: onlyCancelled ? '1' : undefined,
    from: from || undefined,
    to: to || undefined,
    sort,
    dir,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }), [search, paymentStatus, status, supplierFilter, hasDoc, onTheWay, includeCancelled, onlyCancelled, from, to, sort, dir, offset]);

  // reset to first page when filters change
  useEffect(() => { setOffset(0); }, [search, paymentStatus, status, supplierFilter, hasDoc, onTheWay, includeCancelled, onlyCancelled, from, to]);

  useEffect(() => {
    setLoading(true);
    purchasesApi.listOrders(params)
      .then((d) => { setOrders(d.items); setTotal(d.total); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const toggleSort = (col: string) => {
    if (sort === col) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setDir('desc'); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bestellungen"
        subtitle={`${total} Bestellung${total !== 1 ? 'en' : ''}`}
        actions={
          <Link href="/purchases/orders/new" className={btn('primary')}>
            <Plus className="h-4 w-4" /> Neue Bestellung
          </Link>
        }
      />

      {/* Quick filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPaymentStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              paymentStatus === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => { setOnTheWay(!onTheWay); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            onTheWay ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
          }`}
        >
          Unterwegs
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
        >
          <FilterIcon className="h-3.5 w-3.5" /> Mehr Filter
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={includeCancelled} onChange={(e) => { setIncludeCancelled(e.target.checked); if (e.target.checked) setOnlyCancelled(false); }} />
            Stornierte anzeigen
          </label>
          <button
            onClick={() => { setOnlyCancelled(!onlyCancelled); if (!onlyCancelled) setIncludeCancelled(false); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              onlyCancelled ? 'bg-red-600 text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 hover:text-red-600'
            }`}
          >
            <Archive className="h-3.5 w-3.5" /> Nur stornierte
          </button>
        </div>
      </div>

      {/* Search + advanced filters */}
      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bestellnr., Rechnungsnr., Lieferant, Produkt …"
              className={input('pl-9')}
            />
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-white/8">
            <div>
              <label className={label()}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={input()}>
                <option value="">Alle</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label()}>Lieferant</label>
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={input()}>
                <option value="">Alle</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className={label()}>Dokument vorhanden</label>
              <select value={hasDoc} onChange={(e) => setHasDoc(e.target.value)} className={input()}>
                <option value="">Egal</option>
                <option value="yes">Ja</option>
                <option value="no">Nein</option>
              </select>
            </div>
            <div>
              <label className={label()}>Zahlungsstatus</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={input()}>
                <option value="">Alle</option>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label()}>Von</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input()} />
            </div>
            <div>
              <label className={label()}>Bis</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input()} />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : orders.length === 0 ? (
          <Empty
            icon={<FileText className="h-10 w-10" />}
            title="Keine Bestellungen gefunden"
            hint="Lege deine erste Bestellung an oder ändere die Filter."
            action={<Link href="/purchases/orders/new" className={btn('primary')}><Plus className="h-4 w-4" /> Neue Bestellung</Link>}
          />
        ) : (
          <div className="table-scroll">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-white/[0.02] sticky top-0 backdrop-blur">
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Th onClick={() => toggleSort('orderNumber')} active={sort === 'orderNumber'} dir={dir}>Bestellnr.</Th>
                  <Th hideOn="sm">Lieferant</Th>
                  <Th>Produkte</Th>
                  <Th hideOn="xl">Käufer</Th>
                  <Th hideOn="md" onClick={() => toggleSort('orderDate')} active={sort === 'orderDate'} dir={dir}>Datum</Th>
                  <Th hideOn="xl">Rechnung</Th>
                  <Th onClick={() => toggleSort('total')} active={sort === 'total'} dir={dir} align="right">Betrag</Th>
                  <Th hideOn="lg" align="right">Bezahlt</Th>
                  <Th hideOn="lg" onClick={() => toggleSort('open')} active={sort === 'open'} dir={dir} align="right">Offen</Th>
                  <Th hideOn="sm">Status</Th>
                  <Th align="center">Doc</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {orders.map((o) => {
                  const inv = o.invoices?.[0];
                  const ps = PAYMENT_STATUS_LABELS[o.paymentStatus];
                  const productPreview = (o.items || []).slice(0, 2).map((i) => i.productName).join(', ');
                  const more = (o.items?.length || 0) - 2;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <Link href={`/purchases/orders/${o.id}`} className="font-mono font-medium text-primary-700 dark:text-primary-300 hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[160px] md:max-w-[200px]">{o.supplier?.companyName}</div>
                        <div className="text-xs text-gray-400">{o.supplier?.supplierNumber}</div>
                      </td>
                      <td className="px-3 py-3 max-w-[140px] sm:max-w-[220px]">
                        <div className="truncate text-gray-700 dark:text-gray-300" title={(o.items || []).map(i => i.productName).join(', ')}>
                          {productPreview || '—'}
                          {more > 0 && <span className="text-xs text-gray-400 ml-1">+{more}</span>}
                        </div>
                        {/* Mobile-only sub-line: supplier + date + status */}
                        <div className="sm:hidden text-[10px] text-gray-500 mt-0.5 truncate">
                          {o.supplier?.companyName} · {fmtDate(o.orderDate)} · <Badge color={ps.color}>{ps.label}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300 hidden xl:table-cell">{o.createdBy?.name || o.createdBy?.email || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap hidden md:table-cell">{fmtDate(o.orderDate)}</td>
                      <td className="px-3 py-3 hidden xl:table-cell">
                        {inv ? (
                          <div>
                            <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{inv.invoiceNumber}</div>
                            <div className="text-xs text-gray-400">{fmtDate(inv.invoiceDate)}</div>
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={o.totalAmount} currency={o.currency} /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap text-gray-600 dark:text-gray-300 hidden lg:table-cell"><Money amount={o.paidAmount} currency={o.currency} /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap font-medium hidden lg:table-cell">
                        <span className={Number(o.openAmount) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}>
                          <Money amount={o.openAmount} currency={o.currency} />
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell"><Badge color={ps.color}>{ps.label}</Badge></td>
                      <td className="px-3 py-3 text-center">
                        {(o._count?.documents ?? 0) > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const docs = o.documents || [];
                              if (docs.length === 0) return;
                              const doc = docs.find(d => d.documentType === 'invoice') || docs[0];
                              setPreviewDoc({ fileName: doc.fileName, fileUrl: doc.fileUrl, mimeType: doc.mimeType });
                            }}
                            title="Rechnung / Anhang ansehen"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                          >
                            <Paperclip className="h-3 w-3" />{o._count?.documents}
                          </button>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && !loading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
            <div>
              Seite {Math.floor(offset / PAGE_SIZE) + 1} von {Math.max(1, Math.ceil(total / PAGE_SIZE))} · {total} Bestellungen
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Zurück
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}
              >
                Weiter <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function DocPreviewModal({ doc, onClose }: { doc: { fileName: string; fileUrl: string; mimeType: string }; onClose: () => void }) {
  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = doc.mimeType.startsWith('image/');
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.fileName}</h3>
            <p className="text-xs text-gray-400">{doc.mimeType}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a href={doc.fileUrl} download className={btn('secondary', 'h-8 px-2 py-1 text-xs')}><Download className="h-3.5 w-3.5" /> Download</a>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/40">
          {isPdf ? (
            <iframe src={doc.fileUrl} className="w-full h-[75vh]" title={doc.fileName} />
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img src={doc.fileUrl} alt={doc.fileName} className="max-w-full max-h-[75vh] object-contain" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-sm gap-3">
              Vorschau für diesen Dateityp nicht verfügbar
              <a href={doc.fileUrl} target="_blank" rel="noopener" className={btn('primary')}>In neuem Tab öffnen</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active, dir, align, hideOn }: { children: any; onClick?: () => void; active?: boolean; dir?: string; align?: 'right' | 'center'; hideOn?: 'sm' | 'md' | 'lg' | 'xl' }) {
  // hideOn: hide this header below the given breakpoint ("sm" = show from sm: up)
  const hideClass =
    hideOn === 'sm' ? 'hidden sm:table-cell' :
    hideOn === 'md' ? 'hidden md:table-cell' :
    hideOn === 'lg' ? 'hidden lg:table-cell' :
    hideOn === 'xl' ? 'hidden xl:table-cell' : '';
  const cls = `px-3 py-2.5 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${onClick ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''} ${hideClass}`;
  return (
    <th onClick={onClick} className={cls}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}
