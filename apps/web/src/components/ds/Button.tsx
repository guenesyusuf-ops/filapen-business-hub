'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Icon vor dem Label (ReactNode, z. B. ein lucide-Icon). */
  leftIcon?: ReactNode;
  /** Icon nach dem Label. */
  rightIcon?: ReactNode;
  /** Zeigt einen Lade-Spinner und sperrt den Button. */
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none ' +
  'active:scale-[0.975] disabled:opacity-45 disabled:pointer-events-none';

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-[38px] px-[15px] text-[13.5px]',
};

const variants: Record<Variant, string> = {
  // Akzent = Preset-Farbe (primary). Text immer auf Vollton lesbar.
  primary:
    'bg-primary-600 text-white border border-transparent ' +
    'shadow-[0_1px_2px_rgb(var(--accent-2)/0.4),0_7px_18px_-8px_rgb(var(--accent-2)/0.55)] ' +
    'hover:brightness-[1.07]',
  secondary:
    'bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] ' +
    'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-color)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent ' +
    'hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
  danger:
    'bg-transparent text-error border border-[var(--border-color)] hover:bg-error/10',
};

/**
 * Klassen-String der DS-Button-Optik — für Elemente, die kein <button> sind
 * (z. B. Next <Link>). Verhalten/Markup des Elements bleibt unangetastet.
 */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string): string {
  return cn(base, sizes[size], variants[variant], ds.rControl, ds.focus, ds.ease, extra);
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/**
 * DS Button — exakt definierte Größen, Radien, Gewichte und Zustände.
 * `type` ist standardmäßig "button", um ungewollte Form-Submits zu verhindern.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', leftIcon, rightIcon, loading, fullWidth, className, children, type, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        ds.rControl,
        ds.focus,
        ds.ease,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
