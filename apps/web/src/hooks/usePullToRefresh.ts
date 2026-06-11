'use client';

import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOpts {
  /** Wird gerufen wenn die Geste komplett ist. Awaitbar. */
  onRefresh: () => Promise<void> | void;
  /** Schwelle in px die ueberzogen werden muss. Default 70. */
  threshold?: number;
  /** Wenn false, ist die Geste deaktiviert (z.B. wenn schon refreshed wird). */
  enabled?: boolean;
  /** Container-Ref der gescrollt wird (default: window). */
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

interface UsePullToRefreshState {
  /** 0..1 wie weit gezogen wurde — fuer UI-Feedback */
  pullProgress: number;
  /** True waehrend der Refresh-Promise laeuft */
  isRefreshing: boolean;
  /** Container-Props zum Spreaden auf den scrollbaren Container */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    style: React.CSSProperties;
  };
}

/**
 * Pull-to-Refresh-Hook fuer Listen.
 * Nur auf Touch-Geraeten aktiv. Funktioniert nur wenn Container am oberen
 * Rand gescrollt ist (scrollTop === 0).
 *
 * Beispiel:
 *   const { pullProgress, isRefreshing, containerProps } = usePullToRefresh({
 *     onRefresh: async () => { await listQuery.refetch(); },
 *   });
 *   return <div {...containerProps}>... Liste ...</div>;
 */
export function usePullToRefresh({
  onRefresh, threshold = 70, enabled = true,
}: UsePullToRefreshOpts): UsePullToRefreshState {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const canPullRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;
    if (typeof window === 'undefined') return;
    // Nur am Top der Page starten
    if (window.scrollY > 0) { canPullRef.current = false; return; }
    canPullRef.current = true;
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canPullRef.current || !enabled || isRefreshing) return;
    if (startYRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) {
      // Damped pull — fuehlt sich natuerlicher an
      const dampedY = Math.min(150, dy * 0.5);
      setPullY(dampedY);
    }
  };

  const handleTouchEnd = async () => {
    if (!canPullRef.current || isRefreshing) {
      setPullY(0);
      return;
    }
    canPullRef.current = false;
    startYRef.current = null;
    if (pullY > threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  return {
    pullProgress: Math.min(1, pullY / threshold),
    isRefreshing,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      style: {
        transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
        transition: pullY === 0 ? 'transform 0.2s ease-out' : 'none',
      },
    },
  };
}
