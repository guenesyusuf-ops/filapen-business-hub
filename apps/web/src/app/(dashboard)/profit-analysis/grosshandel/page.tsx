'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, ExternalLink, Link2Off,
  X, Search, Check, ArrowRight, Package,
} from 'lucide-react';
import {
  profitAnalysisApi, WholesaleAutoResponse, WholesaleUnmatchedItem, ProductCostRow,
} from '@/lib/profit-analysis/api';
import { formatEur, formatDate, formatPercent } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

/**
 * Grosshandel = automatischer Feed aus dem Verkauf-Modul (/sales).
 *
 * - Monatszuordnung: requiredDeliveryDate (Wunschliefertermin)
 * - Bruttoumsatz: nach 3% Skonto (immer pauschal)
 * - Produktkosten: historisch am Wunschliefertermin
 * - Nicht-gematchte Positionen: gelbe Warnung + Link zum Sales-Auftrag
 */
export default function GrosshandelPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<WholesaleAutoResponse | null>(null);
  const [unmatched, setUnmatched] = useState<WholesaleUnmatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, unm] = await Promise.all([
        profitAnalysisApi.wholesaleSync.listForMonth(year, month),
        profitAnalysisApi.wholesaleSync.unmatched(year, month),
      ]);
      setData(res);
      setUnmatched(unm.items);
    } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); }
  function nextMonth() { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Großhandel</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Automatisch aus dem <Link href="/sales/orders" className="text-amber-600 hover:text-amber-700 underline">Verkauf-Modul</Link>.
          Zuordnung nach Wunschliefertermin, Bruttoumsatz nach pauschalem 3 %-Skonto,
          Produktkosten historisch am Liefertermin.
        </p>
      </div>

      {/* Monat-Navigation */}
      <div className="flex items-center gap-2">
        <button onClick={prevMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-lg font-bold text-slate-900 dark:text-white min-w-[180px] text-center tabular-nums">{MONTH_LABELS[month - 1]} {year}</div>
        <button onClick={nextMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Match-Warnung */}
      {data && data.aggregate.unmatchedPositions > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <Link2Off className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Produkte matchen für Großhandel
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                <b>{data.aggregate.unmatchedPositions}</b> {data.aggregate.unmatchedPositions === 1 ? 'Position' : 'Positionen'} in
                {' '}<b>{data.aggregate.unmatchedOrders}</b> {data.aggregate.unmatchedOrders === 1 ? 'Auftrag' : 'Aufträgen'} sind noch nicht mit einem Filapen-Produkt verknüpft.
                Für diese Positionen können keine Produktkosten und damit kein Gewinn ermittelt werden.
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold"
                >
                  <Package className="h-3.5 w-3.5" /> Jetzt matchen
                </button>
                <button
                  onClick={() => setShowUnmatched((v) => !v)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 underline"
                >
                  {showUnmatched ? 'Liste ausblenden' : 'Nur ansehen'}
                </button>
              </div>
              {showUnmatched && (
                <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-white/[0.02] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-amber-100 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200">
                      <tr>
                        <th className="text-left px-3 py-2">Auftrag</th>
                        <th className="text-left px-3 py-2">Kunde</th>
                        <th className="text-left px-3 py-2">Position</th>
                        <th className="text-right px-3 py-2">Menge</th>
                        <th className="text-right px-3 py-2">Netto</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 dark:divide-amber-500/10">
                      {unmatched.map((u) => (
                        <tr key={u.lineItemId}>
                          <td className="px-3 py-2 font-mono text-[11px]">{u.orderNumber}</td>
                          <td className="px-3 py-2">{u.customerName}</td>
                          <td className="px-3 py-2 truncate max-w-xs">
                            <div className="truncate">{u.title}</div>
                            {(u.ean || u.supplierArticleNumber) && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {u.ean && `EAN ${u.ean}`}
                                {u.supplierArticleNumber && `${u.ean ? ' · ' : ''}${u.supplierArticleNumber}`}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatEur(u.lineNet)}</td>
                          <td className="px-3 py-2">
                            <Link href={`/sales/orders/${u.orderId}`} className="text-amber-600 hover:text-amber-700 inline-flex items-center" title="Im Verkauf-Modul öffnen">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monats-KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="Aufträge" value={data.aggregate.orderCount.toString()} />
          <SummaryCard
            label="Brutto (nach Skonto)"
            value={formatEur(data.aggregate.totalGross)}
            tooltip={{
              description: 'Bruttoumsatz aller Aufträge im Monat, nach pauschalem 3 %-Skonto.',
              formula: 'Σ (line_net × (1 + USt%)) × 0,97',
            }}
          />
          <SummaryCard
            label="Netto"
            value={formatEur(data.aggregate.totalNet)}
            tooltip={{ description: 'Netto-Umsatz aus dem Brutto herausgerechnet.', formula: 'Brutto / (1 + USt/100)' }}
          />
          <SummaryCard label="Produktkosten" value={formatEur(data.aggregate.totalCost)} />
          <SummaryCard
            label="Gewinn"
            value={formatEur(data.aggregate.totalProfit)}
            tone={Number(data.aggregate.totalProfit) < 0 ? 'critical' : 'good'}
            tooltip={{ description: 'Netto-Umsatz minus Produktkosten.', formula: 'Netto − Σ (Menge × Produktkosten)' }}
          />
          <SummaryCard
            label="Marge"
            value={data.aggregate.margin !== null ? formatPercent(data.aggregate.margin) : '—'}
            tone={marginTone(data.aggregate.margin)}
          />
        </div>
      )}

      {wizardOpen && unmatched.length > 0 && (
        <MatchWizard
          items={unmatched}
          onClose={() => setWizardOpen(false)}
          onComplete={() => { setWizardOpen(false); load(); }}
        />
      )}

      {/* Auftragsliste */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
        ) : !data || data.orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Keine Verkaufsaufträge mit Wunschliefertermin in {MONTH_LABELS[month - 1]} {year}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                <tr>
                  <th className="text-left px-4 py-3">Auftrag</th>
                  <th className="text-left px-4 py-3">Kunde</th>
                  <th className="text-left px-4 py-3">Lieferung</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Pos.</th>
                  <th className="text-right px-4 py-3">Brutto</th>
                  <th className="text-right px-4 py-3">Netto</th>
                  <th className="text-right px-4 py-3">Kosten</th>
                  <th className="text-right px-4 py-3">Gewinn</th>
                  <th className="text-right px-4 py-3">Marge</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {data.orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{o.orderNumber}</div>
                      {o.externalOrderNumber && <div className="text-[10px] text-slate-500">ext: {o.externalOrderNumber}</div>}
                    </td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="px-4 py-3 tabular-nums">{o.requiredDeliveryDate ? formatDate(o.requiredDeliveryDate) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.itemCount}
                      {o.hasUnmatched && (
                        <span title={`${o.unmatchedCount} nicht gematcht`} className="ml-1 inline-flex text-amber-600">
                          <Link2Off className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(o.totalGross)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(o.totalNet)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEur(o.totalCost)}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums font-semibold',
                      Number(o.totalProfit) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatEur(o.totalProfit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.margin !== null ? formatPercent(o.margin) : '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/sales/orders/${o.id}`} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, tooltip }: {
  label: string; value: string; tone?: 'good' | 'critical' | 'warn' | null;
  tooltip?: { description: string; formula?: string };
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft:     'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    shipped:   'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    invoiced:  'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    paid:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    draft: 'Entwurf', confirmed: 'Bestätigt', shipped: 'Versendet',
    invoiced: 'Fakturiert', paid: 'Bezahlt', completed: 'Erledigt', cancelled: 'Storniert',
  };
  return <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-medium', colors[status] ?? colors.draft)}>{labels[status] ?? status}</span>;
}

function marginTone(v: string | null | undefined): 'good' | 'warn' | 'critical' | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 20) return 'critical';
  if (n < 25) return 'warn';
  return 'good';
}

// -----------------------------------------------------------------------------
// Match-Wizard: fuehrt nacheinander durch nicht-gematchte Positionen
// -----------------------------------------------------------------------------

function MatchWizard({ items, onClose, onComplete }: {
  items: WholesaleUnmatchedItem[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [products, setProducts] = useState<ProductCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState(0);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await profitAnalysisApi.productCosts.list({ limit: 500 });
        setProducts(res.items);
      } finally { setLoading(false); }
    })();
  }, []);

  const current = items[idx];
  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 items-center justify-center mb-3">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">Fertig!</div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            {matched} Position{matched !== 1 ? 'en' : ''} gematcht{skipped > 0 && `, ${skipped} übersprungen`}.
          </div>
          <button onClick={onComplete} className="mt-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 text-sm font-semibold">
            Schließen und aktualisieren
          </button>
        </div>
      </div>
    );
  }

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.title.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.externalId.toLowerCase().includes(s);
  });

  async function saveAndNext() {
    if (!selectedProductId) { setError('Bitte Produkt auswählen'); return; }
    setSaving(true); setError(null);
    try {
      await profitAnalysisApi.wholesaleSync.match(current.lineItemId, selectedProductId);
      setMatched((v) => v + 1);
      setSelectedProductId(null);
      setSearch('');
      setIdx((i) => i + 1);
    } catch (e: any) { setError(e?.message ?? 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }
  function skip() {
    setSkipped((v) => v + 1);
    setSelectedProductId(null);
    setSearch('');
    setIdx((i) => i + 1);
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-white/8 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              Position {idx + 1} von {items.length}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Filapen-Produkt zuordnen
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress-Bar */}
        <div className="h-1 bg-slate-100 dark:bg-white/5">
          <div className="h-full bg-amber-500 transition-all" style={{ width: (idx / items.length) * 100 + '%' }} />
        </div>

        {/* Position-Details (fest oben) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/8 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="text-xs text-slate-500 mb-1">
            Auftrag <span className="font-mono font-bold">{current.orderNumber}</span> · {current.customerName}
          </div>
          <div className="font-semibold text-slate-900 dark:text-white">{current.title}</div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-600 dark:text-slate-300">
            {current.ean && <span><span className="text-slate-500">EAN:</span> <span className="font-mono">{current.ean}</span></span>}
            {current.supplierArticleNumber && <span><span className="text-slate-500">Art-Nr:</span> <span className="font-mono">{current.supplierArticleNumber}</span></span>}
            <span><span className="text-slate-500">Menge:</span> <b>{current.quantity}</b></span>
            <span><span className="text-slate-500">Netto:</span> <b>{formatEur(current.lineNet)}</b></span>
          </div>
        </div>

        {/* Produkt-Auswahl */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-white/8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filapen-Produkt suchen (Titel, SKU, Shopify-ID) …"
                className="w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Lade Produkte …</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center">Keine Produkte gefunden.</div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((p) => {
                  const active = selectedProductId === p.productId;
                  return (
                    <li key={p.productId}>
                      <button
                        onClick={() => setSelectedProductId(p.productId)}
                        className={cn('w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                          active ? 'bg-amber-100 dark:bg-amber-500/10 ring-2 ring-amber-500'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]')}
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-900 dark:text-white truncate">{p.title}</div>
                          <div className="text-[11px] text-slate-500 flex gap-2 mt-0.5">
                            {p.sku && <span className="font-mono">{p.sku}</span>}
                            {p.currentCost && <span>Kosten: {formatEur(p.currentCost)}</span>}
                            {!p.currentCost && <span className="text-amber-600">Kosten fehlen</span>}
                          </div>
                        </div>
                        {active && <Check className="h-5 w-5 text-amber-600 flex-shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer mit Aktionen */}
        <div className="border-t border-slate-200 dark:border-white/8 px-5 py-3 flex items-center justify-between">
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400">✓ {matched}</span>
            <span className="text-slate-500">− {skipped}</span>
          </div>
          {error && (
            <div className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {error}</div>
          )}
          <div className="flex gap-2">
            <button onClick={skip} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 px-3 py-2">
              Überspringen
            </button>
            <button
              onClick={saveAndNext}
              disabled={!selectedProductId || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {idx === items.length - 1 ? 'Speichern & fertig' : 'Speichern & nächste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
