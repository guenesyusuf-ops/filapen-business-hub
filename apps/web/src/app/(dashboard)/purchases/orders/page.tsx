'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Paperclip, Filter as FilterIcon, ChevronDown } from 'lucide-react';
import {
  purchasesApi, fmtDate, STATUS_LABELS, PAYMENT_STATUS_LABELS,
  type PurchaseOrder,
} from '@/lib/purchases';
import { Badge, btn, input, label, Money, PageHeader, Empty } from '@/components/purchases/PurchaseUI';

const QUICK_FILTERS = [
  { key: '', label: 'Alle' },
  { key: 'unpaid', label: 'Offen' },
  { key: 'partially_paid', label: 'Teilweise bezahlt' },
  { key: 'overdue', label: 'Überfällig' },
] as const;

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [hasDoc, setHasDoc] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<string>('orderDate');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    purchasesApi.listSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const params = useMemo(() => ({
    search: search || undefined,
    paymentStatus: paymentStatus || undefined,
    status: status || undefined,
    supplierId: supplierFilter || undefined,
    hasDocument: hasDoc as any || undefined,
    from: from || undefined,
    to: to || undefined,
    sort,
    dir,
  }), [search, paymentStatus, status, supplierFilter, hasDoc, from, to, sort, dir]);

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
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
        >
          <FilterIcon className="h-3.5 w-3.5" /> Mehr Filter
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-white/8">
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-white/[0.02] sticky top-0 backdrop-blur">
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Th onClick={() => toggleSort('orderNumber')} active={sort === 'orderNumber'} dir={dir}>Bestellnr.</Th>
                  <Th>Lieferant</Th>
                  <Th>Produkte</Th>
                  <Th>Käufer</Th>
                  <Th onClick={() => toggleSort('orderDate')} active={sort === 'orderDate'} dir={dir}>Bestelldatum</Th>
                  <Th>Rechnung</Th>
                  <Th onClick={() => toggleSort('total')} active={sort === 'total'} dir={dir} align="right">Betrag</Th>
                  <Th align="right">Bezahlt</Th>
                  <Th onClick={() => toggleSort('open')} active={sort === 'open'} dir={dir} align="right">Offen</Th>
                  <Th>Status</Th>
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
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{o.supplier?.companyName}</div>
                        <div className="text-xs text-gray-400">{o.supplier?.supplierNumber}</div>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="truncate text-gray-700 dark:text-gray-300" title={(o.items || []).map(i => i.productName).join(', ')}>
                          {productPreview || '—'}
                          {more > 0 && <span className="text-xs text-gray-400 ml-1">+{more}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{o.createdBy?.name || o.createdBy?.email || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtDate(o.orderDate)}</td>
                      <td className="px-3 py-3">
                        {inv ? (
                          <div>
                            <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{inv.invoiceNumber}</div>
                            <div className="text-xs text-gray-400">{fmtDate(inv.invoiceDate)}</div>
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={o.totalAmount} currency={o.currency} /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap text-gray-600 dark:text-gray-300"><Money amount={o.paidAmount} currency={o.currency} /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap font-medium">
                        <span className={Number(o.openAmount) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}>
                          <Money amount={o.openAmount} currency={o.currency} />
                        </span>
                      </td>
                      <td className="px-3 py-3"><Badge color={ps.color}>{ps.label}</Badge></td>
                      <td className="px-3 py-3 text-center">
                        {(o._count?.documents ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Paperclip className="h-3 w-3" />{o._count?.documents}</span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, onClick, active, dir, align }: { children: any; onClick?: () => void; active?: boolean; dir?: string; align?: 'right' | 'center' }) {
  const cls = `px-3 py-2.5 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${onClick ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''}`;
  return (
    <th onClick={onClick} className={cls}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}
