'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Loader2, AlertCircle,
  Download, Lock, Unlock, ShoppingBag, Package2, Music2,
} from 'lucide-react';
import { profitAnalysisApi, ComputedMonth, TargetItem, RankingsResult, PreflightResult } from '@/lib/profit-analysis/api';
import { formatEur, formatPercent } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { useAuthStore, getAuthHeaders } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function OverviewPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [current, setCurrent] = useState<ComputedMonth | null>(null);
  const [previous, setPrevious] = useState<ComputedMonth | null>(null);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [rankings, setRankings] = useState<RankingsResult | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLock, setPreflightLock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, prev, t, r] = await Promise.all([
        profitAnalysisApi.daily.getMonth(year, month),
        profitAnalysisApi.daily.getMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
        profitAnalysisApi.targets.list(),
        profitAnalysisApi.rankings.lastMonths(12).catch(() => null),
      ]);
      setCurrent(c.computed);
      setPrevious(prev.computed);
      setTargets(t.items);
      setRankings(r);
    } catch (e: any) {
      setError(e?.message ?? 'Laden fehlgeschlagen');
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); }
  function nextMonth() { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); }

  async function openPreflight(lock: boolean) {
    setBusy('preflight');
    try {
      const pf = await profitAnalysisApi.months.preflight(year, month);
      setPreflight(pf);
      setPreflightLock(lock);
    } catch (e: any) { setError(e?.message ?? 'Preflight fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function confirmClose() {
    if (!preflight) return;
    setBusy('close');
    try {
      await profitAnalysisApi.months.close(year, month, preflightLock);
      setPreflight(null);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Abschluss fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function reopenMonth() {
    if (!confirm('Monat wieder öffnen?')) return;
    setBusy('reopen');
    try {
      await profitAnalysisApi.months.reopen(year, month);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Öffnen fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function download(kind: 'csv' | 'xlsx' | 'pdf') {
    setBusy(kind);
    try {
      const urlPath = kind === 'csv'  ? profitAnalysisApi.months.exportCsvUrl(year, month)
                    : kind === 'xlsx' ? profitAnalysisApi.months.exportXlsxUrl(year, month)
                    :                    profitAnalysisApi.months.exportPdfUrl(year, month);
      const res = await fetch(`${API_URL}${urlPath}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gewinnanalyse-${year}-${String(month).padStart(2, '0')}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.message ?? 'Export fehlgeschlagen'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-lg font-bold text-slate-900 dark:text-white min-w-[180px] text-center tabular-nums">
            {MONTH_LABELS[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => download('csv')}  disabled={busy === 'csv'}  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
            {busy === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
          </button>
          <button onClick={() => download('xlsx')} disabled={busy === 'xlsx'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
            {busy === 'xlsx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Excel
          </button>
          <button onClick={() => download('pdf')}  disabled={busy === 'pdf'}  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
            {busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
          </button>
          {current?.status === 'open' && (
            <button onClick={() => openPreflight(false)} disabled={busy === 'preflight'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Abschließen
            </button>
          )}
          {current?.status === 'closed' && isOwner && (
            <button onClick={() => openPreflight(true)} disabled={busy === 'preflight'} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Sperren
            </button>
          )}
          {(current?.status === 'closed' || current?.status === 'locked') && isOwner && (
            <button onClick={reopenMonth} disabled={busy === 'reopen'} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 text-amber-700 dark:border-amber-500/30 dark:text-amber-400 px-3 py-1.5 text-xs disabled:opacity-50">
              <Unlock className="h-3.5 w-3.5" /> Wieder öffnen
            </button>
          )}
          {current?.status === 'locked' && (
            <div className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-medium">Gesperrt</div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
      ) : current && (
        <>
          {/* Große KPI-Cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <BigKpi
              label="Netto-Umsatz"
              value={formatEur(current.netSalesWithWholesale)}
              delta={deltaPct(current.netSalesWithWholesale, previous?.netSalesWithWholesale)}
              tooltip={{ description: 'Netto-Umsatz aus den drei Kanälen + Großhandel.', formula: 'Shopify + Amazon + TikTok + Großhandel (alle netto)' }}
            />
            <BigKpi
              label="USt aus Verkäufen"
              value={formatEur(current.totals.vatTotal)}
              tooltip={{ description: 'Enthaltene Umsatzsteuer aus erfassten Verkäufen. NICHT die USt-Zahllast — Vorsteuer aus Kosten wird hier nicht gerechnet.', formula: 'USt19 + USt7 aller Kanäle' }}
            />
            <BigKpi
              label="Profit vor GK"
              value={formatEur(current.profitBeforeOverheadWithWholesale)}
              tone={Number(current.profitBeforeOverheadWithWholesale) < 0 ? 'critical' : 'good'}
              delta={deltaPct(current.profitBeforeOverheadWithWholesale, previous?.profitBeforeOverheadWithWholesale)}
              tooltip={{ description: 'Kanal-Profite + Großhandelsgewinn, vor Abzug monatlicher Gemeinkosten.', formula: 'Webshop Profit + Amazon Profit + TikTok Profit + Großhandel Gewinn' }}
            />
            <BigKpi
              label="Gemeinkosten"
              value={formatEur(current.overhead.totalNet)}
              tone="warn"
              tooltip={{ description: 'Summe aller monatlichen Fix- und Betriebskosten (netto).' }}
            />
            <BigKpi
              label="Operativer Monatsgewinn"
              value={formatEur(current.operatingProfit)}
              tone={Number(current.operatingProfit) < 0 ? 'critical' : 'good'}
              delta={deltaPct(current.operatingProfit, previous?.operatingProfit)}
              highlight
              tooltip={{
                description: 'Was nach Abzug der Gemeinkosten übrig bleibt. Die wichtigste Kennzahl des Monats.',
                formula: 'Profit vor Gemeinkosten − Gemeinkosten',
              }}
            />
          </div>

          {/* Mittlere KPIs */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MediumKpi label="Marge vor GK" value={current.totals.marginBeforeOverhead !== null ? formatPercent(current.totals.marginBeforeOverhead) : '—'} tone={marginTone(current.totals.marginBeforeOverhead)} />
            <MediumKpi label="Operative Endmarge" value={current.operatingMargin !== null ? formatPercent(current.operatingMargin) : '—'} tone={marginTone(current.operatingMargin)} highlight />
            <MediumKpi label="Werbekosten" value={formatEur(current.totals.adsTotal)} />
            <MediumKpi label="Großhandelsgewinn" value={formatEur(current.wholesale.totalProfit)} />
          </div>

          {/* Charts mit Widget-Toggle §59 */}
          <ChartsPanel current={current} />


          {/* Ziel-Fortschritt (§63) */}
          <TargetsProgressPanel current={current} targets={targets} />

          {/* Insights */}
          <InsightsPanel current={current} previous={previous} />

          {/* Rankings (§61) */}
          {rankings && rankings.months.length > 1 && (
            <RankingsPanel rankings={rankings} />
          )}
        </>
      )}

      {/* Monatsabschluss-Preflight-Dialog (§73) */}
      {preflight && (
        <PreflightDialog
          preflight={preflight}
          lock={preflightLock}
          onCancel={() => setPreflight(null)}
          onConfirm={confirmClose}
          busy={busy === 'close'}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Charts mit Toggle (§59)
// -----------------------------------------------------------------------------

const CHART_KEYS = [
  { key: 'profit-daily',  label: 'Profit pro Tag' },
  { key: 'revenue-channel', label: 'Umsatz je Kanal' },
  { key: 'cost-breakdown', label: 'Kostenverteilung' },
  { key: 'margin-trend',  label: 'Margen-Verlauf' },
] as const;

function ChartsPanel({ current }: { current: ComputedMonth }) {
  const [active, setActive] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { 'profit-daily': true, 'revenue-channel': true, 'cost-breakdown': false, 'margin-trend': false };
    const stored = localStorage.getItem('pa.charts.active');
    if (stored) try { return JSON.parse(stored); } catch { /* fallthrough */ }
    return { 'profit-daily': true, 'revenue-channel': true, 'cost-breakdown': false, 'margin-trend': false };
  });
  const [showPicker, setShowPicker] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('pa.charts.active', JSON.stringify(active));
  }, [active]);

  const visible = CHART_KEYS.filter((c) => active[c.key]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Diagramme</div>
        <button onClick={() => setShowPicker((v) => !v)} className="text-xs text-amber-600 hover:text-amber-700">
          {showPicker ? 'Fertig' : 'Diagramme wählen'}
        </button>
      </div>
      {showPicker && (
        <div className="rounded-lg border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3 mb-3 flex flex-wrap gap-2">
          {CHART_KEYS.map((c) => (
            <label key={c.key} className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={!!active[c.key]} onChange={(e) => setActive((prev) => ({ ...prev, [c.key]: e.target.checked }))} />
              {c.label}
            </label>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-white/10 p-4 text-xs text-slate-500 text-center">
          Keine Diagramme aktiv. Klicke auf "Diagramme wählen" oben rechts.
        </div>
      ) : (
        <div className={cn('grid gap-4', visible.length === 1 ? 'grid-cols-1' : 'lg:grid-cols-2')}>
          {visible.map((c) => (
            <ChartCard key={c.key} title={c.label} tooltip={chartTooltip(c.key)}>
              <ReactECharts option={chartOption(c.key, current)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
          ))}
        </div>
      )}
    </div>
  );
}

function chartOption(key: string, c: ComputedMonth) {
  if (key === 'profit-daily')    return dailyProfitChart(c);
  if (key === 'revenue-channel') return channelRevenuePie(c);
  if (key === 'cost-breakdown')  return costBreakdownPie(c);
  if (key === 'margin-trend')    return marginTrendChart(c);
  return {};
}
function chartTooltip(key: string): string {
  if (key === 'profit-daily')    return 'Line-Chart des Tages-Profits (nur Kanäle).';
  if (key === 'revenue-channel') return 'Verteilung des Netto-Umsatzes über die drei Kanäle + Großhandel.';
  if (key === 'cost-breakdown')  return 'Produktkosten / Versand / Plattformgebühren / Ads / Gemeinkosten.';
  return 'Tagesmarge über den Monat.';
}

// -----------------------------------------------------------------------------
// Ziel-Progress-Widget (§63)
// -----------------------------------------------------------------------------

function TargetsProgressPanel({ current, targets }: { current: ComputedMonth; targets: TargetItem[] }) {
  const revenueTarget = Number(targets.find((t) => t.key === 'monthly_revenue_target')?.value ?? 0);
  const profitTarget = Number(targets.find((t) => t.key === 'monthly_profit_target')?.value ?? 0);
  const marginTarget = Number(targets.find((t) => t.key === 'margin_target')?.value ?? 30);

  const revenueActual = Number(current.netSalesWithWholesale);
  const profitActual = Number(current.operatingProfit);
  const marginActual = current.operatingMargin !== null ? Number(current.operatingMargin) : null;

  const items = [
    revenueTarget > 0 && { label: 'Umsatzziel', actual: revenueActual, target: revenueTarget, format: (v: number) => formatEur(v.toString()) },
    profitTarget > 0  && { label: 'Gewinnziel', actual: profitActual, target: profitTarget, format: (v: number) => formatEur(v.toString()) },
    marginActual !== null && { label: 'Margenziel', actual: marginActual, target: marginTarget, format: (v: number) => formatPercent(v.toString()) },
  ].filter(Boolean) as Array<{ label: string; actual: number; target: number; format: (v: number) => string }>;

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="text-sm font-semibold mb-3">Ziel-Fortschritt</div>
      <div className="space-y-3">
        {items.map((it) => {
          const pct = it.target > 0 ? Math.max(0, Math.min(100, (it.actual / it.target) * 100)) : 0;
          const reached = pct >= 100;
          return (
            <div key={it.label}>
              <div className="flex justify-between items-baseline text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">{it.label}</span>
                <span className="tabular-nums text-slate-500">
                  {it.format(it.actual)} / {it.format(it.target)} · <span className={cn('font-semibold', reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300')}>{pct.toFixed(0)} %</span>
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', reached ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Rankings-Panel (§61)
// -----------------------------------------------------------------------------

const MONTH_LABEL_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
function monthLabel(m: { year: number; month: number }) { return `${MONTH_LABEL_SHORT[m.month - 1]} ${m.year}`; }

function RankingsPanel({ rankings }: { rankings: RankingsResult }) {
  const cards = [
    { title: 'Bester Umsatzmonat', month: rankings.bestRevenueMonth, value: rankings.bestRevenueMonth?.netSales, format: 'eur' as const, tone: 'good' as const },
    { title: 'Bester Profitmonat', month: rankings.bestProfitMonth, value: rankings.bestProfitMonth?.profit, format: 'eur' as const, tone: 'good' as const },
    { title: 'Beste Marge', month: rankings.bestMarginMonth, value: rankings.bestMarginMonth?.margin, format: 'pct' as const, tone: 'good' as const },
    { title: 'Schlechtester Umsatz', month: rankings.worstRevenueMonth, value: rankings.worstRevenueMonth?.netSales, format: 'eur' as const, tone: 'critical' as const },
    { title: 'Schlechtester Profit', month: rankings.worstProfitMonth, value: rankings.worstProfitMonth?.profit, format: 'eur' as const, tone: 'critical' as const },
    { title: 'Schlechteste Marge', month: rankings.worstMarginMonth, value: rankings.worstMarginMonth?.margin, format: 'pct' as const, tone: 'critical' as const },
  ].filter((c) => c.month);
  if (cards.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="text-sm font-semibold mb-3">Rankings (letzte 12 Monate)</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-lg border border-slate-200 dark:border-white/8 p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{c.title}</div>
            <div className={cn('text-lg font-bold tabular-nums mt-0.5',
              c.tone === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {c.format === 'eur' ? formatEur(c.value as string) : formatPercent(c.value as string)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{monthLabel(c.month!)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Preflight-Dialog (§73)
// -----------------------------------------------------------------------------

function PreflightDialog({ preflight, lock, onCancel, onConfirm, busy }: {
  preflight: PreflightResult; lock: boolean;
  onCancel: () => void; onConfirm: () => void; busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <Lock className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {lock ? 'Monat wirklich sperren?' : 'Monat wirklich abschließen?'}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {lock ? 'Danach kann nur der Owner den Monat wieder öffnen.' : 'Danach ist der Monat für normale Bearbeitung geschlossen. Admin/Owner können weiter bearbeiten.'}
            </div>
          </div>
        </div>

        {/* Zusammenfassung */}
        <div className="rounded-xl border border-slate-200 dark:border-white/8 p-3 mb-4 space-y-1.5 text-sm">
          <SummaryLine label="Tage mit Daten" value={String(preflight.summary.dayCount)} />
          <SummaryLine label="Bruttoumsatz" value={formatEur(preflight.summary.grossSalesTotal)} />
          <SummaryLine label="Nettoumsatz" value={formatEur(preflight.summary.netSalesTotal)} />
          <SummaryLine label="Profit vor Gemeinkosten" value={formatEur(preflight.summary.profitBeforeOverhead)} />
          <SummaryLine label="Operativer Monatsgewinn" value={formatEur(preflight.summary.operatingProfit)} strong />
          <SummaryLine label="Operative Endmarge" value={preflight.summary.operatingMargin !== null ? formatPercent(preflight.summary.operatingMargin) : '—'} strong />
          <SummaryLine label="Großhandelsaufträge" value={String(preflight.summary.wholesaleOrderCount)} />
          <SummaryLine label="Gemeinkosten-Positionen" value={String(preflight.summary.overheadEntryCount)} />
        </div>

        {/* Warnungen */}
        {preflight.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/[0.05] p-3 mb-4">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
              {preflight.warnings.length} Warnung{preflight.warnings.length > 1 ? 'en' : ''} — Abschluss trotzdem möglich
            </div>
            <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc list-inside">
              {preflight.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm text-slate-500 px-3 py-2">Abbrechen</button>
          <button onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Speichert…' : lock ? 'Sperren' : 'Abschließen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-500 dark:text-slate-400 text-xs">{label}</span>
      <span className={cn('tabular-nums text-sm', strong ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300')}>{value}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// KPI-Cards
// -----------------------------------------------------------------------------

function BigKpi({ label, value, tone, delta, tooltip, highlight }: {
  label: string; value: string;
  tone?: 'good' | 'warn' | 'critical'; delta?: number | null; highlight?: boolean;
  tooltip?: { description: string; formula?: string };
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className={cn(
      'rounded-2xl border p-4',
      highlight ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/[0.05]' : 'border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03]',
    )}>
      <div className="flex items-center gap-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
        {tooltip && <InfoTooltip description={tooltip.description} formula={tooltip.formula} />}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums mt-1', toneClass)}>{value}</div>
      {delta !== null && delta !== undefined && Number.isFinite(delta) && (
        <div className={cn('inline-flex items-center gap-1 mt-1 text-xs font-medium',
          delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
          {formatDelta(delta)} vs. Vormonat
        </div>
      )}
    </div>
  );
}

function MediumKpi({ label, value, tone, highlight }: {
  label: string; value: string;
  tone?: 'good' | 'warn' | 'critical' | null; highlight?: boolean;
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className={cn('rounded-xl border p-3',
      highlight ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200 dark:border-white/8',
      'bg-white dark:bg-white/[0.03]')}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', toneClass)}>{value}</div>
    </div>
  );
}

function ChartCard({ title, tooltip, children }: { title: string; tooltip: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-1 mb-2">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        <InfoTooltip description={tooltip} />
      </div>
      {children}
    </div>
  );
}

function InsightsPanel({ current, previous }: { current: ComputedMonth; previous: ComputedMonth | null }) {
  const insights: string[] = [];
  if (previous) {
    const marginNow = current.totals.marginBeforeOverhead;
    const marginBefore = previous.totals.marginBeforeOverhead;
    if (marginNow && marginBefore) {
      const d = Number(marginNow) - Number(marginBefore);
      insights.push(`Die Marge vor Gemeinkosten liegt ${Math.abs(d).toFixed(1)} Prozentpunkte ${d >= 0 ? 'über' : 'unter'} dem Vormonat.`);
    }
    const adsNow = Number(current.totals.adsTotal);
    const adsBefore = Number(previous.totals.adsTotal);
    if (adsBefore > 0) {
      const d = ((adsNow - adsBefore) / adsBefore) * 100;
      insights.push(`Werbekosten sind gegenüber Vormonat um ${Math.abs(d).toFixed(1)} % ${d >= 0 ? 'gestiegen' : 'gefallen'}.`);
    }
  }
  const opMarginNum = current.operatingMargin !== null ? Number(current.operatingMargin) : null;
  const beforeMarginNum = current.totals.marginBeforeOverhead !== null ? Number(current.totals.marginBeforeOverhead) : null;
  if (opMarginNum !== null && beforeMarginNum !== null) {
    const d = beforeMarginNum - opMarginNum;
    if (Math.abs(d) > 0.1) {
      insights.push(`Die operative Endmarge liegt ${d.toFixed(1)} Prozentpunkte unter der Marge vor Gemeinkosten.`);
    }
  }
  if (current.wholesale.orderCount > 0) {
    insights.push(`${current.wholesale.orderCount} Großhandelsauftrag${current.wholesale.orderCount > 1 ? 'e' : ''} tragen ${formatEur(current.wholesale.totalProfit)} zum Gewinn bei.`);
  }
  if (insights.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Insights</div>
      <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
        {insights.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Charts (ECharts option builders)
// -----------------------------------------------------------------------------

function dailyProfitChart(c: ComputedMonth) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
    xAxis: { type: 'category', data: c.days.map((d) => d.date.slice(-2)) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => new Intl.NumberFormat('de-DE').format(v) + ' €' } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      lineStyle: { color: '#F59E0B', width: 2 },
      areaStyle: { color: 'rgba(245,158,11,0.15)' },
      data: c.days.map((d) => Number(d.aggregate.totalProfit)),
    }],
  };
}

function channelRevenuePie(c: ComputedMonth) {
  const shopify = c.days.reduce((a, d) => a + Number(d.shopify.profit.netSales), 0);
  const amazon  = c.days.reduce((a, d) => a + Number(d.amazon.profit.netSales),  0);
  const tiktok  = c.days.reduce((a, d) => a + Number(d.tiktok.profit.netSales),  0);
  const wholesale = Number(c.wholesale.totalNet);
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${new Intl.NumberFormat('de-DE').format(p.value)} € (${p.percent}%)` },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: [
        { value: shopify, name: 'Shopify', itemStyle: { color: '#10B981' } },
        { value: amazon,  name: 'Amazon',  itemStyle: { color: '#F97316' } },
        { value: tiktok,  name: 'TikTok',  itemStyle: { color: '#EC4899' } },
        { value: wholesale, name: 'Großhandel', itemStyle: { color: '#8B5CF6' } },
      ].filter((d) => d.value > 0),
    }],
  };
}

function costBreakdownPie(c: ComputedMonth) {
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${new Intl.NumberFormat('de-DE').format(p.value)} €` },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: [
        { value: Number(c.totals.productCostsTotal), name: 'Produktkosten',        itemStyle: { color: '#6366F1' } },
        { value: Number(c.totals.shippingCostsTotal), name: 'Versand',             itemStyle: { color: '#3B82F6' } },
        { value: Number(c.totals.platformFeesTotal),  name: 'Plattformgebühren',   itemStyle: { color: '#8B5CF6' } },
        { value: Number(c.totals.adsTotal),           name: 'Werbekosten',         itemStyle: { color: '#F59E0B' } },
        { value: Number(c.overhead.totalNet),         name: 'Gemeinkosten',        itemStyle: { color: '#EF4444' } },
      ].filter((d) => d.value > 0),
    }],
  };
}

function marginTrendChart(c: ComputedMonth) {
  return {
    tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].axisValue}: ${params[0].value !== null ? params[0].value.toFixed(2) + ' %' : '—'}` },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: c.days.map((d) => d.date.slice(-2)) },
    yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      lineStyle: { color: '#10B981', width: 2 },
      data: c.days.map((d) => d.aggregate.totalMargin !== null ? Number(d.aggregate.totalMargin) : null),
    }, {
      type: 'line',
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: '#F59E0B', type: 'dashed' },
        data: [{ yAxis: 30 }],
      },
      data: [],
    }],
  };
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function deltaPct(current: string | null | undefined, previous: string | null | undefined): number | null {
  if (!current || !previous) return null;
  const c = Number(current), p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}
function formatDelta(d: number): string { return (d > 0 ? '+' : '') + d.toFixed(1) + ' %'; }
function marginTone(v: string | null | undefined): 'good' | 'warn' | 'critical' | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (n < 20) return 'critical';
  if (n < 25) return 'warn';
  return 'good';
}
