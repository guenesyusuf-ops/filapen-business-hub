'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Lock, Plus, Search, Trash2, Package, MapPin, Receipt, Truck, X } from 'lucide-react';
import { purchasesApi, type PurchaseOrder } from '@/lib/purchases';
import { btn, input, label, PageHeader, Money } from '@/components/purchases/PurchaseUI';
import { useAuthStore } from '@/stores/auth';

/**
 * Edit-Page fuer angelegte Bestellungen.
 *
 * Editierbar:
 *  - Bestelldatum, erwartetes Lieferdatum
 *  - Zahlungsbedingungen
 *  - Notiz + interne Notiz
 *  - Rechnungs- + Lieferadresse
 *  - Positionen (Produkte, Menge, Preis, USt) — Backend ersetzt sie komplett
 *
 * Permission: nur Ersteller oder admin/owner.
 */

type LineItem = {
  id?: string;
  productId?: string | null;
  productVariantId?: string | null;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export default function OrderEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { user } = useAuthStore();

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable Form-State
  const [orderDate, setOrderDate] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  useEffect(() => {
    purchasesApi.getOrder(id)
      .then((d) => {
        setOrder(d);
        setOrderDate(d.orderDate?.split('T')[0] ?? '');
        setExpectedDelivery(d.expectedDelivery?.split('T')[0] ?? '');
        setPaymentTerms((d as any).paymentTerms ?? '');
        setNotes(d.notes ?? '');
        setInternalNotes((d as any).internalNotes ?? '');
        setBillingAddress(d.billingAddress ?? '');
        setShippingAddress(d.shippingAddress ?? '');
        setItems((d.items || []).map((it: any) => ({
          id: it.id,
          productId: it.productId ?? null,
          productVariantId: it.productVariantId ?? null,
          productName: it.productName,
          sku: it.sku ?? null,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          vatRate: Number(it.vatRate || 19),
        })));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const sub = it.quantity * it.unitPrice;
      subtotal += sub;
      tax += sub * (it.vatRate / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!order) return null;

  const canEdit = !!user && (
    user.id === order.createdById ||
    user.role === 'admin' ||
    user.role === 'owner'
  );

  if (!canEdit) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <PageHeader
          title={`${order.orderNumber} bearbeiten`}
          actions={<Link href={`/purchases/orders/${id}`} className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Zurück</Link>}
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Keine Berechtigung.</strong>
            <p className="mt-1">Nur der Ersteller dieser Bestellung oder ein Admin kann sie bearbeiten.</p>
          </div>
        </div>
      </div>
    );
  }

  const updateItem = (i: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addItem = (l: Partial<LineItem>) => {
    setItems((prev) => [...prev, {
      productName: l.productName || 'Freier Artikel',
      sku: l.sku || null,
      productId: l.productId || null,
      productVariantId: l.productVariantId || null,
      quantity: 1,
      unitPrice: l.unitPrice ?? 0,
      vatRate: l.vatRate ?? 19,
    }]);
  };

  const itemsValid = items.length > 0 && items.every((it) => it.quantity > 0 && it.unitPrice >= 0 && it.productName.trim());

  const handleSave = async () => {
    if (!itemsValid) {
      alert('Bitte alle Positionen pruefen: Produktname, Menge > 0, Preis >= 0.');
      return;
    }
    setSaving(true);
    try {
      await purchasesApi.updateOrder(id, {
        orderDate: orderDate || undefined,
        expectedDelivery: expectedDelivery || null,
        paymentTerms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
        internalNotes: internalNotes.trim() || null,
        billingAddress: billingAddress.trim() || null,
        shippingAddress: shippingAddress.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          productVariantId: it.productVariantId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
        })),
      });
      router.push(`/purchases/orders/${id}`);
    } catch (e: any) {
      alert(`Speichern fehlgeschlagen: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title={`${order.orderNumber} bearbeiten`}
        subtitle={`${order.supplier?.companyName} · ${items.length} Position${items.length === 1 ? '' : 'en'}`}
        actions={
          <>
            <Link href={`/purchases/orders/${id}`} className={btn('ghost')}>
              <ArrowLeft className="h-4 w-4" /> Abbrechen
            </Link>
            <button onClick={handleSave} disabled={saving} className={btn('primary')}>
              <Save className="h-4 w-4" />
              {saving ? 'Speichere…' : 'Speichern'}
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: meta + addresses */}
        <div className="lg:col-span-1 space-y-4">
          <ColorCard title="Daten" icon={<Receipt className="h-4 w-4" />} accent="sky">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label()}>Bestelldatum</label>
                <input type="date" className={input()} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div>
                <label className={label()}>Lieferdatum</label>
                <input type="date" className={input()} value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={label()}>Zahlungsbedingungen</label>
                <input type="text" className={input()} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="z.B. Netto 30 Tage" />
              </div>
              <div className="col-span-2">
                <label className={label()}>Notiz</label>
                <textarea rows={2} className={input()} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={label()}>Interne Notiz</label>
                <textarea rows={2} className={input()} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
            </div>
          </ColorCard>

          <ColorCard title="Adressen" icon={<MapPin className="h-4 w-4" />} accent="violet">
            <div className="space-y-3">
              <div>
                <label className={label() + ' inline-flex items-center gap-1.5'}>
                  <Receipt className="h-3 w-3" /> Rechnungsadresse
                </label>
                <textarea
                  rows={4}
                  className={input()}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Firmenname\nStrasse\nPLZ Ort\nLand"
                />
              </div>
              <div>
                <label className={label() + ' inline-flex items-center gap-1.5'}>
                  <Truck className="h-3 w-3" /> Lieferadresse
                </label>
                <textarea
                  rows={4}
                  className={input()}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Falls abweichend von der Rechnungsadresse"
                />
              </div>
            </div>
          </ColorCard>
        </div>

        {/* Right: positions */}
        <div className="lg:col-span-2 space-y-4">
          <ColorCard
            title={`Positionen (${items.length})`}
            icon={<Package className="h-4 w-4" />}
            accent="emerald"
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
              <div className="text-center py-10 text-sm text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Keine Positionen.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => {
                  const lineSub = it.quantity * it.unitPrice;
                  const lineTax = lineSub * (it.vatRate / 100);
                  return (
                    <div key={it.id || i} className="grid grid-cols-12 gap-2 items-start p-3 border border-gray-100 dark:border-white/8 rounded-lg bg-white/60 dark:bg-white/[0.02]">
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
                          <Money amount={lineSub + lineTax} currency={order.currency} />
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
          </ColorCard>

          <ColorCard title="Übersicht" accent="rose">
            <div className="space-y-2 max-w-sm ml-auto text-sm">
              <Row label="Zwischensumme (netto)" value={<Money amount={totals.subtotal} currency={order.currency} />} />
              <Row label="Steuer" value={<Money amount={totals.tax} currency={order.currency} />} />
              <div className="h-px bg-gray-200 dark:bg-white/10 my-2" />
              <Row label="Gesamt brutto (Positionen)" value={<span className="text-lg font-bold"><Money amount={totals.total} currency={order.currency} /></span>} bold />
              <p className="text-[11px] text-gray-400 mt-2">
                Backend berechnet beim Speichern Endsumme inkl. Versand/Zoll neu.
              </p>
            </div>
          </ColorCard>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href={`/purchases/orders/${id}`} className={btn('ghost')}>Abbrechen</Link>
        <button onClick={handleSave} disabled={saving || !itemsValid} className={btn('primary')}>
          <Save className="h-4 w-4" />
          {saving ? 'Speichere…' : 'Änderungen speichern'}
        </button>
      </div>

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
    </div>
  );
}

type CardAccent = 'primary' | 'emerald' | 'amber' | 'violet' | 'sky' | 'rose' | 'none';

const ACCENT_STYLES: Record<CardAccent, { border: string; bg: string; iconWrap: string; iconColor: string; titleColor: string }> = {
  primary: { border: 'border-primary-200/60 dark:border-primary-500/20', bg: 'bg-gradient-to-br from-primary-50/40 to-white dark:from-primary-900/10 dark:to-white/[0.03]', iconWrap: 'bg-primary-100 dark:bg-primary-900/40', iconColor: 'text-primary-700 dark:text-primary-300', titleColor: 'text-primary-900 dark:text-primary-100' },
  emerald: { border: 'border-emerald-200/60 dark:border-emerald-500/20', bg: 'bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-900/10 dark:to-white/[0.03]', iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-700 dark:text-emerald-300', titleColor: 'text-emerald-900 dark:text-emerald-100' },
  amber: { border: 'border-amber-200/60 dark:border-amber-500/20', bg: 'bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-900/10 dark:to-white/[0.03]', iconWrap: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-700 dark:text-amber-300', titleColor: 'text-amber-900 dark:text-amber-100' },
  violet: { border: 'border-violet-200/60 dark:border-violet-500/20', bg: 'bg-gradient-to-br from-violet-50/40 to-white dark:from-violet-900/10 dark:to-white/[0.03]', iconWrap: 'bg-violet-100 dark:bg-violet-900/40', iconColor: 'text-violet-700 dark:text-violet-300', titleColor: 'text-violet-900 dark:text-violet-100' },
  sky: { border: 'border-sky-200/60 dark:border-sky-500/20', bg: 'bg-gradient-to-br from-sky-50/40 to-white dark:from-sky-900/10 dark:to-white/[0.03]', iconWrap: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-700 dark:text-sky-300', titleColor: 'text-sky-900 dark:text-sky-100' },
  rose: { border: 'border-rose-200/60 dark:border-rose-500/20', bg: 'bg-gradient-to-br from-rose-50/40 to-white dark:from-rose-900/10 dark:to-white/[0.03]', iconWrap: 'bg-rose-100 dark:bg-rose-900/40', iconColor: 'text-rose-700 dark:text-rose-300', titleColor: 'text-rose-900 dark:text-rose-100' },
  none: { border: 'border-gray-200/80 dark:border-white/8', bg: 'bg-white dark:bg-white/[0.03]', iconWrap: 'bg-gray-100 dark:bg-white/5', iconColor: 'text-gray-600 dark:text-gray-300', titleColor: 'text-gray-900 dark:text-white' },
};

function ColorCard({
  title, icon, actions, children, accent = 'none',
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  accent?: CardAccent;
}) {
  const a = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100/70 dark:border-white/8">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${a.titleColor}`}>
          {icon && (
            <span className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${a.iconWrap} ${a.iconColor}`}>
              {icon}
            </span>
          )}
          {title}
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
