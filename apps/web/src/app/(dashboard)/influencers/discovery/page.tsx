'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Heart,
  Users,
  MessageCircle,
  X,
  Check,
  Mail,
  Building2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import {
  usePhylloSearch,
  type PhylloProfile,
  type PhylloSearchParams,
  type PhylloDiscoveryFilters,
} from '@/hooks/influencers/useInfluencers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: Array<{ value: 'instagram' | 'tiktok'; label: string; color: string }> = [
  { value: 'instagram', label: 'Instagram', color: '#E4405F' },
  { value: 'tiktok', label: 'TikTok', color: '#000000' },
];

const FOLLOWER_RANGES: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Alle', min: undefined, max: undefined },
  { label: '5K – 50K', min: 5000, max: 50000 },
  { label: '50K – 100K', min: 50000, max: 100000 },
  { label: '100K – 500K', min: 100000, max: 500000 },
  { label: '500K – 1M', min: 500000, max: 1000000 },
  { label: '1M+', min: 1000000, max: undefined },
];

const ENGAGEMENT_RANGES: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Alle', min: undefined, max: undefined },
  { label: '1% – 3%', min: 0.01, max: 0.03 },
  { label: '3% – 6%', min: 0.03, max: 0.06 },
  { label: '6% – 10%', min: 0.06, max: 0.1 },
  { label: '10%+', min: 0.1, max: undefined },
];

const SORT_OPTIONS: Array<{ value: 'followers' | 'engagement' | 'avg_likes'; label: string }> = [
  { value: 'followers', label: 'Follower' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'avg_likes', label: 'Ø Likes' },
];

const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Filter Panel — Brand-Filter ist KEY-Feature für "Mit welcher Brand hat er
// gearbeitet?"-Use-Case (mappt auf Phyllos brand_sponsors-Array).
// ---------------------------------------------------------------------------

interface FilterState {
  platform: 'instagram' | 'tiktok';
  followerRangeIdx: number;
  engagementRangeIdx: number;
  brandSponsors: string;       // Komma-getrennt vom User
  countries: string;            // ISO-Codes komma-getrennt: DE,AT,CH
  sort: 'followers' | 'engagement' | 'avg_likes';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: FilterState = {
  platform: 'instagram',
  followerRangeIdx: 0,
  engagementRangeIdx: 0,
  brandSponsors: '',
  countries: '',
  sort: 'followers',
  sortOrder: 'desc',
};

function FilterPanel({
  filters,
  onChange,
  onApply,
  onClear,
  loading,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onApply: () => void;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <div className="w-72 shrink-0 space-y-4">
      <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </h3>
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Zurücksetzen
          </button>
        </div>

        {/* Platform */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
            Plattform
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ ...filters, platform: p.value })}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors',
                  filters.platform === p.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brand-Sponsor */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            Hat mit Brand gearbeitet
          </label>
          <input
            type="text"
            value={filters.brandSponsors}
            onChange={(e) => onChange({ ...filters, brandSponsors: e.target.value })}
            placeholder="z.B. nike, adidas"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Mehrere mit Komma trennen
          </p>
        </div>

