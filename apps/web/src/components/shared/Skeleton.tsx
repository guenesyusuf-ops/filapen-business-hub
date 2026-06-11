'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /** Anzahl Zeilen die gerendert werden */
  rows?: number;
}

/**
 * Basis-Skeleton — pulsierende graue Box.
 * Verbessert die wahrgenommene Performance speziell auf langsamen
 * Mobilnetzen (besser als Spinner).
 */
export function Skeleton({ className, rows = 1 }: SkeletonProps) {
  if (rows === 1) {
    return (
      <div className={cn('animate-pulse rounded bg-gray-200 dark:bg-white/10', className)} />
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn('animate-pulse rounded bg-gray-200 dark:bg-white/10', className)}
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard — Listen-Karten-Platzhalter fuer Mobile-Karten.
 */
export function SkeletonCard() {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/**
 * SkeletonList — N SkeletonCards fuer Listen-Loading-State.
 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonRow — Tabellen-Zeilen-Platzhalter fuer Desktop-Tabellen.
 */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}
