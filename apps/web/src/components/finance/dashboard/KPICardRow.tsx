'use client';

import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Target,
  ShoppingCart,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { useTranslation } from '@/i18n/useTranslation';
import type { ApiKpis } from '@/hooks/finance/useDashboard';

interface KPICardRowProps {
  kpis: ApiKpis | undefined;
  loading: boolean;
}

/** Configuration for which KPIs to show and in what order */
const KPI_CONFIG = [
  {
    key: 'grossRevenue' as const,
    labelKey: 'finance.grossRevenue',
    format: 'currency' as const,
    icon: <DollarSign className="h-4 w-4" />,
    accentColor: '#2563EB',
  },
  {
    key: 'netProfit' as const,
    labelKey: 'finance.netProfit',
    format: 'currency' as const,
    icon: <TrendingUp className="h-4 w-4" />,
    accentColor: '#059669',
  },
  {
    key: 'totalAdSpend' as const,
    labelKey: 'finance.adSpend',
    format: 'currency' as const,
    icon: <BarChart3 className="h-4 w-4" />,
    accentColor: '#DC2626',
    invertTrend: true,
  },
  {
    key: 'blendedRoas' as const,
    labelKey: 'finance.blendedRoas',
    format: 'multiplier' as const,
    icon: <Target className="h-4 w-4" />,
    accentColor: '#7C3AED',
  },
  {
    key: 'orderCount' as const,
    labelKey: 'finance.orders',
    format: 'number' as const,
    icon: <ShoppingCart className="h-4 w-4" />,
    accentColor: '#D97706',
  },
] as const;

export function KPICardRow({ kpis, loading }: KPICardRowProps) {
  const { t } = useTranslation();

  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <KPICard
            key={i}
            label=""
            value={0}
            previousValue={null}
            format="currency"
            loading
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {KPI_CONFIG.map((cfg) => {
        const kpi = kpis[cfg.key];
        if (!kpi) return null;

        return (
          <KPICard
            key={cfg.key}
            label={t(cfg.labelKey)}
            value={kpi.value}
            previousValue={kpi.previousValue ?? null}
            changePercent={kpi.changePercent}
            format={cfg.format}
            icon={cfg.icon}
            accentColor={cfg.accentColor}
            invertTrend={'invertTrend' in cfg ? cfg.invertTrend : false}
          />
        );
      })}
    </div>
  );
}
