'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Save, Loader2, Plus, Trash2, Search } from 'lucide-react';
import {
  returnsApi, todayLocal, type ReturnPlatform, type ReturnProduct,
} from '@/lib/returns';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

interface ItemForm {
  uid: string;
  productId: string | null;
  productLabel: string | null;
  productFreetext: string;
  quantity: number;
  notes: string;
  mode: 'catalog' | 'freetext';
}

function newItem(): ItemForm {
  return {
    uid: Math.random().toString(36).slice(2),
    productId: null,
    productLabel: null,
    productFreetext: '',
    quantity: 1,
    notes: '',
    mode: 'catalog',
  };
}

export function ReturnFormModal({ onClose, onCreated }: Props) {
  const [platform, setPlatform] = useState<ReturnPlatform>('shopify');
  const [orderNumber, setOrderNumber] = useState('');
  const [requestDate, setRequestDate] = useState(todayLocal());
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemForm[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function addItem() { setItems((prev) => [...prev, newItem()]); }
  function removeItem(uid: string) {
    setItems((prev) => prev.length > 1 ? prev.filter((i) => i.uid !== uid) : prev);
  }
  function patchItem(uid: string, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((i) => i.uid === uid ? { ...i, ...patch } : i));
  }

  function validate(): string | null {
    if (!orderNumber.trim()) return 'Bestellnummer ist erforderlich';
    if (!requestDate) return 'Datum der Retourenanfrage ist erforderlich';
    if (items.length === 0) return 'Mindestens eine Position ist erforderlich';
    for (const it of items) {
      if (it.mode === 'catalog' && !it.productId) return 'Bitte ein Produkt für jede Position auswählen oder auf Freitext wechseln';
      if (it.mode === 'freetext' && !it.productFreetext.trim()) return 'Bitte einen Produkt-Namen eintragen';
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await returnsApi.create({
        platform,
        orderNumber: orderNumber.trim(),
        requestDate,
        customerName: customerName.trim() || null,
        customerEmail: customerEmail.trim() || null,
        trackingNumber: trackingNumber.trim() || null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          productId: it.mode === 'catalog' ? it.productId : null,
          productFreetext: it.mode === 'freetext' ? it.productFreetext.trim() : null,
          quantity: it.quantity,
          notes: it.notes.trim() || null,
        })),
      });
      onCreated(result.id);
    } catch (e: any) {
      setError(e?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-2xl max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Neue Retoure anlegen</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Plattform */}
          <Field label="Plattform">
            <div className="grid grid-cols-2 gap-2">
              {(['shopify', 'tiktok'] as ReturnPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                    platform === p
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >{p === 'shopify' ? 'Shopify' : 'TikTok'}</button>
              ))}
            </div>
          </Field>

          {/* Bestellung */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bestellnummer *">
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="z.B. #1234"
                autoFocus
                className={inputCls}
              />
            </Field>
            <Field label="Datum der Anfrage *">
              <input
                type="date"
                value={requestDate}
                max={todayLocal()}
                onChange={(e) => setRequestDate(e.target.value)}
                className={inputCls + ' tabular-nums'}
              />
            </Field>
          </div>

          {/* Kunde */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kundenname">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="z.B. Max Mustermann" className={inputCls} />
            </Field>
            <Field label="Kunden-E-Mail">
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="kunde@email.de" className={inputCls} />
            </Field>
          </div>

          <Field label="Tracking-Nr. (Retoure-Sendung, optional)">
            <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="z.B. 11223344556677" className={inputCls + ' font-mono'} />
          </Field>

          {/* Positionen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                Positionen ({items.length})
              </label>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
              >
                <Plus className="h-3 w-3" /> Position hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <ItemRow
                  key={it.uid}
                  index={idx}
                  item={it}
                  canRemove={items.length > 1}
                  onPatch={(p) => patchItem(it.uid, p)}
                  onRemove={() => removeItem(it.uid)}
                />
              ))}
            </div>
          </div>

          {/* Notizen */}
          <Field label="Interne Notizen (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. Kunde sehr unzufrieden, Eilbearbeitung gewünscht"
              className={inputCls}
            />
          </Field>

          {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02]">
          <button onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white shadow shadow-purple-500/20"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Anlegen & Bilder hochladen
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ index, item, canRemove, onPatch, onRemove }: {
  index: number;
  item: ItemForm;
  canRemove: boolean;
  onPatch: (p: Partial<ItemForm>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['return-products', search],
    queryFn: () => returnsApi.searchProducts(search),
    enabled: item.mode === 'catalog' && showSuggestions,
    staleTime: 30_000,
  });

  function selectProduct(p: ReturnProduct) {
    onPatch({ productId: p.id, productLabel: p.title });
    setSearch('');
    setShowSuggestions(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 items-center justify-center text-[10px] font-bold">
          {index + 1}
        </span>
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => onPatch({ mode: 'catalog' })}
            className={`px-2 py-0.5 rounded ${item.mode === 'catalog' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >Aus Katalog</button>
          <button
            type="button"
            onClick={() => onPatch({ mode: 'freetext' })}
            className={`px-2 py-0.5 rounded ${item.mode === 'freetext' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >Freitext</button>
        </div>
        <div className="flex-1" />
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onPatch({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          className="w-16 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          title="Menge"
        />
        {canRemove && (
          <button onClick={onRemove} type="button" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {item.mode === 'catalog' ? (
        <div className="relative">
          {item.productLabel ? (
            <div className="flex items-center gap-2 rounded-lg bg-purple-50/60 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/30 px-3 py-2">
              <span className="flex-1 text-sm font-medium text-purple-900 dark:text-purple-200">{item.productLabel}</span>
              <button
                onClick={() => onPatch({ productId: null, productLabel: null })}
                type="button"
                className="text-purple-700 dark:text-purple-300 hover:opacity-70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Produkt suchen …"
                className={inputCls + ' pl-9'}
              />
              {showSuggestions && (productsQuery.data?.length ?? 0) > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {productsQuery.data!.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >{p.title}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <input
          value={item.productFreetext}
          onChange={(e) => onPatch({ productFreetext: e.target.value })}
          placeholder="Produktname (Freitext)"
          className={inputCls}
        />
      )}

      <input
        value={item.notes}
        onChange={(e) => onPatch({ notes: e.target.value })}
        placeholder="Notiz zur Position (z.B. Größe M, Farbe blau)"
        className={inputCls + ' text-xs'}
      />
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
