'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Calendar, TrendingUp, TrendingDown, Loader2, AlertCircle,
  Download, Lock, Unlock,
} from 'lucide-react';
import { profitAnalysisApi, ComputedMonth, ComputedDay, TargetItem, RankingsResult, PreflightResult } from '@/lib/profit-analysis/api';
import { formatEur, formatPercent } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { FilapenInsightsPanel } from '@/components/profit-analysis/FilapenInsightsPanel';
import { ChannelBreakdown } from '@/components/profit-analysis/ChannelBreakdown';
import { useAuthStore, getAuthHeaders } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// -----------------------------------------------------------------------------
// Zeitraum-Logik
// -----------------------------------------------------------------------------

type RangeMode = 'today' | 'yesterday' | 'last-7' | 'this-month' | 'last-month' | 'custom';

interface Range {
  mode: RangeMode;
  from: string;
  to: string;
  label: string;
  focusYear: number;    // welcher Monat als "aktueller" gilt fuer close/rankings/overhead
  focusMonth: number;
}

function resolveRange(mode: RangeMode, customFrom?: string, customTo?: string): Range {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayIso = iso(today);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayIso = iso(yesterday);
  const y = today.getFullYear(), m = today.getMonth() + 1;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;

  if (mode === 'today')      return { mode, from: todayIso, to: todayIso, label: 'Heute', focusYear: y, focusMonth: m };
  if (mode === 'yesterday')  return { mode, from: yesterdayIso, to: yesterdayIso, label: 'Gestern', focusYear: yesterday.getFullYear(), focusMonth: yesterday.getMonth() + 1 };
  if (mode === 'last-7') {
    const seven = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { mode, from: iso(seven), to: todayIso, label: 'Letzte 7 Tage', focusYear: y, focusMonth: m };
  }
  if (mode === 'this-month') {
    const first = new Date(Date.UTC(y, m - 1, 1));
    return { mode, from: iso(first), to: todayIso, label: `${MONTH_LABELS[m - 1]} ${y}`, focusYear: y, focusMonth: m };
  }
  if (mode === 'last-month') {
    const first = new Date(Date.UTC(prevY, prevM - 1, 1));
    const last = new Date(Date.UTC(prevY, prevM, 0));
    return { mode, from: iso(first), to: iso(last), label: `${MONTH_LABELS[prevM - 1]} ${prevY}`, focusYear: prevY, focusMonth: prevM };
  }
  const from = customFrom ?? todayIso;
  const to = customTo ?? todayIso;
  const fromD = new Date(from + 'T00:00:00Z');
  return { mode: 'custom', from, to, label: 'Benutzerdefiniert', focusYear: fromD.getUTCFullYear(), focusMonth: fromD.getUTCMonth() + 1 };
}

