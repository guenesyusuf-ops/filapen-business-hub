'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Image as ImageIcon, Layers, Blocks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaSectionLabel, MetaDivider, META_FRAME, btnPrimary } from '@/components/meta-ads/MetaUI';
import { SignalBadge, ConfidenceDot, BuildCombinationModal } from '@/components/meta-ads/CreativeBits';
import { fmtPct, fmtRoas } from '@/components/meta-ads/format';
import { useCreativeLab, LabCard, ComponentRow } from '@/hooks/meta-ads/useCreative';

export default function CreativeLabPage() {
  const router = useRouter();
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const [buildOpen, setBuildOpen] = useState(false);
  const { data, isLoading, isError } = useCreativeLab({ productGroupId: controls.productGroupId, range: controls.range, start: controls.start, end: controls.end });
  const s = data?.sections;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads" title="Creative Lab"
        description="Was funktioniert gerade — und was sollten Cutter & Creative Maker als Nächstes bauen? Deterministisch, relativ zur Produkt-Baseline."
        actions={<button onClick={() => setBuildOpen(true)} className={btnPrimary}><Blocks className="h-4 w-4" /> Build Combination</button>}>
        <MetaControls value={controls} onChange={setControls} />
      </MetaPageHeader>

      {isError ? (
        <div className="rounded-[11px] border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">Daten konnten nicht geladen werden.</div>
      ) : isLoading ? (
        <div className={cn(META_FRAME, 'h-48 animate-pulse bg-gray-50 dark:bg-white/5')} />
      ) : !s ? null : (
        <>
          <LabSection title="Winning Creatives" count={s.winningCreatives.length} cards={s.winningCreatives} router={router}
            empty="Noch keine klaren Winner im Zeitraum — braucht genug Daten (Confidence)." />
          <MetaDivider />
          <CompSection title="Winning Hooks" rows={s.winningHooks} router={router} metricLabel="Hook Rate" />
          <MetaDivider />
          <CompSection title="Strong Bodies" rows={s.winningBodies} router={router} metricLabel="50→75 Retention" />
          <MetaDivider />
          <LabSection title="Strong Retention" count={s.strongRetention.length} cards={s.strongRetention} router={router} empty="Keine Ads mit auffällig starker Retention." />
          <MetaDivider />
          <LabSection title="Needs Iteration" count={s.needsIteration.length} cards={s.needsIteration} router={router} empty="Keine klaren Schwachstellen erkannt." />
          <MetaDivider />
          <LabSection title="Salvage Opportunities" count={s.salvage.length} cards={s.salvage} router={router}
            empty="Keine Salvage-Kandidaten — nichts, wo ein Teil stark und ein anderer schwach ist." />
        </>
      )}

      <BuildCombinationModal open={buildOpen} onClose={() => setBuildOpen(false)} productGroupId={controls.productGroupId} />
    </div>
  );
}

function LabSection({ title, count, cards, router, empty }: { title: string; count: number; cards: LabCard[]; router: any; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>{title}{count ? ` · ${count}` : ''}</MetaSectionLabel>
      {cards.length === 0 ? (
        <p className="text-[12.5px] text-gray-400 dark:text-white/40">{empty}</p>
      ) : (
        <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
          {cards.map((c) => <LabRow key={c.id} c={c} router={router} />)}
        </div>
      )}
    </section>
  );
}

function LabRow({ c, router }: { c: LabCard; router: any }) {
  const Fmt = c.format === 'video' ? Play : ImageIcon;
  return (
    <div onClick={() => router.push(`/meta-ads/ads/${c.id}`)} className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5"><Fmt className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-white">{c.name}</span>
          <SignalBadge type={c.primary} />
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-gray-400 dark:text-white/40">
          {c.productGroupName ?? '—'}{c.angleName ? ` · ${c.angleName}` : ''} · <ConfidenceDot c={c.confidence} />
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-5 text-right text-[12.5px] tabular-nums sm:flex">
        <Metric label="Hook" value={fmtPct(c.metrics.hookRate)} />
        <Metric label="50→75" value={fmtPct(c.metrics.retention50to75)} />
        <Metric label="ROAS" value={fmtRoas(c.metrics.calculatedRoas)} accent />
      </div>
    </div>
  );
}

function CompSection({ title, rows, router, metricLabel }: { title: string; rows: ComponentRow[]; router: any; metricLabel: string }) {
  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>{title}{rows.length ? ` · ${rows.length}` : ''}</MetaSectionLabel>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keine {title.toLowerCase()} über Baseline — lege Components aus starken Ads an.</p>
      ) : (
        <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
          {rows.map((r) => (
            <div key={r.id} onClick={() => router.push(`/meta-ads/components?focus=${r.id}`)} className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5"><Layers className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-gray-400 dark:text-white/40">{r.code}</span><span className="truncate font-medium text-gray-900 dark:text-white">{r.name}</span></div>
                <div className="mt-0.5 truncate text-[11.5px] text-gray-400 dark:text-white/40">In {r.adCount} Ad{r.adCount === 1 ? '' : 's'}{r.sourceAdName ? ` · aus ${r.sourceAdName}` : ''} · <ConfidenceDot c={r.confidence} /></div>
              </div>
              <div className="shrink-0 text-right text-[12.5px] tabular-nums">
                <div className="font-semibold text-gray-900 dark:text-white">{fmtPct(r.keyMetric)}</div>
                <div className="text-[11px] text-gray-400 dark:text-white/40">{metricLabel}{r.keyDelta != null ? <span className={r.keyDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}> {r.keyDelta > 0 ? '+' : ''}{r.keyDelta}pp</span> : null}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex flex-col"><span className={cn('font-semibold', accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>{value}</span><span className="text-[10.5px] text-gray-400 dark:text-white/40">{label}</span></div>;
}
