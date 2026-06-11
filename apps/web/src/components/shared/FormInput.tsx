'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Standardisierte Form-Inputs fuer Filapen.
// - Min-Hoehe 44px (WCAG-Tap-Target)
// - 16px Schrift (verhindert iOS-Auto-Zoom)
// - Korrekte inputMode/autoComplete fuer mobile Keyboards
// - Integrierte Error/Hint/Label-Slots
// - Dark-Mode-fertig, accent-anpassbar
// ---------------------------------------------------------------------------

type CommonProps = {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  wrapperClassName?: string;
  accent?: 'primary' | 'amber' | 'purple' | 'emerald' | 'red' | 'blue';
};

const ACCENT_RING: Record<NonNullable<CommonProps['accent']>, string> = {
  primary: 'focus:ring-primary-500/30',
  amber:   'focus:ring-amber-500/30',
  purple:  'focus:ring-purple-500/30',
  emerald: 'focus:ring-emerald-500/30',
  red:     'focus:ring-red-500/30',
  blue:    'focus:ring-blue-500/30',
};

const BASE_INPUT_CLS = (accent: NonNullable<CommonProps['accent']>, hasError: boolean) => cn(
  'w-full rounded-lg border bg-white dark:bg-white/[0.04] px-3 py-3 sm:py-2.5 text-base sm:text-sm',
  'focus:outline-none focus:ring-2',
  hasError
    ? 'border-red-300 dark:border-red-500/40 focus:ring-red-500/30'
    : `border-gray-200 dark:border-white/10 ${ACCENT_RING[accent]}`,
  'min-h-[44px] sm:min-h-0',
);

// ---------------------------------------------------------------------------
// Wrapper mit Label/Error/Hint
// ---------------------------------------------------------------------------

function Wrap({
  label, hint, error, required, wrapperClassName, children,
}: CommonProps & { children: React.ReactNode }) {
  return (
    <label className={cn('block', wrapperClassName)}>
      {label && (
        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </div>
      )}
      {children}
      {(error || hint) && (
        <div className={cn('text-[11px] mt-1', error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
          {error || hint}
        </div>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// <TextField />
// ---------------------------------------------------------------------------

interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    CommonProps {
  type?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'search';
  mono?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, required, wrapperClassName, accent = 'primary',
    type = 'text', mono, className, ...rest }, ref,
) {
  // Sinnvolle Default-AutoCompletes pro Type
  const autoComplete = rest.autoComplete ?? (
    type === 'email' ? 'email'
    : type === 'tel' ? 'tel'
    : type === 'url' ? 'url'
    : type === 'password' ? 'current-password'
    : 'off'
  );
  // Mobile-Keyboards optimieren
  const inputMode = rest.inputMode ?? (
    type === 'email' ? 'email'
    : type === 'tel' ? 'tel'
    : type === 'url' ? 'url'
    : type === 'search' ? 'search'
    : 'text'
  );
  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <input
        ref={ref}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={cn(BASE_INPUT_CLS(accent, !!error), mono && 'font-mono', className)}
        {...rest}
      />
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <PasswordField /> mit Augen-Toggle
// ---------------------------------------------------------------------------

export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type'>>(function PasswordField(
  { label, hint, error, required, wrapperClassName, accent = 'primary', className, ...rest }, ref,
) {
  const [show, setShow] = useState(false);
  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          className={cn(BASE_INPUT_CLS(accent, !!error), 'pr-11', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <NumberField /> mit String-Buffer (User kann 0 loeschen + leer lassen)
// ---------------------------------------------------------------------------

interface NumberFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'>, CommonProps {
  value: number | string | null | undefined;
  onChange: (v: number | null) => void;
  /** Wenn true wird 0 als gueltig akzeptiert; sonst leerer Wert = null */
  allowZero?: boolean;
  /** Zeigt Einheit rechts (z.B. EUR, %, kg) */
  unit?: string;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, hint, error, required, wrapperClassName, accent = 'primary',
    value, onChange, allowZero = true, unit, step = '0.01', className, ...rest }, ref,
) {
  const [text, setText] = useState<string>(
    value == null || value === '' ? '' : String(value),
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value == null || value === '' ? '' : String(value));
  }, [value, focused]);

  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <div className="relative">
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (raw.trim() === '') onChange(null);
            else {
              const n = Number(raw);
              if (Number.isFinite(n)) {
                if (n === 0 && !allowZero) onChange(null);
                else onChange(n);
              }
            }
          }}
          onFocus={(e) => { setFocused(true); e.target.select(); }}
          onBlur={() => { setFocused(false); if (text.trim() === '') onChange(null); }}
          className={cn(BASE_INPUT_CLS(accent, !!error), 'tabular-nums', unit && 'pr-12', className)}
          {...rest}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <DateField /> — native <input type="date"> mit max=today als Default
// ---------------------------------------------------------------------------

interface DateFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>, CommonProps {
  maxToday?: boolean;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { label, hint, error, required, wrapperClassName, accent = 'primary', maxToday, className, ...rest }, ref,
) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <input
        ref={ref}
        type="date"
        max={maxToday ? todayStr : rest.max}
        className={cn(BASE_INPUT_CLS(accent, !!error), 'tabular-nums', className)}
        {...rest}
      />
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <TextAreaField /> — auto-resize optional
// ---------------------------------------------------------------------------

interface TextAreaFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'>,
    CommonProps {
  rows?: number;
  autoResize?: boolean;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, required, wrapperClassName, accent = 'primary',
    rows = 3, autoResize = true, onChange, className, ...rest }, ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function adjustHeight(el: HTMLTextAreaElement) {
    if (!autoResize) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <textarea
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          if (node && autoResize) adjustHeight(node);
        }}
        rows={rows}
        onChange={(e) => {
          if (autoResize) adjustHeight(e.target);
          onChange?.(e);
        }}
        className={cn(
          BASE_INPUT_CLS(accent, !!error),
          'min-h-[88px] resize-none',
          className,
        )}
        {...rest}
      />
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <SelectField /> — native <select> (mobile-friendly)
// ---------------------------------------------------------------------------

interface SelectFieldProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    CommonProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, required, wrapperClassName, accent = 'primary',
    options, className, ...rest }, ref,
) {
  return (
    <Wrap label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            BASE_INPUT_CLS(accent, !!error),
            'appearance-none pr-9',
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
      </div>
    </Wrap>
  );
});

// ---------------------------------------------------------------------------
// <CheckboxField /> — gross genug fuer Touch
// ---------------------------------------------------------------------------

interface CheckboxFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  accent?: CommonProps['accent'];
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, hint, accent = 'primary', className, ...rest }, ref,
) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2 -my-2">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'mt-0.5 h-5 w-5 rounded border-gray-300 dark:border-white/10 cursor-pointer',
          accent === 'primary' && 'text-primary-600 focus:ring-primary-500',
          accent === 'amber' && 'text-amber-600 focus:ring-amber-500',
          accent === 'purple' && 'text-purple-600 focus:ring-purple-500',
          accent === 'emerald' && 'text-emerald-600 focus:ring-emerald-500',
          accent === 'red' && 'text-red-600 focus:ring-red-500',
          accent === 'blue' && 'text-blue-600 focus:ring-blue-500',
          className,
        )}
        {...rest}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800 dark:text-gray-200">{label}</div>
        {hint && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
});
