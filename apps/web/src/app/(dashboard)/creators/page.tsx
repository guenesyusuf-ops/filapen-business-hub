'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Handshake,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useCreatorStats } from '@/hooks/creators/useCreators';
import { usePipelineStats } from '@/hooks/creators/useDeals';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/hooks/creators/useDeals';
import type { DealStage } from '@/hooks/creators/useDeals';

// ---------------------------------------------------------------------------
// Status Distribution Chart (simple donut via CSS)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  active: '#059669',
  prospect: '#2563EB',
  outreach: '#7C3AED',
  inactive: '#9CA3AF',
};

function StatusDistribution({
  data,
  loading,
}: {
  data: { status: string; count: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200 mb-4" />
        <div className="h-40 rounded bg-gray-100" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Creator Status Distribution</h3>
      <div className="flex items-center gap-6">
        {/* Simple visual bar */}
        <div className="flex-1">
          <div className="flex h-4 rounded-full overflow-hidden">
            {data.map((item) => (
              <div
                key={item.status}
                className="transition-all duration-300"
                style={{
                  width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                  backgroundColor: STATUS_COLORS[item.status] ?? '#9CA3AF',
                }}
              />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {data.map((item) => (
              <div key={item.status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[item.status] ?? '#9CA3AF' }}
                  />
                  <span className="text-gray-600 capitalize">{item.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.count}</span>
                  <span className="text-gray-400 text-xs">
                    ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Funnel
// ---------------------------------------------------------------------------

function PipelineFunnel({
  stages,
  loading,
}: {
  stages: { stage: DealStage; label: string; count: number; totalValue: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
        <div className="h-40 rounded bg-gray-100" />
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Deal Pipeline</h3>
      <div className="space-y-2.5">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20 text-right shrink-0">{stage.label}</span>
            <div className="flex-1 h-7 bg-gray-50 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                style={{
                  width: `${Math.max((stage.count / maxCount) * 100, 8)}%`,
                  backgroundColor: DEAL_STAGE_COLORS[stage.stage],
                  opacity: 0.85,
                }}
              >
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {stage.count}
                </span>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-600 w-16 text-right shrink-0">
              {formatDollars(stage.totalValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<string, string> = {
  deal_stage: 'bg-purple-100 text-purple-600',
  new_deal: 'bg-blue-100 text-blue-600',
  deal_completed: 'bg-green-100 text-green-600',
  new_creator: 'bg-amber-100 text-amber-600',
};

function RecentActivity({
  activities,
  loading,
}: {
  activities: {
    id: string;
    type: string;
    description: string;
    creatorName: string;
    timestamp: string;
  }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-48 rounded bg-gray-200 mb-1" />
              <div className="h-2.5 w-24 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-sm text-gray-400">No recent activity</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-0 divide-y divide-gray-50">
        {activities.map((activity) => {
          const iconClass = ACTIVITY_ICONS[activity.type] ?? 'bg-gray-100 text-gray-500';
          return (
            <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full shrink-0',
                  iconClass,
                )}
              >
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{activity.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activity.creatorName} &middot;{' '}
                  {new Date(activity.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CreatorHubOverview() {
  const router = useRouter();
  const statsQuery = useCreatorStats();
  const pipelineQuery = usePipelineStats();

  const stats = statsQuery.data;
  const pipeline = pipelineQuery.data;
  const loading = statsQuery.isLoading || pipelineQuery.isLoading;

  const handleAddCreator = useCallback(() => {
    router.push('/creators/list?action=add');
  }, [router]);

  const handleNewDeal = useCallback(() => {
    router.push('/creators/deals?action=new');
  }, [router]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Creator Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage creators, deals, and campaign briefings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddCreator}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Creator
          </button>
          <button
            onClick={handleNewDeal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
          >
            <Handshake className="h-3.5 w-3.5" />
            New Deal
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(statsQuery.isError || pipelineQuery.isError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> Using cached data where available.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Creators"
          value={stats?.totalCreators ?? 0}
          previousValue={null}
          format="number"
          icon={<Users className="h-4 w-4" />}
          accentColor="#7C3AED"
          loading={loading}
        />
        <KPICard
          label="Active Deals"
          value={stats?.activeDeals ?? 0}
          previousValue={null}
          format="number"
          icon={<Handshake className="h-4 w-4" />}
          accentColor="#2563EB"
          loading={loading}
        />
        <KPICard
          label="Total Spend"
          value={stats?.totalSpend ?? 0}
          previousValue={null}
          format="currency"
          icon={<DollarSign className="h-4 w-4" />}
          accentColor="#059669"
          loading={loading}
        />
        <KPICard
          label="Avg Deal Value"
          value={stats?.avgDealValue ?? 0}
          previousValue={null}
          format="currency"
          icon={<TrendingUp className="h-4 w-4" />}
          accentColor="#D97706"
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StatusDistribution
          data={stats?.statusDistribution ?? []}
          loading={loading}
        />
        <PipelineFunnel
          stages={pipeline?.stages ?? []}
          loading={pipelineQuery.isLoading}
        />
      </div>

      {/* Recent Activity */}
      <RecentActivity
        activities={stats?.recentActivity ?? []}
        loading={statsQuery.isLoading}
      />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/creators/list')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-accent-creator-light text-accent-creator">
              <Users className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">View All Creators</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-accent-creator transition-colors" />
        </button>
        <button
          onClick={() => router.push('/creators/deals')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600">
              <Handshake className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Deal Pipeline</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/creators/briefings')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900">Briefings</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}
