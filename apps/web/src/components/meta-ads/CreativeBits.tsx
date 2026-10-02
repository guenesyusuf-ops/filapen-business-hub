'use client';

import { useState } from 'react';
import { X, Plus, Check, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { btnPrimary, btnGhost } from './MetaUI';
import {
  useComponents, useCreateRecipe, useCreateComponent, COMPONENT_TYPE_LABELS, OPPORTUNITY_LABELS, Confidence, ComponentType,
} from '@/hooks/meta-ads/useCreative';
import { useCreateTaskFromRecipe } from '@/hooks/meta-ads/useIdeas';

/** Opportunity-Badge mit deterministischer Farbe. */
export function SignalBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const tone =
    type === 'FULL_WINNER' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
      : type === 'HOOK_WINNER' || type === 'BODY_WINNER' || type === 'STRONG_RETENTION' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : type === 'SALVAGE_BODY' || type === 'SALVAGE_HOOK' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400'
      : type === 'PROMISING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
      : type === 'LOW_CONFIDENCE' ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'; // needs iteration / drops
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium', tone)}>{OPPORTUNITY_LABELS[type] ?? type}</span>;
}

export function ConfidenceDot({ c }: { c?: Confidence | null }) {
  if (!c || !c.level) return null; // defensiv: nie an fehlender Confidence crashen
  const tone = c.level === 'high' ? 'text-green-600 dark:text-green-400' : c.level === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-white/40';
  const label = c.level === 'high' ? 'Hohe' : c.level === 'medium' ? 'Mittlere' : 'Geringe';
  return <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', tone)} title={(c.reasons ?? []).join(' · ')}>● {label} Aussagekraft</span>;
}

