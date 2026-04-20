'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Trash2, Package, Truck, Check, X, ShoppingCart } from 'lucide-react';
import { purchasesApi, type Supplier } from '@/lib/purchases';
import { btn, input, label, Money, PageHeader } from '@/components/purchases/PurchaseUI';

type LineItem = {
  productId?: string | null;
  productVariantId?: string | null;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function NewOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  const [orderDate, setOrderDate] = useState(todayIso());
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [shippingCost, setShippingCost] = useState<string>('');
  const [customsCost, setCustomsCost] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [items, setItems] = useState<LineItem[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // Rechnungs-Felder (optional)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [invoiceDue, setInvoiceDue] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [useOrderTotalAsInvoice, setUseOrderTotalAsInvoice] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    purchasesApi.listSuppliers({ search: supplierSearch || undefined, status: 'active' }).then(setSuppliers);
  }, [supplierSearch]);

  const supplier = suppliers.find((s) => s.id === supplierId);

  // Auto-select default currency from supplier
  useEffect(() => {
    if (supplier?.defaultCurrency && (supplier.defaultCurrency === 'EUR' || supplier.defaultCurrency === 'USD')) {
      setCurrency(supplier.defaultCurrency as any);
    }
  }, [supplierId]); // eslint-disable-line

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const sub = it.quantity * it.unitPrice;
      subtotal += sub;
      tax += sub * (it.vatRate / 100);
    }
    const ship = Number(shippingCost || 0);
    const cust = Number(customsCost || 0);
    const total = subtotal + tax + ship + cust;
    return { subtotal, tax, total };
  }, [items, shippingCost, customsCost]);

  const addItem = (l: Partial<LineItem>) => {
    setItems((prev) => [...prev, {
      productName: l.productName || 'Produkt',
      sku: l.sku || null,
      productId: l.productId || null,
      productVariantId: l.productVariantId || null,
      quantity: 1,
      unitPrice: l.unitPrice ?? 0,
      vatRate: l.vatRate ?? 19,
    }]);
  };

  const updateItem = (i: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const valid = supplierId && items.length > 0 && items.every((it) => it.quantity > 0 && it.unitPrice >= 0);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const order = await purchasesApi.createOrder({
        supplierId,
        orderDate,
        expectedDelivery: expectedDelivery || null,
        currency,
        exchangeRate: exchangeRate ? Number(exchangeRate) : null,
        shippingCost: shippingCost ? Number(shippingCost) : null,
        customsCost: customsCost ? Number(customsCost) : null,
        notes: notes || null,
        internalNotes: internalNotes || null,
        items,
      });

      // Optional: Rechnung direkt miterfassen, falls Nummer angegeben
      if (invoiceNumber.trim()) {
        const invAmount = useOrderTotalAsInvoice
          ? totals.total
          : (invoiceAmount ? Number(invoiceAmount) : totals.total);
        try {
          await purchasesApi.addInvoice(order.id, {
            invoiceNumber: invoiceNumber.trim(),
            invoiceDate,
            dueDate: invoiceDue || null,
            amount: invAmount,
            currency,
          });
        } catch (invErr: any) {
          // Bestellung ist schon gespeichert — wir leiten trotzdem weiter, aber mit Warnung
          setWarning(`Bestellung gespeichert, aber Rechnung konnte nicht erfasst werden: ${invErr.message}`);
          setTimeout(() => router.push(`/purchases/orders/${order.id}`), 2000);
          return;
        }
      }

      router.push(`/purchases/orders/${order.id}`);
    } catch (e: any) {
      setError(e.message || 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Neue Bestellung"
        subtitle="Lieferant wählen, Produkte erfassen, Konditionen festlegen"
        actions={
          <>
            <Link href="/purchases/orders" className={btn('ghost')}>
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
            <button onClick={submit} disabled={!valid || busy} className={btn('primary')}>
              {busy ? 'Speichert …' : (<><Check className="h-4 w-4" /> Bestellung anlegen</>)}
            </button>
          </>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: supplier + conditions */}
        <div className="lg:col-span-1 space-y-4">
          {/* Supplier */}
          <Card title="1. Lieferant" icon={<Truck className="h-4 w-4" />}>
            {!supplier ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className={input('pl-9')} placeholder="Suche Firma, Kontakt …" value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 dark:border-white/8 rounded-lg p-1">
                  {suppliers.length === 0 ? (
                    <div className="text-xs text-gray-400 p-3 text-center">
                      Keine Lieferanten gefunden.
                      <button type="button" onClick={() => setShowSupplierForm(true)} className="ml-2 text-primary-600 hover:underline">Neu anlegen</button>
                    </div>
                  ) : suppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSupplierId(s.id)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 text-sm"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{s.companyName}</div>
                      <div className="text-xs text-gray-400">{s.supplierNumber} · {s.country || 'DE'} · {s.defaultCurrency}</div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowSupplierForm(true)} className={btn('secondary', 'w-full justify-center')}>
                  <Plus className="h-4 w-4" /> Neuer Lieferant
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{supplier.companyName}</div>
                    <div className="text-xs text-gray-500">{supplier.contactName} · {supplier.email}</div>
                    <div className="text-xs text-gray-400 mt-1">{supplier.supplierNumber} · Standardwährung {supplier.defaultCurrency}</div>
                  </div>
                  <button onClick={() => setSupplierId('')} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </Card>

          {/* Conditions */}
          <Card title="2. Konditionen" icon={<ShoppingCart className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label()}>Bestelldatum *</label>
                <input type="date" className={input()} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div>
                <label className={label()}>Lieferdatum</label>
                <input type="date" className={input()} value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>
              <div>
                <label className={label()}>Währung</label>
                <select className={input()} value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className={label()}>Wechselkurs (optional)</label>
                <input type="number" step="0.0001" className={input()} value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder={currency === 'USD' ? 'z.B. 0,9' : '1'} />
              </div>
              <div>
                <label className={label()}>Versandkosten</label>
                <input type="number" step="0.01" min="0" className={input()} value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
              </div>
              <div>
                <label className={label()}>Zollkosten</label>
                <input type="number" step="0.01" min="0" className={input()} value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={label()}>Notiz für Lieferanten</label>
                <textarea rows={2} className={input()} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={label()}>Interne Notiz</label>
                <textarea rows={2} className={input()} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: items + totals */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="3. Produkte / Positionen"
            icon={<Package className="h-4 w-4" />}
            actions={
              <div className="flex gap-2">
                <button onClick={() => setProductPickerOpen(true)} className={btn('secondary')}>
                  <Search className="h-4 w-4" /> Aus Datenbank
                </button>
                <button onClick={() => addItem({ productName: 'Freier Artikel' })} className={btn('secondary')}>
                  <Plus className="h-4 w-4" /> Manuelle Position
                </button>
              </div>
            }
          >
            {items.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Keine Positionen. Füge Produkte aus der Datenbank hinzu oder lege manuelle Positionen an.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => {
                  const lineSub = it.quantity * it.unitPrice;
                  const lineTax = lineSub * (it.vatRate / 100);
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 border border-gray-100 dark:border-white/8 rounded-lg">
                      <div className="col-span-12 md:col-span-4">
                        <input className={input('font-medium')} value={it.productName} onChange={(e) => updateItem(i, { productName: e.target.value })} placeholder="Produktname" />
                        <input className={input('mt-1.5 text-xs')} value={it.sku || ''} onChange={(e) => updateItem(i, { sku: e.target.value })} placeholder="SKU" />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <label className={label()}>Menge</label>
                        <input type="number" step="0.001" min="0" className={input()} value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className={label()}>Einzelpreis</label>
                        <input type="number" step="0.01" min="0" className={input()} value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <label className={label()}>USt %</label>
                        <input type="number" step="0.1" className={input()} value={it.vatRate} onChange={(e) => updateItem(i, { vatRate: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-12 md:col-span-2 text-right">
                        <label className={label('text-right')}>Summe brutto</label>
                        <div className="text-sm font-semibold tabular-nums pt-2 text-gray-900 dark:text-white">
                          <Money amount={lineSub + lineTax} currency={currency} />
                        </div>
                        <div className="text-xs text-gray-400">
                          netto <Money amount={lineSub} currency={currency} />
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-1 flex md:justify-end">
                        <button onClick={() => removeItem(i)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Invoice (optional) */}
          <Card title="4. Rechnung (optional)" icon={<Package className="h-4 w-4" />}>
            <p className="text-xs text-gray-500 mb-3">Falls dir die Rechnung schon vorliegt, kannst du sie direkt miterfassen. Du kannst sie auch später hinzufügen.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className={label()}>Rechnungsnummer</label>
                <input className={input()} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="z.B. RE-2026-00123" />
              </div>
              <div>
                <label className={label()}>Rechnungsdatum</label>
                <input type="date" className={input()} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label className={label()}>Fälligkeitsdatum</label>
                <input type="date" className={input()} value={invoiceDue} onChange={(e) => setInvoiceDue(e.target.value)} />
              </div>
              <div className="col-span-4 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={useOrderTotalAsInvoice} onChange={(e) => setUseOrderTotalAsInvoice(e.target.checked)} />
                  Rechnungsbetrag = Bestellsumme ({new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(totals.total)})
                </label>
              </div>
              {!useOrderTotalAsInvoice && (
                <div className="col-span-2">
                  <label className={label()}>Rechnungsbetrag ({currency})</label>
                  <input type="number" step="0.01" min="0" className={input()} value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                </div>
              )}
            </div>
            {invoiceNumber.trim() && (
              <div className="mt-3 text-xs text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 p-2 rounded-md">
                ✓ Rechnung wird zusammen mit der Bestellung gespeichert.
              </div>
            )}
          </Card>

          {/* Totals */}
          <Card title="Übersicht">
            <div className="space-y-2 max-w-sm ml-auto text-sm">
              <Row label="Zwischensumme (netto)" value={<Money amount={totals.subtotal} currency={currency} />} />
              <Row label="Steuer" value={<Money amount={totals.tax} currency={currency} />} />
              {Number(shippingCost || 0) > 0 && <Row label="Versand" value={<Money amount={Number(shippingCost)} currency={currency} />} />}
              {Number(customsCost || 0) > 0 && <Row label="Zoll" value={<Money amount={Number(customsCost)} currency={currency} />} />}
              <div className="h-px bg-gray-200 dark:bg-white/10 my-2" />
              <Row label="Gesamt brutto" value={<span className="text-lg font-bold"><Money amount={totals.total} currency={currency} /></span>} bold />
            </div>
          </Card>
        </div>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
          {warning}
        </div>
      )}

      {productPickerOpen && (
        <ProductPicker
          onClose={() => setProductPickerOpen(false)}
          onPick={(product, variant) => {
            addItem({
              productId: product.id,
              productVariantId: variant?.id || null,
              productName: variant ? `${product.title}${variant.title && variant.title !== 'Default Title' ? ' — ' + variant.title : ''}` : product.title,
              sku: variant?.sku || product.sku || null,
              unitPrice: variant?.cogs ? Number(variant.cogs) : (variant?.price ? Number(variant.price) : 0),
              vatRate: variant?.vatRate ? Number(variant.vatRate) : 19,
            });
          }}
        />
      )}

      {showSupplierForm && (
        <QuickSupplierForm
          onClose={() => setShowSupplierForm(false)}
          onCreated={(s) => {
            setShowSupplierForm(false);
            setSuppliers((prev) => [s, ...prev]);
            setSupplierId(s.id);
          }}
        />
      )}
    </div>
  );
}

function Card({ title, icon, actions, children }: { title: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon} {title}
        </h3>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : 'text-gray-900 dark:text-white'}`}>{value}</span>
    </div>
  );
}

function ProductPicker({ onClose, onPick }: { onClose: () => void; onPick: (product: any, variant: any) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    purchasesApi.searchProducts(q).then((r: any) => setItems(r || [])).finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Produkt aus Datenbank</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 border-b border-gray-100 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input autoFocus className={input('pl-9')} placeholder="Name, SKU, Barcode …" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? <div className="p-12 text-center text-sm text-gray-400">Lädt …</div> :
            items.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">Keine Produkte gefunden</div> :
            items.map((p) => (
              <div key={p.id} className="border border-gray-100 dark:border-white/8 rounded-lg mb-2">
                <div className="px-3 py-2 bg-gray-50 dark:bg-white/[0.02] rounded-t-lg">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{p.title}</div>
                  <div className="text-xs text-gray-400">{p.sku || '—'} · {p.variants?.length || 0} Variante(n)</div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {(p.variants || []).map((v: any) => (
                    <button key={v.id} onClick={() => { onPick(p, v); onClose(); }} className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-700 dark:text-gray-200 truncate">{v.title || 'Standard'}</div>
                        <div className="text-xs text-gray-400">SKU: {v.sku || '—'}{v.barcode ? ` · EAN ${v.barcode}` : ''}</div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm font-semibold tabular-nums">{v.cogs ? <Money amount={v.cogs} currency={v.cogsCurrency || 'EUR'} /> : <Money amount={v.price} />}</div>
                        <div className="text-xs text-gray-400">{v.cogs ? 'Letzte COGS' : 'Listenpreis'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function QuickSupplierForm({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Supplier) => void }) {
  const [form, setForm] = useState<Partial<Supplier>>({ companyName: '', contactName: '', email: '', phone: '', country: 'DE', defaultCurrency: 'EUR', status: 'active' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const created = await purchasesApi.createSupplier(form);
      onCreated(created as Supplier);
    } catch (e: any) {
      setErr(e.message || 'Fehler');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Neuer Lieferant (Schnellanlage)</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className={label()}>Firmenname *</label><input className={input()} value={form.companyName || ''} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} /></div>
          <div><label className={label()}>Ansprechpartner *</label><input className={input()} value={form.contactName || ''} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label()}>E-Mail *</label><input type="email" className={input()} value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><label className={label()}>Telefon *</label><input className={input()} value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className={label()}>Land</label><input maxLength={2} className={input('uppercase')} value={form.country || ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))} /></div>
            <div>
              <label className={label()}>Währung</label>
              <select className={input()} value={form.defaultCurrency || 'EUR'} onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}>
                <option value="EUR">EUR</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          {err && <div className="text-sm text-red-600 dark:text-red-400">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy} className={btn('primary')}>{busy ? '…' : 'Anlegen'}</button>
        </div>
      </div>
    </div>
  );
}
