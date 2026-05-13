'use client';

import { useEffect, useState } from 'react';
import { X, Save, Plus, Trash2, Search, Package, Loader2, Receipt, Settings2 } from 'lucide-react';
import { salesApi } from '@/lib/sales';
import { btn } from '@/components/sales/SalesUI';

interface Props {
  customerId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function CustomerConditionsDrawer({ customerId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<any | null>(null);
  const [prices, setPrices] = useState<any[]>([]);

  // Globale Konditions-Felder
  const [paymentTerms, setPaymentTerms] = useState('');
  const [minOrderQuantity, setMinOrderQuantity] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [shippingTerms, setShippingTerms] = useState('');

  // Picker fuer neue Produkt-Preise
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = () => {
    setLoading(true);
    salesApi.getCustomerConditions(customerId)
      .then((d) => {
        setCustomer(d.customer);
        setPrices(d.productPrices || []);
        setPaymentTerms(d.customer.paymentTerms ?? '');
        setMinOrderQuantity(d.customer.minOrderQuantity != null ? String(d.customer.minOrderQuantity) : '');
        setMinOrderValue(d.customer.minOrderValue != null ? String(d.customer.minOrderValue) : '');
        setDiscountPercent(d.customer.discountPercent != null ? String(d.customer.discountPercent) : '');
        setShippingTerms(d.customer.shippingTerms ?? '');
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [customerId]);

  // ESC schliesst
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveConditions() {
    setSaving(true);
    setError(null);
    try {
      await salesApi.updateCustomerConditions(customerId, {
        paymentTerms: paymentTerms.trim() || null,
        minOrderQuantity: minOrderQuantity.trim() ? Number(minOrderQuantity) : null,
        minOrderValue: minOrderValue.trim() ? Number(minOrderValue) : null,
        discountPercent: discountPercent.trim() ? Number(discountPercent) : null,
        shippingTerms: shippingTerms.trim() || null,
      });
      onSaved?.();
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function deletePrice(id: string) {
    if (!confirm('Diesen Sonderpreis entfernen?')) return;
    try {
      await salesApi.deleteCustomerProductPrice(id);
      setPrices((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function updatePrice(id: string, patch: any) {
    try {
      const updated = await salesApi.updateCustomerProductPrice(id, patch);
      setPrices((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-[#0f1117] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {customer?.companyName || 'Konditionen'}
            </h2>
            {customer?.customerNumber && (
              <p className="text-xs text-gray-500 font-mono">{customer.customerNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-5 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Globale Konditionen */}
            <ConditionCard title="Allgemeine Konditionen" icon={<Settings2 className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Zahlungsziel">
                  <input
                    type="text"
                    className={inputCls}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="z.B. Netto 30 Tage"
                  />
                </Field>
                <Field label="Mindestbestellmenge (Stueck)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={inputCls}
                    value={minOrderQuantity}
                    onChange={(e) => setMinOrderQuantity(e.target.value)}
                    placeholder="z.B. 12"
                  />
                </Field>
                <Field label="Mindestbestellwert (€)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    placeholder="z.B. 250"
                  />
                </Field>
                <Field label="Rabatt (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className={inputCls}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="z.B. 5"
                  />
                </Field>
                <Field label="Lieferbedingungen" className="col-span-2">
                  <input
                    type="text"
                    className={inputCls}
                    value={shippingTerms}
                    onChange={(e) => setShippingTerms(e.target.value)}
                    placeholder="z.B. frei Haus DE, EXW Werk Pforzheim …"
                  />
                </Field>
              </div>
              <div className="flex justify-end mt-3">
                <button onClick={saveConditions} disabled={saving} className={btn('primary')}>
                  <Save className="h-4 w-4" /> {saving ? 'Speichere …' : 'Speichern'}
                </button>
              </div>
            </ConditionCard>

            {/* Produkt-Preise */}
            <ConditionCard
              title={`Produkt-Sonderpreise (${prices.length})`}
              icon={<Receipt className="h-4 w-4" />}
              actions={
                <button onClick={() => setPickerOpen(true)} className={btn('secondary')}>
                  <Plus className="h-4 w-4" /> Preis hinzufuegen
                </button>
              }
            >
              {prices.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
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
            </ConditionCard>
          </div>
        )}
      </div>

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
            } catch (e: any) {
              alert(e.message);
            }
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Subkomponenten
// -----------------------------------------------------------------------------

function ConditionCard({
  title, icon, actions, children,
}: { title: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-gray-50/40 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon} {title}
        </h3>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`text-xs block ${className ?? ''}`}>
      <div className="text-gray-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

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
