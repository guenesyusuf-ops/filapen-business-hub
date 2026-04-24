'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  MessageSquare,
  TrendingUp,
  Eye,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import {
  useBrandDetail,
  useBrandInfluencers,
  useBrandTimeline,
  useBrandCompetitors,
} from '@/hooks/influencers/useBrands';

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
  '#0EA5E9', '#D946EF', '#22C55E', '#E11D48', '#7C3AED',
];

function BrandLogo({ name, size = 'lg' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % BRAND_COLORS.length;
  const color = BRAND_COLORS[colorIndex];
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-xl',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold text-white shrink-0',
        sizeClasses[size],
      )}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collaboration Timeline
// ---------------------------------------------------------------------------

function CollaborationTimeline({ data }: { data: any }) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    influencer: string;
    date: string;
    type: string;
    reach: number | null;
    engagement: number | null;
    postUrl: string | null;
    x: number;
    y: number;
  } | null>(null);

  if (!data || !data.influencers || data.influencers.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Collaboration Timeline</h3>
        <p className="text-sm text-gray-400 text-center py-8">No collaboration data yet</p>
      </div>
    );
  }

  // Build month columns from all points
  const allDates = data.influencers.flatMap((inf: any) => inf.points.map((p: any) => p.date));
  const months = new Set<string>();
  for (const d of allDates) {
    months.add(d.slice(0, 7)); // YYYY-MM
  }
  const sortedMonths = Array.from(months).sort();

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Collaboration Timeline</h3>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-500 capitalize">{TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Month headers */}
          <div className="flex border-b border-gray-100 pb-2 mb-2">
            <div className="w-40 shrink-0 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Creator
            </div>
            <div className="flex-1 flex">
              {sortedMonths.map((month) => (
                <div key={month} className="flex-1 text-center text-[10px] text-gray-400">
                  {new Date(month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                </div>
              ))}
            </div>
          </div>

          {/* Influencer rows */}
          {data.influencers.slice(0, 20).map((inf: any) => (
            <div key={inf.id} className="flex items-center py-1.5 border-b border-gray-50 last:border-0">
              <div className="w-40 shrink-0 flex items-center gap-2 pr-3">
                <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-semibold shrink-0">
                  {inf.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{inf.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">@{inf.handle}</div>
                </div>
              </div>
              <div className="flex-1 flex relative">
                {sortedMonths.map((month) => {
                  const monthPoints = inf.points.filter((p: any) => p.date.startsWith(month));
                  return (
                    <div key={month} className="flex-1 flex items-center justify-center gap-0.5">
                      {monthPoints.map((point: any, idx: number) => (
                        <div
                          key={idx}
                          className="h-3 w-3 rounded-full cursor-pointer hover:scale-150 transition-transform relative"
                          style={{ backgroundColor: TYPE_COLORS[point.type] || '#9CA3AF' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredPoint({
                              influencer: inf.name,
                              date: point.date,
                              type: point.type,
                              reach: point.estimatedReach,
                              engagement: point.engagementRate,
                              postUrl: point.postUrl,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="fixed z-50 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{
            left: hoveredPoint.x,
            top: hoveredPoint.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-medium">{hoveredPoint.influencer}</div>
          <div className="text-gray-300">{hoveredPoint.date}</div>
          <div className="flex items-center gap-1 mt-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[hoveredPoint.type] || '#9CA3AF' }}
            />
            <span className="capitalize">{TYPE_LABELS[hoveredPoint.type]}</span>
          </div>
          {hoveredPoint.reach && (
            <div className="text-gray-300 mt-0.5">Reach: {formatNumber(hoveredPoint.reach)}</div>
          )}
          {hoveredPoint.engagement && (
            <div className="text-gray-300">Eng: {hoveredPoint.engagement}%</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type Breakdown
// ---------------------------------------------------------------------------

function TypeBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Mention Types</h3>
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {Object.entries(breakdown).map(([type, count]) => (
          count > 0 ? (
            <div
              key={type}
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: TYPE_COLORS[type] || '#9CA3AF',
              }}
              className="transition-all duration-300"
            />
          ) : null
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(breakdown).map(([type, count]) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type] || '#9CA3AF' }}
              />
              <span className="text-xs text-gray-600 capitalize">{TYPE_LABELS[type]}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly Timeline Chart
// ---------------------------------------------------------------------------

function MonthlyChart({ timeline }: { timeline: any[] }) {
  if (!timeline || timeline.length === 0) return null;

  const maxTotal = Math.max(
    ...timeline.map((t) => t.organic + t.paid + t.link + t.affiliate),
    1,
  );

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Mentions</h3>
      <div className="flex items-end gap-1 h-32">
        {timeline.map((month) => {
          const total = month.organic + month.paid + month.link + month.affiliate;
          const height = (total / maxTotal) * 100;
          return (
            <div
              key={month.month}
              className="flex-1 flex flex-col justify-end group relative"
            >
              <div
                className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                style={{ height: `${Math.max(height, 4)}%` }}
              >
                {/* Stack the segments */}
                {(['organic', 'paid', 'link', 'affiliate'] as const).map((type) => (
                  month[type] > 0 ? (
                    <div
                      key={type}
                      style={{
                        height: `${(month[type] / total) * 100}%`,
                        backgroundColor: TYPE_COLORS[type],
                      }}
                      className="w-full first:rounded-t-sm"
                    />
                  ) : null
                ))}
              </div>
              <div className="text-[8px] text-gray-400 text-center mt-1 truncate">
                {new Date(month.month + '-01').toLocaleDateString('en', { month: 'short' })}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {month.month}: {total} mentions
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Influencers Table
// ---------------------------------------------------------------------------

function InfluencersTable({ influencers }: { influencers: any[] }) {
  const router = useRouter();
  const [sortField, setSortField] = useState<string>('totalMentions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...influencers].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [influencers, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? (
      <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : (
      <ChevronUp className="h-3 w-3 inline ml-0.5" />
    );
  };

  if (!influencers || influencers.length === 0) return null;

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Associated Creators</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-xs text-gray-500">
              <th className="text-left font-medium px-5 py-3">Creator</th>
              <th className="text-left font-medium px-3 py-3">Platform</th>
              <th
                className="text-right font-medium px-3 py-3 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('followerCount')}
              >
                Followers <SortIcon field="followerCount" />
              </th>
              <th
                className="text-right font-medium px-3 py-3 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('engagementRate')}
              >
                Engagement <SortIcon field="engagementRate" />
              </th>
              <th
                className="text-right font-medium px-3 py-3 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('brandedContentPct')}
              >
                Branded % <SortIcon field="brandedContentPct" />
              </th>
              <th
                className="text-right font-medium px-3 py-3 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('totalMentions')}
              >
                Mentions <SortIcon field="totalMentions" />
              </th>
              <th className="text-left font-medium px-3 py-3">Types</th>
              <th className="text-left font-medium px-3 py-3">First</th>
              <th className="text-left font-medium px-5 py-3">Last</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((inf) => (
              <tr
                key={inf.id}
                className="hover:bg-orange-50/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/influencers/discovery/${inf.id}`)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-semibold shrink-0">
                      {inf.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-xs flex items-center gap-1">
                        {inf.displayName}
                        {inf.isVerified && (
                          <span className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-blue-500 text-white text-[7px]">
                            &#10003;
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">@{inf.handle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: PLATFORM_COLORS[inf.platform] ?? '#9CA3AF' }}
                  >
                    {PLATFORM_LABELS[inf.platform] ?? inf.platform}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-xs font-medium text-gray-900 dark:text-white">
                  {formatNumber(inf.followerCount)}
                </td>
                <td className="px-3 py-3 text-right text-xs text-gray-700">
                  {inf.engagementRate.toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right text-xs text-gray-700">
                  {inf.brandedContentPct != null ? `${inf.brandedContentPct.toFixed(0)}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold">
                    {inf.totalMentions}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-0.5">
                    {inf.mentionTypes?.map((type: string) => (
                      <div
                        key={type}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[type] || '#9CA3AF' }}
                        title={TYPE_LABELS[type]}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-[10px] text-gray-500">
                  {inf.firstMention ? new Date(inf.firstMention).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '-'}
                </td>
                <td className="px-5 py-3 text-[10px] text-gray-500">
                  {inf.lastMention ? new Date(inf.lastMention).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '-'}
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
// Competitor Overlap
// ---------------------------------------------------------------------------

function CompetitorOverlapSection({ data }: { data: any }) {
  const router = useRouter();

  if (!data || !data.competitors || data.competitors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Competitor Overlap</h3>
      <div className="space-y-4">
        {data.competitors.map((comp: any) => (
          <div key={comp.competitor.id} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BrandLogo name={comp.competitor.name} size="sm" />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{comp.competitor.name}</span>
                  {comp.competitor.category && (
                    <span className="text-xs text-gray-400 ml-2">{comp.competitor.category}</span>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                {comp.overlapCount} shared creator{comp.overlapCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {comp.influencers.slice(0, 8).map((inf: any) => (
                <button
                  key={inf.id}
                  onClick={() => router.push(`/influencers/discovery/${inf.id}`)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 hover:bg-orange-50 text-xs text-gray-700 hover:text-orange-700 transition-colors"
                >
                  <div className="h-4 w-4 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[8px] font-semibold">
                    {inf.displayName.charAt(0)}
                  </div>
                  {inf.displayName}
                </button>
              ))}
              {comp.influencers.length > 8 && (
                <span className="text-xs text-gray-400 self-center">
                  +{comp.influencers.length - 8} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: brand, isLoading, isError } = useBrandDetail(id);
  const { data: influencers } = useBrandInfluencers(id);
  const { data: timeline } = useBrandTimeline(id);
  const { data: competitors } = useBrandCompetitors(id);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="rounded-xl bg-white p-6 shadow-card animate-pulse">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-5 shadow-card animate-pulse">
              <div className="h-3 w-16 rounded bg-gray-200 mb-2" />
              <div className="h-6 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !brand) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Brand not found</h2>
        <button
          onClick={() => router.push('/influencers/brands')}
          className="text-sm text-orange-600 hover:text-orange-700"
        >
          Back to Brands
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.push('/influencers/brands')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Brands
      </button>

      {/* Brand Header */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden border-t-2 border-orange-400">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <BrandLogo name={brand.name} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{brand.name}</h1>
              {brand.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium mb-2">
                  {brand.category}
                </span>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                  >
                    <Globe className="h-3 w-3" />
                    {brand.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {brand.channels && brand.channels.length > 0 && (
                  <div className="flex gap-1">
                    {brand.channels.map((ch) => (
                      <span
                        key={ch}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-600"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Creators',
            value: brand.totalInfluencers,
            format: 'number' as const,
            icon: Users,
            color: '#EC4899',
          },
          {
            label: 'Total Mentions',
            value: brand.totalMentions,
            format: 'number' as const,
            icon: MessageSquare,
            color: '#3B82F6',
          },
          {
            label: 'Avg Engagement',
            value: brand.avgEngagement,
            format: 'percentage' as const,
            icon: TrendingUp,
            color: '#F59E0B',
          },
          {
            label: 'Total Reach',
            value: brand.totalReach,
            format: 'number' as const,
            icon: Eye,
            color: '#10B981',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-white p-4 shadow-card border-t-2"
            style={{ borderTopColor: kpi.color }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {kpi.label}
              </span>
              <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {kpi.format === 'percentage'
                ? `${kpi.value.toFixed(1)}%`
                : formatNumber(kpi.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline + Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyChart timeline={brand.timeline} />
        </div>
        <TypeBreakdown breakdown={brand.typeBreakdown} />
      </div>

      {/* Collaboration Timeline */}
      <CollaborationTimeline data={timeline} />

      {/* Influencers Table */}
      <InfluencersTable influencers={influencers || []} />

      {/* Competitor Overlap */}
      <CompetitorOverlapSection data={competitors} />
    </div>
  );
}
