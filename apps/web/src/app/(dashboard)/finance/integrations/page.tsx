'use client';

import { useState, useCallback } from 'react';
import {
  ShoppingBag,
  Globe,
  BarChart3,
  RefreshCw,
  Unplug,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntegrations, type Integration } from '@/hooks/finance/useIntegrations';

// ---------------------------------------------------------------------------
// Integration metadata
// ---------------------------------------------------------------------------

interface IntegrationMeta {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  dataLabel: (integration: Integration) => string;
}

const INTEGRATION_META: Record<string, IntegrationMeta> = {
  shopify: {
    label: 'Shopify',
    description: 'E-commerce orders, products, and customer data',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: '#5E8E3E',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    dataLabel: () => '5,233 orders synced',
  },
  meta: {
    label: 'Meta Ads',
    description: 'Facebook & Instagram ad campaigns and spend',
    icon: <Globe className="h-5 w-5" />,
    color: '#1877F2',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    dataLabel: () => '3 campaigns, $12.4K total spend',
  },
  google: {
    label: 'Google Ads',
    description: 'Google search and display ad campaigns',
    icon: <BarChart3 className="h-5 w-5" />,
    color: '#EA4335',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    dataLabel: () => '2 campaigns, $8.7K total spend',
  },
};

// ---------------------------------------------------------------------------
// Helper: relative time
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function IntegrationCardSkeleton() {
  return (
    <div className="rounded-xl bg-white p-6 shadow-card animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
        <div>
          <div className="h-4 w-24 rounded bg-gray-200 mb-1" />
          <div className="h-3 w-40 rounded bg-gray-200" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-gray-200" />
        <div className="h-3 w-28 rounded bg-gray-200" />
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
      <div className="flex gap-2 mt-5">
        <div className="h-8 w-24 rounded-lg bg-gray-200" />
        <div className="h-8 w-24 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration Card
// ---------------------------------------------------------------------------

function IntegrationCard({
  integration,
  onSync,
  syncing,
}: {
  integration: Integration;
  onSync: (id: string) => void;
  syncing: boolean;
}) {
  const meta = INTEGRATION_META[integration.type] ?? {
    label: integration.type,
    description: 'Third-party integration',
    icon: <Globe className="h-5 w-5" />,
    color: '#6B7280',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    dataLabel: () => 'Connected',
  };

  const isConnected = integration.status === 'connected';

  return (
    <div className="group rounded-xl bg-white p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn('flex items-center justify-center h-10 w-10 rounded-lg', meta.bgColor)}
            style={{ color: meta.color }}
          >
            {meta.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
            <p className="text-xs text-gray-500">{meta.description}</p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            isConnected
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500',
          )}
        >
          {isConnected ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Last synced: {relativeTime(integration.lastSyncedAt)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
          <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
          <span>{meta.dataLabel(integration)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSync(integration.id)}
          disabled={!isConnected || syncing}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            isConnected && !syncing
              ? 'bg-primary text-white hover:bg-primary-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
        >
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync History Table
// ---------------------------------------------------------------------------

interface SyncLog {
  integration: string;
  status: string;
  time: string;
  records: string;
  duration: string;
}

const MOCK_SYNC_LOGS: SyncLog[] = [
  { integration: 'Shopify', status: 'success', time: '5 minutes ago', records: '127 orders', duration: '12s' },
  { integration: 'Meta Ads', status: 'success', time: '1 hour ago', records: '3 campaigns', duration: '8s' },
  { integration: 'Google Ads', status: 'success', time: '2 hours ago', records: '2 campaigns', duration: '6s' },
  { integration: 'Shopify', status: 'success', time: '6 hours ago', records: '89 orders', duration: '9s' },
  { integration: 'Meta Ads', status: 'warning', time: '12 hours ago', records: '3 campaigns (partial)', duration: '15s' },
  { integration: 'Shopify', status: 'success', time: '1 day ago', records: '156 orders', duration: '14s' },
];

function SyncHistoryTable() {
  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-gray-900">Sync History</h3>
        <p className="text-xs text-gray-500 mt-0.5">Recent synchronization activity</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="px-6 py-3 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                Integration
              </th>
              <th className="px-6 py-3 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                Records
              </th>
              <th className="px-6 py-3 text-left text-xxs font-medium uppercase tracking-wider text-gray-500">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MOCK_SYNC_LOGS.map((log, i) => (
              <tr key={i} className="hover:bg-surface-secondary transition-colors">
                <td className="px-6 py-3 text-sm text-gray-900 font-medium">{log.integration}</td>
                <td className="px-6 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      log.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : log.status === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700',
                    )}
                  >
                    {log.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-gray-500">{log.time}</td>
                <td className="px-6 py-3 text-xs text-gray-700">{log.records}</td>
                <td className="px-6 py-3 text-xs text-gray-500">{log.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const { data: integrations, isLoading, isError, error } = useIntegrations();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = useCallback((id: string) => {
    setSyncingId(id);
    // Simulate sync
    setTimeout(() => {
      setSyncingId(null);
    }, 2000);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your connected data sources and sync settings
        </p>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error loading integrations.</strong>{' '}
          {(error as Error)?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
          </>
        ) : (
          integrations?.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onSync={handleSync}
              syncing={syncingId === integration.id}
            />
          ))
        )}
      </div>

      {/* Sync History */}
      <SyncHistoryTable />
    </div>
  );
}
