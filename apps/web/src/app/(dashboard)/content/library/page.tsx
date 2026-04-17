'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Star,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Copy,
  Trash2,
  Info,
  ExternalLink,
  Globe,
  Users,
  BarChart3,
  Calendar,
  DollarSign,
  Smartphone,
  AlertCircle,
  Check,
  BookmarkPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useContentList,
  useCreateContent,
  useDeleteContent,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
  PLATFORMS,
  PLATFORM_LABELS,
} from '@/hooks/content/useContent';
import type { ContentPiece, ContentListParams } from '@/hooks/content/useContent';
import {
  useAdLibrarySearch,
  AD_LIBRARY_COUNTRIES,
} from '@/hooks/content/useAdLibrary';
import type { AdLibraryAd } from '@/hooks/content/useAdLibrary';

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

function CreateContentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateContent();
  const [form, setForm] = useState({
    type: 'headline',
    title: '',
    body: '',
    platform: '',
    campaign: '',
    tags: '',
  });

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    await createMutation.mutateAsync({
      type: form.type,
      title: form.title,
      body: form.body,
      platform: form.platform || undefined,
      campaign: form.campaign || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      status: 'draft',
    } as any);
    onClose();
    setForm({ type: 'headline', title: '', body: '', platform: '', campaign: '', tags: '' });
  }, [form, createMutation, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Content</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Give your content a title..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              placeholder="Write your content..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              >
                <option value="">Select platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Campaign</label>
              <input
                type="text"
                value={form.campaign}
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                placeholder="Campaign name"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="spring, hero, retargeting"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.title.trim() || !form.body.trim()}
            className="rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Card (existing library)
// ---------------------------------------------------------------------------

