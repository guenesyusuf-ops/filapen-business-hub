'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QrCode, Printer, ExternalLink } from 'lucide-react';
import { shippingApi, SHIPMENT_STATUS_LABELS, CARRIER_LABELS, fmtDateTime } from '@/lib/shipping';
import { PageHeader, Empty, btn, Badge } from '@/components/shipping/ShippingUI';

export default function ShippingLabelsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await shippingApi.listShipments({ limit: '100' });
        if (cancelled) return;
        const withLabels = (res.items || []).filter(function (s: any) {
          return s.labels && s.labels.length;
        });
        setItems(withLabels);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function printLabel(url: string) {
    const w = window.open(url + '#print', '_blank');
    if (!w) window.open(url, '_blank');
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Labels" subtitle="Archiv aller generierten Versand-Labels" />
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<QrCode className="h-10 w-10" />}
            title="Noch keine Labels generiert"
            hint="Gehe zu Bestellungen, wähle offene Orders aus und klicke 'DHL Label erstellen'."
            action={<Link href="/shipping/orders" className={btn('primary')}>Zu den Bestellungen</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Labels" subtitle={`${items.length} Label${items.length !== 1 ? 's' : ''} generiert`} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
            <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left">Tracking-Nr</th>
              <th className="px-3 py-2.5 text-left">Bestellnr.</th>
              <th className="px-3 py-2.5 text-left">Empfänger</th>
              <th className="px-3 py-2.5 text-left">Carrier</th>
              <th className="px-3 py-2.5 text-left">Format</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Erstellt</th>
              <th className="px-3 py-2.5 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {items.map((s: any) => {
              const label = s.labels[0];
              const st = SHIPMENT_STATUS_LABELS[s.status as keyof typeof SHIPMENT_STATUS_LABELS];
              const carrierLabel = CARRIER_LABELS[s.carrier as keyof typeof CARRIER_LABELS] || s.carrier;
              return (
                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-3 font-mono text-xs text-primary-700 dark:text-primary-300">{s.trackingNumber}</td>
                  <td className="px-3 py-3 font-mono text-xs">#{s.order?.orderNumber}</td>
                  <td className="px-3 py-3 truncate max-w-[200px]">{s.recipientName}</td>
                  <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{carrierLabel}</td>
                  <td className="px-3 py-3 text-xs font-mono">{label.format}</td>
                  <td className="px-3 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                  <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => printLabel(label.url)} title="Drucken" className={btn('primary', 'h-7 px-2 py-0 text-xs')}>
                        <Printer className="h-3 w-3" />
                      </button>
                      <a href={label.url} target="_blank" rel="noopener" title="Öffnen" className={btn('secondary', 'h-7 px-2 py-0 text-xs')}>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Link href={`/shipping/shipments/${s.id}`} className={btn('ghost', 'h-7 px-2 py-0 text-xs')}>Details</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
