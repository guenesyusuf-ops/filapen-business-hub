import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneClasses, type Tone } from './tokens';

export interface StatusPillProps {
  tone?: Tone;
  children: ReactNode;
  /** Punkt links (Standard an) — Status nie nur über Farbe (A11y). */
  dot?: boolean;
  className?: string;
}

/**
 * Status-Pill: semantische Farbe + Text + Punkt. Farbe ist nie das einzige
 * Signal (Label immer vorhanden) — barrierefrei und preset-unabhängig.
 */
export function StatusPill({ tone = 'neutral', children, dot = true, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
