'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, ChevronLeft, ChevronRight, Package, AlertCircle, RefreshCw, Filter, X } from 'lucide-react';
import { shippingApi, fmtDate, fmtDateTime } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, Badge, Money } from '@/components/shipping/ShippingUI';

const PAGE_SIZE = 50;

type ProductFilterMode = 'include' | 'exclude';

interface ProductOption {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
}

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

  // Produkt-Filter
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [filterMode, setFilterMode] = useState<ProductFilterMode>('include');
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  useEffect(() => { setOffset(0); setSelectedIds(new Set()); }, [search, hasShipment, filterMode, selectedVariantIds]);

  // Lazy-load product options once (first time user opens filter)
  useEffect(() => {
    if (!productFilterOpen || productOptions.length > 0) return;
    shippingApi.listProductProfiles()
      .then((d: any[]) => {
        setProductOptions(
          d.map((p) => ({
            variantId: p.variantId,
            productTitle: p.productTitle || '—',
            variantTitle: p.variantTitle || '',
            sku: p.sku,
          })),
        );
      })
      .catch((e: any) => console.error('Produkt-Liste laden fehlgeschlagen:', e.message));
  }, [productFilterOpen, productOptions.length]);

  const params = useMemo(() => {
    const ids = Array.from(selectedVariantIds);
    return {
      search: search || undefined,
      hasShipment: hasShipment || undefined,
      included: filterMode === 'include' && ids.length ? ids.join(',') : undefined,
      excluded: filterMode === 'exclude' && ids.length ? ids.join(',') : undefined,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    };
  }, [search, hasShipment, offset, filterMode, selectedVariantIds]);

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
          <>
            <button
              onClick={async () => {
                if (!confirm('Bestehende Bestellungen frisch aus Shopify laden? Dauert 3-5 Minuten. Dadurch werden fehlende Adressen/Namen nachgeladen.')) return;
                try {
                  await shippingApi.refreshOrdersFromShopify();
                  alert('Refresh läuft im Hintergrund. Lade die Seite in 3-5 Min neu.');
                } catch (e: any) { alert(e.message); }
              }}
              className={btn('secondary')}
            >
              <RefreshCw className="h-4 w-4" /> Aus Shopify nachladen
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`${selectedIds.size} Label(s) mit DHL erstellen?`)) return;
                  try {
                    const res: any = await shippingApi.bulkCreateShipments({
                      orderIds: Array.from(selectedIds),
                      carrier: 'dhl',
                    });
                    // Surface the actual carrier errors instead of only the summary —
                    // "0 von 1" alone hides the DHL validation message we need to act on.
                    const failed = (res.results || []).filter((r: any) => r.error);
                    if (res.succeeded === res.total) {
                      alert(`${res.succeeded} von ${res.total} Labels erstellt.`);
                    } else if (failed.length === 1) {
                      alert(`${res.succeeded} von ${res.total} Labels erstellt.\n\nFehler:\n${failed[0].error}`);
                    } else {
                      const preview = failed.slice(0, 5).map((r: any) => `• ${r.error}`).join('\n');
                      const more = failed.length > 5 ? `\n… und ${failed.length - 5} weitere` : '';
                      alert(`${res.succeeded} von ${res.total} Labels erstellt.\n\nFehler:\n${preview}${more}`);
                    }
                    setSelectedIds(new Set());
                    const fresh = await shippingApi.listOrders(params);
                    setItems(fresh.items);
                    setTotal(fresh.total);
                  } catch (e: any) { alert(e.message); }
                }}
                className={btn('primary')}
              >
                <Package className="h-4 w-4" /> {selectedIds.size} × DHL Label erstellen
              </button>
            )}
          </>
        }
      />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3 space-y-3">
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
          <button
            onClick={() => setProductFilterOpen((v) => !v)}
            className={btn(selectedVariantIds.size > 0 ? 'primary' : 'secondary', 'h-10')}
          >
            <Filter className="h-4 w-4" />
            {selectedVariantIds.size > 0
              ? `${selectedVariantIds.size} Produkt${selectedVariantIds.size === 1 ? '' : 'e'} (${filterMode === 'include' ? 'mit' : 'ohne'})`
              : 'Produkt-Filter'}
          </button>
          {selectedVariantIds.size > 0 && (
            <button
              onClick={() => { setSelectedVariantIds(new Set()); setProductFilterOpen(false); }}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Produkt-Filter zurücksetzen"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        {productFilterOpen && (
          <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-xs text-gray-500">Bestellungen</span>
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                <button
                  onClick={() => setFilterMode('include')}
                  className={`px-3 py-1 text-xs ${filterMode === 'include' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                >
                  MIT ausgewählten Produkten
                </button>
                <button
                  onClick={() => setFilterMode('exclude')}
                  className={`px-3 py-1 text-xs ${filterMode === 'exclude' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                >
                  OHNE ausgewählte Produkte
                </button>
              </div>
              <span className="text-xs text-gray-500">anzeigen</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Produkt suchen (Titel oder SKU) …"
                className={inputCls('pl-8 h-9 text-xs')}
              />
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/[0.02]">
              {productOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">Lädt Produkte …</div>
              ) : (() => {
                const q = productSearch.toLowerCase().trim();
                const filtered = q
                  ? productOptions.filter((p) =>
                      p.productTitle.toLowerCase().includes(q) ||
                      p.variantTitle.toLowerCase().includes(q) ||
                      (p.sku || '').toLowerCase().includes(q),
                    )
                  : productOptions;
                if (filtered.length === 0) {
                  return <div className="p-4 text-center text-xs text-gray-500">Keine Treffer</div>;
                }
                return filtered.map((p) => {
                  const checked = selectedVariantIds.has(p.variantId);
                  return (
                    <label
                      key={p.variantId}
                      className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] border-b border-gray-100 dark:border-white/5 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedVariantIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.variantId);
                            else next.delete(p.variantId);
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-gray-900 dark:text-white">{p.productTitle}</span>
                        {p.variantTitle && p.variantTitle !== 'Default Title' && (
                          <span className="text-gray-500"> · {p.variantTitle}</span>
                        )}
                        {p.sku && <span className="text-gray-400 ml-1">({p.sku})</span>}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{selectedVariantIds.size} ausgewählt</span>
              <div className="flex gap-2">
                {selectedVariantIds.size > 0 && (
                  <button
                    onClick={() => setSelectedVariantIds(new Set())}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    Auswahl löschen
                  </button>
                )}
                <button
                  onClick={() => setProductFilterOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
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
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(o.placedAt)}</td>
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
