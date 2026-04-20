'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, AlertCircle, Wallet, CheckCircle2, Calendar,
  TrendingUp, FileText, Plus, Truck, Download,
} from 'lucide-react';
import { purchasesApi, fmtMoney, fmtDate } from '@/lib/purchases';
import { KpiCard, PageHeader, btn, Money, Empty, Badge } from '@/components/purchases/PurchaseUI';

export default function PurchasesDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    purchasesApi.dashboard()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
        Dashboard konnte nicht geladen werden: {error}
      </div>
    );
  }

  const counts = data?.counts || {};
  const openByCurrency: Array<{ currency: string; amount: string }> = data?.openByCurrency || [];
  const paidThisMonth: Array<{ currency: string; amount: string }> = data?.paidThisMonthByCurrency || [];
  const overdue: any[] = data?.overdueInvoices || [];
  const top: any[] = data?.topSuppliers || [];

  const formatSums = (rows: { currency: string; amount: string }[]) => {
    if (!rows.length) return '0,00 EUR';
    return rows.map(r => fmtMoney(r.amount, r.currency)).join(' · ');
  };

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Bestellungen gesamt"
          value={counts.total ?? 0}
          sublabel={`${counts.thisMonth ?? 0} diesen Monat`}
          accent="blue"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <KpiCard
          label="Offene Bestellungen"
          value={counts.open ?? 0}
          sublabel={formatSums(openByCurrency)}
          accent="amber"
          icon={<Wallet className="h-5 w-5" />}
        />
        <KpiCard
          label="Teilweise bezahlt"
          value={counts.partiallyPaid ?? 0}
          accent="indigo"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Vollständig bezahlt"
          value={counts.fullyPaid ?? 0}
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Überfällige Rechnungen"
          value={counts.overdue ?? 0}
          sublabel={counts.overdue ? 'Aktion erforderlich' : 'Alles im Zeitplan'}
          accent="red"
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <KpiCard
          label="Bezahlt diesen Monat"
          value={formatSums(paidThisMonth)}
          accent="green"
          icon={<Calendar className="h-5 w-5" />}
        />
        <KpiCard
          label="Top-Lieferanten"
          value={top.length}
          sublabel="nach Umsatz (alle Zeit)"
          accent="purple"
          icon={<Truck className="h-5 w-5" />}
        />
        <KpiCard
          label="Rechnungen offen"
          value={overdue.length}
          accent="amber"
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {/* Two-column: overdue + top suppliers */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Overdue */}
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

        {/* Top suppliers */}
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
                <Link
                  key={s.id}
                  href={`/purchases/suppliers?id=${s.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
