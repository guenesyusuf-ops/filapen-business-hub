'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, X, Loader2, Receipt, ChevronDown, ChevronRight } from 'lucide-react';
import { salesApi } from '@/lib/sales';

/**
 * Inline-Sektion fuer die Customer-Detail-Page: Produkt-Sonderpreise des
 * Kunden bearbeiten. Loest die fruehere Drawer-Logik aus dem entfernten
 * /sales/conditions Modul ab.
 */
export function CustomerProductPrices({ customerId }: { customerId: string }) {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    salesApi.getCustomerConditions(customerId)
      .then((d) => { if (!cancelled) setPrices(d.productPrices || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  async function deletePrice(id: string) {
    if (!confirm('Diesen Sonderpreis entfernen?')) return;
    try {
      await salesApi.deleteCustomerProductPrice(id);
      setPrices((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) { alert(e.message); }
  }
  async function updatePrice(id: string, patch: any) {
    try {
      const updated = await salesApi.updateCustomerProductPrice(id, patch);
      setPrices((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-900/10 dark:to-white/[0.03] shadow-sm overflow-hidden">
      {/* Header — Klick auf den Titel klappt auf/zu */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100 hover:opacity-80 transition-opacity flex-1 text-left"
        >
          <span className="inline-flex h-6 w-6 rounded-md items-center justify-center bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            <Receipt className="h-3.5 w-3.5" />
          </span>
          Produkt-Sonderpreise
          {expanded
            ? <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            : <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        </button>
        {expanded && (
          <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs font-medium">
            <Plus className="h-3.5 w-3.5" /> Preis hinzufuegen
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> Laedt …
            </div>
          ) : prices.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              Noch keine Sonderpreise hinterlegt
            </div>
          ) : (
            <div className="space-y-2">
              {prices.map((p) => (
                <PriceRow
                  key={p.id}
                  price={p}
                  onChange={(patch) => updatePrice(p.id, patch)}
                  onDelete={() => deletePrice(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <ProductPicker
          onClose={() => setPickerOpen(false)}
          onPick={async (variant, fallbackPrice) => {
            try {
              const created = await salesApi.addCustomerProductPrice(customerId, {
                productVariantId: variant.id,
                netPrice: fallbackPrice || 0,
                currency: 'EUR',
              });
              setPrices((prev) => [created, ...prev]);
              setPickerOpen(false);
            } catch (e: any) { alert(e.message); }
          }}
        />
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30';

function PriceRow({
  price, onChange, onDelete,
}: { price: any; onChange: (patch: any) => void; onDelete: () => void }) {
  const productTitle =
    price.productVariant?.product?.title ||
    price.product?.title ||
    'Produkt';
  const variantTitle = price.productVariant?.title && price.productVariant.title !== 'Default Title'
    ? price.productVariant.title
    : null;
  const sku = price.productVariant?.sku || price.product?.sku;

  const [draftPrice, setDraftPrice] = useState(price.netPrice ?? '');
  const [draftMin, setDraftMin] = useState(price.minQuantity != null ? String(price.minQuantity) : '');

  return (
    <div className="grid grid-cols-12 gap-2 items-center p-3 border border-gray-100 dark:border-white/8 rounded-lg bg-white dark:bg-white/[0.02]">
      <div className="col-span-12 md:col-span-5 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{productTitle}</div>
        <div className="text-[11px] text-gray-400 truncate">
          {variantTitle && <span>{variantTitle}</span>}
          {variantTitle && sku && <span> · </span>}
          {sku && <span className="font-mono">SKU: {sku}</span>}
        </div>
      </div>
      <div className="col-span-6 md:col-span-3">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Netto-Preis (€)</div>
        <input
          type="number"
          step="0.01"
          min="0"
          className={inputCls}
          value={draftPrice}
          onChange={(e) => setDraftPrice(e.target.value)}
          onBlur={() => {
            if (String(draftPrice) !== String(price.netPrice)) {
              onChange({ netPrice: Number(draftPrice) });
            }
          }}
        />
      </div>
      <div className="col-span-6 md:col-span-3">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Min. Menge</div>
        <input
          type="number"
          step="1"
          min="0"
          className={inputCls}
          value={draftMin}
          onChange={(e) => setDraftMin(e.target.value)}
          onBlur={() => {
            const newVal = draftMin.trim() ? Number(draftMin) : null;
            const oldVal = price.minQuantity ?? null;
            if (newVal !== oldVal) onChange({ minQuantity: newVal });
          }}
          placeholder="—"
        />
      </div>
      <div className="col-span-12 md:col-span-1 flex md:justify-end">
        <button onClick={onDelete} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Loeschen">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProductPicker({
  onClose, onPick,
}: { onClose: () => void; onPick: (variant: any, listPrice: number) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    salesApi.searchProductsForConditions(q).then((r) => setItems(r || [])).finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Produkt waehlen</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 border-b border-gray-100 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              autoFocus
              className={inputCls + ' pl-9'}
              placeholder="Name oder SKU suchen …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Suche …
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Keine Produkte gefunden</div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="border border-gray-100 dark:border-white/8 rounded-lg mb-2 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 dark:bg-white/[0.02]">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</div>
                  <div className="text-xs text-gray-400">{p.sku || '—'} · {(p.variants || []).length} Variante(n)</div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {(p.variants || []).map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => onPick({ ...v, product: p }, Number(v.price ?? 0))}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-gray-700 dark:text-gray-200 truncate">{v.title || 'Standard'}</div>
                        <div className="text-xs text-gray-400 font-mono">{v.sku || '—'}</div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm tabular-nums">
                          {Number(v.price ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </div>
                        <div className="text-[10px] text-gray-400">Listenpreis</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
