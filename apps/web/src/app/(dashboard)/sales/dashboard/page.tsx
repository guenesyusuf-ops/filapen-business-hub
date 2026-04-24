'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, AlertTriangle, Clock, FileText } from 'lucide-react';
import { salesApi, fmtMoney } from '@/lib/sales';
import { PageHeader, KpiCard } from '@/components/sales/SalesUI';
import { MonthlyRevenueChart } from '@/components/sales/MonthlyRevenueChart';

export default function SalesDashboardPage() {
  const [kpi, setKpi] = useState<{ open: number; urgent: number; overdue: number; monthRevenue: number } | null>(null);
  const [urgentOrders, setUrgentOrders] = useState<any[]>([]);

  useEffect(() => {
    salesApi.dashboard().then(setKpi);
    salesApi.listOrders({ urgency: 'urgent', limit: '10' }).then((r) => setUrgentOrders(r.items));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Verkauf — Dashboard" subtitle="Überblick über offene B2B-Bestellungen" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Offene Bestellungen"
          value={kpi?.open ?? '—'}
          icon={<FileText className="h-4 w-4" />}
        />
        <KpiCard
          label="Dringend (≤ 3 Tage)"
          value={kpi?.urgent ?? '—'}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
        />
        <KpiCard
          label="In Verzug"
          value={kpi?.overdue ?? '—'}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        />
        <KpiCard
          label="Umsatz diesen Monat"
          value={kpi ? fmtMoney(kpi.monthRevenue) : '—'}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
        />
      </div>

      <MonthlyRevenueChart />

      {urgentOrders.length > 0 && (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold mb-3">Dringend zu versenden</h3>
          <div className="space-y-2">
            {urgentOrders.map((o) => (
              <Link key={o.id} href={`/sales/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200/60 dark:border-white/5 p-2 hover:border-primary-300">
                <div>
                  <div className="text-xs font-mono text-primary-600">{o.orderNumber}</div>
                  <div className="text-sm">{o.customer?.companyName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-amber-600 font-medium">
                    Liefer: {o.requiredDeliveryDate ? new Date(o.requiredDeliveryDate).toLocaleDateString('de-DE') : '—'}
                  </div>
                  <div className="text-xs font-medium">{fmtMoney(o.totalNet, o.currency)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
