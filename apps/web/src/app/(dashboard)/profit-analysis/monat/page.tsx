'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, AlertCircle,
  TrendingUp, TrendingDown, Info, ShoppingBag, Package2, Music2,
} from 'lucide-react';
import {
  profitAnalysisApi, ComputedMonth, ComputedDay, RawDay, RawMonth, Channel,
  ProductCostRow,
} from '@/lib/profit-analysis/api';
import { formatEur, formatPercent, formatDate } from '@/lib/profit-analysis/formatters';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function MonatPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [raw, setRaw] = useState<RawMonth | null>(null);
  const [computed, setComputed] = useState<ComputedMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profitAnalysisApi.daily.getMonth(year, month);
      setRaw(res.raw);
      setComputed(res.computed);
    } catch (e: any) {
      setError(e?.message ?? 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const daysOfMonth = useMemo(() => enumerateDays(year, month), [year, month]);
  const rawByDate = useMemo(() => {
    const m = new Map<string, RawDay>();
    (raw?.days ?? []).forEach((d) => m.set(d.date, d));
    return m;
  }, [raw]);
  const computedByDate = useMemo(() => {
    const m = new Map<string, ComputedDay>();
    (computed?.days ?? []).forEach((d) => m.set(d.date, d));
    return m;
  }, [computed]);

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1);
    setSelectedDate(null);
  }
  function jumpToday() {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth() + 1);
    setSelectedDate(n.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-5">
      {/* Header: Monatsauswahl */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-lg font-bold text-slate-900 dark:text-white min-w-[180px] text-center tabular-nums">
            {MONTH_LABELS[month - 1]} {year}
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={jumpToday}
            className="ml-2 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
          >
            Heute
          </button>
        </div>

        {computed?.status === 'locked' && (
          <div className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-medium">
            Gesperrt – nur Owner kann öffnen
          </div>
        )}
        {computed?.status === 'closed' && (
          <div className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300 font-medium">
            Abgeschlossen
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Empty State §81: leerer Monat */}
      {computed && computed.days.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Für {MONTH_LABELS[month - 1]} {year} wurden noch keine Daten erfasst.
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => setSelectedDate(`${year}-${String(month).padStart(2, '0')}-01`)}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold"
            >
              Ersten Tageswert eintragen
            </button>
          </div>
        </div>
      )}

      {/* Monats-Summen */}
      {computed && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
          <SummaryCard label="Brutto-Umsatz" value={formatEur(computed.totals.grossSalesTotal)} />
          <SummaryCard label="Netto-Umsatz" value={formatEur(computed.totals.netSalesTotal)} tooltip={{
            description: 'Summe der drei Kanal-Netto-Umsätze im Monat (nach Retouren).',
            formula: 'Shopify Netto + Amazon Netto + TikTok Netto',
          }} />
          <SummaryCard label="Werbekosten" value={formatEur(computed.totals.adsTotal)} tone="warn" />
          <SummaryCard label="Profit vor GK" value={formatEur(computed.totals.profitBeforeOverhead)} tone={
            Number(computed.totals.profitBeforeOverhead) < 0 ? 'critical' : 'good'
          } tooltip={{
            description: 'Summe aller Kanal-Profite vor Gemeinkosten (kommen in Phase 7).',
            formula: 'Webshop Profit + Amazon Profit + TikTok Profit',
          }} />
          <SummaryCard
            label="Marge vor GK"
            value={computed.totals.marginBeforeOverhead !== null ? formatPercent(computed.totals.marginBeforeOverhead) : '—'}
            tone={marginToneClass(computed.totals.marginBeforeOverhead)}
            tooltip={{
              description: 'Operative Marge vor Gemeinkosten. Ziel-Ampel: rot < 20, orange 20–25, grün ab 25, Ziel 30.',
              formula: 'Profit vor Gemeinkosten / Netto-Umsatz × 100',
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Monat …
        </div>
      ) : (
        <>
          <MonthTable
            daysOfMonth={daysOfMonth}
            computedByDate={computedByDate}
            rawByDate={rawByDate}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />

          {/* Selected Day Editor */}
          {selectedDate && (
            <DayEditor
              date={selectedDate}
              raw={rawByDate.get(selectedDate) ?? null}
              computed={computedByDate.get(selectedDate) ?? null}
              readonly={computed?.status === 'locked'}
              onSaved={load}
            />
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Day-Editor: Sales + Ads + Shipping + Compute-Preview
// -----------------------------------------------------------------------------

function DayEditor({
  date, raw, computed, readonly, onSaved,
}: {
  date: string;
  raw: RawDay | null;
  computed: ComputedDay | null;
  readonly: boolean;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<Channel>('shopify');
  const sales = raw?.channelSales[tab] ?? { channel: tab, gross19: '0', gross7: '0', returns19: '0', returns7: '0' };
  const ads = raw?.ads ?? { meta: '0', google: '0', influencer: '0', amazonPpc: '0', tiktokAds: '0' };
  const shipping = raw?.shipping ?? { shopifyPackages: 0, tiktokPackages: 0 };
  const computedChannel = computed?.[tab];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Tages-Editor</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{formatDate(date)}</div>
        </div>
        {readonly && (
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">Nur-Lese-Modus</div>
        )}
      </div>

      {/* Kanal-Tabs */}
      <div className="border-b border-slate-200 dark:border-white/8 flex gap-1">
        <ChannelTab active={tab === 'shopify'} onClick={() => setTab('shopify')} color="emerald" icon={ShoppingBag}>Shopify</ChannelTab>
        <ChannelTab active={tab === 'amazon'}  onClick={() => setTab('amazon')}  color="orange"  icon={Package2}>Amazon</ChannelTab>
        <ChannelTab active={tab === 'tiktok'}  onClick={() => setTab('tiktok')}  color="pink"    icon={Music2}>TikTok</ChannelTab>
      </div>

      {/* Sales-Eingabe — adaptive UX (Variante 3, §7) */}
      <SalesSection
        date={date}
        channel={tab}
        sales={sales}
        readonly={readonly}
        onSaved={onSaved}
      />

      {computedChannel && (
        <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02] p-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <ComputedField label="Netto" value={formatEur(computedChannel.profit.netSales)}
              tooltip={{ description: 'Netto-Umsatz nach Abzug der USt (und Retouren).', formula: 'Brutto / (1 + USt/100)' }} />
            <ComputedField label="USt gesamt" value={formatEur(computedChannel.vat.vatTotal)}
              tooltip={{ description: 'Enthaltene Umsatzsteuer aus den erfassten Verkäufen. Nicht Umsatzsteuer-Zahllast.', formula: 'USt19 + USt7' }} />
            <ComputedField label="Brutto (bereinigt)" value={formatEur(computedChannel.vat.grossAdjusted)}
              tooltip={{ description: 'Brutto-Umsatz abzüglich Retouren.', formula: '(Brutto19 + Brutto7) − (Retouren19 + Retouren7)' }} />
          </div>
        </div>
      )}

      {/* §20-23 Verkaufte Produkte je Kanal */}
      <ProductSalesSection
        date={date}
        channel={tab}
        productSales={raw?.productSales ?? []}
        readonly={readonly}
        onSaved={onSaved}
      />

      {/* Werbekosten */}
      <div>
        <SectionLabel>Werbekosten (netto)</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {tab === 'shopify' && <>
            <MoneyField label="Meta Ads"  value={ads.meta}       disabled={readonly}
              onSaved={(v) => profitAnalysisApi.daily.patchAds(date, { meta: v }).then(onSaved)} />
            <MoneyField label="Google Ads" value={ads.google}    disabled={readonly}
              onSaved={(v) => profitAnalysisApi.daily.patchAds(date, { google: v }).then(onSaved)} />
            <MoneyField label="Influencer" value={ads.influencer} disabled={readonly}
              onSaved={(v) => profitAnalysisApi.daily.patchAds(date, { influencer: v }).then(onSaved)} />
          </>}
          {tab === 'amazon' && (
            <MoneyField label="Amazon PPC" value={ads.amazonPpc} disabled={readonly}
              onSaved={(v) => profitAnalysisApi.daily.patchAds(date, { amazonPpc: v }).then(onSaved)} />
          )}
          {tab === 'tiktok' && (
            <MoneyField label="TikTok Ads" value={ads.tiktokAds} disabled={readonly}
              onSaved={(v) => profitAnalysisApi.daily.patchAds(date, { tiktokAds: v }).then(onSaved)} />
          )}
        </div>
      </div>

      {/* Versand */}
      {(tab === 'shopify' || tab === 'tiktok') && (
        <div>
          <SectionLabel>Versand</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mt-2 max-w-md">
            {tab === 'shopify' ? (
              <IntField
                label="Shopify Pakete"
                value={shipping.shopifyPackages}
                disabled={readonly}
                onSaved={(v) => profitAnalysisApi.daily.patchShipping(date, { shopifyPackages: v }).then(onSaved)}
              />
            ) : (
              <IntField
                label="TikTok Pakete"
                value={shipping.tiktokPackages}
                disabled={readonly}
                onSaved={(v) => profitAnalysisApi.daily.patchShipping(date, { tiktokPackages: v }).then(onSaved)}
              />
            )}
            {computedChannel && (
              <div className="rounded-lg bg-slate-50 dark:bg-white/[0.02] px-3 py-2">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Versandkosten</div>
                <div className="text-sm font-semibold tabular-nums">{formatEur(computedChannel.profit.shippingCosts)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ergebnis */}
      {computedChannel && (
        <div className="pt-3 border-t border-slate-200 dark:border-white/8">
          <SectionLabel>Ergebnis {tabLabel(tab)}</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <ResultCell
              label="Profit"
              value={formatEur(computedChannel.profit.profit)}
              tone={Number(computedChannel.profit.profit) < 0 ? 'critical' : 'good'}
              tooltip={{
                description: profitFormulaFor(tab),
                formula: profitFormulaShortFor(tab),
              }}
            />
            <ResultCell
              label="Marge"
              value={computedChannel.profit.margin !== null ? formatPercent(computedChannel.profit.margin) : '—'}
              tone={marginToneClass(computedChannel.profit.margin)}
              tooltip={{
                description: 'Profit geteilt durch Netto-Umsatz.',
                formula: 'Profit / Netto × 100',
              }}
            />
            <ResultCell
              label="Brutto ROAS"
              value={computedChannel.profit.roasGross !== null ? formatDecimal(computedChannel.profit.roasGross) : '—'}
              tooltip={{
                description: 'Brutto-Umsatz geteilt durch die zugeordneten Werbekosten.',
                formula: roasFormulaFor(tab, 'gross'),
              }}
            />
            <ResultCell
              label="Netto ROAS"
              value={computedChannel.profit.roasNet !== null ? formatDecimal(computedChannel.profit.roasNet) : '—'}
              tooltip={{
                description: 'Netto-Umsatz geteilt durch die zugeordneten Werbekosten.',
                formula: roasFormulaFor(tab, 'net'),
              }}
            />
          </div>
        </div>
      )}

      {/* Warnungen */}
      {computed?.warnings.length ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              {computed.warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI-Bausteine
// -----------------------------------------------------------------------------

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}
function Td({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={cn('px-3 py-2', align === 'right' ? 'text-right' : '', className)}>{children}</td>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{children}</div>;
}

function SummaryCard({ label, value, tone, tooltip }: {
  label: string; value: string; tone?: 'good' | 'warn' | 'critical' | null;
  tooltip?: { description: string; formula?: string };
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn'     ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good'     ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
        {tooltip && <InfoTooltip description={tooltip.description} formula={tooltip.formula} />}
      </div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', toneClass)}>{value}</div>
    </div>
  );
}

function ChannelTab({ active, onClick, color, icon: Icon, children }: {
  active: boolean; onClick: () => void; color: 'emerald' | 'orange' | 'pink';
  icon: any; children: React.ReactNode;
}) {
  const colorClass =
    color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
    : color === 'orange' ? 'text-orange-600 dark:text-orange-400 border-orange-500'
    : 'text-pink-600 dark:text-pink-400 border-pink-500';
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm border-b-2 inline-flex items-center gap-1.5',
        active ? cn(colorClass, 'font-semibold')
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function MoneyField({ label, value, onSaved, disabled }: {
  label: string; value: string; onSaved: (v: string) => Promise<any> | void; disabled?: boolean;
}) {
  const [local, setLocal] = useState(value.replace('.', ','));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => { setLocal(value.replace('.', ',')); }, [value]);
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={async () => {
            if (disabled) return;
            const parsed = local.replace(',', '.');
            if (parsed === value) return;
            setStatus('saving');
            try { await onSaved(parsed || '0'); setStatus('saved'); setTimeout(() => setStatus('idle'), 1200); }
            catch { setStatus('error'); }
          }}
          className={cn(
            'w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-14',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {status === 'saving' ? '…' : status === 'saved' ? '✓' : status === 'error' ? '!' : '€'}
        </span>
      </div>
    </label>
  );
}

function IntField({ label, value, onSaved, disabled }: {
  label: string; value: number; onSaved: (v: number) => Promise<any> | void; disabled?: boolean;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      <input
        type="number"
        min="0"
        step="1"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={async () => {
          if (disabled) return;
          const parsed = parseInt(local, 10);
          if (Number.isNaN(parsed) || parsed === value) return;
          await onSaved(parsed);
        }}
        className={cn(
          'w-full rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
    </label>
  );
}

function ComputedField({ label, value, tooltip }: {
  label: string; value: string;
  tooltip: { description: string; formula: string };
}) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {label}
        <InfoTooltip description={tooltip.description} formula={tooltip.formula} />
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );
}

function ResultCell({ label, value, tone, tooltip }: {
  label: string; value: string; tone?: 'good' | 'critical' | 'warn' | null;
  tooltip?: { description: string; formula?: string };
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
        {tooltip && <InfoTooltip description={tooltip.description} formula={tooltip.formula} />}
      </div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', toneClass)}>{value}</div>
    </div>
  );
}

function ProfitCell({ value }: { value: string }) {
  const n = Number(value);
  const cls = n < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
  return <span className={cls}>{formatEur(value)}</span>;
}
function MarginPill({ value }: { value: string }) {
  const n = Number(value);
  const tone = n < 20 ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
    : n < 25 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    : n < 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    : 'bg-emerald-500 text-white';
  return <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', tone)}>{formatPercent(value)}</span>;
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// MonthTable — §39/§71 gespeicherte Ansichten + sticky Datum + sticky Ergebnis
// -----------------------------------------------------------------------------

type ViewKey = 'compact' | 'marketing' | 'shopify' | 'amazon' | 'tiktok' | 'profit' | 'all';

const VIEW_OPTIONS: Array<{ key: ViewKey; label: string }> = [
  { key: 'compact',   label: 'Kompakt' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'shopify',   label: 'Shopify' },
  { key: 'amazon',    label: 'Amazon' },
  { key: 'tiktok',    label: 'TikTok' },
  { key: 'profit',    label: 'Profit' },
  { key: 'all',       label: 'Alle Daten' },
];

function MonthTable({
  daysOfMonth, computedByDate, rawByDate, selectedDate, onSelect,
}: {
  daysOfMonth: string[];
  computedByDate: Map<string, ComputedDay>;
  rawByDate: Map<string, RawDay>;
  selectedDate: string | null;
  onSelect: (d: string) => void;
}) {
  const [view, setView] = useState<ViewKey>(() => {
    if (typeof window === 'undefined') return 'compact';
    return (localStorage.getItem('pa.monat.view') as ViewKey) || 'compact';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('pa.monat.view', view);
  }, [view]);

  const cols = columnsForView(view);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
      {/* View-Auswahl */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-white/8">
        {VIEW_OPTIONS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={cn('px-2.5 py-1 text-xs rounded-md',
              view === v.key ? 'bg-amber-500 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5')}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-x-auto max-h-[600px]">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1a1d26] sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 z-20 bg-slate-50 dark:bg-[#1a1d26]">Datum</th>
              {cols.map((c) => (
                <th key={c.key} className={cn('px-3 py-2 whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left', c.group && 'border-l border-slate-200 dark:border-white/10')}>{c.label}</th>
              ))}
              <th className="text-right px-3 py-2 sticky right-0 z-20 bg-slate-50 dark:bg-[#1a1d26] border-l border-slate-200 dark:border-white/10">Ergebnis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {daysOfMonth.map((dateIso) => {
              const c = computedByDate.get(dateIso);
              const rd = rawByDate.get(dateIso);
              const isSelected = selectedDate === dateIso;
              const rowClass = cn(
                'cursor-pointer',
                isSelected ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]',
              );
              const stickyBg = isSelected ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-white dark:bg-[#0f1117]';
              return (
                <tr key={dateIso} onClick={() => onSelect(dateIso)} className={rowClass}>
                  <td className={cn('px-3 py-2 sticky left-0 z-10 border-r border-slate-100 dark:border-white/5', stickyBg)}>
                    <span className="font-medium text-slate-900 dark:text-white tabular-nums whitespace-nowrap">{formatDate(dateIso)}</span>
                    {c?.warnings.length ? (
                      <span title={c.warnings.join('\n')} className="ml-1 inline-flex text-amber-500"><AlertCircle className="h-3 w-3" /></span>
                    ) : null}
                  </td>
                  {cols.map((col) => (
                    <td key={col.key} className={cn('px-3 py-2 tabular-nums whitespace-nowrap',
                      col.align === 'right' ? 'text-right' : 'text-left',
                      col.group && 'border-l border-slate-100 dark:border-white/5')}>
                      {col.render(c, rd)}
                    </td>
                  ))}
                  <td className={cn('px-3 py-2 sticky right-0 z-10 border-l border-slate-200 dark:border-white/10 text-right', stickyBg)}>
                    {c ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <ProfitCell value={c.aggregate.totalProfit} />
                        {c.aggregate.totalMargin !== null && <MarginPill value={c.aggregate.totalMargin} />}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right';
  group?: boolean;                 // Trenner links
  render: (c: ComputedDay | undefined, r: RawDay | undefined) => React.ReactNode;
}

function columnsForView(view: ViewKey): Col[] {
  const money = (v: string | null | undefined) => v !== null && v !== undefined ? formatEur(v) : '—';

  const shopifyCols: Col[] = [
    { key: 'sh.brutto', label: 'SH Brutto', align: 'right', group: true, render: (c) => c ? money(c.shopify.vat.grossAdjusted) : '—' },
    { key: 'sh.netto',  label: 'SH Netto',  align: 'right', render: (c) => c ? money(c.shopify.profit.netSales) : '—' },
  ];
  const amazonCols: Col[] = [
    { key: 'am.brutto', label: 'AM Brutto', align: 'right', group: true, render: (c) => c ? money(c.amazon.vat.grossAdjusted) : '—' },
    { key: 'am.netto',  label: 'AM Netto',  align: 'right', render: (c) => c ? money(c.amazon.profit.netSales) : '—' },
  ];
  const tiktokCols: Col[] = [
    { key: 'tt.brutto', label: 'TT Brutto', align: 'right', group: true, render: (c) => c ? money(c.tiktok.vat.grossAdjusted) : '—' },
    { key: 'tt.netto',  label: 'TT Netto',  align: 'right', render: (c) => c ? money(c.tiktok.profit.netSales) : '—' },
  ];
  const adsCols: Col[] = [
    { key: 'meta',   label: 'Meta',    align: 'right', group: true, render: (_, r) => money(r?.ads.meta ?? '0') },
    { key: 'google', label: 'Google',  align: 'right', render: (_, r) => money(r?.ads.google ?? '0') },
    { key: 'infl',   label: 'Infl.',   align: 'right', render: (_, r) => money(r?.ads.influencer ?? '0') },
    { key: 'appc',   label: 'AM PPC',  align: 'right', render: (_, r) => money(r?.ads.amazonPpc ?? '0') },
    { key: 'ttads',  label: 'TT Ads',  align: 'right', render: (_, r) => money(r?.ads.tiktokAds ?? '0') },
  ];

  if (view === 'compact') {
    return [
      { key: 'sh',    label: 'Shopify', align: 'right', render: (c) => c ? money(c.shopify.profit.netSales) : '—' },
      { key: 'am',    label: 'Amazon',  align: 'right', render: (c) => c ? money(c.amazon.profit.netSales) : '—' },
      { key: 'tt',    label: 'TikTok',  align: 'right', render: (c) => c ? money(c.tiktok.profit.netSales) : '—' },
      { key: 'gross', label: 'Netto ges.', align: 'right', group: true, render: (c) => c ? money(c.aggregate.totalNetSales) : '—' },
    ];
  }
  if (view === 'marketing') return adsCols;
  if (view === 'shopify')   return [...shopifyCols, ...adsCols.slice(0, 3), { key: 'sh.pfee', label: 'Payment', align: 'right', group: true, render: (c) => c ? money(c.shopify.profit.platformFees) : '—' }];
  if (view === 'amazon')    return [...amazonCols, adsCols[3], { key: 'am.fee', label: 'AM Gebühr', align: 'right', group: true, render: (c) => c ? money(c.amazon.profit.platformFees) : '—' }];
  if (view === 'tiktok')    return [...tiktokCols, adsCols[4], { key: 'tt.fee', label: 'TT Gebühr', align: 'right', group: true, render: (c) => c ? money(c.tiktok.profit.platformFees) : '—' }];
  if (view === 'profit') {
    return [
      { key: 'sh.profit', label: 'SH Profit', align: 'right', group: true, render: (c) => c ? money(c.shopify.profit.profit) : '—' },
      { key: 'am.profit', label: 'AM Profit', align: 'right', render: (c) => c ? money(c.amazon.profit.profit) : '—' },
      { key: 'tt.profit', label: 'TT Profit', align: 'right', render: (c) => c ? money(c.tiktok.profit.profit) : '—' },
    ];
  }
  // 'all'
  return [...shopifyCols, ...amazonCols, ...tiktokCols, ...adsCols];
}

function enumerateDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function tabLabel(t: Channel) { return t === 'shopify' ? 'Shopify' : t === 'amazon' ? 'Amazon' : 'TikTok'; }
function marginToneClass(v: string | null | undefined): 'good' | 'warn' | 'critical' | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (n < 20) return 'critical';
  if (n < 25) return 'warn';
  return 'good';
}
function formatDecimal(v: string): string {
  return v.replace('.', ',');
}
function profitFormulaFor(c: Channel): string {
  if (c === 'shopify') return 'Shopify-Netto − Payment-Fees − Produktkosten − Versand − Meta − Google − Influencer';
  if (c === 'amazon')  return 'Amazon-Netto − Produktkosten − Fulfillment − Amazon-Gebühr − Amazon PPC';
  return 'TikTok-Netto − Produktkosten − Versand − TikTok-Gebühr − TikTok Ads';
}
function profitFormulaShortFor(c: Channel): string {
  if (c === 'shopify') return 'Netto − alle direkten Kosten − Ads';
  if (c === 'amazon')  return 'Netto − alle direkten Kosten − Amazon PPC';
  return 'Netto − alle direkten Kosten − TikTok Ads';
}
function roasFormulaFor(c: Channel, kind: 'gross' | 'net'): string {
  const prefix = kind === 'gross' ? 'Brutto' : 'Netto';
  if (c === 'shopify') return `${prefix}-Umsatz / (Meta + Google) — Influencer nicht enthalten`;
  if (c === 'amazon')  return `${prefix}-Umsatz / Amazon PPC`;
  return `${prefix}-Umsatz / TikTok Ads`;
}

// -----------------------------------------------------------------------------
// SalesSection — §7 Adaptive UX Variante 3
// Ein Feld "Brutto gesamt" + Chip "+ Anteil mit 7 % erfassen" macht Zweitfeld
// sichtbar. Wird sticky nach erster Nutzung im selben Monat.
// -----------------------------------------------------------------------------

function SalesSection({ date, channel, sales, readonly, onSaved }: {
  date: string; channel: Channel;
  sales: { gross19: string; gross7: string; returns19: string; returns7: string };
  readonly: boolean;
  onSaved: () => void;
}) {
  const has7 = Number(sales.gross7) > 0 || Number(sales.returns7) > 0;
  const [showReduced, setShowReduced] = useState(has7);
  useEffect(() => { if (has7) setShowReduced(true); }, [has7]);

  return (
    <div>
      <SectionLabel>Umsatz (Brutto)</SectionLabel>
      <div className={cn('grid gap-3 mt-2', showReduced ? 'grid-cols-2' : 'grid-cols-1 max-w-md')}>
        <MoneyField
          label={showReduced ? 'Brutto 19 %' : 'Brutto gesamt'}
          value={sales.gross19}
          disabled={readonly}
          onSaved={(v) => profitAnalysisApi.daily.patchSales(date, channel, { gross19: v }).then(onSaved)}
        />
        {showReduced && (
          <MoneyField
            label="Brutto 7 % (z.B. Bücher)"
            value={sales.gross7}
            disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, channel, { gross7: v }).then(onSaved)}
          />
        )}
      </div>

      {!showReduced && !readonly && (
        <button
          onClick={() => setShowReduced(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium"
        >
          + Anteil mit 7 % USt erfassen
        </button>
      )}

      {(showReduced || has7) && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <MoneyField label="Retouren 19 %" value={sales.returns19} disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, channel, { returns19: v }).then(onSaved)} />
          <MoneyField label="Retouren 7 %" value={sales.returns7} disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, channel, { returns7: v }).then(onSaved)} />
        </div>
      )}
      {!showReduced && (
        <div className="mt-3 max-w-md">
          <MoneyField label="Retouren (optional)" value={sales.returns19} disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, channel, { returns19: v }).then(onSaved)} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ProductSalesSection — §20-23 Verkaufte Produkte je Kanal
// -----------------------------------------------------------------------------

function ProductSalesSection({ date, channel, productSales, readonly, onSaved }: {
  date: string; channel: Channel;
  productSales: Array<{ channel: Channel; productId: string; quantity: number }>;
  readonly: boolean;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<ProductCostRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await profitAnalysisApi.productCosts.list({ limit: 500 });
        setProducts(res.items);
      } finally { setLoading(false); }
    })();
  }, []);

  // Menge fuer diesen Kanal + productId nachschlagen
  const qtyOf = (productId: string) => {
    return productSales.find((s) => s.channel === channel && s.productId === productId)?.quantity ?? 0;
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.title.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.externalId.toLowerCase().includes(s);
  });

  // Verkaufte + einige unverkaufte nach oben
  const withQty = filtered.filter((p) => qtyOf(p.productId) > 0);
  const withoutQty = filtered.filter((p) => qtyOf(p.productId) === 0);
  const orderedProducts = [...withQty, ...withoutQty];

  const totalUnits = productSales.filter((s) => s.channel === channel).reduce((a, s) => a + s.quantity, 0);

  async function updateQty(productId: string, quantity: number) {
    if (readonly) return;
    setSaving(productId);
    try {
      await profitAnalysisApi.daily.patchProductSale(date, channel, productId, quantity);
      onSaved();
    } finally { setSaving(null); }
  }

  return (
    <div>
      <SectionLabel>Verkaufte Produkte · {tabLabel(channel)} · {totalUnits} Stk. gesamt</SectionLabel>
      <div className="mt-2 rounded-xl border border-slate-200 dark:border-white/8 overflow-hidden">
        <div className="p-2 border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produkt suchen …"
            className="w-full rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
        </div>
        {loading ? (
          <div className="p-4 text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Lade Produkte …</div>
        ) : orderedProducts.length === 0 ? (
          <div className="p-4 text-xs text-slate-500">Keine Produkte gefunden.</div>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {orderedProducts.map((p) => {
              const currentQty = qtyOf(p.productId);
              const hasNoCost = p.currentCost === null;
              const hasNoFulfillment = channel === 'amazon' && p.currentFulfillment === null;
              return (
                <div key={p.productId} className={cn('flex items-center gap-3 px-3 py-2 text-sm', currentQty > 0 && 'bg-amber-50/40 dark:bg-amber-500/[0.03]')}>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-white truncate">{p.title}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      {p.sku && <span className="font-mono">{p.sku}</span>}
                      {hasNoCost && <span className="text-amber-600 dark:text-amber-400">· Produktkosten fehlen</span>}
                      {hasNoFulfillment && <span className="text-amber-600 dark:text-amber-400">· Fulfillment fehlt</span>}
                    </div>
                  </div>
                  <QtyInput
                    productId={p.productId}
                    value={currentQty}
                    disabled={readonly}
                    saving={saving === p.productId}
                    onSave={(v) => updateQty(p.productId, v)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QtyInput({ productId, value, disabled, saving, onSave }: {
  productId: string; value: number; disabled?: boolean; saving?: boolean;
  onSave: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="1"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = parseInt(local, 10);
          if (Number.isNaN(n) || n === value) return;
          onSave(Math.max(0, n));
        }}
        className={cn(
          'w-20 rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500/40',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      <span className="text-xs text-slate-400 w-4">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Stk.'}</span>
    </div>
  );
}
