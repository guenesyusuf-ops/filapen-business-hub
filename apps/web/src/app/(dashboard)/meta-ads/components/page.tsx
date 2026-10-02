'use client';

import { useState } from 'react';
import { Search, Layers, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProductGroupSelect } from '@/components/meta-ads/ProductGroupSelect';
import { MetaPageHeader, MetaSectionLabel, MetaEmptyState, META_FRAME } from '@/components/meta-ads/MetaUI';
import { ConfidenceDot } from '@/components/meta-ads/CreativeBits';
import { CreativeLabTabs } from '@/components/meta-ads/CreativeLabTabs';
import { fmtPct, fmtInt, fmtEur } from '@/components/meta-ads/format';
import { useComponents, useComponent, ComponentRow, COMPONENT_TYPE_LABELS, COMPONENT_SIGNAL_LABELS } from '@/hooks/meta-ads/useCreative';
import { cn as _cn } from '@/lib/utils';

function ComponentSignalBadge({ signal }: { signal?: string }) {
  if (!signal) return null;
  const tone = signal === 'strong' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
    : signal === 'promising' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
    : signal === 'iteration' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
    : signal === 'weak' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
    : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50';
  return <span className={_cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium', tone)}>{COMPONENT_SIGNAL_LABELS[signal] ?? signal}</span>;
}

const TABS: { key: string; label: string; type?: string }[] = [
  { key: 'all', label: 'Alle' }, { key: 'hook', label: 'Hooks', type: 'hook' },
  { key: 'body', label: 'Bodies', type: 'body' }, { key: 'cta', label: 'CTAs', type: 'cta' },
];

export default function ComponentsPage() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [focus, setFocus] = useState<string | null>(null);
  const { data, isLoading } = useComponents({ type: TABS.find((t) => t.key === tab)?.type, productGroupId: groupId, search: search.trim() || undefined, range: 'last30' });
  const rows = data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads · Creative Lab" title="Components"
        description="Wiederverwendbare Creative-Bausteine: Hooks, Bodies, CTAs & mehr — mit Performance der Ads, in denen sie verwendet werden (Assoziation, keine Kausalität).">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-[220px] max-w-full"><ProductGroupSelect mode="filter" value={groupId} onChange={setGroupId} /></div>
          <div className="flex gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn('rounded-[7px] px-3 py-1 text-[12.5px] font-medium transition', tab === t.key ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>{t.label}</button>
            ))}
          </div>
        </div>
      </MetaPageHeader>

      <CreativeLabTabs />

      <div className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white p-1.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        <Search className="ml-1.5 h-4 w-4 shrink-0 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, Name, Text, Source Ad…" className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-gray-900 outline-none dark:text-white" />
      </div>

      <div className={META_FRAME}>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-white/5" />)}</div>
        ) : !rows.length ? (
          <MetaEmptyState icon={Layers} title="Noch keine Components" description={'Lege Hooks/Bodies/CTAs aus starken Ads an — in der Ad-Detailansicht via „Component anlegen".'} />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {rows.map((c) => (
              <button key={c.id} onClick={() => setFocus(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:bg-white/10 dark:text-white/50">{c.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-medium text-gray-900 dark:text-white">{c.name}</span><ComponentSignalBadge signal={c.signal} /></div>
                  <div className="mt-0.5 truncate text-[11.5px] text-gray-400 dark:text-white/40">
                    {COMPONENT_TYPE_LABELS[c.type]}{c.productGroupName ? ` · ${c.productGroupName}` : ''}{c.sourceAdName ? ` · aus ${c.sourceAdName}` : ''} · In {c.adCount} Ad{c.adCount === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-white">{fmtPct(c.keyMetric)}</div>
                  {c.keyDelta != null && <div className={cn('text-[11px] tabular-nums', c.keyDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{c.keyDelta > 0 ? '+' : ''}{c.keyDelta}pp vs. Baseline</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ComponentDetail id={focus} onClose={() => setFocus(null)} />
    </div>
  );
}

function ComponentDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: c, isLoading } = useComponent(id, 'last30');
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-auto border-l border-gray-200 bg-white dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.07]">
          <div>{c && <><div className="font-mono text-[11px] text-gray-400 dark:text-white/40">{c.code} · {COMPONENT_TYPE_LABELS[c.type] ?? c.type}</div><h2 className="mt-0.5 text-[16px] font-semibold text-gray-900 dark:text-white">{c.name}</h2></>}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        {isLoading || !c ? <div className="p-5"><div className="h-40 animate-pulse rounded bg-gray-100 dark:bg-white/5" /></div> : (
          <div className="flex flex-col gap-5 p-5">
            {c.text && <p className="rounded-lg bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:bg-white/5 dark:text-white/80">„{c.text}"</p>}
            <div>
              <MetaSectionLabel>Stammdaten</MetaSectionLabel>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                {[['Produkt', c.productGroupName], ['Source Ad', c.sourceAdName], ['Angle', c.angleName], ['Zeitbereich', c.startTimeSeconds != null ? `${c.startTimeSeconds}–${c.endTimeSeconds ?? '?'}s` : null]].map(([k, v]) => (
                  <div key={k as string}><dt className="text-gray-400 dark:text-white/40">{k}</dt><dd className="mt-0.5 font-medium text-gray-900 dark:text-white">{(v as string) || '—'}</dd></div>
                ))}
              </dl>
            </div>
            <div>
              <MetaSectionLabel>Performance (Ads mit dieser Component)</MetaSectionLabel>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                {[['Spend', fmtEur(c.performance.spend)], ['Hook', fmtPct(c.performance.hookRate)], ['Hold', fmtPct(c.performance.holdRate)], ['50→75', fmtPct(c.performance.retention50to75)], ['Ausg. CTR', fmtPct(c.performance.outboundCtr)], ['Unique', fmtInt(c.performance.uniqueSales)], ['ROAS (ber.)', c.performance.calculatedRoas != null ? `${c.performance.calculatedRoas}×` : '—']].map(([k, v]) => (
                  <div key={k as string} className="flex flex-col"><span className="text-[14px] font-semibold tabular-nums text-gray-900 dark:text-white">{v}</span><span className="text-[11px] text-gray-400 dark:text-white/40">{k}</span></div>
                ))}
              </div>
              <div className="mt-2"><ConfidenceDot c={c.confidence} /></div>
              <p className="mt-2 text-[11.5px] text-gray-400 dark:text-white/40">Werte sind eine Assoziation über die verwendenden Ads — keine isolierte Kausalität der Component.</p>
            </div>
            <div>
              <MetaSectionLabel>Verwendet in {c.usedInAds.length} Ad{c.usedInAds.length === 1 ? '' : 's'}</MetaSectionLabel>
              <div className="mt-2 flex flex-col gap-1.5">
                {c.usedInAds.map((a: any) => (
                  <Link key={a.id} href={`/meta-ads/ads/${a.id}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-[13px] transition hover:border-accent-meta/40 dark:border-white/[0.08]">
                    <span className="truncate text-gray-800 dark:text-white/85">{a.name}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </Link>
                ))}
                {c.usedInAds.length === 0 && <p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keiner Ad zugeordnet.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
