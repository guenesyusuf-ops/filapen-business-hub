'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, Plus, Trash2, Copy, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { profitabilityApi, compute, fmtEUR, fmtPct, type ProfitCalculation } from '@/lib/profitability';
import { ProfitabilityModal } from './ProfitabilityModal';

export default function ProfitabilityPage() {
  const [items, setItems] = useState<ProfitCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<ProfitCalculation | null | 'new'>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await profitabilityApi.list();
      setItems(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function deleteOne(id: string) {
    if (!confirm('Diese Berechnung wirklich loeschen?')) return;
    try {
      await profitabilityApi.remove(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) { alert(e.message); }
  }

  async function duplicate(item: ProfitCalculation) {
    try {
      const newItem = await profitabilityApi.create({
        productName: `${item.productName} (Kopie)`,
        purchasePrice: Number(item.purchasePrice),
        shippingCost: Number(item.shippingCost),
        customsRate: Number(item.customsRate),
        salesPrice: Number(item.salesPrice),
        vatRate: Number(item.vatRate),
        shippingToCustomer: Number(item.shippingToCustomer),
        paymentRate: Number(item.paymentRate),
        adCost: item.adCost != null ? Number(item.adCost) : null,
        notes: item.notes,
      });
      setItems((prev) => [newItem, ...prev]);
      setEdit(newItem);
    } catch (e: any) { alert(e.message); }
  }

  // Aggregierte Stats fuer Header
  const stats = useMemo(() => {
    if (items.length === 0) return null;
    const results = items.map((i) => compute({
      productName: i.productName,
      purchasePrice: Number(i.purchasePrice),
      shippingCost: Number(i.shippingCost),
      customsRate: Number(i.customsRate),
      salesPrice: Number(i.salesPrice),
      vatRate: Number(i.vatRate),
      shippingToCustomer: Number(i.shippingToCustomer),
      paymentRate: Number(i.paymentRate),
      adCost: i.adCost != null ? Number(i.adCost) : null,
    }));
    const avgMargin = results.reduce((s, r) => s + r.margin, 0) / results.length;
    const profitable = results.filter((r) => r.profit > 0).length;
    return { avgMargin, profitable, total: items.length };
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-md">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Profitabilitäts-Rechner
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xl">
            Berechne pro Produkt was am Ende übrig bleibt — inkl. Zoll, MwSt, Payment und Werbung.
            Speichere deine Modelle und vergleiche Szenarien.
          </p>
        </div>
        <button
          onClick={() => setEdit('new')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all"
        >
          <Plus className="h-4 w-4" /> Neue Berechnung
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Gespeicherte Modelle" value={stats.total.toString()} />
          <StatCard label="Davon profitabel" value={`${stats.profitable} / ${stats.total}`} hint={stats.profitable === stats.total ? 'Alles im grünen Bereich' : undefined} />
          <StatCard label="Ø Marge" value={fmtPct(stats.avgMargin)} accent={stats.avgMargin >= 25 ? 'green' : stats.avgMargin >= 10 ? 'amber' : 'red'} />
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-20 text-center bg-white/40 dark:bg-white/[0.02]">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/30 items-center justify-center mb-4">
            <Calculator className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-1">
            Noch keine Berechnung
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
            Lege deine erste Berechnung an — alle Werte werden gespeichert und du kannst sie jederzeit anpassen.
          </p>
          <button
            onClick={() => setEdit('new')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Erste Berechnung
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => <ProductCard key={c.id} item={c} onOpen={() => setEdit(c)} onDelete={() => deleteOne(c.id)} onDuplicate={() => duplicate(c)} />)}
        </div>
      )}

      {edit && (
        <ProfitabilityModal
          initial={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={(saved) => {
            setItems((prev) => {
              const idx = prev.findIndex((x) => x.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [saved, ...prev];
            });
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'green' | 'amber' | 'red' }) {
  const color =
    accent === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : accent === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : accent === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/8 p-4">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function ProductCard({
  item, onOpen, onDelete, onDuplicate,
}: {
  item: ProfitCalculation;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const r = compute({
    productName: item.productName,
    purchasePrice: Number(item.purchasePrice),
    shippingCost: Number(item.shippingCost),
    customsRate: Number(item.customsRate),
    salesPrice: Number(item.salesPrice),
    vatRate: Number(item.vatRate),
    shippingToCustomer: Number(item.shippingToCustomer),
    paymentRate: Number(item.paymentRate),
    adCost: item.adCost != null ? Number(item.adCost) : null,
  });

  const isProfit = r.profit > 0;
  const marginColor =
    r.margin >= 25 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
    : r.margin >= 10 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30';

  return (
    <div className="group rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/8 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:shadow-lg transition-all overflow-hidden flex flex-col">
      <button onClick={onOpen} className="text-left flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={item.productName}>
              {item.productName}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              VK {fmtEUR(Number(item.salesPrice))} brutto
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${marginColor}`}>
            {isProfit ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {fmtPct(r.margin)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Gewinn</div>
            <div className={`text-lg font-bold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {fmtEUR(r.profit)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Break-even ROAS</div>
            <div className="text-lg font-bold tabular-nums text-gray-700 dark:text-gray-300">
              {Number.isFinite(r.breakevenRoas) ? r.breakevenRoas.toFixed(2) : '∞'}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 dark:text-gray-500">
          Aktualisiert: {new Date(item.updatedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </button>
      <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100 dark:border-white/5">
        <button onClick={onOpen} className="flex-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline text-left">
          Öffnen →
        </button>
        <button onClick={onDuplicate} className="p-1.5 rounded text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20" title="Duplizieren">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Loeschen">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
