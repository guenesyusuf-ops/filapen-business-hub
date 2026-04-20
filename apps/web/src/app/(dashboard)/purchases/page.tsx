'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, AlertCircle, Wallet, CheckCircle2, Calendar,
  TrendingUp, FileText, Plus, Truck, Download,
  ChevronLeft, ChevronRight, Paperclip,
} from 'lucide-react';
import {
  purchasesApi, fmtDate,
  PAYMENT_STATUS_LABELS, STATUS_LABELS,
  type PurchaseOrder,
} from '@/lib/purchases';
import { KpiCard, PageHeader, btn, Money, Empty, Badge } from '@/components/purchases/PurchaseUI';

const PAGE_SIZE = 5;

export default function PurchasesDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    purchasesApi.dashboard()
      .then((d) => { setData(d); setKpiError(null); })
      .catch((e) => setKpiError(e.message))
      .finally(() => setLoadingKpi(false));
  }, []);

  useEffect(() => {
    setLoadingOrders(true);
    purchasesApi.listOrders({ limit: String(PAGE_SIZE), offset: String(offset), sort: 'orderDate', dir: 'desc' })
      .then((d) => { setOrders(d.items); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [offset]);

  const counts = data?.counts || {};
  const openByCurrency: Array<{ currency: string; amount: string }> = data?.openByCurrency || [];
  const paidThisMonth: Array<{ currency: string; amount: string }> = data?.paidThisMonthByCurrency || [];
  const overdue: any[] = data?.overdueInvoices || [];
  const top: any[] = data?.topSuppliers || [];

  const sumCurrencies = (rows: { currency: string; amount: string }[]) => {
    if (!rows.length) return '0,00 EUR';
    return rows
      .filter(r => Number(r.amount) > 0)
      .map(r => new Intl.NumberFormat('de-DE', { style: 'currency', currency: r.currency || 'EUR' }).format(Number(r.amount)))
      .join(' · ') || '0,00 EUR';
  };

  const goToOrders = (q: Record<string, string>) => {
    const params = new URLSearchParams(q);
    router.push(`/purchases/orders${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einkauf"
        subtitle="Lieferanten, Bestellungen, Rechnungen und Zahlungen"
        actions={
          <>
            <Link href="/purchases/export" className={btn('secondary')}>
              <Download className="h-4 w-4" /> Export
            </Link>
            <Link href="/purchases/orders/new" className={btn('primary')}>
              <Plus className="h-4 w-4" /> Neue Bestellung
            </Link>
          </>
        }
      />

      {kpiError && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">KPIs konnten nicht geladen werden: {kpiError}</div>}

      {/* KPI cards — klickbar, navigiert zur Bestell-Liste mit passendem Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Bestellungen gesamt"
          value={loadingKpi ? '…' : counts.total ?? 0}
          sublabel={`${counts.thisMonth ?? 0} diesen Monat`}
          accent="blue"
          icon={<ShoppingCart className="h-5 w-5" />}
          onClick={() => goToOrders({})}
        />
        <KpiCard
          label="Offene Bestellungen"
          value={loadingKpi ? '…' : counts.open ?? 0}
          sublabel={sumCurrencies(openByCurrency)}
          accent="amber"
          icon={<Wallet className="h-5 w-5" />}
          onClick={() => goToOrders({ paymentStatus: 'unpaid' })}
        />
        <KpiCard
          label="Teilweise bezahlt"
          value={loadingKpi ? '…' : counts.partiallyPaid ?? 0}
          accent="indigo"
          icon={<TrendingUp className="h-5 w-5" />}
          onClick={() => goToOrders({ paymentStatus: 'partially_paid' })}
        />
        <KpiCard
          label="Vollständig bezahlt"
          value={loadingKpi ? '…' : counts.fullyPaid ?? 0}
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
          onClick={() => goToOrders({ paymentStatus: 'paid' })}
        />
        <KpiCard
          label="Überfällige Rechnungen"
          value={loadingKpi ? '…' : counts.overdue ?? 0}
          sublabel={counts.overdue ? 'Aktion erforderlich' : 'Alles im Zeitplan'}
          accent="red"
          icon={<AlertCircle className="h-5 w-5" />}
          onClick={() => goToOrders({ paymentStatus: 'unpaid' })}
        />
        <KpiCard
          label="Bezahlt diesen Monat"
          value={sumCurrencies(paidThisMonth)}
          accent="green"
          icon={<Calendar className="h-5 w-5" />}
          onClick={() => goToOrders({ paymentStatus: 'paid' })}
        />
        <KpiCard
          label="Lieferanten"
          value={loadingKpi ? '…' : top.length}
          sublabel="Top-Umsätze"
          accent="purple"
          icon={<Truck className="h-5 w-5" />}
          onClick={() => router.push('/purchases/suppliers')}
        />
        <KpiCard
          label="Diesen Monat"
          value={loadingKpi ? '…' : counts.thisMonth ?? 0}
          sublabel="neue Bestellungen"
          accent="blue"
          icon={<FileText className="h-5 w-5" />}
          onClick={() => goToOrders({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) })}
        />
      </div>

      {/* Recent orders table — 5 pro Seite, blätterbar */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bestellungen</h3>
          <Link href="/purchases/orders" className="text-xs text-primary-600 hover:underline">Alle ansehen →</Link>
        </div>

        {loadingOrders ? (
          <div className="p-10 text-center text-sm text-gray-400">Lädt …</div>
        ) : orders.length === 0 ? (
          <Empty
            icon={<FileText className="h-10 w-10" />}
            title="Noch keine Bestellungen"
            hint="Lege deine erste Bestellung an, um loszulegen."
            action={<Link href="/purchases/orders/new" className={btn('primary')}><Plus className="h-4 w-4" /> Neue Bestellung</Link>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left">Lieferantennr.</th>
                    <th className="px-3 py-2.5 text-left">Lieferant</th>
                    <th className="px-3 py-2.5 text-left">Produkte</th>
                    <th className="px-3 py-2.5 text-left">Käufer</th>
                    <th className="px-3 py-2.5 text-right">Rechnungssumme</th>
                    <th className="px-3 py-2.5 text-right">Schon bezahlt</th>
                    <th className="px-3 py-2.5 text-right">Offener Betrag</th>
                    <th className="px-3 py-2.5 text-left">Rechnungsnr.</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Doc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {orders.map((o) => {
                    const inv = o.invoices?.[0];
                    const ps = PAYMENT_STATUS_LABELS[o.paymentStatus];
                    const productPreview = (o.items || []).slice(0, 2).map((i) => i.productName).join(', ');
                    const more = (o.items?.length || 0) - 2;
                    return (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/purchases/orders/${o.id}`)}
                        className="hover:bg-gray-50/80 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{o.supplier?.supplierNumber || '—'}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{o.supplier?.companyName || '—'}</div>
                          <div className="text-xs text-gray-400 font-mono">{o.orderNumber}</div>
                        </td>
                        <td className="px-3 py-3 max-w-[220px]">
                          <div className="truncate text-gray-700 dark:text-gray-300" title={(o.items || []).map(i => i.productName).join(', ')}>
                            {productPreview || '—'}
                            {more > 0 && <span className="text-xs text-gray-400 ml-1">+{more}</span>}
                          </div>
                          <div className="text-xs text-gray-400">{fmtDate(o.orderDate)}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{o.createdBy?.name || o.createdBy?.email || '—'}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={o.totalAmount} currency={o.currency} /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-green-700 dark:text-green-400"><Money amount={o.paidAmount} currency={o.currency} /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap font-medium">
                          <span className={Number(o.openAmount) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}>
                            <Money amount={o.openAmount} currency={o.currency} />
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {inv ? (
                            <div>
                              <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{inv.invoiceNumber}</div>
                              <div className="text-xs text-gray-400">{fmtDate(inv.invoiceDate)}</div>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
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

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
                <div>
                  Seite {currentPage} von {totalPages} · {total} Bestellungen gesamt
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
          </>
        )}
      </div>

      {/* Two-column: overdue + top suppliers */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" /> Überfällige Rechnungen
          </h3>
          {overdue.length === 0 ? (
            <Empty title="Keine überfälligen Rechnungen" hint="Alle Zahlungsfristen werden eingehalten." />
          ) : (
            <div className="space-y-2">
              {overdue.slice(0, 8).map((inv) => {
                const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
                return (
                  <Link
                    key={inv.id}
                    href={`/purchases/orders/${inv.purchaseOrder.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {inv.invoiceNumber} · {inv.purchaseOrder.supplier.companyName}
                      </div>
                      <div className="text-xs text-gray-400">Fällig: {fmtDate(inv.dueDate)} · {days} Tage überfällig</div>
                    </div>
                    <div className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums whitespace-nowrap">
                      <Money amount={inv.purchaseOrder.openAmount} currency={inv.purchaseOrder.currency} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-purple-500" /> Top-Lieferanten
          </h3>
          {top.length === 0 ? (
            <Empty title="Noch keine Bestellungen" hint="Lege deinen ersten Lieferanten an und erfasse eine Bestellung." action={
              <Link href="/purchases/orders/new" className={btn('primary')}>
                <Plus className="h-4 w-4" /> Neue Bestellung
              </Link>
            } />
          ) : (
            <div className="space-y-2">
              {top.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goToOrders({ supplierId: s.id })}
                  className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.companyName}</div>
                      <div className="text-xs text-gray-400">{s.orderCount} Bestellungen</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                    <Money amount={s.totalAmount} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
