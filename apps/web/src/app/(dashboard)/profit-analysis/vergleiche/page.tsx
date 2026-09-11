'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { profitAnalysisApi, PeriodInput, PeriodTotal, PeriodKind } from '@/lib/profit-analysis/api';
import { formatEur, formatPercent } from '@/lib/profit-analysis/formatters';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const KIND_OPTIONS: Array<{ value: PeriodKind; label: string }> = [
  { value: 'month', label: 'Monat' },
  { value: 'quarter', label: 'Quartal' },
  { value: 'year', label: 'Jahr' },
  { value: 'ytd', label: 'YTD (year-to-date)' },
];

export default function VergleichePage() {
  const now = new Date();
  const [a, setA] = useState<PeriodInput>({ kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 });
  const [b, setB] = useState<PeriodInput>({ kind: 'month', year: now.getFullYear() - 1, month: now.getMonth() + 1 });
  const [aData, setAData] = useState<PeriodTotal | null>(null);
  const [bData, setBData] = useState<PeriodTotal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await profitAnalysisApi.periods.compare(a, b);
      setAData(res.a); setBData(res.b);
    } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }, [a, b]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Vergleiche</h2>
        <p className="text-sm text-slate-500 mt-0.5">Beliebige Zeiträume nebeneinander — Monat, Quartal, Jahr, YTD.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PeriodPicker label="A" value={a} onChange={setA} />
        <PeriodPicker label="B" value={b} onChange={setB} />
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4 mt-0.5" /> {error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
      ) : aData && bData && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
              <tr>
                <th className="text-left px-4 py-3">Kennzahl</th>
                <th className="text-right px-4 py-3">{aData.label}<div className="font-normal text-slate-400">{aData.monthCount} Monat{aData.monthCount !== 1 ? 'e' : ''}</div></th>
                <th className="text-right px-4 py-3">{bData.label}<div className="font-normal text-slate-400">{bData.monthCount} Monat{bData.monthCount !== 1 ? 'e' : ''}</div></th>
                <th className="text-right px-4 py-3">Δ absolut</th>
                <th className="text-right px-4 py-3">Δ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              <Row label="Brutto-Umsatz" a={aData.grossSalesTotal} b={bData.grossSalesTotal} />
              <Row label="Netto-Umsatz (Kanäle)" a={aData.netSalesTotal} b={bData.netSalesTotal} />
              <Row label="Netto inkl. Großhandel" a={aData.netSalesWithWholesale} b={bData.netSalesWithWholesale} />
              <Row label="USt aus Verkäufen" a={aData.vatTotal} b={bData.vatTotal} />
              <Row label="Werbekosten" a={aData.adsTotal} b={bData.adsTotal} />
              <Row label="Produktkosten" a={aData.productCostsTotal} b={bData.productCostsTotal} />
              <Row label="Versandkosten" a={aData.shippingCostsTotal} b={bData.shippingCostsTotal} />
              <Row label="Plattformgebühren" a={aData.platformFeesTotal} b={bData.platformFeesTotal} />
              <Row label="Großhandelsgewinn" a={aData.wholesaleProfit} b={bData.wholesaleProfit} />
              <Row label="Gemeinkosten (Netto)" a={aData.overheadTotal} b={bData.overheadTotal} />
              <Row label="Profit vor GK (nur Kanäle)" a={aData.profitBeforeOverhead} b={bData.profitBeforeOverhead} />
              <Row label="Profit vor GK (inkl. Großhandel)" a={aData.profitBeforeOverheadWithWholesale} b={bData.profitBeforeOverheadWithWholesale} highlight />
              <Row label="Marge vor GK" a={aData.marginBeforeOverhead} b={bData.marginBeforeOverhead} unit="pct" />
              <Row label="Operativer Gewinn" a={aData.operatingProfit} b={bData.operatingProfit} highlight />
              <Row label="Operative Endmarge" a={aData.operatingMargin} b={bData.operatingMargin} unit="pct" highlight />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeriodPicker({ label, value, onChange }: { label: string; value: PeriodInput; onChange: (v: PeriodInput) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">Zeitraum {label}</div>
      <div className="flex flex-wrap gap-2">
        <select value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as PeriodKind })}
          className="rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm">
          {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" min="2020" max="2100" value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className="w-24 rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm text-right tabular-nums" />
        {value.kind === 'month' && (
          <select value={value.month ?? 1} onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
            className="rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm">
            {MONTH_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        )}
        {value.kind === 'quarter' && (
          <select value={value.quarter ?? 1} onChange={(e) => onChange({ ...value, quarter: Number(e.target.value) })}
            className="rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function Row({ label, a, b, unit = 'eur' as 'eur' | 'pct', highlight }: { label: string; a: string | null; b: string | null; unit?: 'eur' | 'pct'; highlight?: boolean }) {
  const na = a !== null ? Number(a) : null;
  const nb = b !== null ? Number(b) : null;
  const delta = na !== null && nb !== null ? na - nb : null;
  const deltaPct = na !== null && nb !== null && nb !== 0 ? ((na - nb) / Math.abs(nb)) * 100 : null;
  const fmt = (v: string | null) => v === null ? '—' : unit === 'eur' ? formatEur(v) : formatPercent(v);
  const fmtDelta = delta === null ? '—' : unit === 'eur' ? formatEur(delta.toString()) : formatPercent(delta.toString());
  const cls = delta === null ? 'text-slate-500' : delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500';
  return (
    <tr className={cn(highlight && 'bg-amber-50/40 dark:bg-amber-500/[0.03]')}>
      <td className={cn('px-4 py-2', highlight && 'font-semibold')}>{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmt(a)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmt(b)}</td>
      <td className={cn('px-4 py-2 text-right tabular-nums font-semibold', cls)}>{fmtDelta}</td>
      <td className={cn('px-4 py-2 text-right tabular-nums font-semibold', cls)}>{deltaPct !== null ? (deltaPct > 0 ? '+' : '') + deltaPct.toFixed(1) + ' %' : '—'}</td>
    </tr>
  );
}
