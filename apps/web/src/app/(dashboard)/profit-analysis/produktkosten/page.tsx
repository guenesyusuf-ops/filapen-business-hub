'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Package, Filter, History, X, Save, Check, Power, PowerOff } from 'lucide-react';
import Image from 'next/image';
import { profitAnalysisApi, ProductCostRow, CostHistoryEntry, CostKind, Channel } from '@/lib/profit-analysis/api';
import {
  formatEur, formatDate, decimalToInputString, inputStringToDecimal,
} from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'missing-costs' | 'missing-fulfillment' | 'disabled';

export default function ProduktkostenPage() {
  const [rows, setRows] = useState<ProductCostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [missingCostsCount, setMissingCostsCount] = useState(0);
  const [missingFulfillmentCount, setMissingFulfillmentCount] = useState(0);
  const [disabledCount, setDisabledCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ row: ProductCostRow; kind: CostKind } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profitAnalysisApi.productCosts.list({
        search: search.trim() || undefined,
        missingCosts: filter === 'missing-costs' || undefined,
        missingFulfillment: filter === 'missing-fulfillment' || undefined,
        includeDisabled: true,   // Produktkosten-Seite zeigt IMMER alle (inkl. deaktivierte)
        status: 'all',           // auch archivierte/Draft — ihre Verkaufszeilen zaehlen weiter mit
        limit: 500,              // ohne limit greift der Backend-Default 100; ab Produkt 101
                                 // waren die alphabetisch hinteren nie bepreisbar
      });
      let items = res.items;
      if (filter === 'disabled') items = items.filter((r) => !r.enabled);
      setRows(items);
      setTotal(res.total);
      setMissingCostsCount(res.missingCostsCount);
      setMissingFulfillmentCount(res.missingFulfillmentCount);
      setDisabledCount(res.items.filter((r) => !r.enabled).length);
    } catch (e: any) {
      setError(e?.message ?? 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  // Debounced Search
  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
  }, [reload]);

  return (
    <div className="space-y-5">
      {/* Header + Stats */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Produktkosten</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pflege pro Shopify-Produkt: Einkaufspreis und Amazon-Fulfillment. Beide historisiert &mdash;
            &Auml;nderungen wirken nur ab dem g&uuml;ltig-ab-Datum, alte Monate rechnen mit dem damaligen Wert.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <StatChip
            label="Produkte gesamt"
            value={total}
            tone="neutral"
          />
          <StatChip
            label="Kosten fehlen"
            value={missingCostsCount}
            tone={missingCostsCount === 0 ? 'good' : 'warn'}
            onClick={() => setFilter(filter === 'missing-costs' ? 'all' : 'missing-costs')}
            active={filter === 'missing-costs'}
          />
          <StatChip
            label="Fulfillment fehlt"
            value={missingFulfillmentCount}
            tone={missingFulfillmentCount === 0 ? 'good' : 'warn'}
            onClick={() => setFilter(filter === 'missing-fulfillment' ? 'all' : 'missing-fulfillment')}
            active={filter === 'missing-fulfillment'}
          />
          <StatChip
            label="Deaktiviert"
            value={disabledCount}
            tone={disabledCount === 0 ? 'neutral' : 'warn'}
            onClick={() => setFilter(filter === 'disabled' ? 'all' : 'disabled')}
            active={filter === 'disabled'}
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titel, SKU oder Shopify-ID …"
          className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Produkte …
          </div>
        ) : rows.length === 0 ? (
          <EmptyState filter={filter} onReset={() => { setFilter('all'); setSearch(''); }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                <tr>
                  <Th align="left">Produkt</Th>
                  <Th align="left">SKU</Th>
                  <Th align="right">
                    <span className="inline-flex items-center gap-1">
                      Produktkosten
                      <InfoTooltip
                        description="Einkaufs- oder Herstellkosten pro Stueck. Wird bei jedem Verkauf abgezogen."
                        formula="Kosten = verkaufte Stueckzahl × gueltige Produktkosten am Verkaufstag"
                      />
                    </span>
                  </Th>
                  <Th align="right">
                    <span className="inline-flex items-center gap-1">
                      Amazon Fulfillment
                      <InfoTooltip
                        description="Pauschale die Amazon (AWD/FBA) pro versendetem Stueck verrechnet."
                        formula="Fulfillment = verkaufte Stueckzahl (Amazon) × gueltige Pauschale am Verkaufstag"
                      />
                    </span>
                  </Th>
                  <Th align="left">
                    <span className="inline-flex items-center gap-1">
                      Verkauft auf
                      <InfoTooltip
                        description="Welche Kanäle bieten dieses Produkt an? Filtert die Produktauswahl im Tages-Editor."
                        formula="Ohne Haken (alle grau) = Produkt taucht in ALLEN Kanal-Tabs auf (Legacy-Verhalten)"
                      />
                    </span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.productId} className={cn('hover:bg-slate-50 dark:hover:bg-white/[0.02]', !r.enabled && 'opacity-40')}>
                    <Td>
                      <div className="flex items-center gap-3 min-w-0">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt="" className={cn('h-9 w-9 rounded-lg object-cover flex-shrink-0', !r.enabled && 'grayscale')} />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('font-medium truncate', r.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 line-through')}>{r.title}</div>
                            {!r.enabled && <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-1.5 py-0.5 rounded">Aus</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Shopify-ID: {r.externalId}</div>
                        </div>
                        <EnabledToggle
                          productId={r.productId}
                          enabled={r.enabled}
                          onSaved={reload}
                        />
                      </div>
                    </Td>
                    <Td className="text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {r.sku ?? <span className="text-slate-400">—</span>}
                    </Td>
                    <Td align="right">
                      <CostCell
                        value={r.currentCost}
                        effectiveFrom={r.currentCostEffectiveFrom}
                        onClick={() => setSelected({ row: r, kind: 'cost' })}
                      />
                    </Td>
                    <Td align="right">
                      <CostCell
                        value={r.currentFulfillment}
                        effectiveFrom={r.currentFulfillmentEffectiveFrom}
                        onClick={() => setSelected({ row: r, kind: 'fulfillment' })}
                      />
                    </Td>
                    <Td align="left">
                      <ChannelChips
                        productId={r.productId}
                        channels={r.channels}
                        onSaved={reload}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail-Drawer mit Editor + Historie */}
      {selected && (
        <CostEditorDrawer
          row={selected.row}
          kind={selected.kind}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); reload(); }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI-Bausteine
// -----------------------------------------------------------------------------

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
  );
}

function Td({ children, align = 'left', className }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td className={cn('px-4 py-3', align === 'right' ? 'text-right' : '', className)}>{children}</td>
  );
}

