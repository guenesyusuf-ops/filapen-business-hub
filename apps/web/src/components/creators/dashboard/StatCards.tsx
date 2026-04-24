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

  // 4 Theme-Rollen rotieren über die Cards damit jede Kachel optisch
  // unterscheidbar ist und gleichzeitig der gewählten Palette folgt.
  const cards: CardDef[] = [
    {
      label: 'Creator',
      key: 'creatorCount',
      icon: <Users className="h-5 w-5 text-theme-3" />,
      gradient: 'bg-gradient-to-r from-theme-3 to-theme-3',
      iconBg: 'bg-theme-3/10 dark:bg-theme-3/20',
    },
    {
      label: 'Produkte',
      key: 'productCount',
      icon: <Package className="h-5 w-5 text-theme-1" />,
      gradient: 'bg-gradient-to-r from-theme-1 to-theme-2',
      iconBg: 'bg-theme-1/15 dark:bg-theme-1/20',
    },
    {
      label: 'Projekte',
      key: 'projectCount',
      icon: <FolderOpen className="h-5 w-5 text-theme-2" />,
      gradient: 'bg-gradient-to-r from-theme-2 to-theme-1',
      iconBg: 'bg-theme-2/10 dark:bg-theme-2/20',
    },
    {
      label: 'Uploads',
      key: 'uploadCount',
      icon: <Upload className="h-5 w-5 text-theme-4" />,
      gradient: 'bg-gradient-to-r from-theme-4 to-theme-3',
      iconBg: 'bg-theme-4/10 dark:bg-theme-4/20',
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
