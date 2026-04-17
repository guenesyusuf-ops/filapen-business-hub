'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowRightLeft, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

const POPULAR_CURRENCIES = [
  { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
  { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'GBP', flag: '🇬🇧', name: 'Pfund' },
  { code: 'CHF', flag: '🇨🇭', name: 'Franken' },
  { code: 'TRY', flag: '🇹🇷', name: 'Tuerk. Lira' },
  { code: 'PLN', flag: '🇵🇱', name: 'Zloty' },
  { code: 'SEK', flag: '🇸🇪', name: 'Krone' },
  { code: 'JPY', flag: '🇯🇵', name: 'Yen' },
  { code: 'CNY', flag: '🇨🇳', name: 'Yuan' },
  { code: 'AED', flag: '🇦🇪', name: 'Dirham' },
];

export function CurrencyWidget() {
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

  // Auto-convert on mount and when inputs change
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
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Waehrungsrechner</h2>
        </div>
        <button
          onClick={convert}
          disabled={loading}
          className="text-gray-400 hover:text-primary-500 transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Amount + From */}
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

        {/* Swap button */}
        <div className="flex items-center justify-center">
          <button
            onClick={swap}
            className="p-2 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-500 hover:text-primary-600 transition-all active:scale-95"
          >
            <ArrowRightLeft className="h-4 w-4 rotate-90" />
          </button>
        </div>

        {/* Result + To */}
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

        {/* Rate info */}
        {rate !== null && !error && (
          <p className="text-[11px] text-gray-400 text-center">
            1 {fromCurrency?.flag} {from} = {rate.toLocaleString('de-DE', { minimumFractionDigits: 4 })} {toCurrency?.flag} {to}
          </p>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
