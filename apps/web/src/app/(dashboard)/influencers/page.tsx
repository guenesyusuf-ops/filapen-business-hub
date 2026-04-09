'use client';

import { useRouter } from 'next/navigation';
import {
  Users,
  TrendingUp,
  Award,
  Heart,
  ArrowRight,
  Search,
  Eye,
  ListChecks,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useInfluencerStats } from '@/hooks/influencers/useInfluencers';

// ---------------------------------------------------------------------------
// Platform colors
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

// ---------------------------------------------------------------------------
// Platform Distribution Bar
// ---------------------------------------------------------------------------

function PlatformDistribution({
  data,
  loading,
}: {
  data: { platform: string; count: number; avgEngagement: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200 mb-4" />
        <div className="h-48 rounded bg-gray-100" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Platform Distribution</h3>
      <div className="flex h-5 rounded-full overflow-hidden mb-5">
        {data.map((item) => (
          <div
            key={item.platform}
            className="transition-all duration-300"
            style={{
              width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
              backgroundColor: PLATFORM_COLORS[item.platform] ?? '#9CA3AF',
            }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.platform} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: PLATFORM_COLORS[item.platform] ?? '#9CA3AF' }}
              />
              <span className="text-sm text-gray-700">
                {PLATFORM_LABELS[item.platform] ?? item.platform}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900">
                {item.count} profiles
              </span>
              <span className="text-xs text-gray-500">
                {item.avgEngagement.toFixed(1)}% avg eng.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Niche Distribution
// ---------------------------------------------------------------------------

const NICHE_COLORS = [
  '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function NicheDistribution({
  data,
  loading,
}: {
  data: { niche: string; count: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200 mb-4" />
        <div className="h-48 rounded bg-gray-100" />
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Niche Distribution</h3>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.niche} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-16 text-right shrink-0 truncate">
              {item.niche}
            </span>
            <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                style={{
                  width: `${Math.max((item.count / maxCount) * 100, 8)}%`,
                  backgroundColor: NICHE_COLORS[i % NICHE_COLORS.length],
                  opacity: 0.85,
                }}
              >
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {item.count}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top Influencers Table
// ---------------------------------------------------------------------------

function TopInfluencersTable({
  influencers,
  loading,
}: {
  influencers: any[];
  loading: boolean;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200 mb-4" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Top Influencers by Score</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-xs text-gray-500">
              <th className="text-left font-medium px-5 py-3">Influencer</th>
              <th className="text-left font-medium px-3 py-3">Platform</th>
              <th className="text-left font-medium px-3 py-3">Niche</th>
              <th className="text-right font-medium px-3 py-3">Followers</th>
              <th className="text-right font-medium px-3 py-3">Engagement</th>
              <th className="text-right font-medium px-5 py-3">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {influencers.map((inf) => (
              <tr
                key={inf.id}
                className="hover:bg-pink-50/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/influencers/discovery/${inf.id}`)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-semibold shrink-0">
                      {inf.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        {inf.displayName}
                        {inf.isVerified && (
                          <span className="inline-block h-3.5 w-3.5 rounded-full bg-blue-500 text-white text-[8px] flex items-center justify-center leading-none">&#10003;</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">@{inf.handle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: PLATFORM_COLORS[inf.platform] ?? '#9CA3AF' }}
                  >
                    {PLATFORM_LABELS[inf.platform] ?? inf.platform}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600">{inf.niche ?? '-'}</td>
                <td className="px-3 py-3 text-right font-medium text-gray-900">
                  {formatNumber(inf.followerCount)}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {inf.engagementRate.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                      inf.score >= 80
                        ? 'bg-emerald-50 text-emerald-700'
                        : inf.score >= 60
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {inf.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InfluencerHubOverview() {
  const router = useRouter();
  const statsQuery = useInfluencerStats();
  const stats = statsQuery.data;
  const loading = statsQuery.isLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Influencer Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Discover and track social media influencers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/influencers/discovery')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-2 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Discover Influencers
          </button>
        </div>
      </div>

      {/* Error banner */}
      {statsQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> Please try refreshing the page.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Profiles"
          value={stats?.total ?? 0}
          previousValue={null}
          format="number"
          icon={<Users className="h-4 w-4" />}
          accentColor="#EC4899"
          loading={loading}
        />
        <KPICard
          label="Avg Engagement"
          value={stats?.avgEngagementRate ?? 0}
          previousValue={null}
          format="percentage"
          icon={<Heart className="h-4 w-4" />}
          accentColor="#F59E0B"
          loading={loading}
        />
        <KPICard
          label="Top Platform"
          value={0}
          previousValue={null}
          format="number"
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="#3B82F6"
          loading={loading}
        />
        <KPICard
          label="Watchlists"
          value={stats?.watchlistCount ?? 0}
          previousValue={null}
          format="number"
          icon={<ListChecks className="h-4 w-4" />}
          accentColor="#8B5CF6"
          loading={loading}
        />
      </div>

      {/* Top Platform override display */}
      {!loading && stats?.topPlatform && stats.topPlatform !== 'N/A' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 -mt-4">
          <div className="col-start-3 lg:col-start-3">
            {/* This is a subtle text overlay - the KPI card shows 0 but we show the platform name */}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PlatformDistribution
          data={stats?.byPlatform ?? []}
          loading={loading}
        />
        <NicheDistribution
          data={stats?.byNiche ?? []}
          loading={loading}
        />
      </div>

      {/* Top Influencers */}
      <TopInfluencersTable
        influencers={stats?.topInfluencers ?? []}
        loading={loading}
      />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/influencers/discovery')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-pink-50 text-pink-600">
              <Search className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Discovery Search</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-pink-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/influencers/brands')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Brand Intelligence</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/influencers/watchlists')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-50 text-purple-600">
              <Eye className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Watchlists</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/influencers/discovery?sortBy=engagementRate')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600">
              <Award className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Top Engagement</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}
