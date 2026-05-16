'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, ChevronLeft, ChevronRight, Package, AlertCircle, RefreshCw, Filter, X, MapPin, Save, Check } from 'lucide-react';
import { shippingApi, fmtDate, fmtDateTime } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, label as labelCls, SectionCard, Badge, Money } from '@/components/shipping/ShippingUI';
import { cn } from '@/lib/utils';

// Raised from 50 to 200 so bulk label creation in one batch is realistic —
// user-Feedback: 50 war zu wenig wenn ein Tag viele Bestellungen reinkommen.
const PAGE_SIZE = 200;

type ProductFilterMode = 'include' | 'exclude';
type OrdersTab = 'pending' | 'address_errors';
type QuantityOp = 'eq' | 'gte' | 'lte' | 'gt' | 'lt' | 'contains';
const QUANTITY_OPS: { value: QuantityOp; label: string }[] = [
  { value: 'contains', label: 'enthält' },
  { value: 'eq', label: '=' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
];

interface ProductOption {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  productImage: string | null;
}

export default function ShippingOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<OrdersTab>('pending');
  const [search, setSearch] = useState('');
  const [hasShipment, setHasShipment] = useState<'' | 'yes' | 'no'>('no');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'unfulfilled' | 'partial'>('all');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Produkt-Filter (include/exclude Liste)
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [filterMode, setFilterMode] = useState<ProductFilterMode>('include');
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  // Exklusiv-Filter (mehrere Variants + Menge + Operator)
  const [exclusiveOpen, setExclusiveOpen] = useState(false);
  const [exclusiveVariantIds, setExclusiveVariantIds] = useState<Set<string>>(new Set());
  const [exclusiveOp, setExclusiveOp] = useState<QuantityOp>('eq');
  const [exclusiveQuantity, setExclusiveQuantity] = useState<number>(2);
  const [exclusiveSearch, setExclusiveSearch] = useState('');

  // Address-Error-Count für Tab-Badge
  const [addressErrorCount, setAddressErrorCount] = useState<number>(0);

  // Address-Correction-Modal
  const [correctingOrder, setCorrectingOrder] = useState<any | null>(null);

  useEffect(() => { setOffset(0); setSelectedIds(new Set()); }, [search, hasShipment, fulfillmentFilter, filterMode, selectedVariantIds, exclusiveVariantIds, exclusiveOp, exclusiveQuantity, tab]);

  // Address-Error-Count regelmäßig laden (für Badge)
  useEffect(() => {
    shippingApi.addressErrorCount()
      .then((d) => setAddressErrorCount(d.count))
      .catch(() => {});
  }, [items]); // refresh nach jeder Order-Liste-Aktualisierung

  // Lazy-load product options once (first time user opens filter OR exclusive-filter)
  useEffect(() => {
    if ((!productFilterOpen && !exclusiveOpen) || productOptions.length > 0) return;
    shippingApi.listProductProfiles()
      .then((d: any[]) => {
        setProductOptions(
          d.map((p) => ({
            variantId: p.variantId,
            productTitle: p.productTitle || '—',
            variantTitle: p.variantTitle || '',
            sku: p.sku,
            productImage: p.productImage ?? null,
          })),
        );
      })
      .catch((e: any) => console.error('Produkt-Liste laden fehlgeschlagen:', e.message));
  }, [productFilterOpen, productOptions.length]);

  const params = useMemo(() => {
    const ids = Array.from(selectedVariantIds);
    const exIds = Array.from(exclusiveVariantIds);
    return {
      search: search || undefined,
      hasShipment: hasShipment || undefined,
      fulfillmentStatus: fulfillmentFilter === 'all' ? undefined : fulfillmentFilter,
      included: filterMode === 'include' && ids.length ? ids.join(',') : undefined,
      excluded: filterMode === 'exclude' && ids.length ? ids.join(',') : undefined,
      exclusiveVariantIds: exIds.length ? exIds.join(',') : undefined,
      exclusiveQuantityOp: exIds.length ? exclusiveOp : undefined,
      // Bei 'contains' brauchen wir keine Menge — nur Praesenz-Check.
      exclusiveQuantity: exIds.length && exclusiveOp !== 'contains' ? String(exclusiveQuantity) : undefined,
      addressStatus: tab === 'address_errors' ? 'error' : undefined,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    };
  }, [search, hasShipment, fulfillmentFilter, offset, filterMode, selectedVariantIds, exclusiveVariantIds, exclusiveOp, exclusiveQuantity, tab]);

  useEffect(() => {
    setLoading(true);
    shippingApi.listOrders(params)
      .then((d) => { setItems(d.items); setTotal(d.total); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  // Versand-Sync State — wird auch fuer den manuellen "Aus Shopify
  // nachladen"-Button genutzt, daher beide Pfade teilen sich Spinner +
  // Statustext, damit der User immer weiss was los ist.
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ checked: number; fixed: number } | null>(null);

  async function runReconcile(): Promise<void> {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const r = await shippingApi.reconcileShipping();
      setReconcileResult({ checked: r.checked, fixed: r.fixed });
      // Immer Liste neu laden (auch wenn fixed=0) — der User soll sehen
      // dass der Sync fertig ist und die Zahlen aktuell sind.
      const fresh = await shippingApi.listOrders(params);
      setItems(fresh.items);
      setTotal(fresh.total);
    } catch (e: any) {
      setReconcileResult({ checked: 0, fixed: 0 });
      console.error('reconcile failed', e);
    } finally {
      setReconciling(false);
      // Result-Banner nach 6s ausblenden
      setTimeout(() => setReconcileResult(null), 6000);
    }
  }

  // Beim ersten Mount automatisch einen Sync — User sieht innerhalb
  // weniger Sekunden eine bereinigte Liste ohne extra Klick.
  useEffect(() => {
    runReconcile();
    // Nur einmal — params aendert sich pro Filterklick und wuerde sonst
    // jedesmal einen Sync ausloesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        subtitle={`${total} offen${total !== 1 ? 'e' : ''} · nur open/unfulfilled · stornierte + rückerstattete ausgeschlossen`}
        actions={
          <>
            <button
              onClick={runReconcile}
              disabled={reconciling}
              className={btn('secondary')}
              title="Holt alle offenen Bestellungen frisch aus Shopify und entfernt versandte/stornierte/rückerstattete aus der Liste."
            >
              <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} />
              {reconciling ? 'Synchronisiere…' : 'Aus Shopify nachladen'}
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

      {/* Sync-Statusleiste — sichtbar wahrend reconcile laeuft + 6s nach Abschluss */}
      {(reconciling || reconcileResult) && (
        <div className={`rounded-xl border p-3 flex items-center gap-3 text-sm ${
          reconciling
            ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300'
            : (reconcileResult?.fixed ?? 0) > 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300'
              : 'border-gray-200 bg-gray-50 dark:border-white/8 dark:bg-white/[0.03] text-gray-600 dark:text-gray-400'
        }`}>
          {reconciling ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Synchronisiere mit Shopify…</div>
                <div className="text-xs opacity-80 mt-0.5">
                  Versandte, stornierte und rückerstattete Bestellungen werden automatisch aus der Liste entfernt. Das dauert ein paar Sekunden.
                </div>
                {/* Indeterminate-Bar — wir kennen kein Total/Done, aber der
                    Spinner-Balken zeigt deutlich dass etwas laeuft. */}
                <div className="mt-2 h-1 bg-blue-200/40 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            </>
          ) : reconcileResult ? (
            <>
              <RefreshCw className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium">Sync fertig.</span>{' '}
                <span className="opacity-80">
                  {reconcileResult.checked} Bestellung{reconcileResult.checked !== 1 ? 'en' : ''} geprüft,{' '}
                  {reconcileResult.fixed > 0
                    ? `${reconcileResult.fixed} aktualisiert (versandt/storniert/rückerstattet entfernt).`
                    : 'alles aktuell.'}
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Tabs — Offene Bestellungen vs. Adressfehler */}
      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-1.5 inline-flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === 'pending'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Bestellungen
        </button>
        <button
          type="button"
          onClick={() => setTab('address_errors')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === 'address_errors'
              ? 'bg-red-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Adressfehler
          {addressErrorCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold ${
              tab === 'address_errors' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            }`}>
              {addressErrorCount}
            </span>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
          {/* Search takes full row on mobile */}
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bestellnr., Name oder Email …" className={inputCls('pl-9')} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={hasShipment} onChange={(e) => setHasShipment(e.target.value as any)} className={inputCls('flex-1 sm:flex-none sm:w-auto')}>
              <option value="no">Ohne Label/Sendung</option>
              <option value="yes">Mit Sendung</option>
              <option value="">Alle</option>
            </select>
            {/* Versand-Status: alle (default) / nur unfulfilled / nur partial.
                Stornierte + rückerstattete sind eh systemweit ausgeschlossen. */}
            <select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value as any)}
              className={inputCls('flex-1 sm:flex-none sm:w-auto')}
              title="Versand-Status"
            >
              <option value="all">Alle (offen + teilversand)</option>
              <option value="unfulfilled">Nur offen (unfulfilled)</option>
              <option value="partial">Nur teilversand (partial)</option>
            </select>
            <button
              onClick={() => setProductFilterOpen((v) => !v)}
              className={btn(selectedVariantIds.size > 0 ? 'primary' : 'secondary', 'flex-1 sm:flex-none')}
            >
              <Filter className="h-4 w-4" />
              <span className="truncate">
                {selectedVariantIds.size > 0
                  ? `${selectedVariantIds.size} Prod. (${filterMode === 'include' ? 'mit' : 'ohne'})`
                  : 'Produkt-Filter'}
              </span>
            </button>
            {selectedVariantIds.size > 0 && (
              <button
                onClick={() => { setSelectedVariantIds(new Set()); setProductFilterOpen(false); }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Produkt-Filter zurücksetzen"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
            {/* Exklusiv-Filter: mehrere SKUs + Operator + Menge */}
            <button
              onClick={() => setExclusiveOpen((v) => !v)}
              className={btn(exclusiveVariantIds.size > 0 ? 'primary' : 'secondary', 'flex-1 sm:flex-none')}
            >
              <Filter className="h-4 w-4" />
              <span className="truncate">
                {exclusiveVariantIds.size > 0
                  ? `SKU-Filter (${exclusiveVariantIds.size} Produkt${exclusiveVariantIds.size === 1 ? '' : 'e'} · ${QUANTITY_OPS.find((o) => o.value === exclusiveOp)?.label}${exclusiveOp !== 'contains' ? ' ' + exclusiveQuantity : ''})`
                  : 'SKU = Menge'}
              </span>
            </button>
            {exclusiveVariantIds.size > 0 && (
              <button
                onClick={() => { setExclusiveVariantIds(new Set()); setExclusiveOpen(false); }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="SKU-Filter zurücksetzen"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Exklusiv-SKU-Filter-Panel: Tiles + Multi-Select + Mengen-Operator */}
        {exclusiveOpen && (
          <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] p-3 space-y-3">
            <p className="text-xs text-gray-500">
              {exclusiveOp === 'contains'
                ? <>Zeige Bestellungen, die <strong>alle ausgewählten Produkte enthalten</strong> (egal in welcher Menge, andere Produkte erlaubt).</>
                : <>Zeige nur Bestellungen, die <strong>genau</strong> alle ausgewählten Produkte in der angegebenen Summen-Menge enthalten — und <strong>nichts anderes</strong>.</>
              }
            </p>

            {/* Operator + Menge (Menge nur wenn nicht 'enthält') */}
            <div className={exclusiveOp === 'contains' ? 'max-w-[160px]' : 'grid grid-cols-2 gap-2 max-w-xs'}>
              <div>
                <label className={labelCls()}>Operator</label>
                <select
                  value={exclusiveOp}
                  onChange={(e) => setExclusiveOp(e.target.value as QuantityOp)}
                  className={inputCls()}
                >
                  {QUANTITY_OPS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {exclusiveOp !== 'contains' && (
                <div>
                  <label className={labelCls()}>Summen-Menge</label>
                  <input
                    type="number"
                    min="1"
                    value={exclusiveQuantity}
                    onChange={(e) => setExclusiveQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className={inputCls()}
                  />
                </div>
              )}
            </div>

            {/* Suche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={exclusiveSearch}
                onChange={(e) => setExclusiveSearch(e.target.value)}
                placeholder="Produkt suchen (Titel oder SKU) …"
                className={inputCls('pl-8 h-9 text-xs')}
              />
            </div>

            {/* Produkt-Liste: kompakte vertikale Zeilen mit kleinem Bild + Text + Checkbox */}
            <div className="max-h-[420px] overflow-y-auto rounded-lg bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
              {productOptions.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">Lädt Produkte …</div>
              ) : (() => {
                const q = exclusiveSearch.toLowerCase().trim();
                const filtered = q
                  ? productOptions.filter((p) =>
                      p.productTitle.toLowerCase().includes(q) ||
                      p.variantTitle.toLowerCase().includes(q) ||
                      (p.sku || '').toLowerCase().includes(q),
                    )
                  : productOptions;
                if (filtered.length === 0) {
                  return <div className="p-6 text-center text-xs text-gray-500">Keine Treffer</div>;
                }
                return (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {filtered.map((p) => {
                      const checked = exclusiveVariantIds.has(p.variantId);
                      return (
                        <button
                          key={p.variantId}
                          type="button"
                          onClick={() => {
                            setExclusiveVariantIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.variantId)) next.delete(p.variantId);
                              else next.add(p.variantId);
                              return next;
                            });
                          }}
                          className={cn(
                            'flex items-center gap-3 w-full px-2.5 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors',
                            checked && 'bg-primary-50/60 dark:bg-primary-900/20',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="rounded text-primary-600 focus:ring-primary-500 flex-shrink-0"
                          />
                          {/* Kleines 32px-Bild */}
                          <div className="h-8 w-8 rounded bg-gray-100 dark:bg-white/5 flex-shrink-0 overflow-hidden">
                            {p.productImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.productImage} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-gray-300 dark:text-white/10 text-base">📦</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex items-baseline gap-2">
                            <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                              {p.productTitle}
                            </span>
                            {p.variantTitle && p.variantTitle !== 'Default Title' && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                · {p.variantTitle}
                              </span>
                            )}
                            {p.sku && (
                              <span className="text-[10px] text-gray-400 font-mono truncate">
                                ({p.sku})
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer: Counter + Reset */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {exclusiveVariantIds.size > 0
                  ? `${exclusiveVariantIds.size} Produkt${exclusiveVariantIds.size === 1 ? '' : 'e'} ausgewählt`
                  : 'Wähle ein oder mehrere Produkte aus'}
              </span>
              {exclusiveVariantIds.size > 0 && (
                <button
                  onClick={() => setExclusiveVariantIds(new Set())}
                  className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 underline"
                >
                  Alle abwählen
                </button>
              )}
            </div>
          </div>
        )}

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
            <div className="table-scroll">
              <table className="min-w-[640px] sm:min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2.5 w-8">
                      <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-2.5 text-left">Bestellnr.</th>
                    <th className="px-3 py-2.5 text-left hidden sm:table-cell">Produkte</th>
                    <th className="px-3 py-2.5 text-left">Empfänger</th>
                    <th className="px-3 py-2.5 text-left hidden md:table-cell">Adresse</th>
                    <th className="px-3 py-2.5 text-left hidden lg:table-cell">Land</th>
                    <th className="px-3 py-2.5 text-right">Betrag</th>
                    <th className="px-3 py-2.5 text-left hidden md:table-cell">Datum</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Status</th>
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
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <ProductThumbnails items={o.lineItems || []} />
                        </td>
                        <td className="px-3 py-3 max-w-[160px] sm:max-w-none">
                          <div className="text-gray-900 dark:text-white truncate">{o.customerName || '—'}</div>
                          <div className="text-xs text-gray-500 truncate">{o.customerEmail || '—'}</div>
                          {/* Mobile-only: inline address + status below name so user still sees key info */}
                          <div className="md:hidden text-[11px] text-gray-500 mt-1 truncate">
                            {!hasAddress ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-3 w-3" /> Adresse fehlt
                              </span>
                            ) : (
                              <>{addr.zip} {addr.city} · {o.countryCode || '—'}</>
                            )}
                          </div>
                          <div className="sm:hidden text-[11px] text-gray-400 mt-0.5">{fmtDateTime(o.placedAt)}</div>
                        </td>
                        <td className="px-3 py-3 max-w-[280px] hidden md:table-cell">
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
                        <td className="px-3 py-3 text-xs text-gray-500 uppercase hidden lg:table-cell">{o.countryCode || '—'}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={o.totalPrice} currency={o.currency} /></td>
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap hidden md:table-cell">{fmtDateTime(o.placedAt)}</td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <Badge color="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{o.fulfillmentStatus}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          {tab === 'address_errors' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setCorrectingOrder(o); }}
                              className={btn('primary', 'h-8 px-2 py-1 text-xs whitespace-nowrap')}
                              title="Adresse korrigieren"
                            >
                              <MapPin className="h-3 w-3" /> Korrigieren
                            </button>
                          ) : shipments.length > 0 ? (
                            <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{shipments.length}×</Badge>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 flex-wrap px-3 sm:px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
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

      {/* Address-Correction-Modal */}
      {correctingOrder && (
        <AddressCorrectionModal
          order={correctingOrder}
          onClose={() => setCorrectingOrder(null)}
          onSaved={() => {
            setCorrectingOrder(null);
            // Reload both current list and error count
            shippingApi.listOrders(params).then((d) => { setItems(d.items); setTotal(d.total); });
            shippingApi.addressErrorCount().then((d) => setAddressErrorCount(d.count));
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address-Correction-Modal — shows current (broken) address at the top,
// editable fields at the bottom. Save overwrites the order's shippingAddress
// and the order re-appears in the main "Bestellungen" tab.
// ---------------------------------------------------------------------------
function AddressCorrectionModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const current = (order.shippingAddress || {}) as any;
  const [name, setName] = useState<string>(current.name || order.customerName || '');
  const [company, setCompany] = useState<string>(current.company || '');
  const [address1, setAddress1] = useState<string>(current.address1 || current.street || '');
  const [address2, setAddress2] = useState<string>(current.address2 || '');
  const [houseNumber, setHouseNumber] = useState<string>(current.houseNumber || '');
  const [zip, setZip] = useState<string>(current.zip || current.postalCode || '');
  const [city, setCity] = useState<string>(current.city || '');
  const [province, setProvince] = useState<string>(current.province || '');
  const [country, setCountry] = useState<string>(
    (current.country_code || current.country || order.countryCode || 'DE').toUpperCase().slice(0, 2),
  );
  const [phone, setPhone] = useState<string>(current.phone || order.customerPhone || '');
  const [email, setEmail] = useState<string>(order.customerEmail || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!address1.trim() || !zip.trim() || !city.trim() || !country.trim()) {
      setErr('Straße, PLZ, Stadt und Land sind Pflicht.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await shippingApi.updateOrderAddress(order.id, {
        name: name.trim() || undefined,
        company: company.trim() || null,
        address1: address1.trim(),
        address2: address2.trim() || null,
        houseNumber: houseNumber.trim() || null,
        zip: zip.trim(),
        city: city.trim(),
        province: province.trim() || null,
        country: country.trim().toUpperCase(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 modal-panel">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Adresse korrigieren</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Bestellung #{order.orderNumber} · {order.customerName || '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current (broken) address — read-only */}
          <SectionCard title="Ursprüngliche Adresse vom Kunden" description="So wurde sie in Shopify eingetragen">
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
              {current.name && <div>{current.name}</div>}
              {current.company && <div className="text-xs text-gray-500">{current.company}</div>}
              <div>
                {current.address1 || current.street ? (
                  <>{current.address1 || current.street}{current.address2 ? `, ${current.address2}` : ''}</>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">— keine Straße —</span>
                )}
              </div>
              <div>
                {current.zip || current.postalCode ? (
                  <>{current.zip || current.postalCode} {current.city || <span className="text-amber-600 dark:text-amber-400">— keine Stadt —</span>}</>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">— keine PLZ/Stadt —</span>
                )}
              </div>
              <div className="uppercase text-xs text-gray-500">{current.country_code || current.country || order.countryCode || '—'}</div>
              {order.customerEmail && <div className="text-xs text-gray-500 mt-1">{order.customerEmail}</div>}
              {order.customerPhone && <div className="text-xs text-gray-500">{order.customerPhone}</div>}
            </div>
          </SectionCard>

          {/* Editable fields */}
          <SectionCard title="Korrigierte Adresse" description="Wird beim Label-Druck verwendet">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls()}>Name / Empfänger</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} placeholder="Max Mustermann" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls()}>Firma (optional)</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className={labelCls()}>Straße *</label>
                <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputCls()} placeholder="Musterstraße" />
              </div>
              <div>
                <label className={labelCls()}>Hausnummer *</label>
                <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className={inputCls()} placeholder="12a" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls()}>Adress-Zusatz (optional)</label>
                <input value={address2} onChange={(e) => setAddress2(e.target.value)} className={inputCls()} placeholder="c/o, Hinterhof, Klingel …" />
              </div>
              <div>
                <label className={labelCls()}>PLZ *</label>
                <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className={labelCls()}>Stadt *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className={labelCls()}>Bundesland / Provinz (optional)</label>
                <input value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className={labelCls()}>Land (ISO-2) *</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                  className={inputCls('uppercase')}
                  maxLength={2}
                  placeholder="DE"
                />
              </div>
              <div>
                <label className={labelCls()}>Telefon (optional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className={labelCls()}>E-Mail (optional)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls()} />
              </div>
            </div>
          </SectionCard>

          {err && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex-shrink-0">
          <button onClick={onClose} className={btn('ghost')} disabled={busy}>Abbrechen</button>
          <button onClick={save} disabled={busy} className={btn('primary')}>
            <Save className="h-4 w-4" /> {busy ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product thumbnails — aggregates line items by product, shows image with
// quantity badge when >1x bestellt. Max 4 thumbnails, Rest als "+N".
// ---------------------------------------------------------------------------
function ProductThumbnails({ items }: { items: any[] }) {
  if (!items?.length) return <span className="text-xs text-gray-400">—</span>;

  // Aggregate line items by productId (or fallback on sku/title)
  const byProduct = new Map<string, { key: string; image: string | null; title: string; quantity: number }>();
  for (const li of items) {
    const key = li.productId || li.sku || li.title || li.id;
    if (!key) continue;
    const qty = Number(li.quantity) || 1;
    const existing = byProduct.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      byProduct.set(key, {
        key,
        image: li.productImageUrl || null,
        title: li.productTitle || li.title || '',
        quantity: qty,
      });
    }
  }

  const products = Array.from(byProduct.values());
  const shown = products.slice(0, 4);
  const overflow = products.length - shown.length;

  return (
    <div className="flex items-center gap-1.5">
      {shown.map((p) => (
        <div key={p.key} className="relative flex-shrink-0" title={`${p.title} × ${p.quantity}`}>
          {p.image ? (
            // Use native <img> — Next/Image would require configured remote patterns in next.config.js
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt={p.title}
              className="h-10 w-10 rounded-lg object-cover bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              loading="lazy"
              onError={(e) => {
                // If the Shopify CDN URL 404s, hide the <img> and let the fallback below show
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const parent = (e.currentTarget as HTMLImageElement).parentElement;
                if (parent) parent.setAttribute('data-image-failed', '1');
              }}
            />
          ) : null}
          {!p.image && (
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {p.title.slice(0, 2).toUpperCase() || '?'}
            </div>
          )}
          {p.quantity > 1 && (
            <span className="absolute -top-1.5 -right-1.5 h-[18px] min-w-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-[#0f1117]">
              {p.quantity}
            </span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="h-10 px-2 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center text-xs text-gray-500 font-medium">
          +{overflow}
        </div>
      )}
    </div>
  );
}
