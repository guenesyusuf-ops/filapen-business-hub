'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { salesApi, fmtMoney } from '@/lib/sales';

const MONTH_LABELS_DE = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

interface MonthlyRevenueChartProps {
  /** Jahr das angezeigt wird. Default: aktuelles Jahr. */
  year?: number;
}

export function MonthlyRevenueChart({ year }: MonthlyRevenueChartProps) {
  const targetYear = year ?? new Date().getFullYear();
  const [data, setData] = useState<{
    year: number;
    total: number;
    totalCount: number;
    cogs: number;
    shippingFlatPerOrder: number;
    profit: number;
    totalAllTime: number;
    totalAllTimeCount: number;
    byMonth: Array<{ month: number; revenue: number; orderCount: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    salesApi.yearly(targetYear)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [targetYear]);

  const option = useMemo(() => {
    if (!data) return null;
    const values = data.byMonth.map((m) => m.revenue);
    const counts = data.byMonth.map((m) => m.orderCount);

    // Theme-Farbe via CSS-Var damit die Linie der User-Palette folgt.
    // Im Standard ist das #2C3E50 (Navy), in Mystic dunkles Lila etc.
    // Wir lesen die Var zur Render-Zeit aus dem Root-Style — das ist clientside
    // sicher (Hook läuft erst nach Mount).
    const themeColor = getComputedThemeColor('--accent-2', '#2C3E50');
    const accentSoft = getComputedThemeColor('--accent-1', '#A9C6E0');

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: Array<{ dataIndex: number; data: number; axisValueLabel: string; color: string }>) => {
          const p = params[0];
          if (!p) return '';
          const month = MONTH_LABELS_DE[p.dataIndex];
          const count = counts[p.dataIndex] ?? 0;
          return `<div style="font-weight:600;margin-bottom:4px">${month} ${data.year}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
              <strong>${fmtMoney(p.data)}</strong>
            </div>
            <div style="font-size:11px;opacity:0.7">${count} Bestellung${count === 1 ? '' : 'en'}</div>`;
        },
      },
      grid: { left: '3%', right: '3%', bottom: '8%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: MONTH_LABELS_DE,
        boundaryGap: false,
        axisLabel: { color: '#6b7280', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1000
              ? `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
              : `${v.toLocaleString('de-DE')} €`,
        },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)', type: 'dashed' as const } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: values,
          lineStyle: { width: 2.5, color: themeColor },
          itemStyle: { color: themeColor, borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(themeColor, 0.25) },
                { offset: 1, color: hexToRgba(accentSoft, 0.02) },
              ],
            },
          },
        },
      ],
      animationDuration: 600,
    };
  }, [data]);

  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
      {/* Header — links Title, rechts die Periode-Summe (deine "Top-Summe") */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Bestellungen {targetYear}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Monatlicher Umsatz im Jahresverlauf
          </p>
        </div>
        <div className="text-right">
          <div className="font-display-serif text-3xl font-medium tracking-tight text-gray-900 dark:text-white tabular-nums leading-none">
            {loading ? '—' : fmtMoney(data?.total ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">
            Summe {targetYear} · {data?.totalCount ?? 0} {data?.totalCount === 1 ? 'Bestellung' : 'Bestellungen'}
          </div>
        </div>
      </div>

      {/* Chart */}
      {error ? (
        <div className="h-64 flex items-center justify-center text-sm text-red-600 dark:text-red-400">
          Diagramm konnte nicht geladen werden: {error}
        </div>
      ) : loading || !option ? (
        <div className="h-64 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-theme-2 border-t-transparent" />
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: '280px', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      )}

      {/* Footer — links der Gewinn (Jahr), rechts die Gesamtsumme aller Zeiten.
          Gewinn = Umsatz - COGS (aus Produkt-DB) - 50€ Versand pro Bestellung.
          Tooltip zeigt die Komponenten damit nachvollziehbar bleibt wie der
          Wert zustande kommt. */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 text-xs">
        <div
          className="flex items-center gap-2"
          title={
            data
              ? `Umsatz ${fmtMoney(data.total)} − COGS ${fmtMoney(data.cogs)} − Versand ${fmtMoney(data.totalCount * data.shippingFlatPerOrder)} (${data.totalCount} × ${fmtMoney(data.shippingFlatPerOrder)})`
              : ''
          }
        >
          <span className="text-gray-500 dark:text-gray-400">Gewinn {targetYear}:</span>
          <span
            className={`font-semibold tabular-nums ${
              loading
                ? 'text-gray-400'
                : (data?.profit ?? 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
            }`}
          >
            {loading ? '—' : fmtMoney(data?.profit ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Gesamtsumme aller Bestellungen:</span>
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
            {loading ? '—' : fmtMoney(data?.totalAllTime ?? 0)}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            ({data?.totalAllTimeCount ?? 0})
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Liest eine RGB-Triple-CSS-Var (z.B. "44 62 80") aus :root und gibt sie als
 * Hex zurück. Fallback wenn nicht gesetzt oder serverseitig.
 */
function getComputedThemeColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return fallback;
  const [r, g, b] = parts;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Hex (#rrggbb) → rgba(r,g,b,a). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
