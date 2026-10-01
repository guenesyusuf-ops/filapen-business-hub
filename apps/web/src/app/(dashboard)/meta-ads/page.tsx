'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import {
  MetaPageHeader, MetaDivider, MetaSectionLabel, MetaMetricStrip, MetaSubMetrics,
  MetaEmptyState, MetaStatus, META_FRAME, btnPrimary, btnGhost,
} from '@/components/meta-ads/MetaUI';
import { fmtEur, fmtInt, fmtRoas, fmtPct, fmtSeconds } from '@/components/meta-ads/format';
import { useMetaOverview, useMetaAdsList } from '@/hooks/meta-ads/useMetaAds';

export default function MetaAdsOverviewPage() {
  const router = useRouter();
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const { data, isLoading, isError } = useMetaOverview(controls);
  const recent = useMetaAdsList({ productGroupId: controls.productGroupId, range: controls.range, start: controls.start, end: controls.end, page: 1, pageSize: 6 });
  const k = data?.kpis;
  const c = data?.counts;
  const hasAds = (c?.totalAds ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 p-4 sm:p-7">
      <MetaPageHeader
        eyebrow="Meta Ads"
        title="Creative Performance & Intelligence"
        description="Hyros ROAS ist der führende ROAS — über Zeiträume nicht gemittelt."
        actions={<>
          <Link href="/meta-ads/import" className={btnGhost}><Upload className="h-4 w-4" /> Import</Link>
          <Link href="/meta-ads/ads" className={btnPrimary}><Plus className="h-4 w-4" /> Neue Ad</Link>
        </>}
      >
        <MetaControls value={controls} onChange={setControls} />
      </MetaPageHeader>

      {isError ? (
        <div className="rounded-[11px] border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">Daten konnten nicht geladen werden.</div>
      ) : isLoading ? (
        <div className={cn(META_FRAME, 'h-[108px] animate-pulse bg-gray-50 dark:bg-white/5')} />
      ) : !hasAds ? (
        <div className={META_FRAME}>
          <MetaEmptyState icon={Megaphone} title="Noch keine Ads vorhanden"
            description="Lege deine erste Ad an oder importiere einen Meta-/Hyros-Report, um Performance zu sehen."
            actions={<>
              <Link href="/meta-ads/ads" className={btnPrimary}><Plus className="h-4 w-4" /> Ad hinzufügen</Link>
              <Link href="/meta-ads/import" className={btnGhost}><Upload className="h-4 w-4" /> Daten importieren</Link>
            </>} />
        </div>
      ) : (
        <>
          {/* Performance */}
          <section className="flex flex-col gap-4">
            <MetaMetricStrip size="lg" items={[
              { label: 'Spend', value: fmtEur(k?.spend ?? 0) },
              { label: 'Umsatz (Hyros)', value: fmtEur(k?.revenue ?? 0) },
              { label: 'Berechneter ROAS', value: fmtRoas(k?.calculatedRoas), sub: 'Umsatz ÷ Spend', accent: true },
              { label: 'CPA Unique', value: fmtEur(k?.cpaUnique) },
              { label: 'Unique Sales', value: fmtInt(k?.uniqueSales ?? 0) },
            ]} />
            <MetaSubMetrics items={[
              { label: 'Impressionen', value: fmtInt(k?.impressions ?? 0) },
              { label: 'Sales gesamt', value: fmtInt(k?.totalSales ?? 0) },
              { label: 'CPA Gesamt', value: fmtEur(k?.cpaTotal) },
              { label: 'Hook Rate', value: fmtPct(k?.hookRate) },
              { label: 'Hold Rate', value: fmtPct(k?.holdRate) },
              { label: 'Ausg. CTR', value: fmtPct(k?.outboundCtr) },
              { label: 'Ø Wiedergabe', value: fmtSeconds(k?.averageWatchTimeSeconds) },
              { label: 'Hyros ROAS', value: '—', title: 'Hyros ROAS wird über Zeiträume nicht gemittelt — pro Tag im Ad-Detail.' },
            ]} />
          </section>

          <MetaDivider />

          {/* Ads nach Status */}
          <section className="flex flex-col gap-3.5">
            <MetaSectionLabel>Ads nach Status</MetaSectionLabel>
            <div className="flex flex-wrap gap-2.5">
              {[['Aktiv', c?.active, 'active'], ['Pausiert', c?.paused, 'paused'], ['Entwurf', c?.draft, 'draft'], ['Beendet', c?.ended, 'ended']].map(([lab, n, st]) => (
                <div key={lab as string} className="flex items-center gap-2.5 rounded-[9px] border border-gray-200/80 bg-white px-3.5 py-2 dark:border-white/[0.08] dark:bg-[var(--card-bg)]">
                  <MetaStatus status={st as string} />
                  <span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{(n as number) ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-gray-400 dark:text-white/40">Creative-Signale (Winning / Needs Iteration / Retention Issues) folgen mit Creative Lab.</p>
          </section>

          <MetaDivider />

          {/* Recent Ads */}
          <section className="flex flex-col gap-3.5">
            <MetaSectionLabel action={<Link href="/meta-ads/ads" className="text-xs font-medium text-accent-meta hover:underline">Alle Ads →</Link>}>Zuletzt aktive Ads</MetaSectionLabel>
            <div className={META_FRAME}>
              {(recent.data?.items ?? []).length === 0 ? (
                <MetaEmptyState icon={Megaphone} title="Keine Ads im Zeitraum" />
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {(recent.data?.items ?? []).map((ad) => (
                      <tr key={ad.id} onClick={() => router.push(`/meta-ads/ads/${ad.id}`)}
                        className="cursor-pointer border-b border-gray-100 transition last:border-0 hover:bg-accent-meta/[0.04] dark:border-white/[0.05] dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{ad.name}</div>
                          <div className="mt-0.5 text-[11.5px] text-gray-400 dark:text-white/40">
                            {ad.productGroupName ?? '—'}{ad.angleName ? ` · ${ad.angleName}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell"><MetaStatus status={ad.status} /></td>
                        <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-500 dark:text-white/60">Hook {fmtPct(ad.metrics.hookRate)}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-accent-meta">{fmtRoas(ad.metrics.calculatedRoas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
