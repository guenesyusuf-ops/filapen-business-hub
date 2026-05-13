'use client';

import { useState, useMemo } from 'react';
import { Percent, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type VatRate = 7 | 19;
type Direction = 'gross-to-net' | 'net-to-gross';

/**
 * MwSt-Rechner: brutto ↔ netto fuer 7% oder 19%.
 * Auto-recalc on input change.
 */
export function VatCalculatorWidget() {
  const [amount, setAmount] = useState('100');
  const [rate, setRate] = useState<VatRate>(19);
  const [direction, setDirection] = useState<Direction>('gross-to-net');

  const result = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    const factor = 1 + rate / 100;
    if (direction === 'gross-to-net') {
      const net = n / factor;
      return { primary: net, vat: n - net, label: 'Netto' };
    }
    const gross = n * factor;
    return { primary: gross, vat: gross - n, label: 'Brutto' };
  }, [amount, rate, direction]);

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">MwSt-Rechner</h2>
        </div>
        {/* MwSt-Satz Toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
          {([7, 19] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRate(r)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold transition-colors',
                rate === r
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-white/[0.03] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
              )}
            >
              {r}%
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        {/* Direction Toggle */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={() => setDirection('gross-to-net')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 font-medium transition-colors',
              direction === 'gross-to-net'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-gray-50 dark:bg-white/[0.03] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10',
            )}
          >
            <ArrowDown className="h-3 w-3" /> Brutto → Netto
          </button>
          <button
            onClick={() => setDirection('net-to-gross')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 font-medium transition-colors',
              direction === 'net-to-gross'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-gray-50 dark:bg-white/[0.03] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10',
            )}
          >
            <ArrowUp className="h-3 w-3" /> Netto → Brutto
          </button>
        </div>

        {/* Eingabe */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            {direction === 'gross-to-net' ? 'Brutto-Betrag (€)' : 'Netto-Betrag (€)'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Ergebnis */}
        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{result?.label}</span>
            <span className="font-bold text-gray-900 dark:text-white tabular-nums">
              {result
                ? result.primary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">MwSt ({rate}%)</span>
            <span className="text-gray-600 dark:text-gray-300 tabular-nums">
              {result
                ? result.vat.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