function ContentCard({ piece }: { piece: ContentPiece }) {
  const deleteMutation = useDeleteContent();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(piece.body);
  }, [piece.body]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium',
              CONTENT_TYPE_COLORS[piece.type] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {CONTENT_TYPE_LABELS[piece.type] ?? piece.type}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium',
              CONTENT_STATUS_COLORS[piece.status] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {CONTENT_STATUS_LABELS[piece.status] ?? piece.status}
          </span>
          {piece.aiGenerated && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-xxs font-medium text-purple-600">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>
        {piece.platform && (
          <span className="text-xxs text-gray-400 uppercase tracking-wider shrink-0">
            {PLATFORM_LABELS[piece.platform] ?? piece.platform}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-1.5 line-clamp-1">{piece.title}</h4>

      {/* Body preview */}
      <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed whitespace-pre-line">
        {piece.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Rating stars */}
          {piece.rating ? (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-3 w-3',
                    i < piece.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200',
                  )}
                />
              ))}
            </div>
          ) : (
            <span className="text-xxs text-gray-300">No rating</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteMutation.mutate(piece.id)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {piece.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {piece.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-xxs text-gray-500"
            >
              {tag}
            </span>
          ))}
          {piece.tags.length > 3 && (
            <span className="text-xxs text-gray-400">+{piece.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Date */}
      <div className="text-xxs text-gray-400 mt-2">
        {new Date(piece.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
        {piece.campaign && (
          <>
            {' '}
            &middot; <span className="text-accent-content">{piece.campaign}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ad Library Card
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}.000`;
  return String(n);
}

function formatRange(min: number, max: number, prefix?: string, suffix?: string): string {
  if (min === 0 && max === 0) return '-';
  const p = prefix || '';
  const s = suffix || '';
  if (min === max) return `${p}${formatNumber(min)}${s}`;
  return `${p}${formatNumber(min)} - ${formatNumber(max)}${s}`;
}

function DemographicBar({
  label,
  percentage,
}: {
  label: string;
  percentage: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xxs text-gray-500 w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-content rounded-full"
          style={{ width: `${Math.min(percentage * 100, 100)}%` }}
        />
      </div>
      <span className="text-xxs text-gray-400 w-8 text-right shrink-0">
        {(percentage * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function AdLibraryCard({
  ad,
  onSaveTemplate,
}: {
  ad: AdLibraryAd;
  onSaveTemplate: (ad: AdLibraryAd) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);

  const handleCopy = useCallback(() => {
    const text = [ad.headline, ad.creativeBody, ad.linkDescription]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [ad]);

  const formattedDate = ad.startDate
    ? new Date(ad.startDate).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '-';

  // Aggregate demographics by gender
  const genderBreakdown: Record<string, number> = {};
  const ageBreakdown: Record<string, number> = {};
  for (const d of ad.demographics) {
    genderBreakdown[d.gender] = (genderBreakdown[d.gender] || 0) + d.percentage;
    ageBreakdown[d.age] = (ageBreakdown[d.age] || 0) + d.percentage;
  }

  return (
    <div className="rounded-xl bg-white shadow-card hover:shadow-card-hover transition-all overflow-hidden">
      {/* Snapshot preview */}
      {ad.snapshotUrl && !snapshotError ? (
        <div className="relative w-full h-48 bg-gray-50 border-b border-border">
          <iframe
            src={ad.snapshotUrl}
            title={`Ad preview: ${ad.pageName}`}
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            onError={() => setSnapshotError(true)}
          />
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 backdrop-blur px-2 py-1 text-xxs text-gray-600 hover:text-gray-900 shadow-sm transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Auf Meta ansehen
          </a>
        </div>
      ) : ad.snapshotUrl ? (
        <div className="w-full h-20 bg-gray-50 border-b border-border flex items-center justify-center">
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent-content hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview auf Meta ansehen
          </a>
        </div>
      ) : null}

      <div className="p-4 space-y-3">
        {/* Page name */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-accent-content/10 text-accent-content shrink-0">
            <Globe className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{ad.pageName}</p>
          </div>
        </div>

        {/* Headline */}
        {ad.headline && (
          <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {ad.headline}
          </h4>
        )}

        {/* Body */}
        {ad.creativeBody && (
          <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed whitespace-pre-line">
            {ad.creativeBody}
          </p>
        )}

        {/* Link caption */}
        {ad.linkCaption && (
          <p className="text-xxs text-gray-400 truncate">{ad.linkCaption}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-xxs text-gray-600">
              Impressionen: {formatRange(ad.impressionsMin, ad.impressionsMax)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-xxs text-gray-600">
              Spend: {formatRange(ad.spendMin, ad.spendMax, '', ` ${ad.currency}`)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-xxs text-gray-600 truncate">
              {ad.platforms.length > 0
                ? ad.platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                : '-'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-xxs text-gray-600">Seit: {formattedDate}</span>
          </div>
        </div>

        {/* Demographics */}
        {ad.demographics.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-xxs font-medium text-gray-600">Zielgruppe</span>
            </div>
            {Object.entries(genderBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([gender, pct]) => (
                <DemographicBar
                  key={gender}
                  label={gender === 'female' ? 'Weiblich' : gender === 'male' ? 'Maennlich' : gender}
                  percentage={pct}
                />
              ))}
            {Object.entries(ageBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([age, pct]) => (
                <DemographicBar key={age} label={age} percentage={pct} />
              ))}
          </div>
        )}

        {/* Regions */}
        {ad.regions.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <span className="text-xxs font-medium text-gray-600">Top Regionen</span>
            {ad.regions
              .sort((a, b) => b.percentage - a.percentage)
              .slice(0, 3)
              .map((r) => (
                <DemographicBar
                  key={r.region}
                  label={r.region}
                  percentage={r.percentage}
                />
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={() => onSaveTemplate(ad)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <BookmarkPlus className="h-3 w-3" />
            Als Template speichern
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Kopiert
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy kopieren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ad Library Tab Content
// ---------------------------------------------------------------------------

function AdLibraryTab() {
  const [searchInput, setSearchInput] = useState('');
  const [country, setCountry] = useState('DE');
  const [searchParams, setSearchParams] = useState<{
    searchTerm: string;
    country: string;
  } | null>(null);

  const createMutation = useCreateContent();

  const adQuery = useAdLibrarySearch(searchParams);
  const ads = adQuery.data?.data ?? [];
  const configured = adQuery.data?.configured ?? true;

  const handleSearch = useCallback(() => {
    if (!searchInput.trim()) return;
    setSearchParams({ searchTerm: searchInput.trim(), country });
  }, [searchInput, country]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  const handleSaveTemplate = useCallback(
    async (ad: AdLibraryAd) => {
      const title = ad.headline || `${ad.pageName} - Ad`;
      const body = [
        ad.headline && `**Headline:** ${ad.headline}`,
        ad.creativeBody && `**Body:** ${ad.creativeBody}`,
        ad.linkDescription && `**Link Description:** ${ad.linkDescription}`,
        ad.linkCaption && `**Link:** ${ad.linkCaption}`,
        '',
        `--- Winning Example von ${ad.pageName} ---`,
        ad.snapshotUrl && `Preview: ${ad.snapshotUrl}`,
      ]
        .filter(Boolean)
        .join('\n');

      await createMutation.mutateAsync({
        type: 'primary_text',
        title,
        body,
        platform: 'meta',
        tags: ['wettbewerber', ad.pageName.toLowerCase().replace(/\s+/g, '-')],
        status: 'draft',
      } as any);
    },
    [createMutation],
  );

  // Not configured state
  if (searchParams && !adQuery.isLoading && !configured) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-amber-50 text-amber-500 mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Meta Ad Library nicht konfiguriert
        </h3>
        <p className="text-sm text-gray-500 max-w-md">
          Bitte META_ACCESS_TOKEN als Umgebungsvariable setzen, um die Ad Library Suche zu aktivieren.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Marke suchen
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="z.B. Nike, Adidas, HelloFresh..."
              className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Land</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
          >
            {AD_LIBRARY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSearch}
          disabled={!searchInput.trim() || adQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          {adQuery.isFetching ? 'Suche...' : 'Suchen'}
        </button>
      </div>

      {/* Loading */}
      {adQuery.isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card animate-pulse">
              <div className="h-40 bg-gray-100 rounded-lg mb-3" />
              <div className="flex gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-gray-200" />
                <div className="h-5 w-32 rounded bg-gray-200" />
              </div>
              <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-full rounded bg-gray-100 mb-1" />
              <div className="h-3 w-3/4 rounded bg-gray-100 mb-3" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 w-24 rounded bg-gray-100" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!adQuery.isLoading && ads.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            {ads.length} aktive Ad{ads.length !== 1 ? 's' : ''} gefunden
            {adQuery.data?.hasMore && ' (weitere vorhanden)'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ads.map((ad) => (
              <AdLibraryCard
                key={ad.id}
                ad={ad}
                onSaveTemplate={handleSaveTemplate}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty after search */}
      {!adQuery.isLoading && searchParams && ads.length === 0 && configured && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-gray-100 text-gray-400 mb-4">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Keine aktiven Ads gefunden
          </h3>
          <p className="text-sm text-gray-500">
            Versuche einen anderen Suchbegriff oder ein anderes Land.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!searchParams && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-accent-content-light text-accent-content mb-4">
            <Globe className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Wettbewerber Ads durchsuchen
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Gib einen Markennamen ein um deren aktive Ads zu sehen. Du kannst erfolgreiche Ads
            als Template speichern oder den Text direkt kopieren.
          </p>
        </div>
      )}

      {/* Save template feedback */}
      {createMutation.isSuccess && (
        <div className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm text-white shadow-lg animate-fade-in">
          <Check className="h-4 w-4" />
          Template gespeichert
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type LibraryTab = 'content' | 'ads';

export default function ContentLibraryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LibraryTab>('content');
  const [showCreate, setShowCreate] = useState(false);
  const [params, setParams] = useState<ContentListParams>({
    page: 1,
    pageSize: 24,
  });
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');

  const contentQuery = useContentList({
    ...params,
    search: search || undefined,
    aiGenerated: sourceFilter === 'ai' ? true : sourceFilter === 'manual' ? false : undefined,
  });

  const items = contentQuery.data?.items ?? [];
  const total = contentQuery.data?.total ?? 0;
  const currentPage = contentQuery.data?.page ?? 1;
  const totalPages = contentQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <CreateContentModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Content Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeTab === 'content'
              ? `${total} piece${total !== 1 ? 's' : ''} of content`
              : 'Meta Ad Library durchsuchen'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/content/generate')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Content
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border">
        <button
          onClick={() => setActiveTab('content')}
          className={cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'content'
              ? 'text-accent-content'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          Meine Inhalte
          {activeTab === 'content' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-content rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'ads'
              ? 'text-accent-content'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          Wettbewerber Ads
          {activeTab === 'ads' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-content rounded-full" />
          )}
        </button>
      </div>

      {/* ---- TAB: Meine Inhalte ---- */}
      {activeTab === 'content' && (
        <>
          {/* Explanation */}
          <div className="flex items-start gap-2 rounded-lg bg-surface-secondary border border-border p-3">
            <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Your Content Library stores all generated and manually created content pieces.
              Use the filters below to browse by type, status, or source. Click any piece to view its full content and generation context.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setParams((p) => ({ ...p, page: 1 }));
                }}
                placeholder="Search content..."
                className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              />
            </div>
            <select
              value={params.type ?? 'all'}
              onChange={(e) =>
                setParams((p) => ({ ...p, type: e.target.value === 'all' ? undefined : e.target.value, page: 1 }))
              }
              className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
            >
              <option value="all">All Types</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              value={params.status ?? 'all'}
              onChange={(e) =>
                setParams((p) => ({ ...p, status: e.target.value === 'all' ? undefined : e.target.value, page: 1 }))
              }
              className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={params.platform ?? 'all'}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  platform: e.target.value === 'all' ? undefined : e.target.value,
                  page: 1,
                }))
              }
              className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as 'all' | 'ai' | 'manual');
                setParams((p) => ({ ...p, page: 1 }));
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
            >
              <option value="all">All Sources</option>
              <option value="ai">AI Generated</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Loading */}
          {contentQuery.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white p-4 shadow-card animate-pulse">
                  <div className="flex gap-2 mb-3">
                    <div className="h-5 w-16 rounded-full bg-gray-200" />
                    <div className="h-5 w-14 rounded-full bg-gray-200" />
                  </div>
                  <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
                  <div className="h-3 w-full rounded bg-gray-100 mb-1" />
                  <div className="h-3 w-3/4 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Content Grid */}
          {!contentQuery.isLoading && items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((piece) => (
                <ContentCard key={piece.id} piece={piece} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!contentQuery.isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-accent-content-light text-accent-content mb-4">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No content found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your filters or generate new content.
              </p>
              <button
                onClick={() => router.push('/content/generate')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Generate Content
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setParams((p) => ({ ...p, page: currentPage - 1 }))}
                  className="rounded-lg border border-border p-2 text-sm disabled:opacity-40 hover:bg-surface-secondary transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setParams((p) => ({ ...p, page: currentPage + 1 }))}
                  className="rounded-lg border border-border p-2 text-sm disabled:opacity-40 hover:bg-surface-secondary transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- TAB: Wettbewerber Ads ---- */}
      {activeTab === 'ads' && <AdLibraryTab />}
    </div>
  );
}