/** Build Combination — Component-Picker → Recipe speichern. */
export function BuildCombinationModal({ open, onClose, productGroupId }: { open: boolean; onClose: () => void; productGroupId?: string }) {
  const toast = useToast();
  const { data } = useComponents({ productGroupId, range: 'last30' });
  const createRecipe = useCreateRecipe();
  const createTask = useCreateTaskFromRecipe();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const comps = data?.items ?? [];

  if (!open) return null;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const byType = (t: ComponentType) => comps.filter((c) => c.type === t);

  const reset = () => { setName(''); setPicked([]); setSaved(null); };
  const close = () => { reset(); onClose(); };

  const save = async () => {
    if (!name.trim()) { toast.error('Name erforderlich'); return; }
    if (!picked.length) { toast.error('Mindestens eine Component wählen'); return; }
    try {
      const recipe = await createRecipe.mutateAsync({ name: name.trim(), productGroupId: productGroupId ?? null, componentIds: picked });
      toast.success('Recipe gespeichert');
      setSaved({ id: (recipe as any).id, name: name.trim() });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); }
  };

  const makeTask = async () => {
    if (!saved) return;
    try {
      const res = await createTask.mutateAsync(saved.id);
      toast.success(res.alreadyLinked ? 'Aufgabe existiert bereits' : 'Aufgabe erstellt');
      close();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={close}>
        <div onClick={(e) => e.stopPropagation()} className="my-2 w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
          <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
            <div><h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">Recipe gespeichert</h2><p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">„{saved.name}" ist angelegt.</p></div>
            <button onClick={close} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-6 py-5 text-[13px] text-gray-600 dark:text-white/60">Direkt in die Produktion übergeben? Es wird eine Aufgabe im Board „Meta Ads — Creative Production" angelegt.</div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
            <button onClick={close} className={btnGhost}>Nur speichern</button>
            <button onClick={makeTask} disabled={createTask.isPending} className={btnPrimary}><ListChecks className="h-4 w-4" /> Aufgabe erstellen</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="my-2 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
          <div><h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">Build Combination</h2><p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">Components zu einem Creative Recipe kombinieren.</p></div>
          <button onClick={close} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-auto px-6 py-5">
          <label className="mb-1.5 block text-[12px] font-medium text-gray-500 dark:text-white/50">Recipe-Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Bundle A+B · Problem Hook + Proof"
            className="mb-5 h-[38px] w-full rounded-[9px] border border-gray-200 bg-white px-3 text-[13.5px] outline-none focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25 dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white" />
          {comps.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-gray-400 dark:text-white/40">Keine Components in dieser Gruppe. Lege welche aus einer Ad an.</p>
          ) : (['hook', 'body', 'cta', 'proof'] as ComponentType[]).map((t) => {
            const list = byType(t);
            if (!list.length) return null;
            return (
              <div key={t} className="mb-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-meta">{COMPONENT_TYPE_LABELS[t]}</div>
                <div className="flex flex-col gap-1.5">
                  {list.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggle(c.id)}
                      className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition',
                        picked.includes(c.id) ? 'border-accent-meta bg-accent-meta/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/[0.08] dark:hover:border-white/15')}>
                      <span className={cn('flex h-4 w-4 items-center justify-center rounded border', picked.includes(c.id) ? 'border-accent-meta bg-accent-meta text-white' : 'border-gray-300 dark:border-white/20')}>{picked.includes(c.id) && <Check className="h-3 w-3" />}</span>
                      <span className="font-mono text-[11px] text-gray-400 dark:text-white/40">{c.code}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-white/85">{c.name}</span>
                      {c.sourceAdName && <span className="shrink-0 text-[11px] text-gray-400 dark:text-white/40">aus {c.sourceAdName}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
          <span className="text-[12px] text-gray-400 dark:text-white/40">{picked.length} Component{picked.length === 1 ? '' : 's'} gewählt</span>
          <div className="flex gap-2"><button onClick={close} className={btnGhost}>Abbrechen</button><button onClick={save} disabled={createRecipe.isPending} className={btnPrimary}><Plus className="h-4 w-4" /> Recipe speichern</button></div>
        </div>
      </div>
    </div>
  );
}

const COMP_TYPES: ComponentType[] = ['hook', 'body', 'cta', 'proof', 'testimonial', 'product_demo', 'offer_section', 'problem_section', 'solution_section', 'transition', 'visual_opening', 'voiceover', 'b_roll'];

/** Component aus einer Ad anlegen (Hook/Body/CTA + Zeitbereich). */
export function CreateComponentModal({ open, onClose, adId, productGroupId, defaults }: {
  open: boolean; onClose: () => void; adId: string; productGroupId?: string | null;
  defaults?: { type?: ComponentType; startTimeSeconds?: number; endTimeSeconds?: number };
}) {
  const toast = useToast();
  const createComp = useCreateComponent();
  const [type, setType] = useState<ComponentType>(defaults?.type ?? 'body');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [start, setStart] = useState(defaults?.startTimeSeconds != null ? String(defaults.startTimeSeconds) : '');
  const [end, setEnd] = useState(defaults?.endTimeSeconds != null ? String(defaults.endTimeSeconds) : '');
  const [notes, setNotes] = useState('');

  if (!open) return null;
  const inp = 'h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-3 text-[13.5px] text-gray-900 dark:text-white outline-none focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25';
  const lbl = 'mb-1.5 block text-[12px] font-medium text-gray-500 dark:text-white/50';

  const save = async () => {
    if (!name.trim()) { toast.error('Name erforderlich'); return; }
    if (start && end && Number(end) <= Number(start)) { toast.error('Endzeit muss nach der Startzeit liegen'); return; }
    try {
      await createComp.mutateAsync({
        type, name: name.trim(), text: text.trim() || null, notes: notes.trim() || null,
        sourceAdId: adId, productGroupId: productGroupId ?? null, linkToSourceAd: true,
        startTimeSeconds: start ? Number(start) : null, endTimeSeconds: end ? Number(end) : null,
      });
      toast.success('Component angelegt');
      setName(''); setText(''); setNotes(''); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-2 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
          <div><h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">Component anlegen</h2><p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">Aus dieser Ad — wird ihr direkt zugeordnet.</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Typ</label>
              <select className={cn(inp, 'appearance-none pr-8')} value={type} onChange={(e) => setType(e.target.value as ComponentType)}>
                {COMP_TYPES.map((t) => <option key={t} value={t}>{COMPONENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Name</label><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Problem-Hook v2" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Start (Sek.)</label><input type="number" min={0} className={inp} value={start} onChange={(e) => setStart(e.target.value)} placeholder="z. B. 4" /></div>
            <div><label className={lbl}>Ende (Sek.)</label><input type="number" min={0} className={inp} value={end} onChange={(e) => setEnd(e.target.value)} placeholder="z. B. 22" /></div>
          </div>
          <div><label className={lbl}>Text / Beschreibung</label><textarea rows={2} className={cn(inp, 'h-auto py-2')} value={text} onChange={(e) => setText(e.target.value)} /></div>
          <div><label className={lbl}>Notizen</label><textarea rows={2} className={cn(inp, 'h-auto py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
          <button onClick={onClose} className={btnGhost}>Abbrechen</button>
          <button onClick={save} disabled={createComp.isPending} className={btnPrimary}><Plus className="h-4 w-4" /> Anlegen</button>
        </div>
      </div>
    </div>
  );
}
