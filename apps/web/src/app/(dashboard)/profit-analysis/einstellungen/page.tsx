'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, History, Save, Check } from 'lucide-react';
import { profitAnalysisApi, SettingItem, SettingHistoryEntry, TargetItem } from '@/lib/profit-analysis/api';
import {
  formatEur,
  formatPercent,
  formatDate,
  decimalToInputString,
  inputStringToDecimal,
} from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';

type Tab = 'fees' | 'shipping' | 'vat' | 'targets';

const TARGET_META: Record<string, { label: string; unit: 'percent' | 'eur' | 'roas'; description: string }> = {
  margin_target:          { label: 'Zielmarge',                unit: 'percent', description: '§38 Ziel-Marge vor Gemeinkosten. Wird auf dem Dashboard als Referenz angezeigt.' },
  margin_good_from:       { label: 'Marge grün ab',            unit: 'percent', description: 'Ab diesem Wert zeigt die Marge-Ampel grün.' },
  margin_critical_below:  { label: 'Marge rot unter',          unit: 'percent', description: 'Unter diesem Wert zeigt die Marge-Ampel rot (kritisch).' },
  roas_target_shopify:    { label: 'ROAS-Ziel Shopify',        unit: 'roas',    description: 'Ziel-ROAS für den Webshop (Meta + Google).' },
  roas_target_amazon:     { label: 'ROAS-Ziel Amazon',         unit: 'roas',    description: 'Ziel-ROAS für Amazon PPC.' },
  roas_target_tiktok:     { label: 'ROAS-Ziel TikTok',         unit: 'roas',    description: 'Ziel-ROAS für TikTok Ads.' },
  monthly_revenue_target: { label: 'Monats-Umsatzziel',        unit: 'eur',     description: 'Ziel-Netto-Umsatz pro Monat (inkl. Großhandel).' },
  monthly_profit_target:  { label: 'Monats-Gewinnziel',        unit: 'eur',     description: 'Ziel-Operativer-Monatsgewinn.' },
};

export default function EinstellungenPage() {
  const [tab, setTab] = useState<Tab>('fees');
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profitAnalysisApi.settings.list();
      setItems(res.items);
    } catch (e: any) {
      setError(e?.message ?? 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const grouped = groupByCategory(items);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Einstellungen</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Alle historisierten Werte: Gebühren, Versand, Umsatzsteuersätze. Änderungen gelten ab dem gewählten Datum &mdash; ältere Monate rechnen weiterhin mit dem Wert der damals gültig war.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-white/8 flex gap-1 overflow-x-auto">
        <TabButton active={tab === 'fees'}     onClick={() => setTab('fees')}>Gebühren</TabButton>
        <TabButton active={tab === 'shipping'} onClick={() => setTab('shipping')}>Versand</TabButton>
        <TabButton active={tab === 'vat'}      onClick={() => setTab('vat')}>Umsatzsteuer</TabButton>
        <TabButton active={tab === 'targets'}  onClick={() => setTab('targets')}>Ziele</TabButton>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Einstellungen …
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!loading && !error && tab !== 'targets' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(grouped[tab] ?? []).map((item) => (
            <SettingCard key={item.key} item={item} onSaved={reload} />
          ))}
          {(grouped[tab] ?? []).length === 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400">Keine Einträge in dieser Kategorie.</div>
          )}
        </div>
      )}

      {tab === 'targets' && <TargetsPanel />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Ziele-Tab (§38 + §62)
// -----------------------------------------------------------------------------

function TargetsPanel() {
  const [items, setItems] = useState<TargetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true); setError(null);
    try {
      const res = await profitAnalysisApi.targets.list();
      setItems(res.items);
    } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {loading && <div className="text-sm text-slate-500">Lade …</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {items.map((t) => (
        <TargetCard key={t.key} target={t} onSaved={reload} />
      ))}
    </div>
  );
}

