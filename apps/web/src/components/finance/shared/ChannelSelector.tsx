'use client';

import { ShoppingBag, Facebook, Search, Layers, Package, Music } from 'lucide-react';
import { useFinanceUI } from '@/stores/finance-ui';
import { useTranslation } from '@/i18n/useTranslation';
import { cn } from '@/lib/utils';

const CHANNELS = [
  { key: null, labelKey: 'channels.allChannels', icon: Layers, color: 'text-gray-600', bg: 'bg-gray-100' },
  { key: 'shopify_dtc', labelKey: 'channels.shopify', icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'amazon', labelKey: 'channels.amazon', icon: Package, color: 'text-orange-500', bg: 'bg-orange-50' },
  { key: 'tiktok', labelKey: 'channels.tiktok', icon: Music, color: 'text-orange-500', bg: 'bg-orange-50' },
  { key: 'meta_ads', labelKey: 'channels.metaAds', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'google_ads', labelKey: 'channels.googleAds', icon: Search, color: 'text-red-600', bg: 'bg-red-50' },
] as const;

export function ChannelSelector() {
  const { selectedChannel, setChannel } = useFinanceUI();
  const { t } = useTranslation();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-white shadow-sm">
      {CHANNELS.map((ch) => {
        const Icon = ch.icon;
        const isActive = ch.key === selectedChannel || (ch.key === null && selectedChannel === null);

        return (
          <button
            key={ch.key ?? 'all'}
            onClick={() => setChannel(ch.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              'first:rounded-l-lg last:rounded-r-lg',
              'border-r border-border last:border-r-0',
              isActive
                ? `${ch.bg} ${ch.color}`
                : 'text-gray-500 hover:bg-surface-secondary hover:text-gray-700',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t(ch.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
