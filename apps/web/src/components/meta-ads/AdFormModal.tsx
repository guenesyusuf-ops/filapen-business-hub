'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { AddableSelect } from './AddableSelect';
import { ProductGroupSelect } from './ProductGroupSelect';
import { btnPrimary, btnGhost } from './MetaUI';
import {
  MetaAd, MaFormat, MaAwareness, MaAdStatus,
  useMetaAngles, useMetaOffers, useCreateAngle, useCreateOffer,
  useCreateAd, useUpdateAd, FORMAT_LABELS, AWARENESS_LABELS, STATUS_LABELS,
} from '@/hooks/meta-ads/useMetaAds';

interface Props { open: boolean; onClose: () => void; ad?: MetaAd | null; onSaved?: (ad: MetaAd) => void; }

const FORMATS: MaFormat[] = ['video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection'];
const AWARENESS: MaAwareness[] = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];
const STATUSES: MaAdStatus[] = ['draft', 'active', 'paused', 'ended', 'archived'];

type FormState = {
  name: string; productGroupId: string; metaAdId: string; startDate: string;
  format: MaFormat; angleId?: string; offerId?: string; awareness?: MaAwareness;
  hookText: string; adLink: string; status: MaAdStatus; videoLengthSeconds: string; notes: string;
};

function initState(ad?: MetaAd | null): FormState {
  return {
    name: ad?.name ?? '', productGroupId: ad?.productGroupId ?? '', metaAdId: ad?.metaAdId ?? '',
    startDate: ad?.startDate ?? '', format: ad?.format ?? 'video', angleId: ad?.angleId ?? undefined,
    offerId: ad?.offerId ?? undefined, awareness: ad?.awareness ?? undefined, hookText: ad?.hookText ?? '',
    adLink: ad?.adLink ?? '', status: ad?.status ?? 'draft',
    videoLengthSeconds: ad?.videoLengthSeconds != null ? String(ad.videoLengthSeconds) : '', notes: ad?.notes ?? '',
  };
}

const inp = 'h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-3 text-[13.5px] text-gray-900 dark:text-white outline-none transition focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25';
const lbl = 'text-[12px] font-medium text-gray-500 dark:text-white/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><label className={lbl}>{label}</label>{children}</div>;
}

export function AdFormModal({ open, onClose, ad, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initState(ad));
  const { data: angles } = useMetaAngles();
  const { data: offers } = useMetaOffers();
  const createAngle = useCreateAngle();
  const createOffer = useCreateOffer();
  const createAd = useCreateAd();
  const updateAd = useUpdateAd(ad?.id ?? '');
  const isEdit = !!ad;

  useEffect(() => { if (open) setForm(initState(ad)); }, [open, ad]);
  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Ad-Name ist erforderlich'); return; }
    if (!form.productGroupId) { toast.error('Produkt / Bundle ist erforderlich'); return; }
    if (form.format === 'video' && form.videoLengthSeconds && !(Number(form.videoLengthSeconds) > 0)) { toast.error('Video-Länge muss > 0 sein'); return; }
    const payload: any = {
      name: form.name.trim(), productGroupId: form.productGroupId, metaAdId: form.metaAdId.trim() || null,
      startDate: form.startDate || null, format: form.format, angleId: form.angleId ?? null, offerId: form.offerId ?? null,
      awareness: form.awareness ?? null, hookText: form.hookText.trim() || null, adLink: form.adLink.trim() || null,
      status: form.status, videoLengthSeconds: form.videoLengthSeconds ? Number(form.videoLengthSeconds) : null, notes: form.notes.trim() || null,
    };
    try {
      const saved = isEdit ? await updateAd.mutateAsync(payload) : await createAd.mutateAsync(payload);
      toast.success(isEdit ? 'Ad aktualisiert' : 'Ad angelegt');
      onSaved?.(saved); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); }
  };

  const saving = createAd.isPending || updateAd.isPending;
  const selCls = cn(inp, 'appearance-none pr-8');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="my-2 w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
          <div>
            <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">{isEdit ? 'Ad bearbeiten' : 'Neue Ad'}</h2>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">Creative und Zuordnung erfassen.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[66vh] overflow-auto px-6">
          {/* Basis */}
          <section className="border-b border-gray-100 py-5 dark:border-white/[0.07]">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-400 dark:text-white/40">Basis</p>
            <div className="flex flex-col gap-4">
              <Field label="Ad-Name *"><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. AD-1223 · Problem Hook" /></Field>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Produkt / Bundle *">
                  <ProductGroupSelect value={form.productGroupId || undefined} onChange={(id) => set('productGroupId', id ?? '')} />
                </Field>
                <Field label="Format">
                  <select className={selCls} value={form.format} onChange={(e) => set('format', e.target.value as MaFormat)}>
                    {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
                  </select>
                </Field>
                <Field label="Meta Ad ID"><input className={inp} value={form.metaAdId} onChange={(e) => set('metaAdId', e.target.value)} placeholder="für Import-Abgleich" /></Field>
                <Field label="Startdatum"><input type="date" className={inp} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
              </div>
            </div>
          </section>

          {/* Creative */}
          <section className="border-b border-gray-100 py-5 dark:border-white/[0.07]">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-400 dark:text-white/40">Creative</p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <AddableSelect label="Angle" value={form.angleId} options={angles?.items ?? []} onChange={(id) => set('angleId', id)} onCreate={(n) => createAngle.mutateAsync(n)} placeholder="— kein Angle —" />
                <Field label="Awareness">
                  <select className={selCls} value={form.awareness ?? ''} onChange={(e) => set('awareness', (e.target.value || undefined) as MaAwareness | undefined)}>
                    <option value="">— kein Level —</option>
                    {AWARENESS.map((a) => <option key={a} value={a}>{AWARENESS_LABELS[a]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Hook"><input className={inp} value={form.hookText} onChange={(e) => set('hookText', e.target.value)} placeholder="Hook-Text der Ad" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <AddableSelect label="Offer" value={form.offerId} options={offers?.items ?? []} onChange={(id) => set('offerId', id)} onCreate={(n) => createOffer.mutateAsync(n)} placeholder="— kein Offer —" />
              </div>
            </div>
          </section>

          {/* Quelle */}
          <section className="py-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-400 dark:text-white/40">Quelle</p>
            <div className="flex flex-col gap-4">
              <Field label="Ad-URL"><input className={inp} value={form.adLink} onChange={(e) => set('adLink', e.target.value)} placeholder="https://…" /></Field>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                {form.format === 'video'
                  ? <Field label="Video-Länge (Sek.)"><input type="number" min={1} className={inp} value={form.videoLengthSeconds} onChange={(e) => set('videoLengthSeconds', e.target.value)} placeholder="z. B. 32" /></Field>
                  : <div />}
                <Field label="Status">
                  <select className={selCls} value={form.status} onChange={(e) => set('status', e.target.value as MaAdStatus)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notizen"><textarea className={cn(inp, 'h-auto py-2')} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
          <span className="text-[12px] text-gray-400 dark:text-white/40">Pflichtfelder: Ad-Name, Produkt</span>
          <div className="flex gap-2">
            <button onClick={onClose} className={btnGhost}>Abbrechen</button>
            <button onClick={submit} disabled={saving} className={btnPrimary}>{saving ? 'Speichern…' : isEdit ? 'Speichern' : 'Ad anlegen'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
