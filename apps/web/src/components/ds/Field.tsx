'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

const controlBase = cn(
  'w-full bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)]',
  'px-[13px] py-2.5 text-[14px] placeholder:text-[rgb(var(--color-text-tertiary))]',
  ds.rControl,
  ds.ease,
  'focus:outline-none focus:border-primary-500 focus:ring-[3.5px] focus:ring-primary-500/20',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(controlBase, 'appearance-none cursor-pointer', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlBase, 'min-h-[92px] resize-y leading-[1.55]', className)} {...rest} />;
  },
);

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Render-Prop erhält die id für korrekte Label-Verknüpfung (A11y). */
  children: (id: string) => ReactNode;
  className?: string;
}

/**
 * Formularfeld-Hülle: verknüpft Label/Hint/Fehler barrierefrei mit dem Control.
 * Nutzung: {@code <Field label="Name">{(id)=><Input id={id} .../>}</Field>}
 */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5 mb-4', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-[var(--text-primary)]">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <span className="text-[12px] text-error">{error}</span>
      ) : (
        hint && <span className="text-[12px] text-[var(--text-secondary)]">{hint}</span>
      )}
    </div>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** Switch mit echtem Button-Semantik + aria-pressed (Tastatur-bedienbar). */
export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-[42px] h-6 rounded-full shrink-0 disabled:opacity-50',
        ds.ease,
        ds.focus,
        checked ? 'bg-primary-600' : 'bg-[var(--border-strong,#D7D2C5)]',
        className,
      )}
      style={{ backgroundColor: checked ? undefined : 'rgb(var(--color-border-strong))' }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-[2.5px] w-[19px] h-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]',
          ds.ease,
          checked ? 'left-[20.5px]' : 'left-[2.5px]',
        )}
      />
    </button>
  );
}
