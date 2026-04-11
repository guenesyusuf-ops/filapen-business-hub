'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Creator } from '@/hooks/creators/useCreators';
import {
  useCreateCreator,
  useUpdateCreator,
} from '@/hooks/creators/useCreators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreatorFormMode = 'create' | 'edit';

interface CreatorFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: CreatorFormMode;
  /** Required when mode === 'edit'. Ignored in create mode. */
  creator?: Creator;
  /** Called after a successful create/update with the returned creator. */
  onSuccess?: (creator: Creator) => void;
}

interface FormState {
  // Basis
  name: string;
  email: string;
  phone: string;
  // Social
  platform: string;
  handle: string;
  followerCount: string;
  engagementRate: string;
  // Demographics
  age: string;
  location: string;
  niche: string;
  kids: boolean;
  kidsAges: string;
  kidsOnVideo: boolean;
  // Compensation
  compensation: string;
  provision: string;
  fixAmount: string;
  ratePerPost: string;
  ratePerVideo: string;
  // Organization
  status: string;
  tags: string[];
  notes: string;
  score: string;
  firstContact: string;
}

const EMPTY_STATE: FormState = {
  name: '',
  email: '',
  phone: '',
  platform: 'instagram',
  handle: '',
  followerCount: '',
  engagementRate: '',
  age: '',
  location: '',
  niche: '',
  kids: false,
  kidsAges: '',
  kidsOnVideo: false,
  compensation: '',
  provision: '',
  fixAmount: '',
  ratePerPost: '',
  ratePerVideo: '',
  status: 'prospect',
  tags: [],
  notes: '',
  score: '',
  firstContact: '',
};

// ---------------------------------------------------------------------------
// Option Lists
// ---------------------------------------------------------------------------

const PLATFORM_OPTIONS = [
  { value: '', label: 'Keine Plattform' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

const NICHE_OPTIONS = [
  '',
  'Lifestyle',
  'Fitness',
  'Food',
  'Tech',
  'Beauty',
  'Travel',
  'Fashion',
  'Gaming',
  'Brand',
  'Money',
];

const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'active', label: 'Aktiv' },
  { value: 'inactive', label: 'Inaktiv' },
];

const COMPENSATION_OPTIONS = [
  '',
  'Fixpreis',
  'Revenue Share',
  'Gratisprodukt',
  'Commission',
  'Fixed',
  'Both',
  'Sonstige',
];

const FIRST_CONTACT_OPTIONS = [
  '',
  'Email',
  'Meta Ads',
  'Empfehlung',
  'Instagram',
  'TikTok',
  'Sonstige',
];

// ---------------------------------------------------------------------------
// Utility: creator -> formState
// ---------------------------------------------------------------------------

function creatorToFormState(creator: Creator | undefined): FormState {
  if (!creator) return { ...EMPTY_STATE };
  return {
    name: creator.name ?? '',
    email: creator.email ?? '',
    phone: creator.phone ?? '',
    platform: creator.platform ?? '',
    handle: creator.handle ?? '',
    followerCount:
      creator.followerCount != null
        ? String(creator.followerCount)
        : creator.followers != null
          ? String(creator.followers)
          : '',
    engagementRate:
      creator.engagementRate != null ? String(creator.engagementRate) : '',
    age: creator.age != null ? String(creator.age) : '',
    location: creator.location ?? '',
    niche: creator.niche ?? '',
    kids: !!creator.kids,
    kidsAges: creator.kidsAges ?? '',
    kidsOnVideo: !!creator.kidsOnVideo,
    compensation: creator.compensation ?? '',
    provision: creator.provision ?? '',
    fixAmount: creator.fixAmount != null ? String(creator.fixAmount) : '',
    ratePerPost: creator.ratePerPost != null ? String(creator.ratePerPost) : '',
    ratePerVideo:
      creator.ratePerVideo != null ? String(creator.ratePerVideo) : '',
    status: creator.status ?? 'prospect',
    tags: Array.isArray(creator.tags) ? [...creator.tags] : [],
    notes: creator.notes ?? '',
    score: creator.score != null ? String(creator.score) : '',
    firstContact: creator.firstContact ?? '',
  };
}

// ---------------------------------------------------------------------------
// Shared Tailwind classes (konsistent mit bestehendem Design)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator placeholder:text-gray-400 dark:placeholder:text-gray-500';
const labelCls =
  'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';
