'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, AlertTriangle, Clock, FileText } from 'lucide-react';
import { salesApi, STATUS_LABELS, fmtDate, fmtMoney, urgencyOf, SalesOrderStatus } from '@/lib/sales';
import { PageHeader, Empty, btn, Badge } from '@/components/sales/SalesUI';

type UrgencyFilter = 'all' | 'urgent' | 'overdue';

export default function SalesOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<UrgencyFilter>('all');
  const [status, setStatus] = useState<SalesOrderStatus | 'all'>('all');

  async function load() {
    setLoading(true);
    try {
      const res = await salesApi.listOrders({
        search: search || undefined,
        urgency: urgency === 'all' ? undefined : urgency,
        status: status === 'all' ? undefined : status,
        limit: '100',
      });
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [urgency, status]);

  const counts = useMemo(() => ({
    total,
    urgent: items.filter((i) => urgencyOf(i) === 'urgent').length,
    overdue: items.filter((i) => urgencyOf(i) === 'overdue').length,
  }), [items, total]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verkauf"
        subtitle={`${counts.total} Bestellungen gesamt — ${counts.urgent} dringend, ${counts.overdue} in Verzug`}
        actions={
          <div className="flex gap-2">
            <Link href="/sales/import" className={btn('secondary')}>
              <Upload className="h-4 w-4" /> Import
            </Link>
            <Link href="/sales/orders/new" className={btn('primary')}>
              <Plus className="h-4 w-4" /> Neue Bestellung
            </Link>
          </div>
        }
      />

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="Suche: Bestellnummer, Kunde …"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
        />
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as UrgencyFilter)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm"
        >
          <option value="all">Alle</option>
          <option value="urgent">Dringend (≤3 Tage)</option>
          <option value="overdue">In Verzug</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm"
        >
          <option value="all">Status: Alle</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button onClick={load} className={btn('ghost', 'text-sm')}>Filter anwenden</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<FileText className="h-10 w-10" />}
            title="Noch keine Bestellungen"
            hint="Importiere eine PDF-Bestellung oder lege manuell eine an."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/80 dark:border-white/8 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Bestellnr.</th>
                <th className="px-4 py-2">Kunde</th>
                <th className="px-4 py-2">Produkte</th>
                <th className="px-4 py-2">Liefertermin</th>
                <th className="px-4 py-2 text-right">Betrag</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const urg = urgencyOf(o);
                const productPreview = (o.lineItems ?? [])
                  .slice(0, 2)
                  .map((l: any) => `${l.quantity}× ${l.title}`).join(', ');
                const more = (o.lineItems?.length ?? 0) > 2 ? ` +${o.lineItems.length - 2}` : '';
                return (
                  <tr key={o.id} className="border-t border-gray-200/60 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/sales/orders/${o.id}`} className="text-primary-600 hover:underline">
                        {o.orderNumber}
                      </Link>
                      {o.externalOrderNumber && (
                        <div className="text-[10px] text-gray-400">ext: {o.externalOrderNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900 dark:text-gray-100">{o.customer?.companyName ?? '—'}</div>
                      <div className="text-[11px] text-gray-500">{o.customer?.customerNumber ?? ''}</div>
                    </td>
                    <td className="px-4 py-2 max-w-[320px] truncate text-gray-700 dark:text-gray-300">
                      {productPreview}{more}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {urg === 'overdue' && <Badge color="bg-red-100 text-red-700"><AlertTriangle className="inline h-3 w-3 mr-0.5" />In Verzug</Badge>}
                        {urg === 'urgent' && <Badge color="bg-amber-100 text-amber-700"><Clock className="inline h-3 w-3 mr-0.5" />Dringend</Badge>}
                        {!urg && <span className="text-gray-600 dark:text-gray-400">{fmtDate(o.requiredDeliveryDate)}</span>}
                      </div>
                      {urg && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{fmtDate(o.requiredDeliveryDate)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(o.totalNet, o.currency)}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <StatusDot on={!!o.confirmationSentAt} label="AB" />
                        <StatusDot on={!!o.shippedAt} label="Versand" />
                        <StatusDot on={!!o.invoiceSentAt} label="Rg." />
                        <StatusDot on={!!o.paidAt} label="Bez." />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/sales/orders/${o.id}`} className="text-xs text-primary-600 hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        on
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
      title={on ? `${label}: erledigt` : `${label}: offen`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}
