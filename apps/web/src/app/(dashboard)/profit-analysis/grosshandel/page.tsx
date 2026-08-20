'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, ExternalLink, Link2Off,
} from 'lucide-react';
import {
  profitAnalysisApi, WholesaleAutoResponse, WholesaleUnmatchedItem,
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
              <button
                onClick={() => setShowUnmatched((v) => !v)}
                className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 underline"
              >
                {showUnmatched ? 'Liste ausblenden' : 'Positionen anzeigen'}
              </button>
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
