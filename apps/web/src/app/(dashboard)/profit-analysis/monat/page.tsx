'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, AlertCircle,
  TrendingUp, TrendingDown, Info, ShoppingBag, Package2, Music2,
} from 'lucide-react';
import {
  profitAnalysisApi, ComputedMonth, ComputedDay, RawDay, RawMonth, Channel,
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
          {/* Tages-Liste (kompakt, Phase 4 wird die volle Tabelle) */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                  <tr>
                    <Th>Datum</Th>
                    <Th align="right">Shopify</Th>
                    <Th align="right">Amazon</Th>
                    <Th align="right">TikTok</Th>
                    <Th align="right">Netto ges.</Th>
                    <Th align="right">Profit</Th>
                    <Th align="right">Marge</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {daysOfMonth.map((dateIso) => {
                    const c = computedByDate.get(dateIso);
                    const isSelected = selectedDate === dateIso;
                    return (
                      <tr
                        key={dateIso}
                        onClick={() => setSelectedDate(dateIso)}
                        className={cn(
                          'cursor-pointer',
                          isSelected ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]',
                        )}
                      >
                        <Td>
                          <span className="font-medium text-slate-900 dark:text-white tabular-nums">
                            {formatDate(dateIso)}
                          </span>
                          {c?.warnings.length ? (
                            <span title={c.warnings.join('\n')} className="ml-2 inline-flex text-amber-500">
                              <AlertCircle className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c ? formatEur(c.shopify.profit.netSales) : '—'}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c ? formatEur(c.amazon.profit.netSales) : '—'}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c ? formatEur(c.tiktok.profit.netSales) : '—'}
                        </Td>
                        <Td align="right" className="tabular-nums font-medium">
                          {c ? formatEur(c.aggregate.totalNetSales) : '—'}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c ? <ProfitCell value={c.aggregate.totalProfit} /> : '—'}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c?.aggregate.totalMargin !== null && c?.aggregate.totalMargin !== undefined
                            ? <MarginPill value={c.aggregate.totalMargin} />
                            : '—'}
                        </Td>
                        <Td>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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

      {/* Sales-Eingabe */}
      <div>
        <SectionLabel>Umsatz (Brutto)</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <MoneyField
            label="Brutto 19 %"
            value={sales.gross19}
            disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, tab, { gross19: v }).then(onSaved)}
          />
          <MoneyField
            label="Brutto 7 % (nur wenn vorhanden)"
            value={sales.gross7}
            disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, tab, { gross7: v }).then(onSaved)}
          />
          <MoneyField
            label="Retouren 19 %"
            value={sales.returns19}
            disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, tab, { returns19: v }).then(onSaved)}
          />
          <MoneyField
            label="Retouren 7 %"
            value={sales.returns7}
            disabled={readonly}
            onSaved={(v) => profitAnalysisApi.daily.patchSales(date, tab, { returns7: v }).then(onSaved)}
          />
        </div>

        {/* Live-Berechnung */}
        {computedChannel && (
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02] p-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <ComputedField
                label="Netto"
                value={formatEur(computedChannel.profit.netSales)}
                tooltip={{
                  description: 'Netto-Umsatz nach Abzug der USt (und Retouren).',
                  formula: 'Brutto 19% / 1,19 + Brutto 7% / 1,07 (jeweils nach Retouren-Abzug)',
                }}
              />
              <ComputedField
                label="USt gesamt"
                value={formatEur(computedChannel.vat.vatTotal)}
                tooltip={{
                  description: 'Enthaltene Umsatzsteuer aus den erfassten Verkäufen. Nicht Umsatzsteuer-Zahllast.',
                  formula: 'USt19 + USt7',
                }}
              />
              <ComputedField
                label="Brutto (bereinigt)"
                value={formatEur(computedChannel.vat.grossAdjusted)}
                tooltip={{
                  description: 'Brutto-Umsatz abzüglich Retouren. Basis für Brutto-ROAS.',
                  formula: '(Brutto19 + Brutto7) − (Retouren19 + Retouren7)',
                }}
              />
            </div>
          </div>
        )}
      </div>

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
