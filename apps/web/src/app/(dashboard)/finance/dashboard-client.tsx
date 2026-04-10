'use client';

import { useCallback, useState, useMemo } from 'react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { ChannelSelector } from '@/components/finance/shared/ChannelSelector';
import { KPICardRow } from '@/components/finance/dashboard/KPICardRow';
import { PnLWaterfallChart } from '@/components/finance/dashboard/PnLWaterfallChart';
import { RevenueTimeChart } from '@/components/finance/dashboard/RevenueTimeChart';
import { ChannelTable } from '@/components/finance/dashboard/ChannelTable';
import { AlertsSidebar } from '@/components/finance/dashboard/AlertsSidebar';
import { DashboardGrid, type WidgetDefinition } from '@/components/shared/DashboardGrid';
import {
  useDashboardOverview,
  useChannelPerformance,
  useFinanceAlerts,
} from '@/hooks/finance/useDashboard';
import { useFinanceUI } from '@/stores/finance-ui';

export function FinanceDashboard() {
  const { setChannel } = useFinanceUI();
  const dashboardQuery = useDashboardOverview();
  const channelsQuery = useChannelPerformance();
  const alertsQuery = useFinanceAlerts();

  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  const handleChannelClick = useCallback(
    (channel: string) => {
      setChannel(channel);
    },
    [setChannel],
  );

  const handleAcknowledge = useCallback((id: string) => {
    setAcknowledgedAlerts((prev) => new Set(prev).add(id));
  }, []);

  const filteredAlerts = (alertsQuery.data ?? []).filter(
    (a) => !acknowledgedAlerts.has(a.id),
  );

  // Extract sub-data from the combined dashboard response
  const kpis = dashboardQuery.data?.kpis;
  const waterfall = dashboardQuery.data?.waterfall ?? [];
  const timeSeries = dashboardQuery.data?.timeSeries;

  const hasError = dashboardQuery.isError || channelsQuery.isError || alertsQuery.isError;

  // Define widgets for the customizable grid
  const widgets: WidgetDefinition[] = useMemo(
    () => [
      {
        id: 'kpis',
        title: 'KPI Cards',
        size: 'full' as const,
        component: (
          <KPICardRow kpis={kpis} loading={dashboardQuery.isLoading} />
        ),
      },
      {
        id: 'waterfall',
        title: 'P&L Waterfall',
        size: 'half' as const,
        component: (
          <PnLWaterfallChart
            segments={waterfall}
            loading={dashboardQuery.isLoading}
          />
        ),
      },
      {
        id: 'revenue-chart',
        title: 'Revenue Over Time',
        size: 'half' as const,
        component: (
          <RevenueTimeChart
            dates={timeSeries?.dates ?? []}
            revenue={timeSeries?.series?.revenue ?? []}
            profit={timeSeries?.series?.profit ?? []}
            adSpend={timeSeries?.series?.adSpend ?? []}
            loading={dashboardQuery.isLoading}
          />
        ),
      },
      {
        id: 'channel-table',
        title: 'Channel Performance',
        size: 'half' as const,
        component: (
          <ChannelTable
            data={channelsQuery.data ?? []}
            onChannelClick={handleChannelClick}
            loading={channelsQuery.isLoading}
          />
        ),
      },
      {
        id: 'alerts',
        title: 'Alerts',
        size: 'half' as const,
        component: (
          <AlertsSidebar
            alerts={filteredAlerts}
            onAcknowledge={handleAcknowledge}
            loading={alertsQuery.isLoading}
          />
        ),
      },
    ],
    [
      kpis,
      waterfall,
      timeSeries,
      dashboardQuery.isLoading,
      channelsQuery.data,
      channelsQuery.isLoading,
      filteredAlerts,
      alertsQuery.isLoading,
      handleChannelClick,
      handleAcknowledge,
    ],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Finance Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track revenue, profitability, and channel performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ChannelSelector />
          <DateRangePicker />
        </div>
      </div>

      {/* Global error banner */}
      {hasError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Error loading data.</strong>{' '}
          {dashboardQuery.error?.message ?? channelsQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Customizable Widget Grid */}
      <DashboardGrid page="/finance" widgets={widgets} />
    </div>
  );
}
