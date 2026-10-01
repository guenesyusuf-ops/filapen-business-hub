'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, Euro, TrendingUp, Target, Users, Eye, MousePointerClick, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaSectionHeader, MetaKpiCard, MetaEmptyState, META_CARD } from '@/components/meta-ads/MetaUI';
import { fmtEur, fmtInt, fmtRoas, fmtPct, fmtSeconds } from '@/components/meta-ads/format';
import { useMetaOverview } from '@/hooks/meta-ads/useMetaAds';

export default function MetaAdsOverviewPage() {
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const { data, isLoading, isError } = useMetaOverview(controls);
  const k = data?.kpis;
  const c = data?.counts;
  const hasAds = (c?.totalAds ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <MetaPageHeader
        eyebrow="Creative Intelligence"
        title="Meta Ads"
        description="Performance-Überblick. Hyros ROAS ist der führende ROAS — über Zeiträume wird er nicht gemittelt."
        actions={
          <>
            <Link href="/meta-ads/import" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-600 hover:border-accent-meta/40 hover:text-accent-meta dark:text-white/70">
              <Upload className="h-4 w-4" /> Import
            </Link>
            <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Ads
            </Link>
          </>
        }
      >
        <MetaControls value={controls} onChange={setControls} />
      </MetaPageHeader>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          Daten konnten nicht geladen werden.
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : !hasAds ? (
        <MetaEmptyState
          icon={Megaphone}
          title="Noch keine Ads vorhanden"
          description="Lege deine erste Ad an oder importiere einen Meta-/Hyros-Report, um Performance zu sehen."
          actions={
            <>
              <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
                <Plus className="h-4 w-4" /> Ad hinzufügen
              </Link>
              <Link href="/meta-ads/import" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:border-accent-meta/40 hover:text-accent-meta">
                <Upload className="h-4 w-4" /> Daten importieren
              </Link>
            </>
          }
        />
      ) : (
        <>
          {/* Performance */}
          <section className="flex flex-col gap-3">
            <MetaSectionHeader title="Performance" description="Aggregiert über den gewählten Zeitraum" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetaKpiCard variant="hero" label="Spend" value={fmtEur(k?.spend ?? 0)} icon={Euro} />
              <MetaKpiCard variant="hero" label="Umsatz (Hyros)" value={fmtEur(k?.revenue ?? 0)} icon={TrendingUp} />
              <MetaKpiCard variant="hero" label="Berechneter ROAS" value={fmtRoas(k?.calculatedRoas)} sub="Umsatz ÷ Spend" accent icon={TrendingUp} />
              <MetaKpiCard variant="hero" label="CPA Unique" value={fmtEur(k?.cpaUnique)} icon={Target} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetaKpiCard label="Impressionen" value={fmtInt(k?.impressions ?? 0)} icon={Eye} />
              <MetaKpiCard label="Unique Sales" value={fmtInt(k?.uniqueSales ?? 0)} icon={Users} />
              <MetaKpiCard label="Sales gesamt" value={fmtInt(k?.totalSales ?? 0)} icon={Users} />
              <MetaKpiCard label="CPA Gesamt" value={fmtEur(k?.cpaTotal)} icon={Target} />
              <MetaKpiCard label="Hyros ROAS" value="—" sub="pro Tag/Ad" title="Hyros ROAS wird über Zeiträume nicht gemittelt — siehe Ad-Detail pro Tag." />
            </div>
          </section>

          {/* Creative Signals */}
          <section className="flex flex-col gap-3">
            <MetaSectionHeader title="Creative Signals" description="Aufmerksamkeit & Traffic — gewichtet nach Impressionen" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetaKpiCard label="Hook Rate" value={fmtPct(k?.hookRate)} icon={MousePointerClick} />
              <MetaKpiCard label="Hold Rate" value={fmtPct(k?.holdRate)} icon={MousePointerClick} />
              <MetaKpiCard label="CTR (Alle)" value={fmtPct(k?.ctrAll)} icon={MousePointerClick} />
              <MetaKpiCard label="Ausgehende CTR" value={fmtPct(k?.outboundCtr)} icon={MousePointerClick} />
              <MetaKpiCard label="Ø Wiedergabe" value={fmtSeconds(k?.averageWatchTimeSeconds)} icon={Eye} />
            </div>
          </section>

          {/* Ads */}
          <section className="flex flex-col gap-3">
            <MetaSectionHeader
              title="Ads"
              count={c?.totalAds}
              action={<Link href="/meta-ads/ads" className="text-xs font-medium text-accent-meta hover:underline">Alle Ads ansehen →</Link>}
            />
            <div className={cn(META_CARD, 'grid grid-cols-2 gap-px overflow-hidden bg-gray-100 dark:bg-white/8 sm:grid-cols-3 lg:grid-cols-5')}>
              <Count label="Gesamt" value={c?.totalAds ?? 0} />
              <Count label="Aktiv" value={c?.active ?? 0} tone="green" />
              <Count label="Pausiert" value={c?.paused ?? 0} tone="amber" />
              <Count label="Entwurf" value={c?.draft ?? 0} tone="blue" />
              <Count label="Beendet" value={c?.ended ?? 0} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' | 'blue' }) {
  const dot = tone === 'green' ? 'bg-green-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/20';
  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3.5 dark:bg-[var(--card-bg)]">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
        <span className="text-xs text-gray-500 dark:text-white/50">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn(META_CARD, 'h-[104px] animate-pulse bg-gray-50 dark:bg-white/5')} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn(META_CARD, 'h-[72px] animate-pulse bg-gray-50 dark:bg-white/5')} />)}
      </div>
    </div>
  );
}
