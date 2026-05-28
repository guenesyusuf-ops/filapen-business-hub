'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Save, Target, Loader2, TrendingUp, TrendingDown, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { profitabilityApi, compute, solveForMargin, fmtEUR, fmtPct, type ProfitInput, type ProfitCalculation } from '@/lib/profitability';

interface Props {
  initial: ProfitCalculation | null; // null = neue Berechnung
  onClose: () => void;
  onSaved: (saved: ProfitCalculation) => void;
}

const EMPTY: ProfitInput = {
  productName: '',
  purchasePrice: 0,
  shippingCost: 0,
  orderQuantity: 1,
  customsRate: 0,
  salesPrice: 0,
  vatRate: 19,
  shippingToCustomer: 0,
  paymentRate: 3,
  adCost: null,
  notes: '',
};

export function ProfitabilityModal({ initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProfitInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetMargin, setTargetMargin] = useState<number>(30);
  const [showTargetCalc, setShowTargetCalc] = useState(false);

  // Initialwerte uebernehmen
  useEffect(() => {
    if (initial) {
      setForm({
        productName: initial.productName,
        purchasePrice: Number(initial.purchasePrice),
        shippingCost: Number(initial.shippingCost),
        orderQuantity: Number(initial.orderQuantity) || 1,
        customsRate: Number(initial.customsRate),
        salesPrice: Number(initial.salesPrice),
        vatRate: Number(initial.vatRate),
        shippingToCustomer: Number(initial.shippingToCustomer),
        paymentRate: Number(initial.paymentRate),
        adCost: initial.adCost != null ? Number(initial.adCost) : null,
        notes: initial.notes || '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  // ESC zum Schliessen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live-Berechnung
  const result = useMemo(() => compute(form), [form]);
  const requiredVk = useMemo(() => solveForMargin(form, targetMargin), [form, targetMargin]);

  function setField<K extends keyof ProfitInput>(key: K, value: ProfitInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.productName.trim()) {
      setError('Produktname ist erforderlich');
      return;
    }
    if (form.purchasePrice <= 0 || form.salesPrice <= 0) {
      setError('EK und VK muessen > 0 sein');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = initial
        ? await profitabilityApi.update(initial.id, form)
        : await profitabilityApi.create(form);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  // Farbkodierung der Marge
  const marginColor =
    result.margin >= 25 ? 'text-emerald-600 dark:text-emerald-400'
    : result.margin >= 10 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {initial ? 'Berechnung bearbeiten' : 'Neue Profitabilitäts-Berechnung'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Live-Berechnung — Werte werden sofort aktualisiert
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — Grid: Inputs links, Result rechts */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-5">
          {/* INPUTS */}
          <div className="lg:col-span-3 p-5 space-y-5 border-r border-gray-100 dark:border-white/8">
            {/* Produkt */}
            <Section title="Produkt">
              <Field label="Produktname *">
                <input
                  autoFocus
                  className={inputCls}
                  value={form.productName}
                  onChange={(e) => setField('productName', e.target.value)}
                  placeholder="z.B. Schuh Modell X (Größe 42)"
                />
              </Field>
            </Section>

            {/* Einkauf */}
            <Section title="Einkauf & Import">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Einkaufspreis (EK netto, €)" hint="pro Einheit">
                  <NumberInput value={form.purchasePrice} onChange={(v) => setField('purchasePrice', v)} step="0.01" />
                </Field>
                <Field label="Bestellmenge (Stück)" hint="Spedition wird auf alle Einheiten umgelegt">
                  <NumberInput value={form.orderQuantity} onChange={(v) => setField('orderQuantity', Math.max(1, Math.floor(v || 1)))} step="1" min={1} />
                </Field>
                <Field label="Speditionskosten gesamt (€)" hint={form.orderQuantity > 0 ? `≙ ${fmtEUR((Number(form.shippingCost) || 0) / Math.max(1, form.orderQuantity))} pro Einheit` : undefined}>
                  <NumberInput value={form.shippingCost} onChange={(v) => setField('shippingCost', v)} step="0.01" />
                </Field>
                <Field label="Zollsatz (%)">
                  <NumberInput value={form.customsRate} onChange={(v) => setField('customsRate', v)} step="0.1" />
                </Field>
                <Field label="Zollgebühren (€) — berechnet" hint="(EK + Spedition/Einheit) × Zollsatz">
                  <div className="px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmtEUR(result.customsFee)}
                  </div>
                </Field>
              </div>
              <div className="mt-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-500/30 px-3 py-2 text-xs text-sky-800 dark:text-sky-200 inline-flex items-center gap-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                Produktpreis bei Ankunft (pro Einheit): <strong>{fmtEUR(result.arrivedCost)}</strong>
              </div>
            </Section>

            {/* Verkauf */}
            <Section title="Verkauf">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Verkaufspreis VK (brutto, €)">
                  <NumberInput value={form.salesPrice} onChange={(v) => setField('salesPrice', v)} step="0.01" />
                </Field>
                <Field label="MwSt (%)">
                  <NumberInput value={form.vatRate} onChange={(v) => setField('vatRate', v)} step="0.1" />
                </Field>
                <Field label="Versand zum Kunden (€)">
                  <NumberInput value={form.shippingToCustomer} onChange={(v) => setField('shippingToCustomer', v)} step="0.01" />
                </Field>
                <Field label="Paymentkosten (%)" hint="Stripe/PayPal/etc. — Standard 3 %">
                  <NumberInput value={form.paymentRate} onChange={(v) => setField('paymentRate', v)} step="0.1" />
                </Field>
              </div>
            </Section>

            {/* Werbung (optional) */}
            <Section title="Werbung (optional)">
              <Field label="Werbekosten pro Verkauf (CAC, €)" hint="Wenn du genau weisst was dich ein Verkauf kostet">
                <NumberInput
                  value={form.adCost ?? 0}
                  onChange={(v) => setField('adCost', v || null)}
                  step="0.01"
                  placeholder="0"
                />
              </Field>
            </Section>

            {/* Zielmargen-Rechner */}
            <Section title={
              <button
                type="button"
                onClick={() => setShowTargetCalc((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white hover:opacity-80"
              >
                {showTargetCalc ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Target className="h-3.5 w-3.5" /> Zielmargen-Rechner
              </button>
            }>
              {showTargetCalc && (
                <div className="space-y-3 pt-1">
                  <Field label={`Zielmarge: ${targetMargin} %`}>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      step="1"
                      value={targetMargin}
                      onChange={(e) => setTargetMargin(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </Field>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 p-3 text-xs space-y-1.5">
                    <div className="text-gray-700 dark:text-gray-300">
                      Für <strong>{targetMargin}%</strong> Marge brauchst du:
                    </div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {fmtEUR(requiredVk)} <span className="text-xs font-normal text-gray-500">VK brutto</span>
                    </div>
                    <button
                      onClick={() => setField('salesPrice', Math.round(requiredVk * 100) / 100)}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      → diesen Preis übernehmen
                    </button>
                  </div>
                </div>
              )}
            </Section>

            {/* Notizen */}
            <Section title="Notizen">
              <textarea
                rows={2}
                className={inputCls + ' min-h-[60px]'}
                value={form.notes || ''}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="z.B. Saisonpreis, Promo-Aktion, …"
              />
            </Section>
          </div>

          {/* RESULTS */}
          <div className="lg:col-span-2 p-5 bg-gray-50/40 dark:bg-white/[0.02] space-y-4">
            {/* Hero-Result */}
            <div className={`rounded-2xl p-4 border-2 ${
              result.profit > 0
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-900/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-gradient-to-br from-red-50 to-red-100/30 dark:from-red-900/30 dark:to-red-900/10 border-red-200 dark:border-red-500/30'
            }`}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">
                Gewinn pro Verkauf
              </div>
              <div className={`text-3xl font-bold tabular-nums ${result.profit > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {fmtEUR(result.profit)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${marginColor}`}>
                  {result.profit > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {fmtPct(result.margin)} Marge
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  · Break-even ROAS {Number.isFinite(result.breakevenRoas) ? result.breakevenRoas.toFixed(2) : '∞'}
                </span>
              </div>
            </div>

            {/* Mit Werbung */}
            {(form.adCost ?? 0) > 0 && (
              <div className={`rounded-xl p-3 border ${
                result.profitAfterAds > 0
                  ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-200/60 dark:border-emerald-500/20'
                  : 'bg-red-50/60 dark:bg-red-900/15 border-red-200/60 dark:border-red-500/20'
              }`}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Nach Werbung ({fmtEUR(form.adCost || 0)})
                </div>
                <div className={`text-xl font-bold tabular-nums ${result.profitAfterAds > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {fmtEUR(result.profitAfterAds)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {fmtPct(result.marginAfterAds)} Marge · ROAS bei diesen Ads: {Number.isFinite(result.effectiveRoas) ? result.effectiveRoas.toFixed(2) : '∞'}
                </div>
              </div>
            )}

            {/* Kostenaufschluesselung */}
            <div className="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/8 p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">
                Aufschlüsselung VK ({fmtEUR(form.salesPrice)})
              </div>
              <StackedBar items={result.breakdown} total={Number(form.salesPrice) || 1} />
              <div className="space-y-1 mt-3">
                {result.breakdown.map((b) => (
                  <div key={b.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                      <span className="text-gray-600 dark:text-gray-300 truncate">{b.label}</span>
                    </span>
                    <span className="tabular-nums text-gray-700 dark:text-gray-200 font-medium flex-shrink-0">
                      {fmtEUR(b.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail-Breakdown */}
            <details className="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/8 p-3 text-xs">
              <summary className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                Details ▸
              </summary>
              <div className="mt-3 space-y-1.5">
                <Row label="Einkaufspreis netto" value={fmtEUR(Number(form.purchasePrice))} />
                <Row label={`+ Spedition / Einheit (${form.orderQuantity} Stk)`} value={fmtEUR((Number(form.shippingCost) || 0) / Math.max(1, form.orderQuantity))} />
                <Row label={`+ Zoll (${form.customsRate}%)`} value={fmtEUR(result.customsFee)} />
                <Row label="= Produkt bei Ankunft" value={fmtEUR(result.arrivedCost)} strong />
                <div className="h-px bg-gray-100 dark:bg-white/8 my-1" />
                <Row label="VK brutto" value={fmtEUR(Number(form.salesPrice))} />
                <Row label={`− MwSt (${form.vatRate}%)`} value={`− ${fmtEUR(result.vatAmount)}`} />
                <Row label="= VK netto" value={fmtEUR(result.vkNetto)} strong />
                <Row label="− Produkt bei Ankunft" value={`− ${fmtEUR(result.arrivedCost)}`} />
                <Row label="− Versand Kunde" value={`− ${fmtEUR(Number(form.shippingToCustomer))}`} />
                <Row label={`− Payment (${form.paymentRate}%)`} value={`− ${fmtEUR(result.paymentFee)}`} />
                <Row label="= Gewinn" value={fmtEUR(result.profit)} strong color={result.profit > 0 ? 'text-emerald-600' : 'text-red-600'} />
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02] flex-shrink-0">
          <div className="min-w-0 flex-1">
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50">
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Speichert …' : initial ? 'Änderungen speichern' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {typeof title === 'string'
        ? <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">{title}</h3>
        : title}
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

function NumberInput({
  value, onChange, step, placeholder, min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  placeholder?: string;
  min?: number;
}) {
  // Interner String-Buffer — sonst kann der User die 0 nicht löschen
  // weil `Number('')` zu 0 wird und der Wert sofort wieder gerendert wird.
  // Buffer wird mit dem externen Wert synced, aber während der User tippt
  // (focus aktiv) bleibt die rohe Eingabe stehen (auch leer/Komma/Minus).
  const [text, setText] = useState<string>(value === 0 ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value === 0 ? '' : String(value));
    }
  }, [value, focused]);

  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? '0.01'}
      min={min}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onBlur={() => {
        setFocused(false);
        // Bei leerem Feld → 0 zurückspielen, damit nichts undefined bleibt
        if (text.trim() === '') onChange(0);
      }}
      placeholder={placeholder ?? '0'}
      className={inputCls + ' tabular-nums'}
    />
  );
}

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-gray-600 dark:text-gray-400 ${strong ? 'font-semibold text-gray-800 dark:text-gray-200' : ''}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} ${color || ''}`}>{value}</span>
    </div>
  );
}

function StackedBar({ items, total }: { items: Array<{ label: string; value: number; color: string }>; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
      {items.map((it, i) => {
        const pct = Math.max(0, (it.value / total) * 100);
        if (pct <= 0) return null;
        return (
          <div
            key={i}
            style={{ width: `${pct}%`, background: it.color }}
            title={`${it.label}: ${it.value.toFixed(2)} € (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}
