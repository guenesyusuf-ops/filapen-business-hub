'use client';

import { useRef } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  children: React.ReactNode;
}

/**
 * Drop-in Pull-to-Refresh-Container.
 *
 * Beispiel:
 *   <PullToRefresh onRefresh={() => listQuery.refetch()}>
 *     <YourListContent />
 *   </PullToRefresh>
 *
 * Nur auf Touch-Geraeten aktiv (Hook macht nichts auf Desktop).
 * Zeigt einen Pull-Indikator (Refresh-Icon) der mit dem Pull-Progress mit-rotiert.
 */
export function PullToRefresh({ onRefresh, enabled = true, children }: PullToRefreshProps) {
  const { pullProgress, isRefreshing, containerProps } = usePullToRefresh({ onRefresh, enabled });

  const showIndicator = pullProgress > 0 || isRefreshing;
  const rotation = pullProgress * 180; // 0..180 Grad

  return (
    <div className="relative">
      {/* Pull-Indikator */}
      {showIndicator && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          style={{
            transform: `translate(-50%, ${Math.min(40, pullProgress * 40)}px)`,
            opacity: Math.min(1, pullProgress + 0.2),
          }}
        >
          <div className="rounded-full bg-white dark:bg-[#0f1117] shadow-md border border-gray-200 dark:border-white/10 p-2">
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />
            ) : (
              <RefreshCw
                className="h-4 w-4 text-primary-600"
                style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.05s linear' }}
              />
            )}
          </div>
        </div>
      )}
      <div {...containerProps}>
        {children}
      </div>
    </div>
  );
}