function TargetCard({ target, onSaved }: { target: TargetItem; onSaved: () => void }) {
  const meta = TARGET_META[target.key];
  if (!meta) return null;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(decimalToInputString(target.value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      await profitAnalysisApi.targets.set(target.key, inputStringToDecimal(value), null, null);
      setEditing(false);
      onSaved();
    } catch (e: any) { setError(e?.message ?? 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  const unitSuffix = meta.unit === 'percent' ? '%' : meta.unit === 'eur' ? '€' : 'x';
  const displayValue = meta.unit === 'percent' ? formatPercent(target.value) : meta.unit === 'eur' ? formatEur(target.value) : target.value + 'x';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{meta.label}</h3>
            <InfoTooltip description={meta.description} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {displayValue}
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
            Ändern
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/8 space-y-3">
          <div className="relative">
            <input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{unitSuffix}</span>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditing(false); setValue(decimalToInputString(target.value)); }} className="text-xs text-slate-500 px-3 py-1.5">Abbrechen</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function groupByCategory(items: SettingItem[]) {
  return items.reduce<Record<string, SettingItem[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});
}

// -----------------------------------------------------------------------------
// Einzelne Setting-Kachel mit Wert + Änderungs-Formular + Historie
// -----------------------------------------------------------------------------

function SettingCard({ item, onSaved }: { item: SettingItem; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newValue, setNewValue] = useState(decimalToInputString(item.currentValue));
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<SettingHistoryEntry[] | null>(null);

  const unitSuffix = item.unit === 'percent' ? '%' : '€';
  const currentFormatted =
    item.unit === 'percent' ? formatPercent(item.currentValue) : formatEur(item.currentValue);

  const exampleFor = buildExample(item);

  async function loadHistory() {
    if (history) { setShowHistory((v) => !v); return; }
    try {
      const res = await profitAnalysisApi.settings.history(item.key);
      setHistory(res.items);
      setShowHistory(true);
    } catch (e: any) {
      setError(e?.message ?? 'Historie laden fehlgeschlagen');
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await profitAnalysisApi.settings.set(item.key, {
        value: inputStringToDecimal(newValue),
        effectiveFrom,
        note: note.trim() || undefined,
      });
      setSaved(true);
      setEditing(false);
      setHistory(null);        // Historie ist stale — beim nächsten Öffnen neu laden
      setNote('');
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {item.label}
            </h3>
            <InfoTooltip
              description={item.description}
              formula={item.formula}
              example={exampleFor}
              ariaLabel={`Erklärung: ${item.label}`}
            />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {currentFormatted}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            gültig seit {formatDate(item.currentEffectiveFrom)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Ändern
            </button>
          )}
          <button
            onClick={loadHistory}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1"
            title="Historie einblenden"
          >
            <History className="h-3 w-3" /> Historie
          </button>
        </div>
      </div>

      {/* Änderungs-Formular */}
      {editing && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/8 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Neuer Wert</div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{unitSuffix}</span>
              </div>
            </label>
            <label className="block">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Gültig ab</div>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </label>
          </div>
          <label className="block">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Notiz (optional)</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Neue Konditionen ab Q4"
              className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </label>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setEditing(false); setError(null); setNewValue(decimalToInputString(item.currentValue)); }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5"
            >
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Speichern
            </button>
          </div>
        </div>
      )}

      {saved && !editing && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Gespeichert
        </div>
      )}

      {/* Historie */}
      {showHistory && history && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/8">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">
            Historie ({history.length})
          </div>
          {history.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Keine Einträge.</div>
          ) : (
            <ol className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-xs">
                  <div className="w-24 flex-shrink-0 text-slate-500 dark:text-slate-400 tabular-nums">
                    ab {formatDate(h.effectiveFrom)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      {item.unit === 'percent' ? formatPercent(h.value) : formatEur(h.value)}
                    </div>
                    {h.effectiveTo && (
                      <div className="text-slate-500 dark:text-slate-400">bis {formatDate(h.effectiveTo)}</div>
                    )}
                    {h.note && <div className="text-slate-500 dark:text-slate-400 mt-0.5 italic">„{h.note}"</div>}
                    {h.createdByName && (
                      <div className="text-slate-400 dark:text-slate-500 mt-0.5">durch {h.createdByName}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-2 text-sm border-b-2 transition-colors ' +
        (active
          ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}

function todayIso(): string {
  // LOKALES Datum, nicht UTC. toISOString() liefert in Berlin (UTC+2)
  // zwischen 00:00 und 02:00 den VORTAG — ein nachts gesetzter Stichtag
  // landete dadurch einen Tag zu frueh und verschob Kosten in den falschen
  // Monat (z.B. 40 Pakete x 1,00 EUR aus dem Juli zurueck in den Juni).
  const d = new Date();
  const jahr = d.getFullYear();
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const tag = String(d.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/** Erzeugt ein rechenbares Beispiel fuer die Tooltip-Anzeige. */
function buildExample(item: SettingItem): string | undefined {
  const v = Number(item.currentValue);
  if (!Number.isFinite(v)) return undefined;
  if (item.category === 'fees') {
    return `Beispiel: 10.000,00 € Netto × ${v.toString().replace('.', ',')} % = ${formatEur((10000 * v) / 100)}`;
  }
  if (item.category === 'shipping') {
    return `Beispiel: 42 Pakete × ${formatEur(v)} = ${formatEur(42 * v)}`;
  }
  if (item.category === 'vat') {
    const brutto = 1190;
    const netto = brutto / (1 + v / 100);
    return `Beispiel: ${formatEur(brutto)} Brutto / (1 + ${v}%) = ${formatEur(netto)} Netto`;
  }
  return undefined;
}
