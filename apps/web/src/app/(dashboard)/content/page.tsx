'use client';

import { useRouter } from 'next/navigation';
import {
  FileText,
  Sparkles,
  CheckCircle,
  LayoutTemplate,
  ArrowRight,
  Wand2,
  BookOpen,
  Mic,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { KPICard } from '@/components/finance/dashboard/KPICard';
import {
  useContentStats,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '@/hooks/content/useContent';

// ---------------------------------------------------------------------------
// Chart: Content by Type (horizontal bars)
// ---------------------------------------------------------------------------

function ContentByTypeChart({
  data,
  loading,
}: {
  data: { type: string; count: number }[];
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
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Content by Type</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.type} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 text-right shrink-0">
              {CONTENT_TYPE_LABELS[item.type] ?? item.type}
            </span>
            <div className="flex-1 h-7 bg-gray-50 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500 flex items-center px-2 bg-accent-content/80"
                style={{
                  width: `${Math.max((item.count / maxCount) * 100, 10)}%`,
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
// Chart: Content by Status (stacked bar + legend)
// ---------------------------------------------------------------------------

const STATUS_BAR_COLORS: Record<string, string> = {
  draft: '#9CA3AF',
  in_review: '#D97706',
  approved: '#2563EB',
  published: '#059669',
  archived: '#D1D5DB',
};

function ContentByStatusChart({
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
        <div className="h-48 rounded bg-gray-100" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Content by Status</h3>
      <div className="flex h-5 rounded-full overflow-hidden mb-4">
        {data.map((item) => (
          <div
            key={item.status}
            className="transition-all duration-300"
            style={{
              width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
              backgroundColor: STATUS_BAR_COLORS[item.status] ?? '#9CA3AF',
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: STATUS_BAR_COLORS[item.status] ?? '#9CA3AF',
                }}
              />
              <span className="text-gray-600">
                {CONTENT_STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
              <span className="text-gray-400 text-xs">
                ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)
              </span>
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

export default function ContentHubOverview() {
  const router = useRouter();
  const statsQuery = useContentStats();
  const stats = statsQuery.data;
  const loading = statsQuery.isLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Content Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-powered creative operations for ads, scripts, and content
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/content/library')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Library
          </button>
          <button
            onClick={() => router.push('/content/generate')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>
      </div>

      {/* Error */}
      {statsQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading data.</strong> Using cached data where available.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Content"
          value={stats?.total ?? 0}
          previousValue={null}
          format="number"
          icon={<FileText className="h-4 w-4" />}
          accentColor="#D97706"
          loading={loading}
        />
        <KPICard
          label="Published"
          value={stats?.published ?? 0}
          previousValue={null}
          format="number"
          icon={<CheckCircle className="h-4 w-4" />}
          accentColor="#059669"
          loading={loading}
        />
        <KPICard
          label="AI Generated"
          value={stats?.aiGenerated ?? 0}
          previousValue={null}
          format="number"
          icon={<Sparkles className="h-4 w-4" />}
          accentColor="#7C3AED"
          loading={loading}
        />
        <KPICard
          label="Templates"
          value={stats?.templates ?? 0}
          previousValue={null}
          format="number"
          icon={<LayoutTemplate className="h-4 w-4" />}
          accentColor="#2563EB"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ContentByTypeChart data={stats?.byType ?? []} loading={loading} />
        <ContentByStatusChart data={stats?.byStatus ?? []} loading={loading} />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/content/generate')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-accent-content-light text-accent-content">
              <Wand2 className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Generate Content</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-accent-content transition-colors" />
        </button>
        <button
          onClick={() => router.push('/content/library')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-orange-50 text-orange-600">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Content Library</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-orange-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/content/templates')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600">
              <LayoutTemplate className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Templates</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </button>
        <button
          onClick={() => router.push('/content/brand-voice')}
          className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600">
              <Mic className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Brand Voice</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}
