'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Loader2, Wallet, AlertTriangle, Clock, CalendarRange,
  TrendingUp, ArrowRight,
} from 'lucide-react';
import { invoicesApi, fmtEUR, categoryColor, categoryLabel } from '@/lib/invoices';

export default function InvoiceStatsPage() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ['invoice-stats-dashboard'],
    queryFn: () => invoicesApi.statsDashboard(),
    refetchInterval: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="p-16 text-center text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt Dashboard …
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <div className="p-16 text-center text-sm text-red-600">Statistiken konnten nicht geladen werden.</div>;
  }
  const d = q.data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-md">
          <BarChart2 className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
          Statistiken
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Offen" value={d.kpis.open} accent="text-gray-700 dark:text-gray-300" onClick={() => router.push('/invoices?tab=open')} />
        <Kpi label="Bald fällig" value={d.kpis.due_soon} accent="text-orange-600 dark:text-orange-400" onClick={() => router.push('/invoices?tab=due_soon')} />
        <Kpi label="Heute fällig" value={d.kpis.due_today} accent="text-amber-600 dark:text-amber-400" onClick={() => router.push('/invoices?tab=due_today')} />
        <Kpi label="Überfällig" value={d.kpis.overdue} accent="text-red-600 dark:text-red-400" onClick={() => router.push('/invoices?tab=overdue')} />
        <Kpi label="Σ Offen" value={fmtEUR(d.kpis.sumOpen)} numeric accent="text-gray-900 dark:text-white" />
        <Kpi label="Σ Bezahlt" value={fmtEUR(d.kpis.sumPaid)} numeric accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Liquiditäts-Widget */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-gradient-to-br from-blue-50/60 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Liquidität</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">— wie viel musst du in den nächsten Tagen zahlen?</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CashflowCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Nächste 7 Tage"
            total={d.cashflow.next7d.total}
            count={d.cashflow.next7d.count}
            tone="amber"
          />
          <CashflowCard
            icon={<CalendarRange className="h-3.5 w-3.5" />}
            label="Nächste 30 Tage"
            total={d.cashflow.next30d.total}
            count={d.cashflow.next30d.count}
            tone="blue"
          />
          <CashflowCard
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Überfällig (gesamt)"
            total={d.cashflow.overdue.total}
            count={d.cashflow.overdue.count}
            tone="red"
          />
          <CashflowCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Dieser Monat"
            total={d.cashflow.thisMonth.total}
            count={d.cashflow.thisMonth.count}
            tone="emerald"
          />
        </div>
      </div>

      {/* Monatliche Ausgaben + Kategorie-Aufteilung nebeneinander */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ausgaben pro Monat</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">Letzte 12 Monate · grün = bezahlt, orange = offen</span>
          </div>
          <MonthlyChart data={d.monthly} />
        </div>
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Nach Kategorie</h2>
          {d.byCategory.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">Noch keine Daten.</div>
          ) : (
            <CategoryChart data={d.byCategory} />
          )}
        </div>
      </div>

      {/* Top Lieferanten */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Top Lieferanten</h2>
          <button onClick={() => router.push('/invoices/suppliers')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            Alle ansehen <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {d.topSuppliers.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">Noch keine Daten.</div>
        ) : (
          <TopSuppliers data={d.topSuppliers} />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// KPI Card
// -----------------------------------------------------------------------------

function Kpi({ label, value, accent, numeric, onClick }: {
  label: string;
  value: number | string;
  accent?: string;
  numeric?: boolean;
  onClick?: () => void;
}) {
  const Wrap = onClick ? 'button' : 'div';
  return (
    <Wrap
      onClick={onClick}
      className={`rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3 text-left ${onClick ? 'hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors' : ''}`}
    >
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`tabular-nums font-semibold ${numeric ? 'text-base' : 'text-2xl'} ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
    </Wrap>
  );
}

// -----------------------------------------------------------------------------
// Cashflow Card
// -----------------------------------------------------------------------------

function CashflowCard({ icon, label, total, count, tone }: {
  icon: React.ReactNode;
  label: string;
  total: number;
  count: number;
  tone: 'amber' | 'blue' | 'red' | 'emerald';
}) {
  const toneClasses = {
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20',
  }[tone];
  return (
    <div className="rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/8 p-3">
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${toneClasses}`}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white mt-2">
        {fmtEUR(total)}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
        {count} Rechnung{count === 1 ? '' : 'en'}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Monthly Chart (SVG Bar Chart)
// -----------------------------------------------------------------------------

function MonthlyChart({ data }: { data: Array<{ month: string; paid: number; unpaid: number; total: number }> }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 100; // viewBox is 0..100, scaled via SVG
  const H = 60;
  const barWidth = W / data.length;
  const gap = barWidth * 0.18;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full h-[220px]" preserveAspectRatio="none">
        {/* Y-Achsen-Linien */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1="0" y1={H - H * t} x2={W} y2={H - H * t} stroke="currentColor" strokeWidth="0.1" opacity="0.08" />
        ))}
        {data.map((d, i) => {
          const x = i * barWidth + gap / 2;
          const totalH = (d.total / max) * H;
          const paidH = (d.paid / max) * H;
          const unpaidH = (d.unpaid / max) * H;
          return (
            <g key={d.month}>
              {/* Unpaid (bottom) */}
              <rect x={x} y={H - unpaidH} width={barWidth - gap} height={unpaidH} fill="#f97316" rx="0.5">
                <title>{`${formatMonth(d.month)} · Offen: ${fmtEUR(d.unpaid)}`}</title>
              </rect>
              {/* Paid (stacked) */}
              <rect x={x} y={H - unpaidH - paidH} width={barWidth - gap} height={paidH} fill="#10b981" rx="0.5">
                <title>{`${formatMonth(d.month)} · Bezahlt: ${fmtEUR(d.paid)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
        {data.map((d) => (
          <span key={d.month}>{formatMonthShort(d.month)}</span>
        ))}
      </div>
    </div>
  );
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
function formatMonthShort(ym: string) {
  const [_, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return names[parseInt(m, 10) - 1] ?? m;
}

// -----------------------------------------------------------------------------
// Category Chart (Horizontal Bars)
// -----------------------------------------------------------------------------

function CategoryChart({ data }: { data: Array<{ category: string; total: number; count: number }> }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      {data.map((c) => {
        const pct = (c.total / total) * 100;
        const color = categoryColor(c.category);
        return (
          <div key={c.category}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="text-gray-700 dark:text-gray-300 truncate">{categoryLabel(c.category)}</span>
                <span className="text-gray-400 text-[10px]">({c.count})</span>
              </span>
              <span className="text-gray-700 dark:text-gray-300 tabular-nums font-medium flex-shrink-0">{fmtEUR(c.total)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Top Suppliers
// -----------------------------------------------------------------------------

function TopSuppliers({ data }: { data: Array<{ supplierName: string; total: number; count: number }> }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="space-y-2.5">
      {data.map((s, i) => {
        const pct = (s.total / max) * 100;
        return (
          <div key={s.supplierName} className="flex items-center gap-3">
            <span className="w-5 text-center text-xs tabular-nums font-bold text-gray-400">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-800 dark:text-gray-200 font-medium truncate">{s.supplierName}</span>
                <span className="text-gray-700 dark:text-gray-300 tabular-nums font-semibold flex-shrink-0">{fmtEUR(s.total)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">{s.count} Rg.</span>
          </div>
        );
      })}
    </div>
  );
}
