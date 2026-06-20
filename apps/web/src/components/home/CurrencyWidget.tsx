'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ArrowRightLeft, RefreshCw, TrendingUp, Percent, ArrowDown, ArrowUp, Calculator } from 'lucide-react';
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

type Mode = 'currency' | 'vat' | 'calc';

/**
 * Kombiniertes Widget: Waehrungsrechner + MwSt-Rechner + Taschenrechner.
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
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:text-sm font-semibold transition-colors',
            mode === 'currency'
              ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500 bg-primary-50/40 dark:bg-primary-900/15'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent',
          )}
        >
          <TrendingUp className="h-4 w-4" />
          Währung
        </button>
        <button
          onClick={() => setMode('vat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:text-sm font-semibold transition-colors',
            mode === 'vat'
              ? 'text-emerald-600 dark:text-emerald-300 border-b-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/15'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent',
          )}
        >
          <Percent className="h-4 w-4" />
          MwSt
        </button>
        <button
          onClick={() => setMode('calc')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:text-sm font-semibold transition-colors',
            mode === 'calc'
              ? 'text-gray-900 dark:text-gray-100 border-b-2 border-gray-900 dark:border-gray-100 bg-gray-100/60 dark:bg-white/[0.04]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent',
          )}
        >
          <Calculator className="h-4 w-4" />
          Rechner
        </button>
      </div>

      {mode === 'currency' && <CurrencyMode />}
      {mode === 'vat' && <VatMode />}
      {mode === 'calc' && <CalcMode />}
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

// -----------------------------------------------------------------------------
// Taschen-Rechner ("Paper"-Preset, Space Grotesk, 19 Tasten, Keyboard-Support)
// -----------------------------------------------------------------------------

// Space Grotesk Font wird einmalig per <link> nachgeladen — idempotent.
function useSpaceGroteskFont() {
  useEffect(() => {
    const id = 'space-grotesk-font-link';
    if (document.getElementById(id)) return;
    const pre1 = document.createElement('link');
    pre1.id = id;
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pre1);
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    document.head.appendChild(pre2);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap';
    document.head.appendChild(css);
  }, []);
}

// Logik streng nach Spec
type CalcState = {
  cur: string;
  prev: string | null;
  op: '+' | '−' | '×' | '÷' | null;
  fresh: boolean;
};

function fmtCalc(x: number): string {
  if (!Number.isFinite(x)) return 'Error';
  if (Math.abs(x) >= 1e12) return x.toExponential(4);
  // 9 Nachkommastellen, ueberfluessige Nullen weg
  const r = Math.round(x * 1e9) / 1e9;
  let s = r.toFixed(9);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function CalcMode() {
  useSpaceGroteskFont();
  const stateRef = useRef<CalcState>({ cur: '0', prev: null, op: null, fresh: true });
  const [, force] = useState(0);
  const tick = useCallback(() => force((n) => n + 1), []);

  function press(key: string) {
    const s = stateRef.current;
    // Reset bei 'Error' fuer beliebigen Input ausser AC
    if (s.cur === 'Error' && key !== 'AC') {
      s.cur = '0'; s.prev = null; s.op = null; s.fresh = true;
    }
    if (/^[0-9]$/.test(key)) {
      if (s.fresh || s.cur === '0') { s.cur = key; s.fresh = false; }
      else if (s.cur.replace('.', '').replace('-', '').length < 12) { s.cur += key; }
    } else if (key === '.') {
      if (s.fresh) { s.cur = '0.'; s.fresh = false; }
      else if (!s.cur.includes('.')) { s.cur += '.'; }
    } else if (key === 'AC') {
      s.cur = '0'; s.prev = null; s.op = null; s.fresh = true;
    } else if (key === '±') {
      if (s.cur === '0') return;
      s.cur = s.cur.startsWith('-') ? s.cur.slice(1) : '-' + s.cur;
    } else if (key === '%') {
      const n = parseFloat(s.cur);
      s.cur = fmtCalc(n / 100);
      s.fresh = true;
    } else if (key === '+' || key === '−' || key === '×' || key === '÷') {
      if (s.op && !s.fresh) compute(s);
      s.prev = s.cur;
      s.op = key;
      s.fresh = true;
    } else if (key === '=') {
      if (s.op) {
        compute(s);
        s.op = null;
        s.prev = null;
      }
    }
    tick();
  }

  function compute(s: CalcState) {
    const a = parseFloat(s.prev ?? '0');
    const b = parseFloat(s.cur);
    let r: number;
    switch (s.op) {
      case '+': r = a + b; break;
      case '−': r = a - b; break;
      case '×': r = a * b; break;
      case '÷': r = b === 0 ? NaN : a / b; break;
      default: return;
    }
    s.cur = !Number.isFinite(r) ? 'Error' : fmtCalc(r);
    s.fresh = true;
  }

  // Tastatur-Support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Nur reagieren wenn nicht in einem Input/Textarea fokussiert
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) press(k);
      else if (k === '.') press('.');
      else if (k === '+') press('+');
      else if (k === '-') press('−');
      else if (k === '*') press('×');
      else if (k === '/') { e.preventDefault(); press('÷'); }
      else if (k === '%') press('%');
      else if (k === 'Enter' || k === '=') { e.preventDefault(); press('='); }
      else if (k === 'Escape') press('AC');
      else return;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const s = stateRef.current;
  const expr = s.op && s.prev ? `${s.prev} ${s.op}` : '';
  const out = s.cur;
  // Auto-shrink Logik: >9 → 70%, >7 → 85%, sonst 100% von 60px
  const outScale = out.length > 9 ? 0.7 : out.length > 7 ? 0.85 : 1;

  // Tastenrasterspezifikation: 19 Tasten in 5 Reihen
  type Btn = { k: string; kind: 'fn' | 'op' | 'num' | 'eq'; span?: number };
  const keys: Btn[] = [
    { k: 'AC', kind: 'fn' }, { k: '±', kind: 'fn' }, { k: '%', kind: 'fn' }, { k: '÷', kind: 'op' },
    { k: '7', kind: 'num' }, { k: '8', kind: 'num' }, { k: '9', kind: 'num' }, { k: '×', kind: 'op' },
    { k: '4', kind: 'num' }, { k: '5', kind: 'num' }, { k: '6', kind: 'num' }, { k: '−', kind: 'op' },
    { k: '1', kind: 'num' }, { k: '2', kind: 'num' }, { k: '3', kind: 'num' }, { k: '+', kind: 'op' },
    { k: '0', kind: 'num', span: 2 }, { k: '.', kind: 'num' }, { k: '=', kind: 'eq' },
  ];

  // Hoehe und Schrift gemaess Spec — Tasten 64px, Font 64*0.36
  const btnH = 64;
  const numFs = Math.round(btnH * 0.36);
  const fnFs = Math.round(btnH * 0.32);
  const opShadow = '0 4px 10px rgba(0,0,0,0.11), 0 4px 14px color-mix(in srgb, #111111 45%, transparent)';
  const softShadow = '0 4px 10px rgba(0,0,0,0.11)';

  return (
    <div className="p-4 sm:p-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div
        style={{
          background: '#f3f0ea',
          borderRadius: 34,
          padding: 18,
          boxShadow: '0 15px 35px rgba(20,18,15,0.275), 0 2px 6px rgba(0,0,0,0.18)',
          color: '#1a1a1a',
          width: '100%',
          maxWidth: 340,
          margin: '0 auto',
        }}
      >
        {/* Display */}
        <div style={{ padding: '18px 14px 14px', textAlign: 'right' }}>
          <div style={{ fontSize: 15, opacity: 0.5, lineHeight: 1.2, minHeight: '1em' }}>
            {expr || '\u00A0'}
          </div>
          <div
            style={{
              fontSize: 60 * outScale,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {out}
          </div>
        </div>

        {/* Tastenraster */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            userSelect: 'none',
          }}
        >
          {keys.map((b) => {
            const isNum = b.kind === 'num';
            const isOp = b.kind === 'op' || b.kind === 'eq';
            const isFn = b.kind === 'fn';
            const bg = isOp ? '#111111' : isFn ? 'color-mix(in srgb, #ffffff 78%, #1a1a1a 22%)' : '#ffffff';
            const color = isOp ? '#ffffff' : '#1a1a1a';
            return (
              <button
                key={b.k}
                type="button"
                onClick={() => press(b.k)}
                style={{
                  gridColumn: b.span ? `span ${b.span}` : undefined,
                  height: btnH,
                  borderRadius: '50%',
                  background: bg,
                  color,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 500,
                  fontSize: isFn ? fnFs : numFs,
                  boxShadow: isOp ? opShadow : softShadow,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform .07s',
                  // 0-Taste ueberspannt 2 Spalten — bleibt Pille-Form via 50% radius
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
              >
                {b.k}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
