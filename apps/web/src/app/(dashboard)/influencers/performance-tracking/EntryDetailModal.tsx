'use client';

import { useEffect } from 'react';
import {
  X, Edit2, Trash2, Star, Ban, ExternalLink, TrendingUp, TrendingDown,
  Users, Eye, MousePointerClick, ShoppingCart, Banknote, Target,
  Sparkles, Calendar, Tag, Hash, Globe, Link as LinkIcon,
  Award, Lightbulb, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2,
  Flame, BadgeCheck, RotateCcw, Activity,
} from 'lucide-react';
import { type PerformanceEntry, STATUS_OPTIONS } from '@/lib/influencer-performance';
import { cn } from '@/lib/utils';

interface Props {
  entry: PerformanceEntry;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleWhitelist: () => void;
  onToggleBlacklist: () => void;
}

const eur = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

const num = (n: number | null | undefined, suffix = '') =>
  n == null ? '—' : `${Number(n).toLocaleString('de-DE')}${suffix}`;

const pct = (n: number | null | undefined, digits = 1) =>
  n == null ? '—' : `${Number(n).toFixed(digits)}%`;

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const PERF_FLAG_META: Record<string, { label: string; tone: string }> = {
  '🔥': { label: 'Top Performer', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-500/30' },
  '✅': { label: 'Profitabel',    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' },
  '⚠️': { label: 'Knapp',         tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
  '❌': { label: 'Verlust',       tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-500/30' },
};

export function EntryDetailModal({
  entry, onClose, onEdit, onDelete, onToggleWhitelist, onToggleBlacklist,
}: Props) {
  // ESC schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = STATUS_OPTIONS.find((s) => s.value === entry.status);
  const isProfit = entry.profit > 0;
  const flagMeta = entry.perfFlag ? PERF_FLAG_META[entry.perfFlag] : null;
  const ratings = [entry.ctaQuality, entry.videoQuality, entry.brandingScore, entry.performanceRating].filter(
    (r): r is number => r != null,
  );
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r, 0) / ratings.length
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-4xl max-h-[95vh] sm:max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden modal-panel"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="inline-flex h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 items-center justify-center flex-shrink-0 text-lg shadow">
              {entry.perfFlag ?? '·'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {entry.influencerName}
                </h2>
                {entry.whitelist && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200">
                    <Star className="h-2.5 w-2.5 fill-current" /> WHITELIST
                  </span>
                )}
                {entry.blacklist && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200">
                    <Ban className="h-2.5 w-2.5" /> BLACKLIST
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                <span className="capitalize font-medium">{entry.platform}</span>
                {entry.category && <><span>·</span><span>{entry.category}</span></>}
                {entry.country && <><span>·</span><span className="uppercase">{entry.country}</span></>}
                {entry.profileUrl && (
                  <a href={entry.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400 hover:underline">
                    Profil <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {status && (
                  <span className={cn('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full', status.color)}>{status.label}</span>
                )}
                {flagMeta && (
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', flagMeta.tone)}>
                    {entry.perfFlag} {flagMeta.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* HERO: KPI-Kacheln */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <HeroKpi
              label="Profit"
              value={eur(entry.profit)}
              accent={isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
              icon={isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              hint={entry.roi != null ? `${pct(entry.roi, 1)} ROI` : undefined}
            />
            <HeroKpi
              label="ROAS"
              value={entry.roas == null ? '—' : `×${entry.roas.toFixed(2)}`}
              accent={entry.roas != null && entry.breakEvenRoas != null && entry.roas >= entry.breakEvenRoas
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-700 dark:text-gray-300'}
              icon={<Activity className="h-4 w-4" />}
              hint={entry.breakEvenRoas != null ? `Break-even ×${entry.breakEvenRoas.toFixed(2)}` : undefined}
            />
            <HeroKpi
              label="Umsatz"
              value={eur(entry.revenue)}
              icon={<Banknote className="h-4 w-4" />}
              hint={`${entry.orders} Orders`}
            />
            <HeroKpi
              label="Gesamt-Kosten"
              value={eur(entry.totalCost)}
              icon={<Target className="h-4 w-4" />}
              hint={`Gewinnmarge ${pct(entry.profitMargin, 1)}`}
            />
          </div>

          {/* Erweiterte KPIs */}
          <Section icon={<Activity className="h-3.5 w-3.5" />} title="Detail-Metriken">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Stat label="CPA (Cost per Acquisition)" value={eur(entry.cpa)} />
              <Stat label="CPM (Cost per 1k Impressions)" value={eur(entry.cpm)} />
              <Stat label="EPC (Earnings per Click)" value={eur(entry.epc)} />
              <Stat label="AOV (Average Order Value)" value={eur(entry.aov)} />
              <Stat label="Conversion-Rate" value={pct(entry.conversionRate)} />
              <Stat label="Klicks" value={num(entry.clicks)} />
              <Stat label="Views" value={num(entry.views)} />
              <Stat label="Bestellungen" value={num(entry.orders)} />
            </div>
          </Section>

          {/* Kosten-Aufschluesselung */}
          <Section icon={<Banknote className="h-3.5 w-3.5" />} title="Kosten-Aufschlüsselung">
            <CostBreakdown entry={entry} />
          </Section>

          {/* Kampagne + Produkt */}
          <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="Kampagne & Produkt">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <InfoRow label="Kampagne" value={entry.campaignName} />
              <InfoRow label="Produkt" value={entry.productName} />
              <InfoRow label="Veröffentlicht" value={fmtDate(entry.postedAt)} />
              <InfoRow label="Story" value={fmtDate(entry.storyAt)} />
              <InfoRow label="Discount-Code" value={entry.discountCode} mono />
              <InfoRow label="Discount %" value={entry.discountPct != null ? pct(entry.discountPct, 0) : null} />
              {entry.landingPageUrl && (
                <InfoRow label="Landingpage" value={<ExternalLinkText href={entry.landingPageUrl} />} wide />
              )}
              {entry.affiliateLink && (
                <InfoRow label="Affiliate-Link" value={<ExternalLinkText href={entry.affiliateLink} />} wide />
              )}
            </div>
          </Section>

          {/* Influencer-Profil */}
          <Section icon={<Users className="h-3.5 w-3.5" />} title="Influencer-Profil">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Stat label="Follower" value={num(entry.followerCount)} icon={<Users className="h-3 w-3" />} />
              <Stat label="Engagement-Rate" value={pct(entry.engagementRate)} icon={<ThumbsUp className="h-3 w-3" />} />
              <Stat label="Story-Views" value={num(entry.storyViews)} icon={<Eye className="h-3 w-3" />} />
              <Stat label="Ø Views/Post" value={num(entry.avgViews)} icon={<Eye className="h-3 w-3" />} />
              <Stat label="Sprache" value={entry.language ? entry.language.toUpperCase() : '—'} />
              <Stat label="Land" value={entry.country ? entry.country.toUpperCase() : '—'} />
              {entry.managerContact && (
                <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Manager-Kontakt</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200">{entry.managerContact}</div>
                </div>
              )}
            </div>
          </Section>

          {/* Tracking & Attribution */}
          {(entry.trackingLink || entry.utmSource || entry.utmCampaign || entry.trackingStatus) && (
            <Section icon={<LinkIcon className="h-3.5 w-3.5" />} title="Tracking & Attribution">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {entry.trackingLink && (
                  <InfoRow label="Tracking-Link" value={<ExternalLinkText href={entry.trackingLink} />} wide />
                )}
                <InfoRow label="UTM-Source" value={entry.utmSource} mono />
                <InfoRow label="UTM-Campaign" value={entry.utmCampaign} mono />
                <InfoRow label="Tracking-Status" value={entry.trackingStatus} />
                <InfoRow
                  label="Attribution"
                  value={entry.attributionConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Bestätigt
                    </span>
                  ) : (
                    <span className="text-gray-500">Nicht bestätigt</span>
                  )}
                />
              </div>
            </Section>
          )}

          {/* Content-Quality + Ratings */}
          <Section icon={<Award className="h-3.5 w-3.5" />} title="Content-Bewertung">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RatingBar label="CTA-Qualität" value={entry.ctaQuality} />
              <RatingBar label="Video-Qualität" value={entry.videoQuality} />
              <RatingBar label="Branding" value={entry.brandingScore} />
              <RatingBar label="Performance" value={entry.performanceRating} />
            </div>
            {avgRating != null && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Durchschnitt: <strong className="text-gray-800 dark:text-gray-200">{avgRating.toFixed(1)}/5</strong>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Flag
                yes={entry.hookWorked === true}
                no={entry.hookWorked === false}
                label="Hook hat funktioniert"
                emoji="🎯"
              />
              <Flag
                yes={entry.bookable === true}
                no={entry.bookable === false}
                label="Wieder buchbar"
                emoji="🔁"
              />
            </div>
          </Section>

          {/* Learnings */}
          {(entry.whatWorked || entry.whatDidntWork || entry.learnings || entry.improvementIdeas) && (
            <Section icon={<Lightbulb className="h-3.5 w-3.5" />} title="Learnings">
              <div className="space-y-3">
                {entry.whatWorked && (
                  <LearningBlock
                    icon={<ThumbsUp className="h-3 w-3" />}
                    label="Was hat funktioniert"
                    text={entry.whatWorked}
                    tone="emerald"
                  />
                )}
                {entry.whatDidntWork && (
                  <LearningBlock
                    icon={<ThumbsDown className="h-3 w-3" />}
                    label="Was lief nicht"
                    text={entry.whatDidntWork}
                    tone="red"
                  />
                )}
                {entry.improvementIdeas && (
                  <LearningBlock
                    icon={<Lightbulb className="h-3 w-3" />}
                    label="Verbesserungs-Ideen"
                    text={entry.improvementIdeas}
                    tone="amber"
                  />
                )}
                {entry.learnings && (
                  <LearningBlock
                    icon={<BadgeCheck className="h-3 w-3" />}
                    label="Allgemeine Learnings"
                    text={entry.learnings}
                    tone="blue"
                  />
                )}
              </div>
            </Section>
          )}

          {/* Meta */}
          <div className="rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/8 px-4 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between flex-wrap gap-2">
            <span>Erstellt: {fmtDateTime(entry.createdAt)}</span>
            <span>Aktualisiert: {fmtDateTime(entry.updatedAt)}</span>
          </div>
        </div>

        {/* Footer — Action-Bar */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02] mobile-safe-bottom">
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleWhitelist}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium',
                entry.whitelist
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
              )}
              title={entry.whitelist ? 'Aus Whitelist entfernen' : 'Auf Whitelist setzen'}
            >
              <Star className={cn('h-3.5 w-3.5', entry.whitelist && 'fill-current')} />
              <span className="hidden sm:inline">Whitelist</span>
            </button>
            <button
              onClick={onToggleBlacklist}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium',
                entry.blacklist
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
              )}
              title={entry.blacklist ? 'Aus Blacklist entfernen' : 'Auf Blacklist setzen'}
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Blacklist</span>
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Löschen</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              Schließen
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 hover:from-violet-600 hover:to-purple-700 px-4 py-2 text-xs font-medium text-white shadow"
            >
              <Edit2 className="h-3.5 w-3.5" /> Bearbeiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Komponenten
// -----------------------------------------------------------------------------

function HeroKpi({
  label, value, accent, icon, hint,
}: { label: string; value: string; accent?: string; icon?: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/8 p-3">
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
        {icon} {label}
      </div>
      <div className={cn('text-xl sm:text-2xl font-bold tabular-nums', accent ?? 'text-gray-900 dark:text-white')}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums truncate">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, wide }: { label: string; value: React.ReactNode | null | undefined; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2 py-1', wide && 'sm:col-span-2')}>
      <span className="text-gray-500 dark:text-gray-400 min-w-[120px] flex-shrink-0">{label}</span>
      <span className={cn('text-gray-800 dark:text-gray-200 break-all', mono && 'font-mono text-[11px]')}>
        {value ?? <span className="text-gray-400 italic">—</span>}
      </span>
    </div>
  );
}

function ExternalLinkText({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline break-all"
    >
      {href.replace(/^https?:\/\//, '').slice(0, 60)}
      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
    </a>
  );
}

function CostBreakdown({ entry }: { entry: PerformanceEntry }) {
  const parts = [
    { label: 'Influencer-Honorar', value: entry.influencerFee, color: '#8b5cf6' },
    { label: 'Produkt-Kosten',     value: entry.productCost,    color: '#06b6d4' },
    { label: 'Versand',            value: entry.shippingCost,   color: '#f59e0b' },
    { label: 'COGS',               value: entry.cogs,           color: '#10b981' },
    { label: 'Sonstige',           value: entry.extraCost,      color: '#ec4899' },
  ].filter((p) => p.value > 0);
  const total = entry.totalCost;
  if (total === 0 || parts.length === 0) {
    return <div className="text-xs text-gray-500 italic">Keine Kosten erfasst.</div>;
  }

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/8 mb-3">
        {parts.map((p, i) => {
          const pctW = (p.value / total) * 100;
          return (
            <div
              key={i}
              style={{ width: `${pctW}%`, background: p.color }}
              title={`${p.label}: ${eur(p.value)} (${pctW.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-gray-700 dark:text-gray-300 truncate">{p.label}</span>
            </span>
            <span className="tabular-nums font-medium text-gray-800 dark:text-gray-200 flex-shrink-0">{eur(p.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/5 sm:col-span-3">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Gesamt</span>
          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{eur(total)}</span>
        </div>
      </div>
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</div>
        <div className="text-xs text-gray-400 italic">—</div>
      </div>
    );
  }
  const pct = (value / 5) * 100;
  const color = value >= 4 ? '#10b981' : value >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-200">{value}/5</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Flag({ yes, no, label, emoji }: { yes: boolean; no: boolean; label: string; emoji: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 flex items-center justify-between bg-white dark:bg-white/[0.03]">
      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
        <span className="mr-1">{emoji}</span>{label}
      </span>
      {yes && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ja
        </span>
      )}
      {no && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
          <X className="h-3.5 w-3.5" /> Nein
        </span>
      )}
      {!yes && !no && (
        <span className="text-xs text-gray-400 italic">—</span>
      )}
    </div>
  );
}

function LearningBlock({ icon, label, text, tone }: {
  icon: React.ReactNode;
  label: string;
  text: string;
  tone: 'emerald' | 'red' | 'amber' | 'blue';
}) {
  const map = {
    emerald: 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    red:     'bg-red-50/60 dark:bg-red-900/15 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300',
    amber:   'bg-amber-50/60 dark:bg-amber-900/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
    blue:    'bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300',
  };
  return (
    <div className={cn('rounded-xl border p-3', map[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold mb-1.5">
        {icon} {label}
      </div>
      <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