const sectionCls =
  'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pt-4 pb-2 border-t border-gray-200 dark:border-white/10';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreatorFormModal({
  open,
  onClose,
  mode,
  creator,
  onSuccess,
}: CreatorFormModalProps) {
  const createMutation = useCreateCreator();
  const updateMutation = useUpdateCreator();
  const [form, setForm] = useState<FormState>(() =>
    mode === 'edit' ? creatorToFormState(creator) : { ...EMPTY_STATE },
  );
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Re-initialize form when the modal opens or underlying data changes.
  useEffect(() => {
    if (open) {
      setForm(
        mode === 'edit' ? creatorToFormState(creator) : { ...EMPTY_STATE },
      );
      setTagInput('');
      setError(null);
    }
  }, [open, creator, mode]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  // Tags: add via Enter or comma
  const commitTag = useCallback((raw: string) => {
    const clean = raw.trim().replace(/^#/, '');
    if (!clean) return;
    setForm((f) =>
      f.tags.includes(clean) ? f : { ...f, tags: [...f.tags, clean] },
    );
    setTagInput('');
  }, []);

  const handleTagKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitTag(tagInput);
      } else if (
        e.key === 'Backspace' &&
        tagInput === '' &&
        form.tags.length > 0
      ) {
        // Remove last tag
        setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }));
      }
    },
    [commitTag, tagInput, form.tags.length],
  );

  const removeTag = useCallback((tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }, []);

  // Submit handler — converts strings to numbers / nulls as needed.
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (mode === 'edit' && !creator) {
        setError('Kein Creator zum Bearbeiten ausgewählt');
        return;
      }

      // Flush pending tag input
      const pendingTags = [...form.tags];
      const pending = tagInput.trim().replace(/^#/, '');
      if (pending && !pendingTags.includes(pending)) pendingTags.push(pending);

      const toNum = (v: string): number | undefined => {
        if (v.trim() === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      const payload: Record<string, any> = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        platform: form.platform || undefined,
        handle: form.handle.trim() || undefined,
        followerCount: toNum(form.followerCount),
        engagementRate: toNum(form.engagementRate),
        age: toNum(form.age),
        location: form.location.trim() || undefined,
        niche: form.niche || undefined,
        kids: form.kids,
        kidsAges: form.kids ? form.kidsAges.trim() || undefined : undefined,
        kidsOnVideo: form.kids ? form.kidsOnVideo : false,
        compensation: form.compensation || undefined,
        provision: form.provision.trim() || undefined,
        fixAmount: toNum(form.fixAmount),
        ratePerPost: toNum(form.ratePerPost),
        ratePerVideo: toNum(form.ratePerVideo),
        status: form.status,
        tags: pendingTags,
        notes: form.notes,
        score: toNum(form.score),
        firstContact: form.firstContact || undefined,
      };

      // Remove undefined values so we don't overwrite fields accidentally
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      if (!payload.name) {
        setError('Name ist erforderlich');
        return;
      }

      const onOk = (result: Creator) => {
        onClose();
        onSuccess?.(result);
      };
      const onErr = (err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : mode === 'create'
              ? 'Anlegen fehlgeschlagen'
              : 'Speichern fehlgeschlagen';
        setError(msg);
      };

      if (mode === 'create') {
        createMutation.mutate(payload as Partial<Creator>, {
          onSuccess: onOk,
          onError: onErr,
        });
      } else {
        updateMutation.mutate(
          { id: creator!.id, data: payload as Partial<Creator> },
          {
            onSuccess: onOk,
            onError: onErr,
          },
        );
      }
    },
    [
      mode,
      creator,
      form,
      tagInput,
      createMutation,
      updateMutation,
      onClose,
      onSuccess,
    ],
  );

  if (!open) return null;
  if (mode === 'edit' && !creator) return null;

  const title = mode === 'create' ? 'Creator anlegen' : 'Creator bearbeiten';
  const subtitle =
    mode === 'create'
      ? 'Neuen Creator zum Hub hinzufügen'
      : (creator?.name ?? '');
  const primaryLabel = mode === 'create' ? 'Anlegen' : 'Speichern';
  const primaryPendingLabel =
    mode === 'create' ? 'Anlegen...' : 'Speichert...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-3 overflow-y-auto flex-1"
        >
          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ---------------- Basis ---------------- */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-2">
            Basis
          </p>
          <div>
            <label className={labelCls}>Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputCls}
              placeholder="Creator Name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputCls}
                placeholder="creator@email.com"
              />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className={inputCls}
                placeholder="+49 ..."
              />
            </div>
          </div>

          {/* ---------------- Social Media ---------------- */}
          <p className={sectionCls}>Social Media</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Plattform</label>
              <select
                value={form.platform}
                onChange={(e) => update('platform', e.target.value)}
                className={inputCls}
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Handle</label>
              <input
                type="text"
                value={form.handle}
                onChange={(e) => update('handle', e.target.value)}
                className={inputCls}
                placeholder="@username"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Follower</label>
              <input
                type="number"
                min="0"
                value={form.followerCount}
                onChange={(e) => update('followerCount', e.target.value)}
                className={inputCls}
                placeholder="z.B. 25000"
              />
            </div>
            <div>
              <label className={labelCls}>Engagement Rate (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.engagementRate}
                onChange={(e) => update('engagementRate', e.target.value)}
                className={inputCls}
                placeholder="z.B. 4.2"
              />
            </div>
          </div>

          {/* ---------------- Demographics ---------------- */}
          <p className={sectionCls}>Demografie</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Alter</label>
              <input
                type="number"
                min="0"
                value={form.age}
                onChange={(e) => update('age', e.target.value)}
                className={inputCls}
                placeholder="z.B. 28"
              />
            </div>
            <div>
              <label className={labelCls}>Standort</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className={inputCls}
                placeholder="z.B. Berlin"
              />
            </div>
            <div>
              <label className={labelCls}>Kategorie (Niche)</label>
              <select
                value={form.niche}
                onChange={(e) => update('niche', e.target.value)}
                className={inputCls}
              >
                {NICHE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n || 'Keine'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kids */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.kids}
                onChange={(e) => update('kids', e.target.checked)}
                className="rounded border-gray-300 dark:border-white/20 text-accent-creator focus:ring-accent-creator/30"
              />
              Hat Kinder
            </label>
            {form.kids && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.kidsOnVideo}
                  onChange={(e) => update('kidsOnVideo', e.target.checked)}
                  className="rounded border-gray-300 dark:border-white/20 text-accent-creator focus:ring-accent-creator/30"
                />
                Kinder im Video
              </label>
            )}
          </div>
          {form.kids && (
            <div>
              <label className={labelCls}>Alter der Kinder</label>
              <input
                type="text"
                value={form.kidsAges}
                onChange={(e) => update('kidsAges', e.target.value)}
                className={inputCls}
                placeholder="z.B. 5, 8, 11"
              />
            </div>
          )}

          {/* ---------------- Vergütung ---------------- */}
          <p className={sectionCls}>Verg&uuml;tung</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vergütungsmodell</label>
              <select
                value={form.compensation}
                onChange={(e) => update('compensation', e.target.value)}
                className={inputCls}
              >
                {COMPENSATION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c || 'Keines'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Provision</label>
              <input
                type="text"
                value={form.provision}
                onChange={(e) => update('provision', e.target.value)}
                className={inputCls}
                placeholder="z.B. 20%"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fixbetrag (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fixAmount}
                onChange={(e) => update('fixAmount', e.target.value)}
                className={inputCls}
                placeholder="z.B. 500"
              />
            </div>
            <div>
              <label className={labelCls}>Rate pro Post (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ratePerPost}
                onChange={(e) => update('ratePerPost', e.target.value)}
                className={inputCls}
                placeholder="z.B. 250"
              />
            </div>
            <div>
              <label className={labelCls}>Rate pro Video (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ratePerVideo}
                onChange={(e) => update('ratePerVideo', e.target.value)}
                className={inputCls}
                placeholder="z.B. 500"
              />
            </div>
          </div>

          {/* ---------------- Organisation ---------------- */}
          <p className={sectionCls}>Organisation</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Erstkontakt</label>
              <select
                value={form.firstContact}
                onChange={(e) => update('firstContact', e.target.value)}
                className={inputCls}
              >
                {FIRST_CONTACT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f || 'Keiner'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Score (0 - 100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.score}
                onChange={(e) => update('score', e.target.value)}
                className={inputCls}
                placeholder="z.B. 85"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags</label>
            <div
              className={cn(
                'flex flex-wrap items-center gap-1.5 min-h-[38px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-2 py-1.5',
              )}
            >
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 text-xs px-2 py-0.5"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-400 hover:text-red-500"
                    aria-label={`Tag ${tag} entfernen`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) commitTag(tagInput);
                }}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none px-1"
                placeholder={
                  form.tags.length === 0
                    ? 'Tag eingeben und Enter dr\u00fccken'
                    : 'Weitere Tags...'
                }
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Enter oder Komma zum Hinzuf&uuml;gen, Backspace zum Entfernen
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notizen (intern)</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className={cn(inputCls, 'resize-y min-h-[80px]')}
              placeholder="Interne Notizen zum Creator..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 dark:border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-4 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {primaryPendingLabel}
              </>
            ) : (
              primaryLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreatorFormModal;
