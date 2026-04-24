'use client';

import Link from 'next/link';
import {
  ShoppingBag,
  Facebook,
  Search,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Package,
  Music,
} from 'lucide-react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useChannelPerformance } from '@/hooks/finance/useDashboard';
import { useTranslation } from '@/i18n/useTranslation';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string; slug: string; borderColor: string }
> = {
  shopify_dtc: {
    label: 'Shopify DTC',
    icon: ShoppingBag,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    slug: 'shopify_dtc',
    borderColor: '#16a34a',
  },
  amazon: {
    label: 'Amazon',
    icon: Package,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    slug: 'amazon',
    borderColor: '#f97316',
  },
  tiktok: {
    label: 'TikTok',
    icon: Music,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    slug: 'tiktok',
    borderColor: '#ec4899',
  },
  meta_ads: {
    label: 'Meta Ads',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    slug: 'meta_ads',
    borderColor: '#2563eb',
  },
  google_ads: {
    label: 'Google Ads',
    icon: Search,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    slug: 'google_ads',
    borderColor: '#dc2626',
  },
  // Fallback mappings for display-name format (if API returns formatted names)
  'Shopify DTC': {
    label: 'Shopify DTC',
    icon: ShoppingBag,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    slug: 'shopify_dtc',
    borderColor: '#16a34a',
  },
  'Amazon': {
    label: 'Amazon',
    icon: Package,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    slug: 'amazon',
    borderColor: '#f97316',
  },
  'TikTok': {
    label: 'TikTok',
    icon: Music,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    slug: 'tiktok',
    borderColor: '#ec4899',
  },
  'Meta Ads': {
    label: 'Meta Ads',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    slug: 'meta_ads',
    borderColor: '#2563eb',
  },
  'Google Ads': {
    label: 'Google Ads',
    icon: Search,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    slug: 'google_ads',
    borderColor: '#dc2626',
  },
};

function roasColor(roas: number): string {
  if (roas >= 2.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ChannelCardSkeleton() {
  return (
    <div className="rounded-xl bg-white p-6 shadow-card animate-pulse">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-gray-100" />
        <div className="h-5 w-28 rounded bg-gray-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const { data: channels, isLoading, isError, error } = useChannelPerformance();
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">{t('finance.channelPerformance')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('finance.channelCompareDescription')}
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>{t('finance.errorLoading')}</strong> {error?.message ?? 'Please try again.'}
        </div>
      )}

      {/* Channel Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      ) : !channels || channels.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-card text-center">
          <p className="text-gray-400">{t('finance.noChannelData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {channels.map((ch) => {
            const config = CHANNEL_CONFIG[ch.channel];
            if (!config) return null;
            const Icon = config.icon;
            const profit = ch.revenue - ch.spend;
            const margin = ch.revenue > 0 ? (profit / ch.revenue) * 100 : 0;

            return (
              <Link
                key={ch.channel}
                href={`/finance/channels/${config.slug}`}
                className="group"
              >
                <div
                  className={cn(
                    'rounded-xl bg-white p-6 shadow-card transition-all duration-200',
                    'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
                    'border-t-2',
                  )}
                  style={{ borderTopColor: config.borderColor }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex items-center justify-center h-10 w-10 rounded-lg',
                          config.bgColor,
                        )}
                      >
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {config.label}
                      </h3>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.revenue')}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatDollars(ch.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.adSpend')}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {ch.spend > 0 ? formatDollars(ch.spend) : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.roas')}</span>
                      <span className={cn('text-sm font-semibold', roasColor(ch.roas))}>
                        {ch.roas > 0 ? `${ch.roas.toFixed(2)}x` : '--'}
                      </span>
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.profit')}</span>
                        <span
                          className={cn(
                            'text-sm font-semibold inline-flex items-center gap-1',
                            profit >= 0 ? 'text-emerald-600' : 'text-red-600',
                          )}
                        >
                          {profit >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatDollars(profit)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.margin')}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('finance.orders')}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatNumber(ch.conversions)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
