'use client';

import { useState } from 'react';
import { Lightbulb, Plus, X, Sparkles, Wand2, ListChecks, Trash2, ArrowRight, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { ProductGroupSelect } from '@/components/meta-ads/ProductGroupSelect';
import { MetaPageHeader, MetaSectionLabel, MetaDivider, MetaEmptyState, META_FRAME, btnPrimary, btnGhost } from '@/components/meta-ads/MetaUI';
import { CreateIdeaModal, IdeaStatusBadge, IdeaMetaBadges, IdeaDefaults } from '@/components/meta-ads/IdeaBits';
import { OPPORTUNITY_LABELS, COMPONENT_TYPE_LABELS } from '@/hooks/meta-ads/useCreative';
import {
  useIdeas, useIdea, useIdeaSuggestions, useUpdateIdea, useDeleteIdea, useCreateTaskFromIdea,
  IdeaSeed, IdeaRow, IDEA_STATUS_LABELS, IDEA_STATUS_FLOW, IdeaStatus,
} from '@/hooks/meta-ads/useIdeas';

const STATUS_FILTERS = [{ k: '', l: 'Alle' }, { k: 'draft', l: 'Entwurf' }, { k: 'approved', l: 'Freigegeben' }, { k: 'in_production', l: 'In Produktion' }, { k: 'shipped', l: 'Live' }];

export default function IdeasPage() {
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [defaults, setDefaults] = useState<IdeaDefaults | undefined>(undefined);
  const [focus, setFocus] = useState<string | null>(null);

  const { data, isLoading } = useIdeas({ productGroupId: groupId, status: status || undefined, search: search.trim() || undefined });
  const suggestions = useIdeaSuggestions({ productGroupId: groupId, range: 'last30' });
  const rows = data?.items ?? [];
  const seeds = suggestions.data?.items ?? [];

  const openCreate = (d?: IdeaDefaults) => { setDefaults(d); setCreateOpen(true); };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads" title="Ideen & Iterationen"
        description="Was bauen wir als Nächstes — und warum? Manuelle und KI-Ideen im selben System, Iterationen aus den deterministischen Signalen, direkt in Aufgaben übersetzbar."
        actions={<button onClick={() => openCreate(undefined)} className={btnPrimary}><Plus className="h-4 w-4" /> Idee anlegen</button>}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-[220px] max-w-full"><ProductGroupSelect mode="filter" value={groupId} onChange={setGroupId} /></div>
          <div className="flex gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
            {STATUS_FILTERS.map((s) => (
              <button key={s.k} onClick={() => setStatus(s.k)} className={cn('rounded-[7px] px-3 py-1 text-[12.5px] font-medium transition', status === s.k ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>{s.l}</button>
            ))}
          </div>
        </div>
      </MetaPageHeader>

      {/* Deterministische Iterations-Vorschläge */}
      <SuggestionsPanel seeds={seeds} loading={suggestions.isLoading} onTake={openCreate} />

      <MetaDivider />

      <div className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white p-1.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        <Search className="ml-1.5 h-4 w-4 shrink-0 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ideen durchsuchen…" className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-gray-900 outline-none dark:text-white" />
      </div>

      <div className={META_FRAME}>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded bg-gray-100 dark:bg-white/5" />)}</div>
        ) : !rows.length ? (
          <MetaEmptyState icon={Lightbulb} title="Noch keine Ideen" description="Lege eine Idee an oder übernimm einen Iterations-Vorschlag aus den Signalen oben." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {rows.map((r) => <IdeaListRow key={r.id} r={r} onClick={() => setFocus(r.id)} />)}
          </div>
        )}
      </div>

      <CreateIdeaModal open={createOpen} onClose={() => setCreateOpen(false)} defaults={defaults} onCreated={(id) => setFocus(id)} />
      <IdeaDetail id={focus} onClose={() => setFocus(null)} />
    </div>
  );
}