function monthsInRange(from: string, to: string): Array<{ year: number; month: number }> {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const result: Array<{ year: number; month: number }> = [];
  let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1;
  const endY = end.getUTCFullYear(), endM = end.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    result.push({ year: y, month: m });
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

/** Der Range der GENAU davorliegt (gleich lang), fuer Delta-Vergleich (§15). */
function previousRangeOf(r: Range): { from: string; to: string } {
  const fromD = new Date(r.from + 'T00:00:00Z');
  const toD = new Date(r.to + 'T00:00:00Z');
  const days = Math.round((toD.getTime() - fromD.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const prevTo = new Date(fromD.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

// -----------------------------------------------------------------------------

export default function OverviewPage() {
  const [mode, setMode] = useState<RangeMode>('this-month');
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const range = useMemo(() => resolveRange(mode, customFrom, customTo), [mode, customFrom, customTo]);
  const prevRange = useMemo(() => previousRangeOf(range), [range]);

  const [focusMonth, setFocusMonth] = useState<ComputedMonth | null>(null);
  const [rangeDays, setRangeDays] = useState<ComputedDay[]>([]);
  const [prevRangeDays, setPrevRangeDays] = useState<ComputedDay[]>([]);
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
      const months = monthsInRange(range.from, range.to);
      const prevMonths = monthsInRange(prevRange.from, prevRange.to);
      // Alle 5 Calls einzeln absichern damit wir sehen welcher failt
      const focusRes = await profitAnalysisApi.daily.getMonth(range.focusYear, range.focusMonth)
        .catch((e) => { throw new Error(`Focus-Monat ${range.focusYear}-${range.focusMonth}: ${e?.message ?? e}`); });
      const allRes = await Promise.all(months.map((m, i) =>
        profitAnalysisApi.daily.getMonth(m.year, m.month)
          .catch((e) => { throw new Error(`Range-Monat ${m.year}-${m.month}: ${e?.message ?? e}`); })
      ));
      const allPrevRes = await Promise.all(prevMonths.map((m) =>
        profitAnalysisApi.daily.getMonth(m.year, m.month)
          .catch((e) => { throw new Error(`Vergleichsmonat ${m.year}-${m.month}: ${e?.message ?? e}`); })
      ));
      const t = await profitAnalysisApi.targets.list()
        .catch((e) => { throw new Error(`Ziele laden: ${e?.message ?? e}`); });
      const r = await profitAnalysisApi.rankings.lastMonths(12).catch(() => null);

      setFocusMonth(focusRes.computed);
      const allDays: ComputedDay[] = allRes.flatMap((res) => res.computed.days);
      const allPrevDays: ComputedDay[] = allPrevRes.flatMap((res) => res.computed.days);
      setRangeDays(allDays.filter((d) => d.date >= range.from && d.date <= range.to));
      setPrevRangeDays(allPrevDays.filter((d) => d.date >= prevRange.from && d.date <= prevRange.to));
      setTargets(t.items);
      setRankings(r);
    } catch (e: any) {
      const msg = e?.message ?? 'Laden fehlgeschlagen';
      console.error('[ProfitAnalysis Overview] Load error:', msg, e);
      setError(msg);
    } finally { setLoading(false); }
  }, [range.from, range.to, range.focusYear, range.focusMonth, prevRange.from, prevRange.to]);

  useEffect(() => { load(); }, [load]);

  // Range-Aggregate (§11 weighted ROAS)
  const rangeAgg = useMemo(() => aggregateRange(rangeDays, focusMonth, range), [rangeDays, focusMonth, range]);
  const prevAgg = useMemo(() => aggregateRange(prevRangeDays, null, null), [prevRangeDays]);

  async function openPreflight(lock: boolean) {
    setBusy('preflight');
    try {
      const pf = await profitAnalysisApi.months.preflight(range.focusYear, range.focusMonth);
      setPreflight(pf);
      setPreflightLock(lock);
    } catch (e: any) { setError(e?.message ?? 'Preflight fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function confirmClose() {
    if (!preflight) return;
    setBusy('close');
    try {
      await profitAnalysisApi.months.close(range.focusYear, range.focusMonth, preflightLock);
      setPreflight(null);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Abschluss fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function reopenMonth() {
    if (!confirm('Monat wieder öffnen?')) return;
    setBusy('reopen');
    try {
      await profitAnalysisApi.months.reopen(range.focusYear, range.focusMonth);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Öffnen fehlgeschlagen'); }
    finally { setBusy(null); }
  }
  async function download(kind: 'csv' | 'xlsx' | 'pdf') {
    setBusy(kind);
    try {
      const urlPath = kind === 'csv'  ? profitAnalysisApi.months.exportCsvUrl(range.focusYear, range.focusMonth)
                    : kind === 'xlsx' ? profitAnalysisApi.months.exportXlsxUrl(range.focusYear, range.focusMonth)
                    :                    profitAnalysisApi.months.exportPdfUrl(range.focusYear, range.focusMonth);
      const res = await fetch(`${API_URL}${urlPath}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gewinnanalyse-${range.focusYear}-${String(range.focusMonth).padStart(2, '0')}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.message ?? 'Export fehlgeschlagen'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      {/* Header — zentraler Zeitraum-Umschalter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-5 w-5 text-amber-500" />
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{range.label}</div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {range.from === range.to ? formatDateShort(range.from) : `${formatDateShort(range.from)} – ${formatDateShort(range.to)}`}
          </span>
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
          {focusMonth?.status === 'open' && (
            <button onClick={() => openPreflight(false)} disabled={busy === 'preflight'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Monat abschließen
            </button>
          )}
          {focusMonth?.status === 'closed' && isOwner && (
            <button onClick={() => openPreflight(true)} disabled={busy === 'preflight'} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Sperren
            </button>
          )}
          {(focusMonth?.status === 'closed' || focusMonth?.status === 'locked') && isOwner && (
            <button onClick={reopenMonth} disabled={busy === 'reopen'} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 text-amber-700 dark:border-amber-500/30 dark:text-amber-400 px-3 py-1.5 text-xs disabled:opacity-50">
              <Unlock className="h-3.5 w-3.5" /> Öffnen
            </button>
          )}
          {focusMonth?.status === 'locked' && (
            <div className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-medium">Gesperrt</div>
          )}
        </div>
      </div>

      {/* Zeitraum-Presets */}
      <div className="flex flex-wrap gap-1.5">
        <RangeButton active={mode === 'today'}      onClick={() => setMode('today')}>Heute</RangeButton>
        <RangeButton active={mode === 'yesterday'}  onClick={() => setMode('yesterday')}>Gestern</RangeButton>
        <RangeButton active={mode === 'last-7'}     onClick={() => setMode('last-7')}>Letzte 7 Tage</RangeButton>
        <RangeButton active={mode === 'this-month'} onClick={() => setMode('this-month')}>Dieser Monat</RangeButton>
        <RangeButton active={mode === 'last-month'} onClick={() => setMode('last-month')}>Letzter Monat</RangeButton>
        <RangeButton active={mode === 'custom'}     onClick={() => setMode('custom')}>Benutzerdefiniert</RangeButton>
        {mode === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} max={customTo}
              className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs" />
            <span className="text-xs text-slate-500">bis</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom}
              className="rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
      ) : (
        <>
          {/* Große KPI-Cards — alle auf Range basiert */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <BigKpi
              label="Netto-Umsatz"
              value={formatEur(rangeAgg.netSalesTotal)}
              delta={deltaPct(rangeAgg.netSalesTotal, prevAgg.netSalesTotal)}
              tooltip={{ description: 'Netto-Umsatz aller Kanäle im gewählten Zeitraum.', formula: 'Σ (Shopify + Amazon + TikTok) netto' }}
            />
            <BigKpi
              label="USt aus Verkäufen"
              value={formatEur(rangeAgg.vatTotal)}
              tooltip={{ description: 'Enthaltene Umsatzsteuer im Zeitraum. Nicht USt-Zahllast.', formula: 'Σ USt19 + Σ USt7' }}
            />
            <BigKpi
              label="Profit vor GK"
              value={formatEur(rangeAgg.profitBeforeOverhead)}
              tone={rangeAgg.profitBeforeOverhead < 0 ? 'critical' : 'good'}
              delta={deltaPct(rangeAgg.profitBeforeOverhead, prevAgg.profitBeforeOverhead)}
              tooltip={{ description: 'Kanal-Profite im Zeitraum, vor Gemeinkosten.', formula: 'Σ Webshop + Amazon + TikTok Profit' }}
            />
            <BigKpi
              label={rangeAgg.overheadPortion < rangeAgg.overheadFull ? 'Gemeinkosten (anteilig)' : 'Gemeinkosten'}
              value={formatEur(rangeAgg.overheadPortion)}
              tone="warn"
              tooltip={{
                description: rangeAgg.overheadPortion < rangeAgg.overheadFull
                  ? `Anteil der Monats-Gemeinkosten für den gewählten Zeitraum (${rangeAgg.rangeDays} von ${rangeAgg.monthDays} Tagen).`
                  : 'Summe der monatlichen Gemeinkosten des Focus-Monats.',
                formula: rangeAgg.overheadPortion < rangeAgg.overheadFull
                  ? 'Monats-Gemeinkosten × (Tage im Zeitraum / Tage im Monat)'
                  : 'Σ aller Gemeinkosten-Positionen (netto)',
              }}
            />
            <BigKpi
              label="Operativer Gewinn"
              value={formatEur(rangeAgg.operatingProfit)}
              tone={rangeAgg.operatingProfit < 0 ? 'critical' : 'good'}
              delta={deltaPct(rangeAgg.operatingProfit, prevAgg.operatingProfit)}
              highlight
              tooltip={{
                description: 'Profit vor Gemeinkosten − anteilige Gemeinkosten.',
                formula: 'Profit vor GK − Gemeinkosten (anteilig)',
              }}
            />
          </div>

          {/* Filapen Insights — bleiben */}
          <FilapenInsightsPanel />

          {/* Mittlere KPIs */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MediumKpi label="Marge vor GK" value={rangeAgg.marginBeforeOverhead !== null ? formatPercent(rangeAgg.marginBeforeOverhead) : '—'} tone={marginTone(rangeAgg.marginBeforeOverhead)} />
            <MediumKpi label="Operative Endmarge" value={rangeAgg.operatingMargin !== null ? formatPercent(rangeAgg.operatingMargin) : '—'} tone={marginTone(rangeAgg.operatingMargin)} highlight />
            <MediumKpi label="Werbekosten" value={formatEur(rangeAgg.adsTotal)} />
            <MediumKpi label="Großhandelsgewinn" value={formatEur(rangeAgg.wholesaleProfit)} />
          </div>

          {/* Kanal-Kacheln + Bar-Chart Gewinn pro Kanal */}
          <ChannelBreakdown days={rangeDays} />

          {/* Zeitreihen-Charts */}
          <ChartsPanel days={rangeDays} overheadTotal={rangeAgg.overheadPortion} />

          {/* Ziel-Fortschritt (skaliert auf Zeitraum wenn nicht Monatsansicht) */}
          {focusMonth && <TargetsProgressPanel rangeAgg={rangeAgg} targets={targets} />}

          {/* Rankings */}
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

function ChartsPanel({ days, overheadTotal }: { days: ComputedDay[]; overheadTotal: number }) {
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
              <ReactECharts option={chartOption(c.key, days, overheadTotal)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
          ))}
        </div>
      )}
    </div>
  );
}

function chartOption(key: string, days: ComputedDay[], overheadTotal: number) {
  if (key === 'profit-daily')    return dailyProfitChart(days);
  if (key === 'revenue-channel') return channelRevenuePie(days);
  if (key === 'cost-breakdown')  return costBreakdownPie(days, overheadTotal);
  if (key === 'margin-trend')    return marginTrendChart(days);
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

function TargetsProgressPanel({ rangeAgg, targets }: { rangeAgg: RangeAggregate; targets: TargetItem[] }) {
  const revenueTarget = Number(targets.find((t) => t.key === 'monthly_revenue_target')?.value ?? 0);
  const profitTarget = Number(targets.find((t) => t.key === 'monthly_profit_target')?.value ?? 0);
  const marginTarget = Number(targets.find((t) => t.key === 'margin_target')?.value ?? 30);

  // Zielwerte sind monatlich definiert → anteilig fuer den Zeitraum
  const scale = rangeAgg.rangeDays / rangeAgg.monthDays;
  const scaledRevenueTarget = revenueTarget * scale;
  const scaledProfitTarget = profitTarget * scale;

  const revenueActual = rangeAgg.netSalesTotal;
  const profitActual = rangeAgg.operatingProfit;
  const marginActual = rangeAgg.operatingMargin;

  const isFullMonth = rangeAgg.rangeDays === rangeAgg.monthDays;
  const items = [
    scaledRevenueTarget > 0 && { label: isFullMonth ? 'Umsatzziel' : `Umsatzziel (anteilig ${rangeAgg.rangeDays}/${rangeAgg.monthDays} T)`, actual: revenueActual, target: scaledRevenueTarget, format: (v: number) => formatEur(v.toString()) },
    scaledProfitTarget > 0  && { label: isFullMonth ? 'Gewinnziel' : `Gewinnziel (anteilig ${rangeAgg.rangeDays}/${rangeAgg.monthDays} T)`, actual: profitActual, target: scaledProfitTarget, format: (v: number) => formatEur(v.toString()) },
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

function dailyProfitChart(days: ComputedDay[]) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
    xAxis: { type: 'category', data: days.map((d) => d.date.slice(-5)) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => new Intl.NumberFormat('de-DE').format(v) + ' €' } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      lineStyle: { color: '#F59E0B', width: 2 },
      areaStyle: { color: 'rgba(245,158,11,0.15)' },
      data: days.map((d) => Number(d.aggregate.totalProfit)),
    }],
  };
}

function channelRevenuePie(days: ComputedDay[]) {
  const shopify = days.reduce((a, d) => a + Number(d.shopify.profit.netSales), 0);
  const amazon  = days.reduce((a, d) => a + Number(d.amazon.profit.netSales),  0);
  const tiktok  = days.reduce((a, d) => a + Number(d.tiktok.profit.netSales),  0);
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${new Intl.NumberFormat('de-DE').format(p.value)} € (${p.percent}%)` },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: [
        { value: shopify, name: 'Shopify', itemStyle: { color: '#10B981' } },
        { value: amazon,  name: 'Amazon',  itemStyle: { color: '#F97316' } },
        { value: tiktok,  name: 'TikTok',  itemStyle: { color: '#EC4899' } },
      ].filter((d) => d.value > 0),
    }],
  };
}

function costBreakdownPie(days: ComputedDay[], overheadTotal: number) {
  const products = days.reduce((a, d) => a + Number(d.shopify.profit.productCosts) + Number(d.amazon.profit.productCosts) + Number(d.tiktok.profit.productCosts), 0);
  const shipping = days.reduce((a, d) => a + Number(d.shopify.profit.shippingCosts) + Number(d.amazon.profit.shippingCosts) + Number(d.tiktok.profit.shippingCosts), 0);
  const fees     = days.reduce((a, d) => a + Number(d.shopify.profit.platformFees) + Number(d.amazon.profit.platformFees) + Number(d.tiktok.profit.platformFees), 0);
  const ads      = days.reduce((a, d) => a + Number(d.shopify.profit.adsAttributed) + Number(d.amazon.profit.adsAttributed) + Number(d.tiktok.profit.adsAttributed), 0);
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${new Intl.NumberFormat('de-DE').format(p.value)} €` },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: [
        { value: products,      name: 'Produktkosten',      itemStyle: { color: '#6366F1' } },
        { value: shipping,      name: 'Versand',            itemStyle: { color: '#3B82F6' } },
        { value: fees,          name: 'Plattformgebühren',  itemStyle: { color: '#8B5CF6' } },
        { value: ads,           name: 'Werbekosten',        itemStyle: { color: '#F59E0B' } },
        { value: overheadTotal, name: 'Gemeinkosten',       itemStyle: { color: '#EF4444' } },
      ].filter((d) => d.value > 0),
    }],
  };
}

function marginTrendChart(days: ComputedDay[]) {
  return {
    tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].axisValue}: ${params[0].value !== null ? params[0].value.toFixed(2) + ' %' : '—'}` },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: days.map((d) => d.date.slice(-5)) },
    yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      lineStyle: { color: '#10B981', width: 2 },
      data: days.map((d) => d.aggregate.totalMargin !== null ? Number(d.aggregate.totalMargin) : null),
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
// Range-Aggregation + Helpers
// -----------------------------------------------------------------------------

interface RangeAggregate {
  netSalesTotal: number;
  vatTotal: number;
  adsTotal: number;
  profitBeforeOverhead: number;    // Kanal-Profite Summe (aus rangeDays)
  wholesaleProfit: number;         // aus focusMonth (anteilig)
  overheadFull: number;            // Monats-Gemeinkosten
  overheadPortion: number;         // anteilig fuer rangeDays
  operatingProfit: number;         // Profit vor GK − Gemeinkosten (anteilig)
  marginBeforeOverhead: number | null;
  operatingMargin: number | null;
  rangeDays: number;
  monthDays: number;
}

function aggregateRange(days: ComputedDay[], focusMonth: ComputedMonth | null, range: Range | null): RangeAggregate {
  let netSales = 0, vat = 0, ads = 0, profitBeforeGK = 0;
  for (const d of days) {
    netSales += Number(d.aggregate.totalNetSales);
    profitBeforeGK += Number(d.aggregate.totalProfit);
    ads += Number(d.shopify.profit.adsAttributed) + Number(d.amazon.profit.adsAttributed) + Number(d.tiktok.profit.adsAttributed);
    vat += Number(d.shopify.vat.vatTotal) + Number(d.amazon.vat.vatTotal) + Number(d.tiktok.vat.vatTotal);
  }
  const overheadFull = focusMonth ? Number(focusMonth.overhead.totalNet) : 0;
  const wholesaleProfitFull = focusMonth ? Number(focusMonth.wholesale.totalProfit) : 0;
  const rangeDays = days.length;
  const monthDays = focusMonth?.days.length || rangeDays || 1;
  const scale = monthDays > 0 ? rangeDays / monthDays : 0;
  const overheadPortion = overheadFull * scale;
  const wholesaleProfit = wholesaleProfitFull * scale;
  const totalProfitBeforeGK = profitBeforeGK + wholesaleProfit;
  const operatingProfit = totalProfitBeforeGK - overheadPortion;
  return {
    netSalesTotal: netSales,
    vatTotal: vat,
    adsTotal: ads,
    profitBeforeOverhead: totalProfitBeforeGK,
    wholesaleProfit,
    overheadFull,
    overheadPortion,
    operatingProfit,
    marginBeforeOverhead: netSales > 0 ? (totalProfitBeforeGK / netSales) * 100 : null,
    operatingMargin: netSales > 0 ? (operatingProfit / netSales) * 100 : null,
    rangeDays,
    monthDays,
  };
}

function RangeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('px-3 py-1.5 text-xs rounded-md whitespace-nowrap',
        active ? 'bg-amber-500 text-white font-semibold'
          : 'text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5')}>
      {children}
    </button>
  );
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function deltaPct(current: string | number | null | undefined, previous: string | number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const c = Number(current), p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}
function formatDelta(d: number): string { return (d > 0 ? '+' : '') + d.toFixed(1) + ' %'; }
function marginTone(v: string | number | null | undefined): 'good' | 'warn' | 'critical' | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 20) return 'critical';
  if (n < 25) return 'warn';
  return 'good';
}
