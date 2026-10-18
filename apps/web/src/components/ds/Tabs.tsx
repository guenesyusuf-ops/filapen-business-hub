'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/** Unterstrichene Tabs mit animiertem Indikator (role=tablist, Tastatur-OK). */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel, className }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-[22px] border-b', ds.hairline, className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative py-[11px] px-px text-[13.5px] bg-transparent',
              ds.ease,
              ds.focus,
              active ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]',
            )}
          >
            {it.label}
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 right-0 -bottom-px h-0.5 rounded-t bg-primary-600 origin-left transition-transform duration-200',
                active ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
