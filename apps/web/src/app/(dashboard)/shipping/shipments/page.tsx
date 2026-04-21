'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PackageCheck, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { shippingApi, SHIPMENT_STATUS_LABELS, CARRIER_LABELS, fmtDateTime, type OrderShipmentStatus, type ShippingCarrier } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, Badge } from '@/components/shipping/ShippingUI';

const PAGE_SIZE = 50;

export default function ShipmentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [carrier, setCarrier] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => { setOffset(0); }, [search, status, carrier]);

  const params = useMemo(() => ({
    search: search || undefined,
    status: status || undefined,
    carrier: carrier || undefined,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }), [search, status, carrier, offset]);

  useEffect(() => {
    setLoading(true);
    shippingApi.listShipments(params)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [params]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <PageHeader title="Sendungen" subtitle={`${total} Sendung${total !== 1 ? 'en' : ''}`} />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tracking-Nr, Empfänger, Bestellnr …" className={inputCls('pl-9')} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls('w-auto')}>
            <option value="">Alle Status</option>
            {Object.entries(SHIPMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls('w-auto')}>
            <option value="">Alle Carrier</option>
            {Object.entries(CARRIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : items.length === 0 ? (
          <Empty icon={<PackageCheck className="h-10 w-10" />} title="Keine Sendungen" hint="Wähle in /shipping/orders Bestellungen aus und erstelle Labels." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left">Tracking-Nr</th>
                    <th className="px-3 py-2.5 text-left">Bestellnr.</th>
                    <th className="px-3 py-2.5 text-left">Empfänger</th>
                    <th className="px-3 py-2.5 text-left">Carrier</th>
                    <th className="px-3 py-2.5 text-right">Gewicht</th>
                    <th className="px-3 py-2.5 text-left">Erstellt</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((s) => {
                    const st = SHIPMENT_STATUS_LABELS[s.status as OrderShipmentStatus];
                    return (
                      <tr key={s.id} onClick={() => router.push(`/shipping/shipments/${s.id}`)} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.04] cursor-pointer">
                        <td className="px-3 py-3 font-mono text-xs text-primary-700 dark:text-primary-300">{s.trackingNumber || '—'}</td>
                        <td className="px-3 py-3 font-mono text-xs">#{s.order?.orderNumber}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{s.recipientName}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{s.recipientEmail || '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{CARRIER_LABELS[s.carrier as ShippingCarrier] || s.carrier}</td>
                        <td className="px-3 py-3 text-right text-xs text-gray-500">{s.weightG ? (s.weightG / 1000).toFixed(2) + ' kg' : '—'}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(s.createdAt)}</td>
                        <td className="px-3 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                        <td className="px-3 py-3 text-center">
                          {s.labels?.[0]?.url ? (
                            <a href={s.labels[0].url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-xs">
                              Öffnen <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
                <div>Seite {currentPage} von {totalPages} · {total} gesamt</div>
                <div className="flex gap-2">
                  <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                  </button>
                  <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}>
                    Weiter <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
