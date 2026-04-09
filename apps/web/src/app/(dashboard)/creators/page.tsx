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
  Bell,
  Radio,
  Upload,
  Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import { useCreatorStats } from '@/hooks/creators/useCreators';
import { usePipelineStats } from '@/hooks/creators/useDeals';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/hooks/creators/useDeals';
import type { DealStage } from '@/hooks/creators/useDeals';
import { useAllUploads, useUnseenUploadCount, useLiveUploads, useGoOfflineUpload } from '@/hooks/creators/useUploads';
import type { CreatorUpload } from '@/hooks/creators/useUploads';

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
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days}d`;
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const TAB_BADGE_COLORS: Record<string, string> = {
  bilder: 'bg-blue-50 text-blue-700',
  videos: 'bg-purple-50 text-purple-700',
  roh: 'bg-amber-50 text-amber-700',
  auswertung: 'bg-green-50 text-green-700',
};

// ---------------------------------------------------------------------------
// Recent Uploads Card
// ---------------------------------------------------------------------------

function RecentUploadsCard({
  uploads,
  loading,
  onNavigate,
}: {
  uploads: CreatorUpload[];
  loading: boolean;
  onNavigate: (creatorId: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-36 rounded bg-gray-200 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-40 rounded bg-gray-200 mb-1" />
              <div className="h-2.5 w-24 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4 text-gray-400" />
          Recent Uploads
        </h3>
        <div className="text-center py-8 text-sm text-gray-400">No uploads yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Upload className="h-4 w-4 text-gray-400" />
        Recent Uploads
      </h3>
      <div className="space-y-0 divide-y divide-gray-50">
        {uploads.slice(0, 10).map((upload) => (
          <button
            key={upload.id}
            onClick={() => onNavigate(upload.creatorId)}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 w-full text-left hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent-creator-light text-accent-creator font-medium text-xs shrink-0">
              {upload.creator?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-900 truncate">
                  {upload.label || upload.fileName}
                </p>
                {!upload.seenByAdmin && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                    Neu
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">
                  {upload.creator?.name ?? 'Unknown'}
                </span>
                <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', TAB_BADGE_COLORS[upload.tab] ?? 'bg-gray-50 text-gray-600')}>
                  {upload.tab}
                </span>
                <span className="text-[10px] text-gray-400">{timeAgo(upload.createdAt)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Content Card
// ---------------------------------------------------------------------------

function LiveContentCard({
  uploads,
  loading,
  onGoOffline,
  onNavigate,
  offlinePending,
}: {
  uploads: CreatorUpload[];
  loading: boolean;
  onGoOffline: (id: string) => void;
  onNavigate: (creatorId: string) => void;
  offlinePending: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200 mb-4" />
        <div className="h-40 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Radio className="h-4 w-4 text-green-500" />
        Live Content
        {uploads.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
            {uploads.length}
          </span>
        )}
      </h3>
      {uploads.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">No live content</div>
      ) : (
        <div className="space-y-0 divide-y divide-gray-50">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <button
                onClick={() => onNavigate(upload.creatorId)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent-creator-light text-accent-creator font-medium text-xs shrink-0">
                  {upload.creator?.name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {upload.label || upload.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{upload.creator?.name}</span>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-green-600 font-medium">Live</span>
                    </div>
                    {upload.liveDate && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(upload.liveDate).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm('Content offline setzen?')) onGoOffline(upload.id);
                }}
                disabled={offlinePending}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Power className="h-3 w-3" />
                Offline
              </button>
            </div>
          ))}
        </div>
      )}
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
  const unseenQuery = useUnseenUploadCount();
  const recentUploadsQuery = useAllUploads({ pageSize: 10 });
  const liveUploadsQuery = useLiveUploads();
  const goOfflineMutation = useGoOfflineUpload();

  const stats = statsQuery.data;
  const pipeline = pipelineQuery.data;
  const loading = statsQuery.isLoading || pipelineQuery.isLoading;
  const unseenCount = unseenQuery.data?.count ?? 0;

  const handleAddCreator = useCallback(() => {
    router.push('/creators/list?action=add');
  }, [router]);

  const handleNewDeal = useCallback(() => {
    router.push('/creators/deals?action=new');
  }, [router]);

  const handleNavigateToCreator = useCallback((creatorId: string) => {
    router.push(`/creators/list/${creatorId}`);
  }, [router]);

  const handleGoOffline = useCallback((uploadId: string) => {
    goOfflineMutation.mutate(uploadId);
  }, [goOfflineMutation]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Creator Hub</h1>
            {unseenCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                <Bell className="h-3 w-3" />
                {unseenCount} neue Uploads
              </span>
            )}
          </div>
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

      {/* Recent Uploads + Live Content Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentUploadsCard
          uploads={recentUploadsQuery.data?.items ?? []}
          loading={recentUploadsQuery.isLoading}
          onNavigate={handleNavigateToCreator}
        />
        <LiveContentCard
          uploads={liveUploadsQuery.data ?? []}
          loading={liveUploadsQuery.isLoading}
          onGoOffline={handleGoOffline}
          onNavigate={handleNavigateToCreator}
          offlinePending={goOfflineMutation.isPending}
        />
      </div>

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
