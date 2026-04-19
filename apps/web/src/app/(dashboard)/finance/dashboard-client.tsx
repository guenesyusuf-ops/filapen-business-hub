'use client';

import { useCallback, useState, useMemo } from 'react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { ChannelSelector } from '@/components/finance/shared/ChannelSelector';
import { KPICardRow } from '@/components/finance/dashboard/KPICardRow';
import { PnLWaterfallChart } from '@/components/finance/dashboard/PnLWaterfallChart';
import { RevenueTimeChart } from '@/components/finance/dashboard/RevenueTimeChart';
import { ChannelTable } from '@/components/finance/dashboard/ChannelTable';
import { AlertsSidebar } from '@/components/finance/dashboard/AlertsSidebar';
import { ProductSalesWidget } from '@/components/finance/dashboard/ProductSalesWidget';
import { ChannelPnLCards } from '@/components/finance/dashboard/ChannelPnLCards';
import { ShopifyAnalyticsClient } from '@/components/channels/shopify/ShopifyAnalyticsClient';
import { DashboardGrid, type WidgetDefinition } from '@/components/shared/DashboardGrid';
import {
  useDashboardOverview,
  useChannelPerformance,
  useFinanceAlerts,
} from '@/hooks/finance/useDashboard';
import { useFinanceUI } from '@/stores/finance-ui';

// Any of these channel keys activates the Shopify deep-dive view. We match
// both "shopify" (task spec) and "shopify_dtc" (legacy DB channel key).
const SHOPIFY_CHANNEL_KEYS = new Set(['shopify', 'shopify_dtc']);

export function FinanceDashboard() {
  const { selectedChannel, setChannel } = useFinanceUI();
  const isShopifyView =
    selectedChannel != null && SHOPIFY_CHANNEL_KEYS.has(selectedChannel);

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
        id: 'channel-pnl',
        title: 'Kanäle',
        size: 'full' as const,
        component: (
          <ChannelPnLCards
            pnl={dashboardQuery.data ? {
              ...dashboardQuery.data.kpis,
              netRevenue: dashboardQuery.data.kpis?.grossRevenue?.value ?? 0,
              grossRevenue: dashboardQuery.data.kpis?.grossRevenue?.value ?? 0,
              adSpend: dashboardQuery.data.kpis?.totalAdSpend?.value ?? 0,
              cogs: 0,
              shippingCosts: 0,
              paymentFees: 0,
              fixedCosts: 0,
              orderCount: dashboardQuery.data.kpis?.orderCount?.value ?? 0,
              avgOrderValue: dashboardQuery.data.kpis?.avgOrderValue?.value ?? 0,
              newCustomerRate: (dashboardQuery.data.kpis as any)?.newCustomerRate?.value ?? 0,
            } : undefined}
            loading={dashboardQuery.isLoading}
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

      {/* Global error banner (only in aggregate view) */}
      {!isShopifyView && hasError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Error loading data.</strong>{' '}
          {dashboardQuery.error?.message ?? channelsQuery.error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Channel-conditional content */}
      {isShopifyView ? (
        <ShopifyAnalyticsClient />
      ) : (
        <DashboardGrid page="/finance" widgets={widgets} />
      )}
    </div>
  );
}
