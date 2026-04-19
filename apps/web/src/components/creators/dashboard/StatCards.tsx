'use client';

import { Users, Package, FolderOpen, Upload, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/hooks/creators/useCreatorDashboard';

const numberFormatter = new Intl.NumberFormat('de-DE');

interface StatCardsProps {
  stats: DashboardStats | undefined;
  loading: boolean;
  onUploadsClick: () => void;
}

interface CardDef {
  label: string;
  key: keyof DashboardStats;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  subtitle?: (stats: DashboardStats) => string | undefined;
  onClick?: () => void;
}

function StatCard({
  label, value, icon, gradient, iconBg, loading, subtitle, onClick,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  loading: boolean;
  subtitle?: string;
  onClick?: () => void;
}) {
  const Comp: 'button' | 'div' = onClick ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-5 text-left transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-white/15',
      )}
    >
      {/* Subtle gradient accent top */}
      <div className={cn('absolute inset-x-0 top-0 h-1 rounded-t-2xl', gradient)} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
            {label}
          </span>
          <div className="mt-2">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                {numberFormatter.format(value ?? 0)}
              </p>
            )}
          </div>
          {subtitle && !loading && (
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/40 leading-tight">
              {subtitle}
            </p>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
          iconBg,
        )}>
          {icon}
        </div>
      </div>
    </Comp>
  );
}

export function StatCards({ stats, loading, onUploadsClick }: StatCardsProps) {
  const withoutUploads = stats?.creatorsWithoutUploads ?? 0;
  const totalCreators = stats?.totalCreators ?? 0;

  const cards: CardDef[] = [
    {
      label: 'Creator',
      key: 'creatorCount',
      icon: <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
      gradient: 'bg-gradient-to-r from-violet-500 to-purple-500',
      iconBg: 'bg-violet-50 dark:bg-violet-500/10',
    },
    {
      label: 'Produkte',
      key: 'productCount',
      icon: <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'Projekte',
      key: 'projectCount',
      icon: <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'Uploads',
      key: 'uploadCount',
      icon: <Upload className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      gradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      subtitle: (s) =>
        s.totalCreators > 0
          ? `${numberFormatter.format(s.creatorsWithoutUploads)} von ${numberFormatter.format(s.totalCreators)} ohne Upload`
          : undefined,
    },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={stats?.[c.key] as number | undefined}
            icon={c.icon}
            gradient={c.gradient}
            iconBg={c.iconBg}
            loading={loading}
            subtitle={stats && c.subtitle ? c.subtitle(stats) : undefined}
            onClick={c.key === 'uploadCount' ? onUploadsClick : undefined}
          />
        ))}
      </div>
    </section>
  );
}
