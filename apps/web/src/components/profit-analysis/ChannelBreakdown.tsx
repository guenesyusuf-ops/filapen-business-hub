'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ShoppingBag, Package2, Music2, TrendingUp } from 'lucide-react';
import { ComputedDay } from '@/lib/profit-analysis/api';
import { formatEur, formatPercent } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

/**
 * Uebersicht — Kanal-Breakdown fuer einen bereits gefilterten Range.
 * Bekommt die Days per Prop, aggregiert kanalweise und rendert Kacheln + Chart.
 *
 * §11 Zeitraum-ROAS = Sum(Umsatz) / Sum(Ads), NIE Durchschnitt der Tages-ROAS.
 */

interface ChannelAgg {
  gross: number;
  net: number;
  costs: number;
  profit: number;
  ads: number;
  margin: number | null;
  roasNet: number | null;
  roasGross: number | null;
}

export function ChannelBreakdown({ days }: { days: ComputedDay[] }) {
  const agg = useMemo(() => aggregateChannels(days), [days]);

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Kanäle im Zeitraum</div>
        <InfoTooltip description="Aggregierte Kennzahlen pro Verkaufskanal im gewählten Zeitraum. ROAS = Summe Umsatz / Summe Ads (nicht Durchschnitt der Tages-ROAS)." />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ChannelCard title="Shopify" color="emerald" Icon={ShoppingBag} data={agg.shopify} />
        <ChannelCard title="Amazon"  color="orange"  Icon={Package2}    data={agg.amazon}  />
        <ChannelCard title="TikTok"  color="pink"    Icon={Music2}      data={agg.tiktok}  />
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gewinn pro Kanal</div>
          <InfoTooltip description="Absoluter Profit je Kanal im gewählten Zeitraum." />
        </div>
        <ReactECharts option={buildProfitBarChart(agg)} style={{ height: 220 }} notMerge lazyUpdate />
      </div>
    </div>
  );
}

function ChannelCard({ title, color, Icon, data }: {
  title: string; color: 'emerald' | 'orange' | 'pink'; Icon: any; data: ChannelAgg;
}) {
  const accentBg = color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : color === 'orange' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
    : 'bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400';
  const profitClass = data.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
  const marginClass = data.margin === null ? 'text-slate-500'
    : data.margin < 20 ? 'text-red-600 dark:text-red-400'
    : data.margin < 25 ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/8 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('inline-flex h-7 w-7 rounded-lg items-center justify-center', accentBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
      </div>
      <dl className="space-y-1.5 text-xs">
        <Row label="Brutto-Umsatz" value={formatEur(data.gross)} />
        <Row label="Kosten"        value={formatEur(data.costs)} className="text-slate-600 dark:text-slate-300" />
        <Row label="Gewinn"        value={formatEur(data.profit)} className={cn('font-bold', profitClass)} />
        <Row label="Marge"         value={data.margin !== null ? formatPercent(data.margin) : '—'} className={cn('font-semibold', marginClass)} />
        <Row label="Netto-ROAS"    value={data.roasNet !== null ? data.roasNet.toFixed(2).replace('.', ',') + '×' : '—'} />
      </dl>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={cn('tabular-nums text-slate-900 dark:text-white', className)}>{value}</dd>
    </div>
  );
}

function aggregateChannels(days: ComputedDay[]): { shopify: ChannelAgg; amazon: ChannelAgg; tiktok: ChannelAgg } {
  const empty = (): ChannelAgg => ({ gross: 0, net: 0, costs: 0, profit: 0, ads: 0, margin: null, roasNet: null, roasGross: null });
  const shopify = empty(), amazon = empty(), tiktok = empty();
  for (const d of days) {
    shopify.gross  += Number(d.shopify.vat.grossAdjusted);
    shopify.net    += Number(d.shopify.profit.netSales);
    shopify.profit += Number(d.shopify.profit.profit);
    shopify.ads    += Number(d.shopify.profit.adsAttributed);
    amazon.gross   += Number(d.amazon.vat.grossAdjusted);
    amazon.net     += Number(d.amazon.profit.netSales);
    amazon.profit  += Number(d.amazon.profit.profit);
    amazon.ads     += Number(d.amazon.profit.adsAttributed);
    tiktok.gross   += Number(d.tiktok.vat.grossAdjusted);
    tiktok.net     += Number(d.tiktok.profit.netSales);
    tiktok.profit  += Number(d.tiktok.profit.profit);
    tiktok.ads     += Number(d.tiktok.profit.adsAttributed);
  }
  for (const c of [shopify, amazon, tiktok]) {
    c.costs = c.net - c.profit;
    c.margin = c.net > 0 ? (c.profit / c.net) * 100 : null;
    c.roasNet = c.ads > 0 ? c.net / c.ads : null;
    c.roasGross = c.ads > 0 ? c.gross / c.ads : null;
  }
  return { shopify, amazon, tiktok };
}

function buildProfitBarChart(agg: { shopify: ChannelAgg; amazon: ChannelAgg; tiktok: ChannelAgg }) {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        return `${p.axisValue}<br/><b>${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.value)}</b>`;
      },
    },
    grid: { top: 30, right: 20, bottom: 30, left: 70 },
    xAxis: { type: 'category', data: ['Shopify', 'Amazon', 'TikTok'] },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => new Intl.NumberFormat('de-DE').format(v) + ' €' } },
    series: [{
      type: 'bar', barMaxWidth: 80,
      data: [
        { value: agg.shopify.profit, itemStyle: { color: agg.shopify.profit < 0 ? '#DC2626' : '#10B981' } },
        { value: agg.amazon.profit,  itemStyle: { color: agg.amazon.profit  < 0 ? '#DC2626' : '#F97316' } },
        { value: agg.tiktok.profit,  itemStyle: { color: agg.tiktok.profit  < 0 ? '#DC2626' : '#EC4899' } },
      ],
      label: {
        show: true, position: 'top',
        formatter: (params: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(params.value),
      },
    }],
  };
}
