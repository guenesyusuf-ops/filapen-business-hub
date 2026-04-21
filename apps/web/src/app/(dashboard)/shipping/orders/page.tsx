'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, ChevronLeft, ChevronRight, Package, AlertCircle } from 'lucide-react';
import { shippingApi, fmtDate } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, Badge, Money } from '@/components/shipping/ShippingUI';

const PAGE_SIZE = 50;

export default function ShippingOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [hasShipment, setHasShipment] = useState<'' | 'yes' | 'no'>('no');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setOffset(0); setSelectedIds(new Set()); }, [search, hasShipment]);

  const params = useMemo(() => ({
    search: search || undefined,
    hasShipment: hasShipment || undefined,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }), [search, hasShipment, offset]);

  useEffect(() => {
    setLoading(true);
    shippingApi.listOrders(params)
      .then((d) => { setItems(d.items); setTotal(d.total); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const toggleAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((o) => o.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bestellungen"
        subtitle={`${total} offen${total !== 1 ? 'e' : ''} · nur open/unfulfilled · stornierte ausgeschlossen`}
        actions={
          selectedIds.size > 0 ? (
            <button
              onClick={async () => {
                if (!confirm(`${selectedIds.size} Label(s) mit DHL erstellen?`)) return;
                try {
                  const res: any = await shippingApi.bulkCreateShipments({
                    orderIds: Array.from(selectedIds),
                    carrier: 'dhl',
                  });
                  alert(`${res.succeeded} von ${res.total} Labels erstellt.`);
                  setSelectedIds(new Set());
                  // Reload
                  const fresh = await shippingApi.listOrders(params);
                  setItems(fresh.items);
                  setTotal(fresh.total);
                } catch (e: any) { alert(e.message); }
              }}
              className={btn('primary')}
            >
              <Package className="h-4 w-4" /> {selectedIds.size} × DHL Label erstellen
            </button>
          ) : null
        }
      />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bestellnr., Name oder Email …" className={inputCls('pl-9')} />
          </div>
          <select value={hasShipment} onChange={(e) => setHasShipment(e.target.value as any)} className={inputCls('w-auto')}>
            <option value="no">Ohne Label/Sendung</option>
            <option value="yes">Mit Sendung</option>
            <option value="">Alle</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : items.length === 0 ? (
          <Empty
            icon={<ClipboardList className="h-10 w-10" />}
            title="Keine offenen Bestellungen"
            hint="Offene + unfulfilled Orders aus Shopify erscheinen hier automatisch. Falls nichts erscheint: Shopify-Shop muss verbunden sein und es müssen neue Webhooks eingegangen sein (oder der Shop wurde re-connected)."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2.5 w-8">
                      <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-2.5 text-left">Bestellnr.</th>
                    <th className="px-3 py-2.5 text-left">Empfänger</th>
                    <th className="px-3 py-2.5 text-left">Adresse</th>
                    <th className="px-3 py-2.5 text-left">Land</th>
                    <th className="px-3 py-2.5 text-right">Betrag</th>
                    <th className="px-3 py-2.5 text-left">Datum</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Sendung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((o) => {
                    const addr = o.shippingAddress as any;
                    const hasAddress = !!addr && (addr.address1 || addr.street || addr.zip);
                    const shipments = o.shipments || [];
                    return (
                      <tr key={o.id} className={`hover:bg-gray-50/80 dark:hover:bg-white/[0.04] ${selectedIds.has(o.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggle(o.id)} />
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          <Link href={`/shipping/orders/${o.id}`} className="text-primary-700 dark:text-primary-300 hover:underline">
                            #{o.orderNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-gray-900 dark:text-white">{o.customerName || '—'}</div>
                          <div className="text-xs text-gray-500">{o.customerEmail || '—'}</div>
                        </td>
                        <td className="px-3 py-3 max-w-[280px]">
                          {hasAddress ? (
                            <div className="text-xs text-gray-600 dark:text-gray-300 truncate" title={`${addr.address1 || ''} ${addr.address2 || ''} ${addr.zip || ''} ${addr.city || ''}`}>
                              {addr.address1 || '—'}{addr.address2 ? `, ${addr.address2}` : ''} · {addr.zip} {addr.city}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" /> Adresse fehlt
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500 uppercase">{o.countryCode || '—'}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={o.totalPrice} currency={o.currency} /></td>
                        <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(o.placedAt)}</td>
                        <td className="px-3 py-3">
                          <Badge color="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{o.fulfillmentStatus}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          {shipments.length > 0 ? (
                            <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{shipments.length} Sendung{shipments.length !== 1 ? 'en' : ''}</Badge>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
                <div>Seite {currentPage} von {totalPages} · {total} Bestellungen</div>
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
