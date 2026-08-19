'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * InfoTooltip — kleines "i" neben einer berechneten Kennzahl.
 *
 * Klick/Hover oeffnet ein Popover mit bis zu drei Bloecken:
 *   description  — was ist das ueberhaupt?
 *   formula      — wie wird gerechnet? (Monospace)
 *   example      — welche Zahlen wurden konkret verwendet?
 *
 * Design-Regel des Moduls: rein eingegebene Werte kein Tooltip, berechnete
 * Kennzahlen bekommen einen. Dann kann der Nutzer per Klick immer verstehen
 * wie eine Zahl zustande kam.
 */
export function InfoTooltip({
  description,
  formula,
  example,
  size = 'sm',
  align = 'left',
  className,
  ariaLabel,
}: {
  description: string;
  formula?: string;
  example?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right' | 'center';
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + ESC schliesst das Popover.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const iconSize = size === 'md' ? 16 : 14;
  const alignClass =
    align === 'right'  ? 'right-0 origin-top-right'
    : align === 'center' ? 'left-1/2 -translate-x-1/2 origin-top'
    :                     'left-0 origin-top-left';

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        aria-label={ariaLabel ?? 'Erklaerung anzeigen'}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-colors',
          'text-slate-400 hover:text-slate-700 focus:text-slate-700',
          'dark:text-slate-500 dark:hover:text-slate-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          size === 'md' ? 'h-5 w-5' : 'h-4 w-4',
        )}
      >
        <Info size={iconSize} strokeWidth={2} />
      </button>

      {open && (
        <div
          ref={popRef}
          role="tooltip"
          onMouseLeave={() => setOpen(false)}
          className={cn(
            'absolute top-full mt-1.5 z-40',
            'w-72 sm:w-80 max-w-[calc(100vw-2rem)]',
            'rounded-xl border border-slate-200 bg-white shadow-dropdown',
            'dark:border-white/10 dark:bg-[#161923]',
            'p-3 text-left',
            'animate-scale-in',
            alignClass,
          )}
        >
          <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {description}
          </div>

          {formula && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">
                Formel
              </div>
              <div className="font-mono text-[11px] text-slate-800 dark:text-slate-100 leading-snug break-words">
                {formula}
              </div>
            </div>
          )}

          {example && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">
                Beispiel
              </div>
              <div className="font-mono text-[11px] text-slate-800 dark:text-slate-100 leading-snug break-words">
                {example}
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
