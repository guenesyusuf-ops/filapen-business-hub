'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, Package, X, Trash2, Save } from 'lucide-react';
import { profitAnalysisApi, WholesaleListRow, WholesaleDetail, WholesaleOrderInput } from '@/lib/profit-analysis/api';
import { formatEur, formatDate, formatPercent, inputStringToDecimal, decimalToInputString } from '@/lib/profit-analysis/formatters';
import { cn } from '@/lib/utils';

interface ProductOption { id: string; title: string; sku: string | null; }

export default function GrosshandelPage() {
  const [rows, setRows] = useState<WholesaleListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [wsRes, pRes] = await Promise.all([
        profitAnalysisApi.wholesale.list(),
        profitAnalysisApi.productCosts.list({ limit: 500 }),
      ]);
      setRows(wsRes.items);
      setProducts(pRes.items.map((p) => ({ id: p.productId, title: p.title, sku: p.sku })));
    } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Großhandel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            B2B-Aufträge mit Positionen und historisch eingefrorenen Produktkosten.
          </p>
        </div>
        <button
          onClick={() => setOpenId('new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Neuer Auftrag
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Noch keine Aufträge angelegt.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                <tr>
                  <th className="text-left px-4 py-3">Datum</th>
                  <th className="text-left px-4 py-3">Nr / Kunde</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Pos.</th>
                  <th className="text-right px-4 py-3">Brutto</th>
                  <th className="text-right px-4 py-3">Netto</th>
                  <th className="text-right px-4 py-3">Kosten</th>
                  <th className="text-right px-4 py-3">Gewinn</th>
                  <th className="text-right px-4 py-3">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3 tabular-nums">{formatDate(r.orderDate)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{r.orderNumber ?? '—'}</div>
                      <div className="text-xs text-slate-500">{r.customerName ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.itemCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(r.totalGross)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(r.totalNet)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(r.totalCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatEur(r.totalProfit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.margin !== null ? formatPercent(r.margin) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && (
        <OrderEditor
          id={openId}
          products={products}
          onClose={() => setOpenId(null)}
          onSaved={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft:     'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    shipped:   'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    invoiced:  'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    paid:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    draft: 'Entwurf', confirmed: 'Bestätigt', shipped: 'Versendet',
    invoiced: 'Fakturiert', paid: 'Bezahlt', cancelled: 'Storniert',
  };
  return <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-medium', colors[status])}>{labels[status] ?? status}</span>;
}

// -----------------------------------------------------------------------------
// Order-Editor
// -----------------------------------------------------------------------------

function OrderEditor({ id, products, onClose, onSaved }: {
  id: string | 'new'; products: ProductOption[];
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = id === 'new';
  const [order, setOrder] = useState<WholesaleDetail | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState<'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'paid' | 'cancelled'>('draft');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<Array<{ productId: string; quantity: number; unitPriceGross: string; vatRate: string }>>([]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const d = await profitAnalysisApi.wholesale.get(id as string);
        setOrder(d);
        setOrderDate(d.orderDate);
        setOrderNumber(d.orderNumber ?? '');
        setCustomerName(d.customerName ?? '');
        setStatus(d.status as any);
        setNote(d.note ?? '');
        setItems(d.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPriceGross: decimalToInputString(it.unitPriceGross),
          vatRate: decimalToInputString(it.vatRate),
        })));
      } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
      finally { setLoading(false); }
    })();
  }, [id, isNew]);

  function addItem() {
    setItems((prev) => [...prev, { productId: products[0]?.id ?? '', quantity: 1, unitPriceGross: '10,00', vatRate: '19' }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, patch: Partial<{ productId: string; quantity: number; unitPriceGross: string; vatRate: string }>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function save() {
    if (!items.length) { setError('Mindestens eine Position nötig'); return; }
    setSaving(true); setError(null);
    try {
      const payload: WholesaleOrderInput = {
        orderDate,
        orderNumber: orderNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        status,
        note: note.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPriceGross: inputStringToDecimal(it.unitPriceGross),
          vatRate: inputStringToDecimal(it.vatRate),
        })),
      };
      if (isNew) await profitAnalysisApi.wholesale.create(payload);
      else await profitAnalysisApi.wholesale.update(id as string, payload);
      onSaved();
    } catch (e: any) { setError(e?.message ?? 'Speichern fehlgeschlagen'); setSaving(false); }
  }

  async function deleteOrder() {
    if (isNew) return;
    if (!confirm('Auftrag löschen?')) return;
    try { await profitAnalysisApi.wholesale.delete(id as string); onSaved(); }
    catch (e: any) { setError(e?.message ?? 'Löschen fehlgeschlagen'); }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-[#0f1117] shadow-2xl overflow-y-auto animate-slide-up">
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f1117] px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Großhandelsauftrag</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">{isNew ? 'Neuer Auftrag' : orderNumber || 'Auftrag'}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Datum" type="date" value={orderDate} onChange={setOrderDate} />
              <TextField label="Auftragsnummer" value={orderNumber} onChange={setOrderNumber} />
              <TextField label="Kunde" value={customerName} onChange={setCustomerName} />
              <SelectField label="Status" value={status} onChange={(v) => setStatus(v as any)} options={[
                { value: 'draft', label: 'Entwurf' },
                { value: 'confirmed', label: 'Bestätigt' },
                { value: 'shipped', label: 'Versendet' },
                { value: 'invoiced', label: 'Fakturiert' },
                { value: 'paid', label: 'Bezahlt' },
                { value: 'cancelled', label: 'Storniert' },
              ]} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Positionen ({items.length})</div>
                <button onClick={addItem} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                  <Plus className="h-3.5 w-3.5" /> Position hinzufügen
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/8 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-2">Produkt</th>
                      <th className="text-right px-2 py-2 w-20">Menge</th>
                      <th className="text-right px-2 py-2 w-28">Preis Brutto</th>
                      <th className="text-right px-2 py-2 w-16">USt %</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {items.length === 0 ? (
                      <tr><td colSpan={5} className="text-center px-3 py-6 text-slate-400">Noch keine Positionen.</td></tr>
                    ) : items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <select
                            value={it.productId}
                            onChange={(e) => updateItem(i, { productId: e.target.value })}
                            className="w-full rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs"
                          >
                            {products.map((p) => <option key={p.id} value={p.id}>{p.title}{p.sku ? ` (${p.sku})` : ''}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                            className="w-full rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" inputMode="decimal" value={it.unitPriceGross} onChange={(e) => updateItem(i, { unitPriceGross: e.target.value })}
                            className="w-full rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" inputMode="decimal" value={it.vatRate} onChange={(e) => updateItem(i, { vatRate: e.target.value })}
                            className="w-full rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {order && !isNew && (
              <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02] p-3 grid grid-cols-4 gap-3 text-xs">
                <div><div className="text-slate-500">Brutto</div><div className="font-semibold tabular-nums">{formatEur(order.totalGross)}</div></div>
                <div><div className="text-slate-500">Netto</div><div className="font-semibold tabular-nums">{formatEur(order.totalNet)}</div></div>
                <div><div className="text-slate-500">Kosten</div><div className="font-semibold tabular-nums">{formatEur(order.totalCost)}</div></div>
                <div><div className="text-slate-500">Gewinn</div><div className="font-bold text-emerald-600 tabular-nums">{formatEur(order.totalProfit)}</div></div>
              </div>
            )}

            <TextArea label="Notiz" value={note} onChange={setNote} rows={2} />

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-white/8">
              {!isNew ? (
                <button onClick={deleteOrder} className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Auftrag löschen
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2">Abbrechen</button>
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
    </label>
  );
}
function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
    </label>
  );
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
