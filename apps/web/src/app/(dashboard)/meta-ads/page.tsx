'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { fmtEur, fmtInt, fmtRoas, fmtPct } from '@/components/meta-ads/format';
import { useMetaOverview } from '@/hooks/meta-ads/useMetaAds';

const CARD = 'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card';

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn(CARD, 'p-4')}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-white/40">{label}</div>
      <div className={cn('mt-1.5 text-2xl font-semibold tabular-nums', accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{hint}</div>}
    </div>
  );
}

export default function MetaAdsOverviewPage() {
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const { data, isLoading, isError } = useMetaOverview(controls);
  const k = data?.kpis;
  const c = data?.counts;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Meta Ads</h1>
          <span className="rounded-full bg-accent-meta/10 px-2 py-0.5 text-xs font-medium text-accent-meta">Creative Intelligence</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/50">
          Performance-Überblick. Hyros ROAS ist der führende ROAS — über Zeiträume wird er nicht gemittelt.
        </p>
      </header>

      <MetaControls value={controls} onChange={setControls} />

      {isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6 text-center text-sm text-red-700 dark:text-red-400">
          Daten konnten nicht geladen werden.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn(CARD, 'h-[88px] animate-pulse bg-gray-50 dark:bg-white/5')} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi label="Spend" value={fmtEur(k?.spend ?? 0)} />
            <Kpi label="Impressionen" value={fmtInt(k?.impressions ?? 0)} />
            <Kpi label="Unique Sales" value={fmtInt(k?.uniqueSales ?? 0)} />
            <Kpi label="Sales gesamt" value={fmtInt(k?.totalSales ?? 0)} />
            <Kpi label="Umsatz (Hyros)" value={fmtEur(k?.revenue ?? 0)} />
            <Kpi label="Hyros ROAS" value="—" hint="pro Tag/Ad — nicht aggregierbar" />
            <Kpi label="Berechneter ROAS" value={fmtRoas(k?.calculatedRoas)} hint="Umsatz ÷ Spend" accent />
            <Kpi label="CPA Unique" value={fmtEur(k?.cpaUnique)} />
            <Kpi label="CPA Gesamt" value={fmtEur(k?.cpaTotal)} />
            <Kpi label="Hook Rate" value={fmtPct(k?.hookRate)} hint="gewichtet n. Impressionen" />
            <Kpi label="Hold Rate" value={fmtPct(k?.holdRate)} hint="gewichtet n. Impressionen" />
            <Kpi label="CTR (Alle)" value={fmtPct(k?.ctrAll)} hint="gewichtet n. Impressionen" />
          </div>

          <section className={cn(CARD, 'p-4')}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ads</h2>
              <Link href="/meta-ads/ads" className="text-xs font-medium text-accent-meta hover:underline">
                Alle Ads ansehen →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Count label="Gesamt" value={c?.totalAds ?? 0} />
              <Count label="Aktiv" value={c?.active ?? 0} />
              <Count label="Pausiert" value={c?.paused ?? 0} />
              <Count label="Entwurf" value={c?.draft ?? 0} />
              <Count label="Beendet" value={c?.ended ?? 0} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-white/50">{label}</div>
    </div>
  );
}
