'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Heart,
  MessageCircle,
  Eye,
  Globe,
  Mail,
  ExternalLink,
  Plus,
  Check,
  MapPin,
  Tag,
  TrendingUp,
  BarChart3,
  DollarSign,
  Target,
  Calendar,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { useInfluencer } from '@/hooks/influencers/useInfluencers';
import { useWatchlists, useAddToWatchlist } from '@/hooks/influencers/useWatchlists';
import { useInfluencerBrands, type InfluencerBrandRelation } from '@/hooks/influencers/useBrands';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const TYPE_COLORS: Record<string, string> = {
  organic: '#10B981',
  paid: '#3B82F6',
  link: '#F97316',
  affiliate: '#8B5CF6',
};

const TYPE_LABELS: Record<string, string> = {
  organic: 'Organic',
  paid: 'Paid',
  link: 'Link',
  affiliate: 'Affiliate',
};

const BRAND_COLORS = [
  '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

// ---------------------------------------------------------------------------
// Audience Charts
// ---------------------------------------------------------------------------

const BAR_COLORS = ['#EC4899', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444'];

function AudienceCountryChart({ data }: { data: { country: string; pct: number }[] | null }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.pct));
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Audience by Country</h3>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.country} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-10 text-right shrink-0 font-medium">
              {item.country}
            </span>
            <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md flex items-center px-2 transition-all duration-500"
                style={{
                  width: `${Math.max((item.pct / max) * 100, 8)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  opacity: 0.85,
                }}
              >
                <span className="text-xs font-medium text-white">{item.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceAgeChart({ data }: { data: { range: string; pct: number }[] | null }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.pct));
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Audience by Age</h3>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.range} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-10 text-right shrink-0">{item.range}</span>
            <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md flex items-center px-2 transition-all duration-500"
                style={{
                  width: `${Math.max((item.pct / max) * 100, 8)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  opacity: 0.85,
                }}
              >
                <span className="text-xs font-medium text-white">{item.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceGenderChart({ data }: { data: { male: number; female: number; other: number } | null }) {
  if (!data) return null;
  const segments = [
    { label: 'Male', pct: data.male, color: '#3B82F6' },
    { label: 'Female', pct: data.female, color: '#EC4899' },
    { label: 'Other', pct: data.other, color: '#9CA3AF' },
  ];
  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Audience by Gender</h3>
      <div className="flex h-5 rounded-full overflow-hidden mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            className="transition-all duration-300"
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-6">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600">{seg.label}</span>
            <span className="text-xs font-bold text-gray-900">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand Logo
// ---------------------------------------------------------------------------

function BrandLogo({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % BRAND_COLORS.length;
  const color = BRAND_COLORS[colorIndex];
  const sizeClasses = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs' };

  return (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center font-bold text-white shrink-0',
        sizeClasses[size],
      )}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand Relationships Section
// ---------------------------------------------------------------------------

function BrandRelationships({ brands, influencerName }: { brands: InfluencerBrandRelation[]; influencerName: string }) {
  const router = useRouter();

  if (!brands || brands.length === 0) return null;

  // Flatten all mentions for timeline
  const allMentions = brands.flatMap((br) =>
    br.mentions.map((m) => ({
      ...m,
      brandName: br.brand.name,
      brandId: br.brand.id,
    })),
  );

  // Group by month for the horizontal bar
  const monthMap = new Map<string, { organic: number; paid: number; link: number; affiliate: number }>();
  for (const m of allMentions) {
    const month = m.mentionDate.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { organic: 0, paid: 0, link: 0, affiliate: 0 });
    }
    const entry = monthMap.get(month)!;
    const t = m.type as keyof typeof entry;
    if (entry[t] !== undefined) entry[t]++;
  }
  const timeline = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  const maxTotal = Math.max(...timeline.map((t) => t.organic + t.paid + t.link + t.affiliate), 1);

  return (
    <div className="space-y-6">
      {/* Brand logos row */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Brands Worked With</h3>
        <div className="flex flex-wrap gap-3">
          {brands.map((br) => (
            <button
              key={br.brand.id}
              onClick={() => router.push(`/influencers/brands/${br.brand.id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-pink-50 transition-colors group"
            >
              <BrandLogo name={br.brand.name} />
              <div className="text-left">
                <div className="text-xs font-medium text-gray-900 group-hover:text-pink-600 transition-colors">
                  {br.brand.name}
                </div>
                <div className="text-[10px] text-gray-400">
                  {br.totalMentions} mention{br.totalMentions !== 1 ? 's' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mention Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Mention Timeline</h3>
          <div className="flex items-center gap-4 mb-4">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gray-500">{TYPE_LABELS[type]}</span>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-1 h-24">
            {timeline.map((month) => {
              const total = month.organic + month.paid + month.link + month.affiliate;
              const height = (total / maxTotal) * 100;
              return (
                <div key={month.month} className="flex-1 flex flex-col justify-end group relative">
                  <div className="w-full flex flex-col" style={{ height: `${Math.max(height, 4)}%` }}>
                    {(['organic', 'paid', 'link', 'affiliate'] as const).map((type) =>
                      month[type] > 0 ? (
                        <div
                          key={type}
                          style={{
                            flex: month[type],
                            backgroundColor: TYPE_COLORS[type],
                          }}
                          className="w-full first:rounded-t-sm"
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="text-[8px] text-gray-400 text-center mt-1">
                    {new Date(month.month + '-01').toLocaleDateString('en', { month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collaboration History Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Collaboration History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-xs text-gray-500">
                <th className="text-left font-medium px-5 py-3">Brand</th>
                <th className="text-left font-medium px-3 py-3">Type</th>
                <th className="text-left font-medium px-3 py-3">Date</th>
                <th className="text-left font-medium px-3 py-3">Platform</th>
                <th className="text-right font-medium px-3 py-3">Engagement</th>
                <th className="text-right font-medium px-5 py-3">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allMentions
                .sort((a, b) => b.mentionDate.localeCompare(a.mentionDate))
                .slice(0, 20)
                .map((mention) => (
                  <tr key={mention.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => router.push(`/influencers/brands/${mention.brandId}`)}
                        className="flex items-center gap-2 text-xs font-medium text-gray-900 hover:text-pink-600 transition-colors"
                      >
                        <BrandLogo name={mention.brandName} />
                        {mention.brandName}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[mention.type] || '#9CA3AF' }}
                        />
                        <span className="text-xs text-gray-600 capitalize">{TYPE_LABELS[mention.type]}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      {new Date(mention.mentionDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: PLATFORM_COLORS[mention.platform] ?? '#9CA3AF' }}
                      >
                        {PLATFORM_LABELS[mention.platform] ?? mention.platform}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-700">
                      {mention.engagementRate != null ? `${mention.engagementRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-medium text-gray-900">
                      {mention.estimatedReach != null ? formatNumber(mention.estimatedReach) : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InfluencerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: profile, isLoading, isError } = useInfluencer(id);
  const { data: watchlists } = useWatchlists();
  const { data: brandRelations } = useInfluencerBrands(id);
  const addMutation = useAddToWatchlist();
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);

  const handleAddToWatchlist = useCallback(
    (watchlistId: string) => {
      addMutation.mutate(
        { watchlistId, influencerProfileId: id },
        { onSuccess: () => setShowWatchlistMenu(false) },
      );
    },
    [addMutation, id],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-6 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="rounded-xl bg-white p-6 shadow-card animate-pulse">
          <div className="flex gap-5">
            <div className="h-20 w-20 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
              <div className="h-3 w-64 rounded bg-gray-100" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card animate-pulse">
              <div className="h-3 w-16 rounded bg-gray-200 mb-2" />
              <div className="h-5 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Profile not found</h2>
        <p className="text-sm text-gray-500 mb-4">The influencer profile could not be loaded.</p>
        <button
          onClick={() => router.push('/influencers/discovery')}
          className="text-sm text-pink-600 hover:text-pink-700"
        >
          Back to Discovery
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.push('/influencers/discovery')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Discovery
      </button>

      {/* Profile Header */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div
          className="h-2"
          style={{ backgroundColor: PLATFORM_COLORS[profile.platform] ?? '#EC4899' }}
        />
        <div className="p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-2xl font-bold shrink-0">
              {profile.displayName.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">
                  {profile.displayName}
                </h1>
                {profile.isVerified && (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-[10px]">
                    &#10003;
                  </span>
                )}
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ml-1"
                  style={{ backgroundColor: PLATFORM_COLORS[profile.platform] ?? '#9CA3AF' }}
                >
                  {PLATFORM_LABELS[profile.platform] ?? profile.platform}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ml-1',
                    profile.score >= 80
                      ? 'bg-emerald-50 text-emerald-700'
                      : profile.score >= 60
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-600',
                  )}
                >
                  Score: {profile.score}
                </span>
              </div>
              <div className="text-sm text-gray-500 mb-2">@{profile.handle}</div>
              {profile.bio && (
                <p className="text-sm text-gray-700 mb-3 max-w-2xl">{profile.bio}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {profile.location}
                  </span>
                )}
                {profile.language && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {profile.language.toUpperCase()}
                  </span>
                )}
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {profile.email}
                  </span>
                )}
                {profile.websiteUrl && (
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-pink-600 hover:text-pink-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Website
                  </a>
                )}
              </div>
            </div>

            {/* Add to Watchlist */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Watchlist
              </button>
              {showWatchlistMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg bg-white shadow-lg border border-gray-200 py-1">
                  {watchlists && watchlists.length > 0 ? (
                    watchlists.map((wl) => (
                      <button
                        key={wl.id}
                        onClick={() => handleAddToWatchlist(wl.id)}
                        disabled={addMutation.isPending}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors disabled:opacity-50"
                      >
                        {wl.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">
                      No watchlists yet
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            label: 'Followers',
            value: formatNumber(profile.followerCount),
            sub: profile.growthRate != null
              ? `${profile.growthRate > 0 ? '+' : ''}${profile.growthRate.toFixed(1)}% growth`
              : undefined,
            subColor: profile.growthRate != null
              ? profile.growthRate >= 0 ? '#10B981' : '#EF4444'
              : undefined,
            icon: Users,
            color: '#EC4899',
          },
          {
            label: 'Engagement',
            value: `${profile.engagementRate.toFixed(1)}%`,
            icon: Heart,
            color: '#F59E0B',
          },
          {
            label: 'Posting Freq',
            value: profile.postingFrequency || '-',
            icon: Calendar,
            color: '#3B82F6',
          },
          {
            label: 'Branded Content',
            value: profile.brandedContentPct != null ? `${profile.brandedContentPct.toFixed(0)}%` : '-',
            icon: BarChart3,
            color: '#8B5CF6',
          },
          {
            label: 'Est. Media Value',
            value: profile.estimatedMediaValue != null
              ? `$${formatNumber(Math.round(profile.estimatedMediaValue))}`
              : '-',
            icon: DollarSign,
            color: '#10B981',
          },
          {
            label: 'Brand Fit Score',
            value: profile.brandFitScore != null ? `${profile.brandFitScore}` : '-',
            icon: Target,
            color: '#EF4444',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-4 shadow-card border-t-2"
            style={{ borderTopColor: stat.color }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {stat.label}
              </span>
              <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
            </div>
            <div className="text-lg font-bold text-gray-900">{stat.value}</div>
            {stat.sub && (
              <div className="text-[10px] font-medium mt-0.5" style={{ color: stat.subColor }}>
                {stat.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Likes', value: formatNumber(profile.avgLikes), icon: Heart, color: '#EF4444' },
          { label: 'Avg Comments', value: formatNumber(profile.avgComments), icon: MessageCircle, color: '#3B82F6' },
          { label: 'Following', value: formatNumber(profile.followingCount), icon: Users, color: '#8B5CF6' },
          ...(profile.avgViews != null
            ? [{ label: 'Avg Views', value: formatNumber(profile.avgViews), icon: Eye, color: '#10B981' }]
            : []),
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-3 shadow-card flex items-center gap-3"
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${stat.color}15` }}
            >
              <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{stat.label}</div>
              <div className="text-sm font-bold text-gray-900">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Categories */}
      {profile.contentCategories && profile.contentCategories.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-pink-500" />
            Content Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.contentCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Audience Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AudienceCountryChart data={profile.audienceCountry} />
        <AudienceAgeChart data={profile.audienceAge} />
        <AudienceGenderChart data={profile.audienceGender} />
      </div>

      {/* Brand Relationships */}
      {brandRelations && brandRelations.length > 0 && (
        <BrandRelationships brands={brandRelations} influencerName={profile.displayName} />
      )}

      {/* Tags */}
      {profile.tags && profile.tags.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Watchlists */}
      {profile.watchlists && profile.watchlists.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">In Watchlists</h3>
          <div className="space-y-2">
            {profile.watchlists.map((wl) => (
              <button
                key={wl.watchlistId}
                onClick={() => router.push(`/influencers/watchlists/${wl.watchlistId}`)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-pink-600 transition-colors"
              >
                <Check className="h-3.5 w-3.5 text-pink-500" />
                {wl.watchlistName}
                <span className="text-xs text-gray-400">
                  added {new Date(wl.addedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
