'use client';

import { useEffect, useState } from 'react';
import { X, User, Sparkles, DollarSign, TrendingUp, Link2, FileText, MessageSquare, Loader2 } from 'lucide-react';
import {
  influencerPerformanceApi,
  PLATFORMS,
  STATUS_OPTIONS,
  type PerformanceEntry,
  type EntryStatus,
} from '@/lib/influencer-performance';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'influencer', label: 'Influencer',  icon: User },
  { id: 'campaign',   label: 'Kampagne',    icon: Sparkles },
  { id: 'costs',      label: 'Kosten',      icon: DollarSign },
  { id: 'performance',label: 'Performance', icon: TrendingUp },
  { id: 'tracking',   label: 'Tracking',    icon: Link2 },
  { id: 'content',    label: 'Content',     icon: FileText },
  { id: 'notes',      label: 'Notizen',     icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]['id'];

interface Props {
  entry?: PerformanceEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EntryFormModal({ entry, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<TabId>('influencer');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Partial<PerformanceEntry>>(() => entry
    ? { ...entry }
    : {
        influencerName: '', platform: 'instagram', status: 'planned',
        influencerFee: 0, productCost: 0, shippingCost: 0, cogs: 0, extraCost: 0,
        revenue: 0, orders: 0, clicks: 0, views: 0,
        whitelist: false, blacklist: false,
      });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof PerformanceEntry>(k: K, v: PerformanceEntry[K] | null) => {
    setData((prev) => ({ ...prev, [k]: v as any }));
  };

  async function handleSave() {
    if (!data.influencerName?.trim()) {
      // eslint-disable-next-line no-alert
      window.alert('Name ist Pflicht');
      setTab('influencer');
      return;
    }
    if (!data.platform) {
      setTab('influencer');
      return;
    }
    setBusy(true);
    try {
      if (entry) {
        await influencerPerformanceApi.update(entry.id, data);
      } else {
        await influencerPerformanceApi.create(data);
      }
      onSaved();
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(`Speichern fehlgeschlagen: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-[5] w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white">
            {entry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 pt-2 border-b border-gray-100 dark:border-white/5 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors',
                  active
                    ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-b-2 border-violet-500 -mb-px'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.02]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'influencer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name *" required>
                <input
                  autoFocus
                  value={data.influencerName ?? ''}
                  onChange={(e) => set('influencerName', e.target.value)}
                  placeholder="@username oder voller Name"
                  className={inputCls}
                />
              </Field>
              <Field label="Plattform *">
                <select value={data.platform ?? 'instagram'} onChange={(e) => set('platform', e.target.value)} className={inputCls}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Kategorie / Nische">
                <input value={data.category ?? ''} onChange={(e) => set('category', e.target.value || null)} placeholder="z.B. Beauty, Tech …" className={inputCls} />
              </Field>
              <Field label="Manager / Kontakt">
                <input value={data.managerContact ?? ''} onChange={(e) => set('managerContact', e.target.value || null)} placeholder="agentur@example.com" className={inputCls} />
              </Field>
              <Field label="Profil-URL" wide>
                <input value={data.profileUrl ?? ''} onChange={(e) => set('profileUrl', e.target.value || null)} placeholder="https://instagram.com/…" className={inputCls} />
              </Field>
              <Field label="Follower">
                <input type="number" min="0" value={data.followerCount ?? ''} onChange={(e) => set('followerCount', e.target.value === '' ? null : parseInt(e.target.value, 10))} className={inputCls} />
              </Field>
              <Field label="Engagement Rate (%)">
                <input type="number" step="0.01" min="0" value={data.engagementRate ?? ''} onChange={(e) => set('engagementRate', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Story Views">
                <input type="number" min="0" value={data.storyViews ?? ''} onChange={(e) => set('storyViews', e.target.value === '' ? null : parseInt(e.target.value, 10))} className={inputCls} />
              </Field>
              <Field label="Ø Views (Posts/Reels)">
                <input type="number" min="0" value={data.avgViews ?? ''} onChange={(e) => set('avgViews', e.target.value === '' ? null : parseInt(e.target.value, 10))} className={inputCls} />
              </Field>
              <Field label="Land">
                <input value={data.country ?? ''} onChange={(e) => set('country', e.target.value || null)} placeholder="DE, AT, CH …" className={inputCls} />
              </Field>
              <Field label="Sprache">
                <input value={data.language ?? ''} onChange={(e) => set('language', e.target.value || null)} placeholder="de, en …" className={inputCls} />
              </Field>
            </div>
          )}

          {tab === 'campaign' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Kampagne" wide>
                <input value={data.campaignName ?? ''} onChange={(e) => set('campaignName', e.target.value || null)} placeholder="z.B. Summer Drop 2026" className={inputCls} />
              </Field>
              <Field label="Datum Post">
                <input type="datetime-local" value={dtLocal(data.postedAt)} onChange={(e) => set('postedAt', e.target.value ? new Date(e.target.value).toISOString() : null)} className={inputCls} />
              </Field>
              <Field label="Datum Story">
                <input type="datetime-local" value={dtLocal(data.storyAt)} onChange={(e) => set('storyAt', e.target.value ? new Date(e.target.value).toISOString() : null)} className={inputCls} />
              </Field>
              <Field label="Produkt" wide>
                <input value={data.productName ?? ''} onChange={(e) => set('productName', e.target.value || null)} className={inputCls} />
              </Field>
              <Field label="Rabattcode">
                <input value={data.discountCode ?? ''} onChange={(e) => set('discountCode', e.target.value || null)} placeholder="z.B. ANNA15" className={inputCls} />
              </Field>
              <Field label="Rabatt (%)">
                <input type="number" step="0.01" min="0" value={data.discountPct ?? ''} onChange={(e) => set('discountPct', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Landingpage" wide>
                <input value={data.landingPageUrl ?? ''} onChange={(e) => set('landingPageUrl', e.target.value || null)} placeholder="https://…" className={inputCls} />
              </Field>
              <Field label="Affiliate-Link" wide>
                <input value={data.affiliateLink ?? ''} onChange={(e) => set('affiliateLink', e.target.value || null)} placeholder="https://…" className={inputCls} />
              </Field>
              <Field label="Status" wide>
                <select value={data.status ?? 'planned'} onChange={(e) => set('status', e.target.value as EntryStatus)} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>
          )}

          {tab === 'costs' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Alle Beträge in EUR. Die Gesamtkosten werden automatisch berechnet.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Influencer-Kosten">
                  <input type="number" step="0.01" min="0" value={data.influencerFee ?? 0} onChange={(e) => set('influencerFee', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Produktkosten (gratis Ware)">
                  <input type="number" step="0.01" min="0" value={data.productCost ?? 0} onChange={(e) => set('productCost', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Versandkosten">
                  <input type="number" step="0.01" min="0" value={data.shippingCost ?? 0} onChange={(e) => set('shippingCost', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="COGS (Wareneinsatz pro Bestellung × Bestellungen)">
                  <input type="number" step="0.01" min="0" value={data.cogs ?? 0} onChange={(e) => set('cogs', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Zusatzkosten" wide>
                  <input type="number" step="0.01" min="0" value={data.extraCost ?? 0} onChange={(e) => set('extraCost', Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <CostTotal data={data} />
            </div>
          )}

          {tab === 'performance' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Eingabewerte. ROAS, ROI, CPA, CPM, Conversion Rate, EPC, AOV werden automatisch live berechnet.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Umsatz (EUR)">
                  <input type="number" step="0.01" min="0" value={data.revenue ?? 0} onChange={(e) => set('revenue', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Bestellungen">
                  <input type="number" min="0" value={data.orders ?? 0} onChange={(e) => set('orders', parseInt(e.target.value, 10) || 0)} className={inputCls} />
                </Field>
                <Field label="Klicks">
                  <input type="number" min="0" value={data.clicks ?? 0} onChange={(e) => set('clicks', parseInt(e.target.value, 10) || 0)} className={inputCls} />
                </Field>
                <Field label="Views (für CPM)">
                  <input type="number" min="0" value={data.views ?? 0} onChange={(e) => set('views', parseInt(e.target.value, 10) || 0)} className={inputCls} />
                </Field>
                <Field label="Gewinnmarge Override (%) — optional" wide hint="Leer = wird aus Umsatz - Gesamtkosten berechnet">
                  <input type="number" step="0.01" value={data.profitMarginOverride ?? ''} onChange={(e) => set('profitMarginOverride', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <PerformancePreview data={data} />
            </div>
          )}

          {tab === 'tracking' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tracking-Link" wide>
                <input value={data.trackingLink ?? ''} onChange={(e) => set('trackingLink', e.target.value || null)} className={inputCls} />
              </Field>
              <Field label="UTM Source">
                <input value={data.utmSource ?? ''} onChange={(e) => set('utmSource', e.target.value || null)} placeholder="instagram, tiktok …" className={inputCls} />
              </Field>
              <Field label="UTM Campaign">
                <input value={data.utmCampaign ?? ''} onChange={(e) => set('utmCampaign', e.target.value || null)} className={inputCls} />
              </Field>
              <Field label="Tracking-Status">
                <select value={data.trackingStatus ?? ''} onChange={(e) => set('trackingStatus', e.target.value || null)} className={inputCls}>
                  <option value="">— nicht gesetzt —</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="partial">Partial</option>
                  <option value="failed">Failed</option>
                </select>
              </Field>
              <Field label="Attribution bestätigt?">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!data.attributionConfirmed} onChange={(e) => set('attributionConfirmed', e.target.checked)} className="rounded" />
                  Ja, Zuordnung passt
                </label>
              </Field>
            </div>
          )}

          {tab === 'content' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Hook hat funktioniert?">
                <ThreeWaySelect value={data.hookWorked} onChange={(v) => set('hookWorked', v)} />
              </Field>
              <Field label="Wieder buchbar?">
                <ThreeWaySelect value={data.bookable} onChange={(v) => set('bookable', v)} />
              </Field>
              <Field label="CTA-Qualität (1-5)">
                <RatingInput value={data.ctaQuality} onChange={(v) => set('ctaQuality', v)} />
              </Field>
              <Field label="Video-Qualität (1-5)">
                <RatingInput value={data.videoQuality} onChange={(v) => set('videoQuality', v)} />
              </Field>
              <Field label="Branding-Score (1-5)">
                <RatingInput value={data.brandingScore} onChange={(v) => set('brandingScore', v)} />
              </Field>
              <Field label="Performance-Bewertung (1-5)">
                <RatingInput value={data.performanceRating} onChange={(v) => set('performanceRating', v)} />
              </Field>
              <Field label="Whitelist (Top-Performer)">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!data.whitelist} onChange={(e) => set('whitelist', e.target.checked)} className="rounded text-emerald-600" />
                  ⭐ als Top-Performer markieren
                </label>
              </Field>
              <Field label="Blacklist">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!data.blacklist} onChange={(e) => set('blacklist', e.target.checked)} className="rounded text-red-600" />
                  🚫 nicht mehr buchen
                </label>
              </Field>
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              <Field label="Learnings" wide>
                <textarea rows={3} value={data.learnings ?? ''} onChange={(e) => set('learnings', e.target.value || null)} className={textareaCls} placeholder="Was haben wir aus dieser Kampagne gelernt?" />
              </Field>
              <Field label="Was hat funktioniert?" wide>
                <textarea rows={3} value={data.whatWorked ?? ''} onChange={(e) => set('whatWorked', e.target.value || null)} className={textareaCls} />
              </Field>
              <Field label="Was hat nicht funktioniert?" wide>
                <textarea rows={3} value={data.whatDidntWork ?? ''} onChange={(e) => set('whatDidntWork', e.target.value || null)} className={textareaCls} />
              </Field>
              <Field label="Verbesserungs-Ideen" wide>
                <textarea rows={3} value={data.improvementIdeas ?? ''} onChange={(e) => set('improvementIdeas', e.target.value || null)} className={textareaCls} />
              </Field>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {entry ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
const textareaCls = inputCls + ' resize-none';

function Field({ label, children, wide = false, required = false, hint }: { label: string; children: React.ReactNode; wide?: boolean; required?: boolean; hint?: string }) {
  return (
    <label className={cn('block', wide && 'sm:col-span-2')}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

function ThreeWaySelect({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const v = value === undefined ? null : value;
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <button type="button" onClick={() => onChange(null)}     className={cn('px-3 py-1.5 text-xs', v === null ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white' : 'text-gray-500')}>—</button>
      <button type="button" onClick={() => onChange(true)}     className={cn('px-3 py-1.5 text-xs', v === true ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'text-gray-500')}>✓ Ja</button>
      <button type="button" onClick={() => onChange(false)}    className={cn('px-3 py-1.5 text-xs', v === false ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'text-gray-500')}>✗ Nein</button>
    </div>
  );
}

function RatingInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            'h-8 w-8 rounded-lg text-xs font-semibold transition-colors',
            value && value >= n
              ? 'bg-amber-400 text-white'
              : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function CostTotal({ data }: { data: Partial<PerformanceEntry> }) {
  const total = Number(data.influencerFee ?? 0) + Number(data.productCost ?? 0) + Number(data.shippingCost ?? 0) + Number(data.cogs ?? 0) + Number(data.extraCost ?? 0);
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-200/50 dark:border-violet-700/30 p-4 flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-violet-600 dark:text-violet-300 font-semibold">Gesamtkosten</span>
      <span className="font-display-serif text-2xl font-medium text-gray-900 dark:text-white">
        {total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  );
}

function PerformancePreview({ data }: { data: Partial<PerformanceEntry> }) {
  const totalCost = Number(data.influencerFee ?? 0) + Number(data.productCost ?? 0) + Number(data.shippingCost ?? 0) + Number(data.cogs ?? 0) + Number(data.extraCost ?? 0);
  const revenue = Number(data.revenue ?? 0);
  const orders = Number(data.orders ?? 0);
  const clicks = Number(data.clicks ?? 0);
  const views = Number(data.views ?? 0);
  const profit = revenue - totalCost;
  const roas = totalCost > 0 ? revenue / totalCost : null;
  const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : null;
  const cpa = orders > 0 ? totalCost / orders : null;
  const cpm = views > 0 ? (totalCost / views) * 1000 : null;
  const conv = clicks > 0 ? (orders / clicks) * 100 : null;
  const aov = orders > 0 ? revenue / orders : null;

  const fmt = (n: number | null, opts?: Intl.NumberFormatOptions) =>
    n == null ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: 2, ...opts });
  const eur = (n: number | null) => n == null ? '—' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border border-emerald-200/50 dark:border-emerald-700/30 p-4">
      <div className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-300 font-semibold mb-3">Live-Berechnungen</div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-xs">
        <Stat label="Profit" value={eur(profit)} positive={profit > 0} negative={profit < 0} />
        <Stat label="ROAS" value={fmt(roas)} positive={roas != null && roas > 1} negative={roas != null && roas < 1} />
        <Stat label="ROI %" value={fmt(roi)} positive={roi != null && roi > 0} negative={roi != null && roi < 0} />
        <Stat label="CPA" value={eur(cpa)} />
        <Stat label="CPM" value={eur(cpm)} />
        <Stat label="Conv. %" value={fmt(conv)} />
        <Stat label="AOV" value={eur(aov)} />
      </div>
    </div>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn(
        'font-mono font-semibold tabular-nums',
        positive && 'text-emerald-600 dark:text-emerald-400',
        negative && 'text-red-600 dark:text-red-400',
      )}>
        {value}
      </div>
    </div>
  );
}

function dtLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
