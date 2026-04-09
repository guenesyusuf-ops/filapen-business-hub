'use client';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  /** Shape variant */
  variant?: 'text' | 'circle' | 'card' | 'chart';
  /** Number of text lines to show (only for variant="text") */
  lines?: number;
  /** Width of the skeleton (Tailwind class) */
  width?: string;
  /** Height of the skeleton (Tailwind class) */
  height?: string;
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg shimmer-bg animate-shimmer',
        className,
      )}
    />
  );
}

export function LoadingSkeleton({
  className,
  variant = 'text',
  lines = 3,
  width,
  height,
}: LoadingSkeletonProps) {
  if (variant === 'circle') {
    return (
      <div
        className={cn(
          'rounded-full shimmer-bg animate-shimmer',
          width ?? 'w-10',
          height ?? 'h-10',
          className,
        )}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('relative rounded-xl bg-white p-5 shadow-card overflow-hidden', className)}>
        <div className="absolute inset-0 shimmer-bg animate-shimmer" />
        <div className="relative space-y-3">
          <ShimmerBar className="h-3 w-24 bg-gray-200/60" />
          <ShimmerBar className="h-8 w-32 bg-gray-200/60" />
          <ShimmerBar className="h-5 w-16 bg-gray-200/60" />
        </div>
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={cn('relative rounded-xl bg-white p-5 shadow-card overflow-hidden', className)}>
        <div className="absolute inset-0 shimmer-bg animate-shimmer" />
        <div className="relative">
          <ShimmerBar className="h-4 w-40 bg-gray-200/60 mb-4" />
          <div className={cn('rounded-lg bg-gray-100/40', height ?? 'h-[400px]')} />
        </div>
      </div>
    );
  }

  // Default: text variant
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBar
          key={i}
          className={cn(
            'h-3 bg-gray-200/60',
            i === lines - 1 ? 'w-3/4' : width ?? 'w-full',
          )}
        />
      ))}
    </div>
  );
}
