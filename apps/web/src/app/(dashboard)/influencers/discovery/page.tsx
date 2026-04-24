'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Heart,
  Users,
  MessageCircle,
  Plus,
  X,
  Check,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { useInfluencers, type InfluencerListParams } from '@/hooks/influencers/useInfluencers';
import { useWatchlists, useAddToWatchlist } from '@/hooks/influencers/useWatchlists';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', color: '#E4405F' },
  { value: 'tiktok', label: 'TikTok', color: '#000000' },
  { value: 'youtube', label: 'YouTube', color: '#FF0000' },
];

const NICHES = [
  'Beauty', 'Fitness', 'Tech', 'Fashion', 'Food', 'Travel', 'Gaming', 'Lifestyle',
];

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'followerCount', label: 'Followers' },
  { value: 'engagementRate', label: 'Engagement' },
  { value: 'avgLikes', label: 'Avg Likes' },
];

const FOLLOWER_RANGES = [
  { label: 'Any', min: undefined, max: undefined },
  { label: '5K - 50K', min: 5000, max: 50000 },
  { label: '50K - 100K', min: 50000, max: 100000 },
  { label: '100K - 500K', min: 100000, max: 500000 },
  { label: '500K+', min: 500000, max: undefined },
];

const ENGAGEMENT_RANGES = [
  { label: 'Any', min: undefined, max: undefined },
  { label: '1% - 3%', min: 1, max: 3 },
  { label: '3% - 6%', min: 3, max: 6 },
  { label: '6% - 10%', min: 6, max: 10 },
  { label: '10%+', min: 10, max: undefined },
];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
};

// ---------------------------------------------------------------------------
// Add to Watchlist Dropdown
// ---------------------------------------------------------------------------