function SuggestionsPanel({ seeds, loading, onTake }: { seeds: IdeaSeed[]; loading: boolean; onTake: (d: IdeaDefaults) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>Iterations-Vorschläge{seeds.length ? ` · ${seeds.length}` : ''}</MetaSectionLabel>
      {loading ? (
        <div className={cn(META_FRAME, 'h-20 animate-pulse bg-gray-50 dark:bg-white/5')} />
      ) : !seeds.length ? (
        <p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine Salvage-/Needs-Iteration-Signale im Zeitraum — nichts, wo ein klarer deterministischer Vorschlag greift.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {seeds.map((s) => (
            <div key={s.basedOnAdId} className={cn(META_FRAME, 'flex flex-col gap-2 p-3.5')}>
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 shrink-0 text-accent-meta" />
                <span className="truncate text-[13.5px] font-semibold text-gray-900 dark:text-white">{s.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{OPPORTUNITY_LABELS[s.opportunityType] ?? s.opportunityType}</span>
                {s.suggestedRole && <span className="rounded bg-accent-meta/10 px-1.5 py-0.5 font-medium text-accent-meta">{COMPONENT_TYPE_LABELS[s.suggestedRole]} neu</span>}
                {s.productGroupName && <span className="text-gray-400 dark:text-white/40">{s.productGroupName}</span>}
              </div>
              <p className="text-[12px] leading-relaxed text-gray-500 dark:text-white/50">{s.rationale}</p>
              <div className="mt-0.5 flex items-center justify-between">
                {s.alreadyHasIdea ? <span className="text-[11.5px] text-gray-400 dark:text-white/40">Idee existiert bereits</span> : <span />}
                <button
                  onClick={() => onTake({ title: s.title, ideaType: 'iteration', basedOnAdId: s.basedOnAdId, basedOnAdName: s.basedOnAdName, opportunityType: s.opportunityType, rationale: s.rationale })}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-meta hover:underline">
                  Als Iteration übernehmen <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function IdeaListRow({ r, onClick }: { r: IdeaRow; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5"><Lightbulb className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-white">{r.title}</span>
          <IdeaStatusBadge status={r.status} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-gray-400 dark:text-white/40">
          <IdeaMetaBadges source={r.source} type={r.ideaType} />
          {r.productGroupName && <span>· {r.productGroupName}</span>}
          {r.componentCount > 0 && <span>· {r.componentCount} Baustein{r.componentCount === 1 ? '' : 'e'}</span>}
          {r.taskCount > 0 && <span className="text-accent-meta">· {r.taskCount} Aufgabe{r.taskCount === 1 ? '' : 'n'}</span>}
        </div>
      </div>
    </button>
  );
}

function IdeaDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: idea, isLoading } = useIdea(id);
  const update = useUpdateIdea(id ?? '');
  const del = useDeleteIdea();
  const createTask = useCreateTaskFromIdea(id ?? '');
  const toast = useToast();
  const { confirm } = useConfirm();
  if (!id) return null;

  const nextStatus = (cur: IdeaStatus): IdeaStatus | null => {
    const i = IDEA_STATUS_FLOW.indexOf(cur);
    return i >= 0 && i < IDEA_STATUS_FLOW.length - 1 ? IDEA_STATUS_FLOW[i + 1] : null;
  };

  const advance = async () => {
    if (!idea) return;
    const next = nextStatus(idea.status);
    if (!next) return;
    try { await update.mutateAsync({ status: next }); toast.success(`Status: ${IDEA_STATUS_LABELS[next]}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };
  const makeTask = async () => {
    try {
      const res = await createTask.mutateAsync({});
      toast.success(res.alreadyLinked ? 'Aufgabe existiert bereits' : 'Aufgabe erstellt');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };
  const remove = async () => {
    if (!idea) return;
    const ok = await confirm({ title: 'Idee löschen?', message: `„${idea.title}" wird entfernt. Verknüpfte Aufgaben bleiben bestehen.`, confirmLabel: 'Löschen', variant: 'danger' });
    if (!ok) return;
    try { await del.mutateAsync(idea.id); toast.success('Idee gelöscht'); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };

  const next = idea ? nextStatus(idea.status) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-auto border-l border-gray-200 bg-white dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.07]">
          <div className="min-w-0">{idea && <><div className="flex items-center gap-2"><IdeaStatusBadge status={idea.status} /><IdeaMetaBadges source={idea.source} type={idea.ideaType} /></div><h2 className="mt-1.5 text-[16px] font-semibold text-gray-900 dark:text-white">{idea.title}</h2></>}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        {isLoading || !idea ? <div className="p-5"><div className="h-40 animate-pulse rounded bg-gray-100 dark:bg-white/5" /></div> : (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap gap-2">
              {next && <button onClick={advance} disabled={update.isPending} className={btnPrimary}><ArrowRight className="h-4 w-4" /> {IDEA_STATUS_LABELS[next]}</button>}
              <button onClick={makeTask} disabled={createTask.isPending} className={btnGhost}><ListChecks className="h-4 w-4" /> Aufgabe erstellen</button>
            </div>

            {idea.body && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:bg-white/5 dark:text-white/80">{idea.body}</p>}

            <div>
              <MetaSectionLabel>Kontext</MetaSectionLabel>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                {[['Produkt', idea.productGroupName], ['Angle', idea.angleName], ['Offer', idea.offerName],
                  ['Signal', idea.opportunityType ? (OPPORTUNITY_LABELS[idea.opportunityType] ?? idea.opportunityType) : null],
                  ['Basis-Ad', idea.basedOnAdName], ['Recipe', idea.recipeName]].map(([k, v]) => (
                  <div key={k as string}><dt className="text-gray-400 dark:text-white/40">{k}</dt>
                    <dd className="mt-0.5 font-medium text-gray-900 dark:text-white">
                      {k === 'Basis-Ad' && idea.basedOnAdId ? <Link href={`/meta-ads/ads/${idea.basedOnAdId}`} className="text-accent-meta hover:underline">{v || '—'}</Link> : ((v as string) || '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {idea.rationale && <div><MetaSectionLabel>Begründung</MetaSectionLabel><p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-white/60">{idea.rationale}</p></div>}

            <div>
              <MetaSectionLabel>Bausteine · {idea.components.length}</MetaSectionLabel>
              <div className="mt-2 flex flex-col gap-1.5">
                {idea.components.length === 0 ? <p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine Bausteine zugeordnet.</p> :
                  idea.components.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] dark:border-white/[0.08]">
                      <span className="font-mono text-[11px] text-gray-400 dark:text-white/40">{c.code}</span>
                      <span className="truncate text-gray-800 dark:text-white/85">{c.name}</span>
                      <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] text-gray-500 dark:bg-white/10 dark:text-white/50">{COMPONENT_TYPE_LABELS[c.type ?? ''] ?? c.type}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <MetaSectionLabel>Verknüpfte Aufgaben · {idea.tasks.length}</MetaSectionLabel>
              <div className="mt-2 flex flex-col gap-1.5">
                {idea.tasks.length === 0 ? <p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keine Aufgabe — „Aufgabe erstellen" legt eine im Board „Meta Ads — Creative Production" an.</p> :
                  idea.tasks.map((t) => (
                    <Link key={t.id} href="/work-management" className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] transition hover:border-accent-meta/40 dark:border-white/[0.08]">
                      <span className="truncate text-gray-800 dark:text-white/85">{t.title || 'Aufgabe'}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    </Link>
                  ))}
              </div>
            </div>

            <MetaDivider />
            <button onClick={remove} className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-red-600 hover:underline dark:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Idee löschen</button>
          </div>
        )}
      </div>
    </div>
  );
}
