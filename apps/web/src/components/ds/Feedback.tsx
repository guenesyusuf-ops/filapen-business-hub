import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Einheitlicher Leerzustand mit klarer nächster Aktion. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center px-5 py-12 flex flex-col items-center', className)}>
      {icon && (
        <div className={cn('w-[54px] h-[54px] grid place-items-center mb-3.5 text-primary-600', ds.subtle, ds.rCard)}>
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</div>
      {description && <p className="mt-1.5 m-0 max-w-[46ch] text-[13.5px] text-[var(--text-secondary)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
  /** Höhe in px (Standard 14). */
  height?: number;
  /** Breite (CSS-Wert, z. B. "60%"). */
  width?: string;
  rounded?: boolean;
}

/** Lade-Skeleton mit dezentem Shimmer. */
export function Skeleton({ className, height = 14, width, rounded }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block relative overflow-hidden bg-[var(--bg-tertiary)] animate-pulse', rounded ? 'rounded-full' : 'rounded-md', className)}
      style={{ height, width }}
    />
  );
}

/** Mehrzeiliger Text-Skeleton. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['85%', '72%', '60%', '78%', '66%'];
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}
