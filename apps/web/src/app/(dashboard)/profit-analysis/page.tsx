'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Loader2, AlertCircle,
  Download, Lock, Unlock, ShoppingBag, Package2, Music2,
} from 'lucide-react';
import { profitAnalysisApi, ComputedMonth } from '@/lib/profit-analysis/api';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, prev] = await Promise.all([
        profitAnalysisApi.daily.getMonth(year, month),
        profitAnalysisApi.daily.getMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
      ]);
      setCurrent(c.computed);
      setPrevious(prev.computed);
    } catch (e: any) {
      setError(e?.message ?? 'Laden fehlgeschlagen');
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); }
  function nextMonth() { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); }

  async function closeMonth(lock: boolean) {
    if (!current) return;
    if (!confirm(lock ? 'Monat sperren? Nur Owner kann wieder öffnen.' : 'Monat abschließen?')) return;
    setBusy('close');
    try {
      await profitAnalysisApi.months.close(year, month, lock);
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
  async function downloadCsv() {
    setBusy('csv');
    try {
      const res = await fetch(`${API_URL}${profitAnalysisApi.months.exportCsvUrl(year, month)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gewinnanalyse-${year}-${String(month).padStart(2, '0')}.csv`;
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
          <button onClick={downloadCsv} disabled={busy === 'csv'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
            {busy === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
          </button>
          {current?.status === 'open' && (
            <button onClick={() => closeMonth(false)} disabled={busy === 'close'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Abschließen
            </button>
          )}
          {current?.status === 'closed' && isOwner && (
            <button onClick={() => closeMonth(true)} disabled={busy === 'close'} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs disabled:opacity-50">
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

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Profit pro Tag" tooltip="Line-Chart des Tages-Profits (nur Kanäle, Großhandel + Gemeinkosten getrennt).">
              <ReactECharts option={dailyProfitChart(current)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
            <ChartCard title="Umsatz je Kanal" tooltip="Verteilung des Netto-Umsatzes über die drei Kanäle + Großhandel.">
              <ReactECharts option={channelRevenuePie(current)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
            <ChartCard title="Kostenverteilung" tooltip="Produktkosten / Versand / Plattformgebühren / Ads / Gemeinkosten.">
              <ReactECharts option={costBreakdownPie(current)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
            <ChartCard title="Marge-Verlauf" tooltip="Tagesmarge über den Monat.">
              <ReactECharts option={marginTrendChart(current)} style={{ height: 260 }} notMerge lazyUpdate />
            </ChartCard>
          </div>

          {/* Insights */}
          <InsightsPanel current={current} previous={previous} />
        </>
      )}
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