        {/* Follower Range */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
            Follower
          </label>
          <select
            value={filters.followerRangeIdx}
            onChange={(e) => onChange({ ...filters, followerRangeIdx: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {FOLLOWER_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Engagement Range */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
            Engagement
          </label>
          <select
            value={filters.engagementRangeIdx}
            onChange={(e) => onChange({ ...filters, engagementRangeIdx: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {ENGAGEMENT_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Countries */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
            Länder (ISO-Codes)
          </label>
          <input
            type="text"
            value={filters.countries}
            onChange={(e) => onChange({ ...filters, countries: e.target.value.toUpperCase() })}
            placeholder="DE,AT,CH"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 uppercase"
          />
        </div>

        {/* Sort */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
            Sortieren nach
          </label>
          <select
            value={`${filters.sort}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sort, sortOrder] = e.target.value.split('-') as [FilterState['sort'], FilterState['sortOrder']];
              onChange({ ...filters, sort, sortOrder });
            }}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.value}-desc`} value={`${opt.value}-desc`}>{opt.label} (absteigend)</option>
            ))}
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.value}-asc`} value={`${opt.value}-asc`}>{opt.label} (aufsteigend)</option>
            ))}
          </select>
        </div>

        <button
          onClick={onApply}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Suche…
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              Suchen
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile-Card — rendert PhylloProfile-Shape direkt
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: '#E4405F',
  TikTok: '#000000',
};

function ProfileCard({ profile }: { profile: PhylloProfile }) {
  const platformColor = PLATFORM_COLORS[profile.work_platform.name] ?? '#9CA3AF';
  const initial = (profile.full_name || profile.platform_username || '?').charAt(0).toUpperCase();
  const engagementPct = (profile.engagement_rate * 100).toFixed(2);
  const hasEmail = profile.contact_details?.some((c) => c.type === 'email');

  return (
    <div className="group rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      <div className="h-1" style={{ backgroundColor: platformColor }} />

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          {profile.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.image_url}
              alt={profile.platform_username}
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              className="h-11 w-11 rounded-full object-cover bg-gray-100 shrink-0"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-semibold text-sm shrink-0">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                {profile.full_name || profile.platform_username}
              </span>
              {profile.is_verified && (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white text-[8px] shrink-0">✓</span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">@{profile.platform_username}</div>
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: platformColor }}
          >
            {profile.work_platform.name}
          </span>
        </div>

        {profile.introduction && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {profile.introduction}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3 mt-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Users className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">{formatNumber(profile.follower_count)}</div>
            <div className="text-[10px] text-gray-400">Follower</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Heart className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">{engagementPct}%</div>
            <div className="text-[10px] text-gray-400">Engagement</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <MessageCircle className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">{formatNumber(profile.average_likes ?? 0)}</div>
            <div className="text-[10px] text-gray-400">Ø Likes</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {profile.creator_location?.country && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-[10px] font-medium truncate">
                {profile.creator_location.country}
              </span>
            )}
            {hasEmail && (
              <Mail className="h-3 w-3 text-gray-400 shrink-0" />
            )}
          </div>
          {profile.url && (
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Profil
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InfluencerDiscoveryPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const search = usePhylloSearch();

  // Baut die typisierte Filter-Eingabe aus dem UI-State. Backend
  // transformiert das in Phyllos verschachteltes Schema. Hier strikt:
  // nur Felder setzen die wirklich Werte haben — keine leeren Objekte,
  // keine undefined-Wrapper.
  const buildPhylloFilters = useCallback((withOffset: number, fs: FilterState, query: string): PhylloSearchParams => {
    const filters: PhylloDiscoveryFilters = {};

    const fr = FOLLOWER_RANGES[fs.followerRangeIdx];
    if (fr.min !== undefined) filters.followerMin = fr.min;
    if (fr.max !== undefined) filters.followerMax = fr.max;

    const er = ENGAGEMENT_RANGES[fs.engagementRangeIdx];
    if (er.min !== undefined) filters.engagementMin = er.min;
    if (er.max !== undefined) filters.engagementMax = er.max;

    const brands = fs.brandSponsors.split(',').map((s) => s.trim()).filter(Boolean);
    if (brands.length > 0) filters.brandSponsors = brands;

    const countries = fs.countries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (countries.length > 0) filters.countries = countries;

    const keywords = query.trim();
    if (keywords) filters.keywords = keywords;

    return {
      platform: fs.platform,
      sort: fs.sort,
      sortOrder: fs.sortOrder,
      limit: PAGE_SIZE,
      offset: withOffset,
      // Nur senden wenn mindestens ein Filter aktiv ist — sonst weglassen
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    };
  }, []);

  const handleApply = useCallback(() => {
    setOffset(0);
    search.mutate(buildPhylloFilters(0, filters, searchQuery));
  }, [buildPhylloFilters, filters, searchQuery, search]);

  const handleClear = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
    setOffset(0);
    search.reset();
  }, [search]);

  const handlePage = useCallback((delta: number) => {
    const nextOffset = Math.max(0, offset + delta * PAGE_SIZE);
    setOffset(nextOffset);
    search.mutate(buildPhylloFilters(nextOffset, filters, searchQuery));
  }, [offset, buildPhylloFilters, filters, searchQuery, search]);

  const results = search.data?.data ?? [];
  const hasResults = results.length > 0;
  const hasSearched = search.isSuccess || search.isError;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Influencer Discovery
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Live-Suche über InsightIQ — Instagram + TikTok
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Stichworte für Bio-Suche (optional)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            className="flex-1 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onApply={handleApply}
          onClear={handleClear}
          loading={search.isPending}
        />

        <div className="flex-1 min-w-0">
          {/* Error */}
          {search.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 mb-4">
              <strong>Fehler bei der Suche:</strong> {search.error?.message}
            </div>
          )}

          {/* Result count */}
          {hasResults && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {results.length} Profile (Position {offset + 1}–{offset + results.length})
            </div>
          )}

          {/* Loading */}
          {search.isPending && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-card p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-gray-200 dark:bg-white/10" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-white/10 mb-1" />
                      <div className="h-2.5 w-16 rounded bg-gray-100 dark:bg-white/5" />
                    </div>
                  </div>
                  <div className="h-12 rounded bg-gray-100 dark:bg-white/5 mb-3" />
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {/* Empty (kein Suchlauf bisher) */}
          {!search.isPending && !hasSearched && (
            <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-card p-12 text-center">
              <Sparkles className="h-10 w-10 text-primary-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Bereit zur Suche
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Stelle die Filter links ein (Plattform, Follower, Brand-Sponsor, Land) und klicke <strong>Suchen</strong>.
                Ergebnisse kommen live von InsightIQ.
              </p>
            </div>
          )}

          {/* Empty (Suche durchgelaufen, 0 Treffer) */}
          {!search.isPending && hasSearched && !search.isError && !hasResults && (
            <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-card p-12 text-center">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Keine Profile gefunden
              </h3>
              <p className="text-xs text-gray-500">Filter lockern und nochmal probieren.</p>
            </div>
          )}

          {/* Results */}
          {!search.isPending && hasResults && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((profile) => (
                  <ProfileCard key={`${profile.work_platform.id}-${profile.platform_username}`} profile={profile} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePage(-1)}
                  disabled={offset === 0 || search.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Vorherige
                </button>
                <span className="text-sm text-gray-500 px-3">
                  Seite {Math.floor(offset / PAGE_SIZE) + 1}
                </span>
                <button
                  onClick={() => handlePage(1)}
                  disabled={results.length < PAGE_SIZE || search.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Nächste
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