function AddToWatchlistDropdown({
  influencerId,
  onClose,
}: {
  influencerId: string;
  onClose: () => void;
}) {
  const { data: watchlists, isLoading } = useWatchlists();
  const addMutation = useAddToWatchlist();

  const handleAdd = useCallback(
    (watchlistId: string) => {
      addMutation.mutate(
        { watchlistId, influencerProfileId: influencerId },
        { onSuccess: onClose },
      );
    },
    [addMutation, influencerId, onClose],
  );

  return (
    <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg bg-white shadow-lg border border-gray-200 py-1">
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Add to watchlist
        </span>
      </div>
      {isLoading ? (
        <div className="px-3 py-4 text-center text-xs text-gray-400">Loading...</div>
      ) : watchlists && watchlists.length > 0 ? (
        watchlists.map((wl) => (
          <button
            key={wl.id}
            onClick={() => handleAdd(wl.id)}
            disabled={addMutation.isPending}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors disabled:opacity-50"
          >
            {wl.name}
            <span className="text-xs text-gray-400 ml-1">({wl.itemCount})</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-4 text-center text-xs text-gray-400">
          No watchlists yet
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Influencer Card
// ---------------------------------------------------------------------------

function InfluencerCard({ profile }: { profile: any }) {
  const router = useRouter();
  const [showWatchlist, setShowWatchlist] = useState(false);

  return (
    <div
      className="group rounded-xl bg-white shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
      onClick={() => router.push(`/influencers/discovery/${profile.id}`)}
    >
      {/* Top accent */}
      <div
        className="h-1"
        style={{ backgroundColor: PLATFORM_COLORS[profile.platform] ?? '#9CA3AF' }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-11 w-11 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm shrink-0">
            {profile.displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-gray-900 truncate">
                {profile.displayName}
              </span>
              {profile.isVerified && (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white text-[8px] shrink-0">
                  &#10003;
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">@{profile.handle}</div>
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: PLATFORM_COLORS[profile.platform] ?? '#9CA3AF' }}
          >
            {PLATFORM_LABELS[profile.platform] ?? profile.platform}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Users className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">
              {formatNumber(profile.followerCount)}
            </div>
            <div className="text-[10px] text-gray-400">Followers</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Heart className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">
              {profile.engagementRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-400">Engagement</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <MessageCircle className="h-3 w-3" />
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">
              {formatNumber(profile.avgComments)}
            </div>
            <div className="text-[10px] text-gray-400">Avg Comments</div>
          </div>
        </div>

        {/* Niche + Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {profile.niche && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-medium">
                {profile.niche}
              </span>
            )}
            {profile.email && (
              <Mail className="h-3 w-3 text-gray-400" />
            )}
          </div>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold',
              profile.score >= 80
                ? 'bg-emerald-50 text-emerald-700'
                : profile.score >= 60
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-gray-100 text-gray-600',
            )}
          >
            {profile.score}
          </span>
        </div>
      </div>

      {/* Add to List button */}
      <div className="px-4 pb-3">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowWatchlist(!showWatchlist);
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add to List
          </button>
          {showWatchlist && (
            <div onClick={(e) => e.stopPropagation()}>
              <AddToWatchlistDropdown
                influencerId={profile.id}
                onClose={() => setShowWatchlist(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Panel
// ---------------------------------------------------------------------------

function FilterPanel({
  filters,
  onFiltersChange,
}: {
  filters: InfluencerListParams;
  onFiltersChange: (f: InfluencerListParams) => void;
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    filters.platform ? [filters.platform] : [],
  );
  const [selectedNiche, setSelectedNiche] = useState(filters.niche || '');
  const [followerRange, setFollowerRange] = useState(0);
  const [engagementRange, setEngagementRange] = useState(0);
  const [hasEmail, setHasEmail] = useState(false);

  const handleApply = useCallback(() => {
    const fr = FOLLOWER_RANGES[followerRange];
    const er = ENGAGEMENT_RANGES[engagementRange];
    onFiltersChange({
      ...filters,
      platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : undefined,
      niche: selectedNiche || undefined,
      minFollowers: fr.min,
      maxFollowers: fr.max,
      minEngagement: er.min,
      maxEngagement: er.max,
      hasEmail: hasEmail || undefined,
      page: 1,
    });
  }, [filters, onFiltersChange, selectedPlatforms, selectedNiche, followerRange, engagementRange, hasEmail]);

  const handleClear = useCallback(() => {
    setSelectedPlatforms([]);
    setSelectedNiche('');
    setFollowerRange(0);
    setEngagementRange(0);
    setHasEmail(false);
    onFiltersChange({
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: 1,
      pageSize: filters.pageSize,
    });
  }, [filters, onFiltersChange]);

  const togglePlatform = useCallback((p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }, []);

  return (
    <div className="w-64 shrink-0 space-y-5">
      <div className="rounded-xl bg-white shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </h3>
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear all
          </button>
        </div>

        {/* Platform */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Platform
          </label>
          <div className="space-y-1.5">
            {PLATFORMS.map((p) => (
              <label
                key={p.value}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center transition-colors',
                    selectedPlatforms.includes(p.value)
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-gray-300 group-hover:border-gray-400',
                  )}
                >
                  {selectedPlatforms.includes(p.value) && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Niche */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Niche
          </label>
          <select
            value={selectedNiche}
            onChange={(e) => setSelectedNiche(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
          >
            <option value="">All niches</option>
            {NICHES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Follower Range */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Followers
          </label>
          <select
            value={followerRange}
            onChange={(e) => setFollowerRange(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
          >
            {FOLLOWER_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Engagement Range */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Engagement Rate
          </label>
          <select
            value={engagementRange}
            onChange={(e) => setEngagementRange(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
          >
            {ENGAGEMENT_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Has Email */}
        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              className={cn(
                'h-4 w-4 rounded border-2 flex items-center justify-center transition-colors',
                hasEmail
                  ? 'border-orange-500 bg-orange-500'
                  : 'border-gray-300 group-hover:border-gray-400',
              )}
            >
              {hasEmail && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <span className="text-sm text-gray-700">Has Email</span>
          </label>
        </div>

        <button
          onClick={handleApply}
          className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InfluencerDiscoveryPage() {
  const [filters, setFilters] = useState<InfluencerListParams>({
    sortBy: 'score',
    sortOrder: 'desc',
    page: 1,
    pageSize: 24,
  });
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading, isError } = useInfluencers(filters);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
  }, [searchInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Discovery</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Find and filter influencers across platforms
        </p>
      </div>

      {/* Search Bar + Sort */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-orange-300 focus-within:ring-1 focus-within:ring-orange-200">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, handle, or bio..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setFilters((prev) => ({ ...prev, search: undefined, page: 1 }));
              }}
            >
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            setFilters((prev) => ({
              ...prev,
              sortBy,
              sortOrder: sortOrder as 'asc' | 'desc',
              page: 1,
            }));
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-300 outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={`${opt.value}-desc`} value={`${opt.value}-desc`}>
              {opt.label} (High to Low)
            </option>
          ))}
          {SORT_OPTIONS.map((opt) => (
            <option key={`${opt.value}-asc`} value={`${opt.value}-asc`}>
              {opt.label} (Low to High)
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Content area: filter panel + results */}
      <div className="flex gap-6">
        <FilterPanel filters={filters} onFiltersChange={setFilters} />

        <div className="flex-1">
          {/* Error */}
          {isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
              Failed to load influencers. Please try again.
            </div>
          )}

          {/* Results count */}
          {data && (
            <div className="text-sm text-gray-500 mb-4">
              Showing {data.items.length} of {data.total} profiles
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white shadow-card p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-gray-200" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 rounded bg-gray-200 mb-1" />
                      <div className="h-2.5 w-16 rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="h-12 rounded bg-gray-100 mb-3" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Results grid */}
          {!isLoading && data && (
            <>
              {data.items.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No influencers found</h3>
                  <p className="text-xs text-gray-500">Try adjusting your filters or search query</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.items.map((profile) => (
                    <InfluencerCard key={profile.id} profile={profile} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                    disabled={(filters.page || 1) <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(data.totalPages, (prev.page || 1) + 1) }))}
                    disabled={(filters.page || 1) >= data.totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
