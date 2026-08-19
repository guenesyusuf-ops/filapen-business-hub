'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle, Trash2, Save, Sparkles,
} from 'lucide-react';
import {
  profitAnalysisApi, OverheadEntry, OverheadTemplate,
} from '@/lib/profit-analysis/api';
import { formatEur, formatPercent, decimalToInputString, inputStringToDecimal } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const CATEGORY_LABELS: Record<string, string> = {
  miete: 'Miete', lager: 'Lager', loehne: 'Löhne', steuerberater: 'Steuerberater',
  software: 'Software', auto_rate: 'Auto Rate', auto_versicherung: 'Auto Versicherung',
  speditionskosten: 'Speditionskosten', verpackung: 'Verpackung', sonstiges: 'Sonstiges',
};

export default function GemeinkostenPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<OverheadEntry[]>([]);
  const [templates, setTemplates] = useState<OverheadTemplate[]>([]);
  const [computed, setComputed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [e, t, m] = await Promise.all([
        profitAnalysisApi.overhead.listEntries(year, month),
        profitAnalysisApi.overhead.listTemplates(),
        profitAnalysisApi.daily.getMonth(year, month),
      ]);
      setEntries(e.entries);
      setTemplates(t.items);
      setComputed(m.computed);
    } catch (err: any) { setError(err?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); }
  function nextMonth() { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); }

  async function applyTemplates() {
    try {
      const res: any = await profitAnalysisApi.overhead.applyTemplates(year, month);
      if (res.skipped) alert('Vorlagen wurden bereits in diesem Monat übernommen.');
      await load();
    } catch (e: any) { setError(e?.message ?? 'Fehler'); }
  }
  async function updateEntry(id: string, patch: any) {
    try {
      await profitAnalysisApi.overhead.updateEntry(id, patch);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Fehler'); }
  }
  async function deleteEntry(id: string) {
    if (!confirm('Position löschen?')) return;
    try {
      await profitAnalysisApi.overhead.deleteEntry(id);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Fehler'); }
  }

  const netSalesTotal = computed?.netSalesWithWholesale ?? '0';
  const byCategory = new Map<string, { totalNet: string; ratioOfNetSales: string | null }>();
  for (const c of (computed?.overhead?.byCategory ?? [])) byCategory.set(c.category, { totalNet: c.totalNet, ratioOfNetSales: c.ratioOfNetSales });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-lg font-bold text-slate-900 dark:text-white min-w-[180px] text-center tabular-nums">{MONTH_LABELS[month - 1]} {year}</div>
          <button onClick={nextMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5">
            <Sparkles className="h-3.5 w-3.5" /> Vorlagen ({templates.length})
          </button>
          <button onClick={applyTemplates} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 text-amber-700 dark:border-amber-500/30 dark:text-amber-400 px-3 py-1.5 text-xs">
            Vorlagen übernehmen
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Neue Position
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {computed && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="Gemeinkosten (Netto)" value={formatEur(computed.overhead.totalNet)} />
          <SummaryTile
            label="Anteil am Netto-Umsatz"
            value={Number(netSalesTotal) > 0 ? formatPercent(((Number(computed.overhead.totalNet) / Number(netSalesTotal)) * 100).toString()) : '—'}
            tooltip={{ description: '§54: Gesamt-Gemeinkosten geteilt durch den Gesamt-Netto-Umsatz (inkl. Großhandel).', formula: 'Gemeinkosten / (Netto Kanäle + Großhandel Netto) × 100' }}
          />
          <SummaryTile
            label="Operativer Monatsgewinn"
            value={formatEur(computed.operatingProfit)}
            tone={Number(computed.operatingProfit) < 0 ? 'critical' : 'good'}
            tooltip={{ description: '§56: Was nach Gemeinkosten übrig bleibt.', formula: 'Profit vor Gemeinkosten − Gemeinkosten Netto' }}
          />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">Noch keine Gemeinkosten für diesen Monat erfasst.</div>
            <div className="flex gap-2 justify-center">
              <button onClick={applyTemplates} className="text-sm text-amber-600 hover:text-amber-700 font-medium">Vorlagen übernehmen</button>
              <button onClick={() => setShowNew(true)} className="text-sm text-amber-600 hover:text-amber-700 font-medium">oder neue Position anlegen</button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                <tr>
                  <th className="text-left px-4 py-3">Kategorie</th>
                  <th className="text-left px-4 py-3">Bezeichnung</th>
                  <th className="text-right px-4 py-3">Betrag eingegeben</th>
                  <th className="text-left px-4 py-3 w-24">Typ</th>
                  <th className="text-right px-4 py-3 w-20">USt %</th>
                  <th className="text-right px-4 py-3">Netto</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {entries.map((e) => {
                  const netAmount = calcNet(e.enteredAmount, e.isGross, e.vatRate);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <CategoryChip category={e.category} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" defaultValue={e.label} onBlur={(ev) => ev.target.value !== e.label && updateEntry(e.id, { label: ev.target.value })}
                          className="w-full rounded-md border border-transparent px-2 py-1 text-sm hover:border-slate-300 focus:border-amber-500 focus:outline-none dark:hover:border-white/10" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="text" inputMode="decimal" defaultValue={decimalToInputString(e.enteredAmount)}
                          onBlur={(ev) => {
                            const v = inputStringToDecimal(ev.target.value);
                            if (v !== e.enteredAmount) updateEntry(e.id, { enteredAmount: v });
                          }}
                          className="w-24 rounded-md border border-transparent px-2 py-1 text-sm text-right tabular-nums hover:border-slate-300 focus:border-amber-500 focus:outline-none dark:hover:border-white/10" />
                        <span className="text-slate-500 ml-1">€</span>
                      </td>
                      <td className="px-4 py-2">
                        <select value={e.isGross ? 'gross' : 'net'} onChange={(ev) => updateEntry(e.id, { isGross: ev.target.value === 'gross' })}
                          className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs">
                          <option value="gross">Brutto</option>
                          <option value="net">Netto</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="text" inputMode="decimal" defaultValue={decimalToInputString(e.vatRate)}
                          onBlur={(ev) => {
                            const v = inputStringToDecimal(ev.target.value);
                            if (v !== e.vatRate) updateEntry(e.id, { vatRate: v });
                          }}
                          className="w-14 rounded-md border border-transparent px-2 py-1 text-sm text-right tabular-nums hover:border-slate-300 focus:border-amber-500 focus:outline-none dark:hover:border-white/10" />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatEur(netAmount)}</td>
                      <td className="px-2 py-2"><button onClick={() => deleteEntry(e.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nach Kategorie */}
      {computed?.overhead?.byCategory?.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
          <div className="text-sm font-semibold mb-3">Nach Kategorie · Anteil am Netto-Umsatz</div>
          <div className="space-y-2">
            {computed.overhead.byCategory.map((c: any) => {
              const label = CATEGORY_LABELS[c.category] ?? c.category;
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-slate-700 dark:text-slate-300">{label}</div>
                  <div className="flex-1 relative h-2 bg-slate-100 dark:bg-white/5 rounded-full">
                    <div className="absolute inset-y-0 left-0 bg-amber-500 rounded-full" style={{ width: Math.min(100, Number(c.ratioOfNetSales ?? 0) * 3) + '%' }} />
                  </div>
                  <div className="w-24 text-right tabular-nums text-sm">{formatEur(c.totalNet)}</div>
                  <div className="w-20 text-right tabular-nums text-xs text-slate-500">{c.ratioOfNetSales !== null ? formatPercent(c.ratioOfNetSales) : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNew && <NewEntryModal year={year} month={month} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {showTemplates && <TemplatesModal templates={templates} onClose={() => setShowTemplates(false)} onChanged={load} />}
    </div>
  );
}

function calcNet(entered: string, isGross: boolean, vatRate: string): string {
  const n = Number(entered), r = Number(vatRate);
  if (!Number.isFinite(n) || !Number.isFinite(r)) return '0';
  if (!isGross || r === 0) return String(n);
  return String(n / (1 + r / 100));
}

function CategoryChip({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  return <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300 font-medium">{label}</span>;
}

function SummaryTile({ label, value, tone, tooltip }: {
  label: string; value: string; tone?: 'good' | 'critical';
  tooltip?: { description: string; formula?: string };
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
        {tooltip && <InfoTooltip description={tooltip.description} formula={tooltip.formula} />}
      </div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', toneClass)}>{value}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------

function NewEntryModal({ year, month, onClose, onSaved }: { year: number; month: number; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState('miete');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('0,00');
  const [isGross, setIsGross] = useState(true);
  const [vatRate, setVatRate] = useState('19');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      await profitAnalysisApi.overhead.createEntry(year, month, {
        category, label: label.trim() || CATEGORY_LABELS[category],
        enteredAmount: inputStringToDecimal(amount),
        isGross, vatRate: inputStringToDecimal(vatRate),
      });
      onSaved();
    } catch (e: any) { setError(e?.message ?? 'Fehler'); setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold mb-3">Neue Kostenposition</div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-[11px] font-semibold mb-1">Kategorie</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] font-semibold mb-1">Bezeichnung (optional)</div>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={CATEGORY_LABELS[category]} className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <div className="text-[11px] font-semibold mb-1">Betrag</div>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <div className="text-[11px] font-semibold mb-1">Typ</div>
              <select value={isGross ? 'gross' : 'net'} onChange={(e) => setIsGross(e.target.value === 'gross')} className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm">
                <option value="gross">Brutto</option>
                <option value="net">Netto</option>
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] font-semibold mb-1">USt %</div>
              <input type="text" inputMode="decimal" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
        {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm text-slate-500 px-3 py-2">Abbrechen</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesModal({ templates, onClose, onChanged }: { templates: OverheadTemplate[]; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<OverheadTemplate[]>(templates);
  const [addNew, setAddNew] = useState(false);
  const [category, setCategory] = useState('miete');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('0,00');
  const [isGross, setIsGross] = useState(true);
  const [vatRate, setVatRate] = useState('19');

  async function refresh() {
    const r = await profitAnalysisApi.overhead.listTemplates();
    setRows(r.items);
    onChanged();
  }
  async function createTemplate() {
    await profitAnalysisApi.overhead.createTemplate({ category, label: label.trim() || CATEGORY_LABELS[category], amount: inputStringToDecimal(amount), isGross, vatRate: inputStringToDecimal(vatRate) });
    setAddNew(false); setLabel(''); setAmount('0,00');
    refresh();
  }
  async function toggleActive(t: OverheadTemplate) {
    await profitAnalysisApi.overhead.updateTemplate(t.id, { active: !t.active });
    refresh();
  }
  async function del(id: string) {
    if (!confirm('Vorlage löschen?')) return;
    await profitAnalysisApi.overhead.deleteTemplate(id); refresh();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 w-full max-w-xl shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">Wiederkehrende Kosten-Vorlagen</div>
          <button onClick={() => setAddNew(true)} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"><Plus className="h-3.5 w-3.5" /> Neue Vorlage</button>
        </div>
        {addNew && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/[0.05] p-3 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="text" placeholder={CATEGORY_LABELS[category]} value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm" />
              <input type="text" inputMode="decimal" placeholder="Betrag" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm text-right" />
              <select value={isGross ? 'gross' : 'net'} onChange={(e) => setIsGross(e.target.value === 'gross')} className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm">
                <option value="gross">Brutto</option><option value="net">Netto</option>
              </select>
              <input type="text" inputMode="decimal" placeholder="USt %" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm text-right col-span-2" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setAddNew(false)} className="text-xs text-slate-500 px-2 py-1">Abbrechen</button>
              <button onClick={createTemplate} className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1">Anlegen</button>
            </div>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">Keine Vorlagen vorhanden.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.map((t) => (
                <tr key={t.id} className={cn(!t.active && 'opacity-40')}>
                  <td className="px-2 py-2"><CategoryChip category={t.category} /></td>
                  <td className="px-2 py-2">{t.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatEur(t.amount)}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">{t.isGross ? 'Brutto' : 'Netto'} · {t.vatRate} %</td>
                  <td className="px-2 py-2">
                    <button onClick={() => toggleActive(t)} className="text-xs text-amber-600 hover:text-amber-700">{t.active ? 'deaktivieren' : 'aktivieren'}</button>
                  </td>
                  <td className="px-2 py-2"><button onClick={() => del(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="text-sm text-amber-600 hover:text-amber-700 font-medium">Fertig</button>
        </div>
      </div>
    </div>
  );
}
