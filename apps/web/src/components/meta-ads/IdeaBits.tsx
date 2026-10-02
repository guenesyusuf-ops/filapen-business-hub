'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Check, Sparkles, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { btnPrimary, btnGhost } from './MetaUI';
import { ProductGroupSelect } from './ProductGroupSelect';
import { useComponents, COMPONENT_TYPE_LABELS } from '@/hooks/meta-ads/useCreative';
import {
  useCreateIdea, IDEA_STATUS_LABELS, IDEA_SOURCE_LABELS, IDEA_TYPE_LABELS, IdeaStatus,
} from '@/hooks/meta-ads/useIdeas';

export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  const tone =
    status === 'shipped' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
      : status === 'in_production' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
      : status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : status === 'archived' ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium', tone)}>{IDEA_STATUS_LABELS[status] ?? status}</span>;
}

export function IdeaMetaBadges({ source, type }: { source: string; type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium', source === 'ai' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50')}>
        {source === 'ai' ? <Sparkles className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}{IDEA_SOURCE_LABELS[source] ?? source}
      </span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-white/50">{IDEA_TYPE_LABELS[type] ?? type}</span>
    </span>
  );
}

export interface IdeaDefaults {
  title?: string; body?: string; ideaType?: 'new' | 'iteration'; source?: 'manual' | 'ai';
  productGroupId?: string; basedOnAdId?: string; basedOnAdName?: string; opportunityType?: string;
  rationale?: string; componentIds?: string[];
}

/** Idee anlegen — manuell oder (vorbereitet) KI; optional aus einem Iterations-Seed vorbefüllt. */
export function CreateIdeaModal({ open, onClose, defaults, onCreated }: {
  open: boolean; onClose: () => void; defaults?: IdeaDefaults; onCreated?: (id: string) => void;
}) {
  const toast = useToast();
  const createIdea = useCreateIdea();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ideaType, setIdeaType] = useState<'new' | 'iteration'>('new');
  const [source, setSource] = useState<'manual' | 'ai'>('manual');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [rationale, setRationale] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(defaults?.title ?? '');
    setBody(defaults?.body ?? '');
    setIdeaType(defaults?.ideaType ?? 'new');
    setSource(defaults?.source ?? 'manual');
    setGroupId(defaults?.productGroupId);
    setRationale(defaults?.rationale ?? '');
    setPicked(defaults?.componentIds ?? []);
  }, [open, defaults]);

  const { data: compData } = useComponents({ productGroupId: groupId, range: 'last30' });
  const comps = compData?.items ?? [];

  if (!open) return null;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const inp = 'h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-3 text-[13.5px] text-gray-900 dark:text-white outline-none focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25';
  const lbl = 'mb-1.5 block text-[12px] font-medium text-gray-500 dark:text-white/50';

  const save = async () => {
    if (!title.trim()) { toast.error('Titel erforderlich'); return; }
    try {
      const idea = await createIdea.mutateAsync({
        title: title.trim(), body: body.trim() || null, ideaType, source,
        productGroupId: groupId ?? null, rationale: rationale.trim() || null,
        basedOnAdId: defaults?.basedOnAdId ?? null, opportunityType: defaults?.opportunityType ?? null,
        componentIds: picked,
      });
      toast.success('Idee angelegt');
      onCreated?.((idea as any).id);
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen'); }
  };

  const byType = (t: string) => comps.filter((c) => c.type === t);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-2 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
          <div>
            <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">{ideaType === 'iteration' ? 'Iteration anlegen' : 'Idee anlegen'}</h2>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">{defaults?.basedOnAdName ? `Basierend auf „${defaults.basedOnAdName}"` : 'Manuell oder als KI-Idee vorbereiten.'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[64vh] overflow-auto px-6 py-5">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div><label className={lbl}>Typ</label>
              <div className="flex gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
                {(['new', 'iteration'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setIdeaType(t)} className={cn('flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] font-medium transition', ideaType === t ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 dark:text-white/50')}>{IDEA_TYPE_LABELS[t]}</button>
                ))}
              </div>
            </div>
            <div><label className={lbl}>Quelle</label>
              <div className="flex gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
                {(['manual', 'ai'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSource(s)} className={cn('flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] font-medium transition', source === s ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 dark:text-white/50')}>{IDEA_SOURCE_LABELS[s]}</button>
                ))}
              </div>
            </div>
          </div>
          {source === 'ai' && (
            <p className="mb-4 rounded-lg bg-violet-50 px-3 py-2 text-[12px] text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              KI-Ideen werden im selben System geführt. Eine automatische KI-Produktion (LLM) ist noch nicht freigegeben — dieses Feld markiert die Herkunft; den Text trägst du aktuell manuell ein.
            </p>
          )}
          <div className="mb-4"><label className={lbl}>Titel</label><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ideaType === 'iteration' ? 'z. B. Neuer Hook für Ad 42' : 'z. B. UGC-Testimonial Variante'} /></div>
          <div className="mb-4"><label className={lbl}>Produktgruppe</label><ProductGroupSelect mode="filter" value={groupId} onChange={setGroupId} /></div>
          <div className="mb-4"><label className={lbl}>Beschreibung</label><textarea rows={3} className={cn(inp, 'h-auto py-2')} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Was soll gebaut werden?" /></div>
          <div className="mb-4"><label className={lbl}>Begründung / Signal</label><textarea rows={2} className={cn(inp, 'h-auto py-2')} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Warum diese Idee? (z. B. Body hält, Hook schwach)" /></div>

          <label className={lbl}>Bausteine wiederverwenden{picked.length ? ` · ${picked.length}` : ''}</label>
          {comps.length === 0 ? (
            <p className="py-3 text-[12.5px] text-gray-400 dark:text-white/40">Keine Components in dieser Gruppe.</p>
          ) : (['hook', 'body', 'cta', 'proof'] as const).map((t) => {
            const list = byType(t);
            if (!list.length) return null;
            return (
              <div key={t} className="mb-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-meta">{COMPONENT_TYPE_LABELS[t]}</div>
                <div className="flex flex-col gap-1.5">
                  {list.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition', picked.includes(c.id) ? 'border-accent-meta bg-accent-meta/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/[0.08] dark:hover:border-white/15')}>
                      <span className={cn('flex h-4 w-4 items-center justify-center rounded border', picked.includes(c.id) ? 'border-accent-meta bg-accent-meta text-white' : 'border-gray-300 dark:border-white/20')}>{picked.includes(c.id) && <Check className="h-3 w-3" />}</span>
                      <span className="font-mono text-[11px] text-gray-400 dark:text-white/40">{c.code}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-white/85">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
          <button onClick={onClose} className={btnGhost}>Abbrechen</button>
          <button onClick={save} disabled={createIdea.isPending} className={btnPrimary}><Plus className="h-4 w-4" /> Idee anlegen</button>
        </div>
      </div>
    </div>
  );
}
