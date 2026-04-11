'use client';

import { Users, Package, FolderOpen, Upload } from 'lucide-react';
import type { DashboardStats } from '@/hooks/creators/useCreatorDashboard';

// ---------------------------------------------------------------------------
// StatCards — "Content in Zahlen"
// ---------------------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat('de-DE');

interface StatCardsProps {
  stats: DashboardStats | undefined;
  loading: boolean;
  onUploadsClick: () => void;
}

interface CardProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  subtitle?: string;
  onClick?: () => void;
  highlight?: boolean;
}

function Card({ label, value, icon, loading, subtitle, onClick, highlight }: CardProps) {
  const clickable = typeof onClick === 'function';
  const Comp: 'button' | 'div' = clickable ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={[
        'group flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-5 text-left shadow-card dark:shadow-[var(--card-shadow)] transition-colors',
        clickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/10' : '',
        highlight ? 'ring-1 ring-gray-200 dark:ring-white/10' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-white/50">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
          {icon}
        </span>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
        ) : (
          <div className="text-3xl font-semibold text-gray-900 dark:text-white">
            {numberFormatter.format(value ?? 0)}
          </div>
        )}
        {subtitle && !loading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{subtitle}</p>
        )}
      </div>
    </Comp>
  );
}

export function StatCards({ stats, loading, onUploadsClick }: StatCardsProps) {
  const withoutUploads = stats?.creatorsWithoutUploads ?? 0;
  const totalCreators = stats?.totalCreators ?? 0;

  const uploadsSubtitle =
    totalCreators > 0
      ? `${numberFormatter.format(withoutUploads)} von ${numberFormatter.format(totalCreators)} Creator haben keinen Upload`
      : undefined;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Content in Zahlen</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Creator"
          value={stats?.creatorCount}
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <Card
          label="Produkte"
          value={stats?.productCount}
          icon={<Package className="h-4 w-4" />}
          loading={loading}
        />
        <Card
          label="Projekte"
          value={stats?.projectCount}
          icon={<FolderOpen className="h-4 w-4" />}
          loading={loading}
        />
        <Card
          label="Uploads"
          value={stats?.uploadCount}
          icon={<Upload className="h-4 w-4" />}
          loading={loading}
          subtitle={uploadsSubtitle}
          onClick={onUploadsClick}
          highlight
        />
      </div>
    </section>
  );
}
