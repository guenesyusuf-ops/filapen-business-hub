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

// -----------------------------------------------------------------------------
// Geteilte "Paper"-Styles — wie der Taschenrechner. Alle 3 Tabs sehen gleich aus.
// -----------------------------------------------------------------------------
const paperPanelStyle: React.CSSProperties = {
  background: '#f3f0ea',
  borderRadius: 34,
  padding: 18,
  boxShadow: '0 15px 35px rgba(20,18,15,0.275), 0 2px 6px rgba(0,0,0,0.18)',
  color: '#1a1a1a',
  width: '100%',
  // 100% sorgt fuer 320px-Devices, maxWidth cap't bei 340 — unveraendert.
  maxWidth: 340,
  margin: '0 auto',
  boxSizing: 'border-box',
};
const displayCard: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 18,
  padding: '12px 14px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
};
const displayInput: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  color: '#1a1a1a',
  textAlign: 'right',
  width: '100%',
  minWidth: 0,
};
const currencyPill: React.CSSProperties = {
  background: '#111111',
  color: '#ffffff',
  border: 'none',
  borderRadius: 999,
  padding: '6px 10px',
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: '0 4px 14px color-mix(in srgb, #111111 45%, transparent)',
  appearance: 'none',
  textAlign: 'center',
  paddingRight: 14,
};
const swapBtn: React.CSSProperties = {
  background: '#111111',
  color: '#ffffff',
  border: 'none',
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 14px color-mix(in srgb, #111111 45%, transparent)',
  transition: 'transform .07s',
};
const paperIconBtn: React.CSSProperties = {
  background: 'color-mix(in srgb, #ffffff 78%, #1a1a1a 22%)',
  color: '#1a1a1a',
  border: 'none',
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(0,0,0,0.11)',
};
const pillToggle = (active: boolean): React.CSSProperties => ({
  background: active ? '#111111' : '#ffffff',
  color: active ? '#ffffff' : '#1a1a1a',
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: active
    ? '0 4px 14px color-mix(in srgb, #111111 45%, transparent)'
    : '0 2px 6px rgba(0,0,0,0.08)',
  transition: 'transform .07s',
});
const subtleLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  color: '#7a7468',
  marginBottom: 6,
};

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

  useSpaceGroteskFont();

  return (
    <div className="p-4 sm:p-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={paperPanelStyle}>
        {/* Refresh oben rechts */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button
            onClick={convert}
            disabled={loading}
            style={paperIconBtn}
            title="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* From: Display-Stil — Betrag (gross) + Currency (Pill) */}
        <div style={{ ...displayCard, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
            style={displayInput}
          />
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={currencyPill}
          >
            {POPULAR_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
        </div>

        {/* Swap-Button — schwarz wie Operator-Tasten */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
          <button onClick={swap} style={swapBtn} title="Vertauschen">
            <ArrowRightLeft className="h-4 w-4 rotate-90" />
          </button>
        </div>

        {/* To: Display-Stil */}
        <div style={{ ...displayCard, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, textAlign: 'right', overflow: 'hidden' }}>
            {loading ? (
              <span style={{ fontSize: 28, opacity: 0.4 }}>…</span>
            ) : result !== null ? (
              <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
                {result.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span style={{ fontSize: 28, color: '#bdb8ad' }}>—</span>
            )}
          </div>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={currencyPill}
          >
            {POPULAR_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
        </div>

        {/* Footer: Rate + Fehler */}
        {rate !== null && !error && (
          <p style={{ fontSize: 11, color: '#7a7468', textAlign: 'center', marginTop: 12, opacity: 0.7 }}>
            1 {fromCurrency?.flag} {from} = {rate.toLocaleString('de-DE', { minimumFractionDigits: 4 })} {toCurrency?.flag} {to}
          </p>
        )}
        {error && <p style={{ fontSize: 12, color: '#c53030', textAlign: 'center', marginTop: 10 }}>{error}</p>}
      </div>
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

  useSpaceGroteskFont();

  return (
    <div className="p-4 sm:p-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={paperPanelStyle}>
        {/* Rate-Toggle 7% / 19% — Pillen */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          {([7, 19] as const).map((r) => (
            <button key={r} onClick={() => setRate(r)} style={pillToggle(rate === r)}>
              {r}%
            </button>
          ))}
        </div>

        {/* Richtungs-Toggle als 2 grosse Pillen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setDirection('gross-to-net')}
            style={{ ...pillToggle(direction === 'gross-to-net'), flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ArrowDown className="h-3 w-3" /> Brutto → Netto
          </button>
          <button
            onClick={() => setDirection('net-to-gross')}
            style={{ ...pillToggle(direction === 'net-to-gross'), flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ArrowUp className="h-3 w-3" /> Netto → Brutto
          </button>
        </div>

        {/* Input-Card im Display-Stil */}
        <div style={{ ...displayCard, marginBottom: 12 }}>
          <div style={subtleLabel}>
            {direction === 'gross-to-net' ? 'Brutto-Betrag' : 'Netto-Betrag'}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={displayInput}
          />
        </div>

        {/* Resultat-Card */}
        <div style={{ ...displayCard, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#7a7468', fontWeight: 600 }}>{result?.label}</span>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
              {result ? result.primary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#7a7468', opacity: 0.7 }}>MwSt ({rate}%)</span>
            <span style={{ fontSize: 14, color: '#3a3530', fontWeight: 500 }}>
              {result ? result.vat.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}
            </span>
          </div>
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
          boxSizing: 'border-box',
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