function StatChip({
  label, value, tone, onClick, active,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'good' | 'warn';
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === 'good' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    : tone === 'warn' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-xl px-3 py-2 text-left transition-all',
        toneClass,
        active && 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900',
        onClick && 'hover:brightness-95 cursor-pointer',
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-none mt-0.5">{value}</div>
    </button>
  );
}

function CostCell({
  value, effectiveFrom, onClick,
}: {
  value: string | null;
  effectiveFrom: string | null;
  onClick: () => void;
}) {
  const isMissing = value === null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-col items-end gap-0.5 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors',
        'hover:bg-slate-100 dark:hover:bg-white/5',
        isMissing && 'text-amber-600 dark:text-amber-400',
      )}
    >
      <span className={cn('font-semibold tabular-nums', !isMissing && 'text-slate-900 dark:text-white')}>
        {isMissing ? 'Fehlt' : formatEur(value)}
      </span>
      {!isMissing && effectiveFrom && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          seit {formatDate(effectiveFrom)}
        </span>
      )}
    </button>
  );
}

function EmptyState({ filter, onReset }: { filter: Filter; onReset: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex h-12 w-12 rounded-xl bg-slate-100 dark:bg-white/5 items-center justify-center mb-3">
        <Filter className="h-5 w-5 text-slate-400" />
      </div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {filter === 'missing-costs' ? 'Alle Produkte haben Kosten hinterlegt.'
         : filter === 'missing-fulfillment' ? 'Alle Produkte haben Fulfillment hinterlegt.'
         : 'Keine Produkte gefunden.'}
      </div>
      {filter !== 'all' && (
        <button onClick={onReset} className="mt-3 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400">
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Editor-Drawer: neuer Wert + gültig-ab + Notiz + Timeline
// -----------------------------------------------------------------------------

function CostEditorDrawer({
  row, kind, onClose, onSaved,
}: {
  row: ProductCostRow;
  kind: CostKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isFulfillment = kind === 'fulfillment';
  const title = isFulfillment ? 'Amazon Fulfillment' : 'Produktkosten';
  const currentValue = isFulfillment ? row.currentFulfillment : row.currentCost;
  const currentFrom  = isFulfillment ? row.currentFulfillmentEffectiveFrom : row.currentCostEffectiveFrom;

  const [newValue, setNewValue] = useState(currentValue ? decimalToInputString(currentValue) : '');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<CostHistoryEntry[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await profitAnalysisApi.productCosts.history(row.productId, kind);
        setHistory(res.items);
      } catch (e: any) {
        setError(e?.message ?? 'Historie laden fehlgeschlagen');
      }
    })();
  }, [row.productId, kind]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await profitAnalysisApi.productCosts.set(row.productId, kind, {
        value: inputStringToDecimal(newValue),
        effectiveFrom,
        note: note.trim() || undefined,
      });
      setSaved(true);
      setTimeout(onSaved, 400);
    } catch (e: any) {
      setError(e?.message ?? 'Speichern fehlgeschlagen');
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-[#0f1117] shadow-2xl overflow-y-auto animate-slide-up">
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f1117] px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{title}</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{row.title}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Aktueller Wert */}
          <div className="rounded-xl border border-slate-200 dark:border-white/8 p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Aktuell</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {currentValue ? formatEur(currentValue) : <span className="text-amber-600 dark:text-amber-400">Nicht gesetzt</span>}
            </div>
            {currentFrom && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">gültig seit {formatDate(currentFrom)}</div>
            )}
          </div>

          {/* Neuer Wert */}
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Neue Periode anlegen</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Neuer Wert</div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">€</span>
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
            <label className="block mt-3">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Notiz (optional)</div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z.B. Neuer Lieferant, Rohstoffpreise gestiegen …"
                className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </label>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 px-3 py-2">
                Abbrechen
              </button>
              <button
                onClick={save}
                disabled={saving || !newValue}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Gespeichert' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="pt-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3 inline-flex items-center gap-1.5">
              <History className="h-4 w-4" /> Historie {history && `(${history.length})`}
            </div>
            {history === null ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade …
              </div>
            ) : history.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                Noch keine Werte hinterlegt. Der erste Eintrag über das Formular oben startet die Historie.
              </div>
            ) : (
              <ol className="space-y-3">
                {history.map((h, idx) => (
                  <li key={h.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-white/8">
                    <div className={cn(
                      'absolute -left-1.5 top-1 h-3 w-3 rounded-full',
                      idx === 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/20',
                    )} />
                    <div className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatEur(h.value)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ab {formatDate(h.effectiveFrom)}{h.effectiveTo ? ` bis ${formatDate(h.effectiveTo)}` : ' (aktuell)'}
                    </div>
                    {h.note && <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">„{h.note}"</div>}
                    {h.createdByName && <div className="text-[11px] text-slate-400 mt-0.5">durch {h.createdByName}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </>
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

// -----------------------------------------------------------------------------
// EnabledToggle — Kill-Switch pro Produkt-Zeile
// -----------------------------------------------------------------------------

function EnabledToggle({ productId, enabled, onSaved }: {
  productId: string; enabled: boolean; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    try {
      await profitAnalysisApi.productCosts.setEnabled(productId, !enabled);
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      disabled={saving}
      className={cn(
        'flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors',
        enabled
          ? 'text-slate-500 border-slate-200 hover:text-red-600 hover:border-red-200 dark:border-white/10 dark:hover:border-red-500/30'
          : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10',
        saving && 'opacity-50',
      )}
      title={enabled ? 'Produkt deaktivieren (wird überall ausgeblendet)' : 'Produkt wieder aktivieren'}
    >
      {enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
      {enabled ? 'Deaktivieren' : 'Aktivieren'}
    </button>
  );
}

// -----------------------------------------------------------------------------
// ChannelChips — Toggle-Chips fuer Shopify/Amazon/TikTok pro Produktzeile
// -----------------------------------------------------------------------------

const CHANNEL_OPTIONS: Array<{ key: Channel; label: string; color: string }> = [
  { key: 'shopify', label: 'SH', color: 'emerald' },
  { key: 'amazon',  label: 'AM', color: 'orange' },
  { key: 'tiktok',  label: 'TT', color: 'pink' },
];

function ChannelChips({ productId, channels, onSaved }: {
  productId: string; channels: Channel[]; onSaved: () => void;
}) {
  const [local, setLocal] = useState<Channel[]>(channels);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setLocal(channels); }, [channels]);

  async function toggle(ch: Channel) {
    const next = local.includes(ch) ? local.filter((c) => c !== ch) : [...local, ch];
    setLocal(next);
    setSaving(true);
    try {
      await profitAnalysisApi.productCosts.setChannels(productId, next);
      onSaved();
    } catch {
      // Bei Fehler Zustand zurücksetzen
      setLocal(local);
    } finally { setSaving(false); }
  }

  const isLegacy = local.length === 0;

  return (
    <div className="flex items-center gap-1">
      {CHANNEL_OPTIONS.map((opt) => {
        const active = local.includes(opt.key);
        const colorClass = active
          ? opt.color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500'
          : opt.color === 'orange'  ? 'bg-orange-500 text-white border-orange-500'
          :                            'bg-pink-500 text-white border-pink-500'
          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10';
        return (
          <button
            key={opt.key}
            onClick={(e) => { e.stopPropagation(); toggle(opt.key); }}
            disabled={saving}
            className={cn(
              'w-8 h-6 text-[10px] font-bold rounded border transition-all',
              colorClass,
              saving && 'opacity-50',
            )}
            title={active ? `In "${opt.key}" verkauft — klicken zum Entfernen` : `Nicht in "${opt.key}" — klicken zum Aktivieren`}
          >
            {opt.label}
          </button>
        );
      })}
      {isLegacy && (
        <span className="ml-1 text-[10px] text-slate-400 italic" title="Ohne Haken tauchen Produkte überall auf (Legacy-Verhalten)">alle</span>
      )}
    </div>
  );
}
