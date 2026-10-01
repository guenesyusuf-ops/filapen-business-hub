'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/shared/Toast';
import { AddableSelect } from './AddableSelect';
import {
  MetaAd, MaFormat, MaAwareness, MaAdStatus,
  useMetaProducts, useMetaAngles, useMetaOffers, useCreateAngle, useCreateOffer, useCreateProduct,
  useCreateAd, useUpdateAd, FORMAT_LABELS, AWARENESS_LABELS, STATUS_LABELS,
} from '@/hooks/meta-ads/useMetaAds';

interface Props {
  open: boolean;
  onClose: () => void;
  ad?: MetaAd | null; // gesetzt = Edit-Modus
  onSaved?: (ad: MetaAd) => void;
}

const FORMATS: MaFormat[] = ['video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection'];
const AWARENESS: MaAwareness[] = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'];
const STATUSES: MaAdStatus[] = ['draft', 'active', 'paused', 'ended', 'archived'];

type FormState = {
  name: string; productId: string; metaAdId: string; startDate: string;
  format: MaFormat; angleId?: string; offerId?: string; awareness?: MaAwareness;
  hookText: string; adLink: string; status: MaAdStatus; videoLengthSeconds: string; notes: string;
};

function initState(ad?: MetaAd | null): FormState {
  return {
    name: ad?.name ?? '',
    productId: ad?.productId ?? '',
    metaAdId: ad?.metaAdId ?? '',
    startDate: ad?.startDate ?? '',
    format: ad?.format ?? 'video',
    angleId: ad?.angleId ?? undefined,
    offerId: ad?.offerId ?? undefined,
    awareness: ad?.awareness ?? undefined,
    hookText: ad?.hookText ?? '',
    adLink: ad?.adLink ?? '',
    status: ad?.status ?? 'draft',
    videoLengthSeconds: ad?.videoLengthSeconds != null ? String(ad.videoLengthSeconds) : '',
    notes: ad?.notes ?? '',
  };
}

const field = 'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30 focus:border-accent-meta';
const lbl = 'text-xs font-medium text-gray-500 dark:text-white/50';

export function AdFormModal({ open, onClose, ad, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initState(ad));
  const { data: products } = useMetaProducts();
  const { data: angles } = useMetaAngles();
  const { data: offers } = useMetaOffers();
  const createAngle = useCreateAngle();
  const createOffer = useCreateOffer();
  const createProduct = useCreateProduct();
  const createAd = useCreateAd();
  const updateAd = useUpdateAd(ad?.id ?? '');
  const isEdit = !!ad;

  useEffect(() => { if (open) setForm(initState(ad)); }, [open, ad]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Ad-Name ist erforderlich'); return; }
    if (!form.productId) { toast.error('Produkt ist erforderlich'); return; }
    if (form.format === 'video' && form.videoLengthSeconds && !(Number(form.videoLengthSeconds) > 0)) {
      toast.error('Video-Länge muss > 0 sein'); return;
    }
    const payload: Partial<MetaAd> & { videoLengthSeconds?: number | null } = {
      name: form.name.trim(),
      productId: form.productId,
      metaAdId: form.metaAdId.trim() || null,
      startDate: form.startDate || null,
      format: form.format,
      angleId: form.angleId ?? null,
      offerId: form.offerId ?? null,
      awareness: form.awareness ?? null,
      hookText: form.hookText.trim() || null,
      adLink: form.adLink.trim() || null,
      status: form.status,
      videoLengthSeconds: form.videoLengthSeconds ? Number(form.videoLengthSeconds) : null,
      notes: form.notes.trim() || null,
    };
    try {
      const saved = isEdit
        ? await updateAd.mutateAsync(payload)
        : await createAd.mutateAsync(payload);
      toast.success(isEdit ? 'Ad aktualisiert' : 'Ad angelegt');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    }
  };

  const saving = createAd.isPending || updateAd.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{isEdit ? 'Ad bearbeiten' : 'Neue Ad'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={lbl}>Ad-Name *</label>
            <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. AD-1223 Hook-Test Problem" />
          </div>

          <AddableSelect
            label="Produkt *"
            value={form.productId || undefined}
            options={(products?.items ?? []).map((p) => ({ id: p.id, name: p.title }))}
            onChange={(id) => set('productId', id ?? '')}
            onCreate={async (name) => { const p = await createProduct.mutateAsync(name); return { id: p.id, name: p.title }; }}
            placeholder="— Produkt wählen —"
          />

          <div className="flex flex-col gap-1">
            <label className={lbl}>Meta Ad ID</label>
            <input className={field} value={form.metaAdId} onChange={(e) => set('metaAdId', e.target.value)} placeholder="für späteren Import-Abgleich" />
          </div>

          <div className="flex flex-col gap-1">
            <label className={lbl}>Startdatum</label>
            <input type="date" className={field} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={lbl}>Format</label>
            <select className={field} value={form.format} onChange={(e) => set('format', e.target.value as MaFormat)}>
              {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
            </select>
          </div>

          <AddableSelect
            label="Angle"
            value={form.angleId}
            options={angles?.items ?? []}
            onChange={(id) => set('angleId', id)}
            onCreate={(name) => createAngle.mutateAsync(name)}
            placeholder="— kein Angle —"
          />

          <AddableSelect
            label="Offer"
            value={form.offerId}
            options={offers?.items ?? []}
            onChange={(id) => set('offerId', id)}
            onCreate={(name) => createOffer.mutateAsync(name)}
            placeholder="— kein Offer —"
          />

          <div className="flex flex-col gap-1">
            <label className={lbl}>Awareness</label>
            <select className={field} value={form.awareness ?? ''} onChange={(e) => set('awareness', (e.target.value || undefined) as MaAwareness | undefined)}>
              <option value="">— kein Level —</option>
              {AWARENESS.map((a) => <option key={a} value={a}>{AWARENESS_LABELS[a]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={lbl}>Status</label>
            <select className={field} value={form.status} onChange={(e) => set('status', e.target.value as MaAdStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {form.format === 'video' && (
            <div className="flex flex-col gap-1">
              <label className={lbl}>Video-Länge (Sekunden)</label>
              <input type="number" min={1} className={field} value={form.videoLengthSeconds} onChange={(e) => set('videoLengthSeconds', e.target.value)} placeholder="z. B. 40" />
            </div>
          )}

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={lbl}>Hook (Text)</label>
            <input className={field} value={form.hookText} onChange={(e) => set('hookText', e.target.value)} placeholder="Hook-Text der Ad" />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={lbl}>Ad-Link</label>
            <input className={field} value={form.adLink} onChange={(e) => set('adLink', e.target.value)} placeholder="https://…" />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={lbl}>Notizen</label>
            <textarea className={field} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5">Abbrechen</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-accent-meta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? 'Speichern…' : isEdit ? 'Speichern' : 'Ad anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
