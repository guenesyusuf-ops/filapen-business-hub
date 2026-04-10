'use client';

import { Plug } from 'lucide-react';
import { AnalyticsCard } from './AnalyticsCard';

interface PlaceholderCardProps {
  title: string;
  message?: string;
  height?: number;
}

export function PlaceholderCard({
  title,
  message = 'Verfügbar nach Shopify-Neuverbindung',
  height = 260,
}: PlaceholderCardProps) {
  return (
    <AnalyticsCard title={title}>
      <div
        className="flex flex-col items-center justify-center gap-3 text-center"
        style={{ height: `${height}px` }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
          <Plug className="h-5 w-5 text-gray-600" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400">{message}</p>
          <p className="text-[11px] text-gray-600">Shopify Analytics API pending</p>
        </div>
      </div>
    </AnalyticsCard>
  );
}
