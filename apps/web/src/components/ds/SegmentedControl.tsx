'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Segmentierte Steuerung (neutral — kein Vollton-Akzent). Aktives Segment
 * hebt sich durch Fläche + Schatten ab. Tastatur-bedienbar über echte Buttons.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('inline-flex p-[3px] gap-0.5 bg-[var(--bg-tertiary)] border', ds.hairline, ds.rControl, className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-[13px] py-1.5 text-[13px] font-medium rounded-[7px]',
              ds.ease,
              ds.focus,
              active
                ? 'bg-[var(--card-bg)] text-[var(--text-primary)] font-semibold shadow-[var(--card-shadow)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
