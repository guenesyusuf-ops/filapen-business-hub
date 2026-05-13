'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowRightLeft, RefreshCw, TrendingUp, Percent, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

const POPULAR_CURRENCIES = [
  { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
  { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'GBP', flag: '🇬🇧', name: 'Pfund' },
  { code: 'CHF', flag: '🇨🇭', name: 'Franken' },
  { code: 'TRY', flag: '🇹🇷', name: 'Türk. Lira' },
  { code: 'PLN', flag: '🇵🇱', name: 'Zloty' },
  { code: 'SEK', flag: '🇸🇪', name: 'Krone' },
  { code: 'JPY', flag: '🇯🇵', name: 'Yen' },
  { code: 'CNY', flag: '🇨🇳', name: 'Yuan' },
  { code: 'AED', flag: '🇦🇪', name: 'Dirham' },
];

type Mode = 'currency' | 'vat';

/**
 * Kombiniertes Widget: Waehrungsrechner + MwSt-Rechner mit Tab-Toggle.
 * Frueher zwei separate Kacheln — User wollte sie zusammenfuehren.
 */
export function CurrencyWidget() {
  const [mode, setMode] = useState<Mode>('currency');

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-card shadow-sm overflow-hidden">
      {/* Tab-Header */}
      <div className="flex border-b border-gray-100 dark:border-white/5">
        <button
          onClick={() => setMode('currency')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors',
            mode === 'currency'
              ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500 bg-primary-50/40 dark:bg-primary-900/15'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent',
          )}
        >
          <TrendingUp className="h-4 w-4" />
          Währungsrechner
        </button>
        <button
          onClick={() => setMode('vat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors',
            mode === 'vat'
              ? 'text-emerald-600 dark:text-emerald-300 border-b-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/15'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent',
          )}
        >
          <Percent className="h-4 w-4" />
          MwSt-Rechner
        </button>
      </div>

      {mode === 'currency' ? <CurrencyMode /> : <VatMode />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Waehrungs-Modus
// -----------------------------------------------------------------------------
function CurrencyMode() {
  const [from, setFrom] = useState('EUR');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('100');
  const [result, setResult] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/home/currency/convert?from=${from}&to=${to}&amount=${amount}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Fehler');
      }
      const data = await res.json();
      setResult(data.result);
      setRate(data.rate);
    } catch (err: any) {
      setError(err.message || 'Umrechnung fehlgeschlagen');
      setResult(null);
      setRate(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, amount]);

  useEffect(() => {
    const timer = setTimeout(convert, 300);
    return () => clearTimeout(timer);
  }, [convert]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  const fromCurrency = POPULAR_CURRENCIES.find((c) => c.code === from);
  const toCurrency = POPULAR_CURRENCIES.find((c) => c.code === to);

  return (
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={convert}
          disabled={loading}
          className="text-gray-400 hover:text-primary-500 transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          min="0"
          step="0.01"
        />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          {POPULAR_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={swap}
          className="p-2 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-500 hover:text-primary-600 transition-all active:scale-95"
        >
          <ArrowRightLeft className="h-4 w-4 rotate-90" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5">
          {loading ? (
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : result !== null ? (
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {result.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          {POPULAR_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </div>

      {rate !== null && !error && (
        <p className="text-[11px] text-gray-400 text-center">
          1 {fromCurrency?.flag} {from} = {rate.toLocaleString('de-DE', { minimumFractionDigits: 4 })} {toCurrency?.flag} {to}
        </p>
      )}

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MwSt-Modus
// -----------------------------------------------------------------------------
type VatRate = 7 | 19;
type Direction = 'gross-to-net' | 'net-to-gross';

function VatMode() {
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
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-end">
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
  );
}
