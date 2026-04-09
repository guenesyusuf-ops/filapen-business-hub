'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Facebook,
  Search,
  DollarSign,
  Target,
  MousePointerClick,
  Users,
  ArrowUpDown,
} from 'lucide-react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useCampaigns, type CampaignSummary } from '@/hooks/finance/useCampaigns';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Platform filter
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { key: 'all', label: 'All Platforms' },
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
] as const;

function roasColor(roas: number): string {
  if (roas >= 2.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

function roasBgColor(roas: number): string {
  if (roas >= 2.0) return 'bg-emerald-50';
  if (roas >= 1.0) return 'bg-amber-50';
  return 'bg-red-50';
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    paused: { bg: 'bg-amber-50', text: 'text-amber-700' },
    deleted: { bg: 'bg-gray-100', text: 'text-gray-500' },
    archived: { bg: 'bg-gray-100', text: 'text-gray-500' },
  };
  const style = map[status] ?? map.archived!;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', style.bg, style.text)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function platformIcon(platform: string) {
  if (platform === 'meta') return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
  if (platform === 'google') return <Search className="h-3.5 w-3.5 text-red-600" />;
  return null;
}

function platformLabel(platform: string): string {
  if (platform === 'meta') return 'Meta';
  if (platform === 'google') return 'Google';
  return platform;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden animate-pulse">
      <div className="p-5">
        <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignsPage() {
  const [platform, setPlatform] = useState<string>('all');
  const campaignsQuery = useCampaigns(platform);
  const campaigns = campaignsQuery.data ?? [];

  // Compute summary KPIs
  const summary = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    return { totalSpend, totalRevenue, totalConversions, blendedRoas, avgCpa };
  }, [campaigns]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ad Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track spend, ROAS, and conversions across all campaigns
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Error */}
      {campaignsQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> {campaignsQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Spend"
          value={summary.totalSpend}
          previousValue={null}
          format="currency"
          icon={<DollarSign className="h-4 w-4" />}
          accentColor="#DC2626"
          loading={campaignsQuery.isLoading}
        />
        <KPICard
          label="Blended ROAS"
          value={summary.blendedRoas}
          previousValue={null}
          format="multiplier"
          icon={<Target className="h-4 w-4" />}
          accentColor="#7C3AED"
          loading={campaignsQuery.isLoading}
        />
        <KPICard
          label="Total Conversions"
          value={summary.totalConversions}
          previousValue={null}
          format="number"
          icon={<Users className="h-4 w-4" />}
          accentColor="#2563EB"
          loading={campaignsQuery.isLoading}
        />
        <KPICard
          label="Avg CPA"
          value={summary.avgCpa}
          previousValue={null}
          format="currency"
          icon={<MousePointerClick className="h-4 w-4" />}
          accentColor="#D97706"
          invertTrend
          loading={campaignsQuery.isLoading}
        />
      </div>

      {/* Platform Filter + Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="inline-flex items-center rounded-lg border border-border bg-surface-secondary">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatform(p.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  'first:rounded-l-lg last:rounded-r-lg',
                  'border-r border-border last:border-r-0',
                  platform === p.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {campaignsQuery.isLoading ? (
          <TableSkeleton />
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">No campaign data available for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Campaign
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Platform
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Spend
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Revenue
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ROAS
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Conv.
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    CPA
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => window.location.href = `/finance/campaigns/${c.id}`}
                  >
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900 max-w-[240px] truncate block">
                        {c.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {platformIcon(c.platform)}
                        <span className="text-gray-700 text-xs">{platformLabel(c.platform)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{statusBadge(c.status)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-700">{formatDollars(c.spend)}</td>
                    <td className="px-5 py-3 whitespace-nowrap font-medium text-gray-900">{formatDollars(c.revenue)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                          roasBgColor(c.roas),
                          roasColor(c.roas),
                        )}
                      >
                        {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '--'}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-700">{formatNumber(c.conversions)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-700">
                      {c.cpa > 0 ? formatDollars(c.cpa) : '--'}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-700">
                      {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
