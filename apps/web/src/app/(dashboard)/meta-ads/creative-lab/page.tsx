'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Image as ImageIcon, Layers, Blocks, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaSectionLabel, MetaDivider, META_FRAME, btnPrimary } from '@/components/meta-ads/MetaUI';
import { Sparkles, Check } from 'lucide-react';
import { useToast } from '@/components/shared/Toast';
import { SignalBadge, ConfidenceDot, BuildCombinationModal } from '@/components/meta-ads/CreativeBits';
import { CreateIdeaModal, IdeaDefaults } from '@/components/meta-ads/IdeaBits';
import { fmtPct, fmtRoas } from '@/components/meta-ads/format';
import { useCreativeLab, LabCard, ComponentRow, useRecommendedCombination, useCreateRecipe, CombinationResult } from '@/hooks/meta-ads/useCreative';

export default function CreativeLabPage() {
  const router = useRouter();
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const [buildOpen, setBuildOpen] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaDefaults, setIdeaDefaults] = useState<IdeaDefaults | undefined>(undefined);
  const { data, isLoading, isError } = useCreativeLab({ productGroupId: controls.productGroupId, range: controls.range, start: controls.start, end: controls.end });
  const s = data?.sections;

  const iterate = (c: LabCard) => {
    setIdeaDefaults({
      title: `Iteration: ${c.name}`, ideaType: 'iteration', basedOnAdId: c.id, basedOnAdName: c.name,
      opportunityType: c.primary ?? undefined, productGroupId: controls.productGroupId,
    });
    setIdeaOpen(true);
  };

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
          <RecommendedCombination productGroupId={controls.productGroupId} range={controls.range} start={controls.start} end={controls.end} />
          <LabSection title="Winning Creatives" count={s.winningCreatives.length} cards={s.winningCreatives} router={router}
            empty="Noch keine klaren Winner im Zeitraum — braucht genug Daten (Confidence)." />
          <MetaDivider />
          <CompSection title="Winning Hooks" rows={s.winningHooks} router={router} metricLabel="Hook Rate" />
          <MetaDivider />
          <CompSection title="Strong Bodies" rows={s.winningBodies} router={router} metricLabel="50→75 Retention" />
          <MetaDivider />
          <LabSection title="Strong Retention" count={s.strongRetention.length} cards={s.strongRetention} router={router} empty="Keine Ads mit auffällig starker Retention." />
          <MetaDivider />
          <LabSection title="Needs Iteration" count={s.needsIteration.length} cards={s.needsIteration} router={router} onIterate={iterate} empty="Keine klaren Schwachstellen erkannt." />
          <MetaDivider />
          <LabSection title="Salvage Opportunities" count={s.salvage.length} cards={s.salvage} router={router} onIterate={iterate}
            empty="Keine Salvage-Kandidaten — nichts, wo ein Teil stark und ein anderer schwach ist." />
        </>
      )}

      <BuildCombinationModal open={buildOpen} onClose={() => setBuildOpen(false)} productGroupId={controls.productGroupId} />
      <CreateIdeaModal open={ideaOpen} onClose={() => setIdeaOpen(false)} defaults={ideaDefaults} />
    </div>
  );
}

function LabSection({ title, count, cards, router, empty, onIterate }: { title: string; count: number; cards: LabCard[]; router: any; empty: string; onIterate?: (c: LabCard) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>{title}{count ? ` · ${count}` : ''}</MetaSectionLabel>
      {cards.length === 0 ? (
        <p className="text-[12.5px] text-gray-400 dark:text-white/40">{empty}</p>
      ) : (
        <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
          {cards.map((c) => <LabRow key={c.id} c={c} router={router} onIterate={onIterate} />)}
        </div>
      )}
    </section>
  );
}

function LabRow({ c, router, onIterate }: { c: LabCard; router: any; onIterate?: (c: LabCard) => void }) {
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
      {onIterate && (
        <button onClick={(e) => { e.stopPropagation(); onIterate(c); }}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-accent-meta transition hover:border-accent-meta/40 hover:bg-accent-meta/[0.06] dark:border-white/[0.1]">
          <Wand2 className="h-3.5 w-3.5" /> Iterieren
        </button>
      )}
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

function RecommendedCombination({ productGroupId, range, start, end }: { productGroupId?: string; range?: any; start?: string; end?: string }) {
  const toast = useToast();
  const { data, isLoading } = useRecommendedCombination({ productGroupId, range, start, end });
  const createRecipe = useCreateRecipe();
  const [created, setCreated] = useState(false);

  const header = <MetaSectionLabel>Empfohlene Kombination (Cross-Ad)</MetaSectionLabel>;
  if (!productGroupId) return <section className="flex flex-col gap-3">{header}<p className="text-[12.5px] text-gray-400 dark:text-white/40">Wähle oben eine Produktgruppe — die Engine kombiniert dann die stärksten validierten Bausteine dieses Produkts.</p></section>;
  if (isLoading) return <section className="flex flex-col gap-3">{header}<div className={cn(META_FRAME, 'h-24 animate-pulse bg-gray-50 dark:bg-white/5')} /></section>;
  const combo: CombinationResult | null | undefined = data?.combination;
  if (!combo) return <section className="flex flex-col gap-3">{header}<p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keine belastbare Kombination — es braucht mindestens je einen starken Hook und Body mit ausreichender Datenlage.</p></section>;

  const create = async () => {
    try {
      await createRecipe.mutateAsync({ name: `Empfehlung: ${combo.slots.map((sl) => sl.code).join(' + ')}`, productGroupId, componentIds: combo.componentIds });
      setCreated(true); toast.success('Recipe erstellt');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Recipe fehlgeschlagen'); }
  };

  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>Empfohlene Kombination (Cross-Ad){combo.label === 'promising' ? ' · Promising' : ''}</MetaSectionLabel>
      <div className={cn(META_FRAME, 'flex flex-col gap-3 p-4')}>
        <div className="flex flex-wrap gap-2">
          {combo.slots.map((sl, i) => (
            <div key={sl.componentId} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 dark:text-white/30">+</span>}
              <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-white/[0.1]">
                <div className="font-mono text-[10.5px] uppercase tracking-wide text-gray-400 dark:text-white/40">{sl.code} · {sl.bucket}</div>
                <div className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{sl.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-white/50">{sl.sourceAdName ? `aus ${sl.sourceAdName}` : '—'}{sl.keyDelta != null ? ` · ${sl.keyDelta > 0 ? '+' : ''}${sl.keyDelta}pp` : ''}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-white/60">{combo.reason}</p>
        <div className="flex items-center gap-2">
          <button onClick={create} disabled={createRecipe.isPending || created} className={btnPrimary}>
            {created ? <><Check className="h-4 w-4" /> Recipe erstellt</> : <><Blocks className="h-4 w-4" /> Recipe erstellen</>}
          </button>
          <span className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 dark:text-white/40"><Sparkles className="h-3.5 w-3.5" /> {combo.label === 'recommended' ? 'ausreichende Confidence' : 'geringe Confidence — als Test behandeln'}</span>
        </div>
      </div>
    </section>
  );
}
