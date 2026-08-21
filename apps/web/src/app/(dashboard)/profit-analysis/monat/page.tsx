'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, AlertCircle,
  TrendingUp, TrendingDown, Info, ShoppingBag, Package2, Music2,
  Save, Circle,
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

  // Save-Buffer-Status: DayEditor meldet Dirty-Zustand + Flush-Funktion nach oben,
  // damit Monatswechsel/Tages-Wechsel Warnungen zeigen koennen.
  const [dayDirty, setDayDirty] = useState(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const registerFlush = useCallback((fn: () => Promise<void>) => { flushRef.current = fn; }, []);

  function confirmDiscardIfDirty(): boolean {
    if (!dayDirty) return true;
    return window.confirm('Es gibt ungespeicherte Änderungen. Beim Wechsel gehen sie verloren. Trotzdem wechseln?');
  }

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
    if (!confirmDiscardIfDirty()) return;
    if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (!confirmDiscardIfDirty()) return;
    if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1);
    setSelectedDate(null);
  }
  function jumpToday() {
    if (!confirmDiscardIfDirty()) return;
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth() + 1);
    setSelectedDate(n.toISOString().slice(0, 10));
  }
  function selectDay(d: string | null) {
    if (d === selectedDate) return;
    if (!confirmDiscardIfDirty()) return;
    setSelectedDate(d);
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
            onSelect={selectDay}
          />

          {/* Selected Day Editor — key={date} sorgt fuer sauberen Buffer-Reset */}
          {selectedDate && (
            <DayEditor
              key={selectedDate}
              date={selectedDate}
              raw={rawByDate.get(selectedDate) ?? null}
              computed={computedByDate.get(selectedDate) ?? null}
              readonly={computed?.status === 'locked'}
              onSaved={load}
              onDirtyChange={setDayDirty}
              registerFlush={registerFlush}
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

type SalesPatch = Partial<{ gross19: string; gross7: string; returns19: string; returns7: string }>;
type AdsPatch = Partial<{ meta: string; google: string; influencer: string; amazonPpc: string; tiktokAds: string }>;
type ShippingPatch = Partial<{ shopifyPackages: number; tiktokPackages: number }>;

const AUTO_SAVE_MS = 5 * 60 * 1000;

function DayEditor({
  date, raw, computed, readonly, onSaved, onDirtyChange, registerFlush,
}: {
  date: string;
  raw: RawDay | null;
  computed: ComputedDay | null;
  readonly: boolean;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  registerFlush: (fn: () => Promise<void>) => void;
}) {
  const [tab, setTab] = useState<Channel>('shopify');

  // Buffer fuer alle noch nicht gespeicherten Aenderungen
  const [pendingAds, setPendingAds] = useState<AdsPatch>({});
  const [pendingShipping, setPendingShipping] = useState<ShippingPatch>({});
  const [pendingSales, setPendingSales] = useState<Record<Channel, SalesPatch>>({ shopify: {}, amazon: {}, tiktok: {} });
  const [pendingProductSales, setPendingProductSales] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const dirtyCount =
    Object.keys(pendingAds).length +
    Object.keys(pendingShipping).length +
    (Object.keys(pendingSales.shopify).length + Object.keys(pendingSales.amazon).length + Object.keys(pendingSales.tiktok).length) +
    Object.keys(pendingProductSales).length;
  const isDirty = dirtyCount > 0;

  // Melde Dirty-Zustand an Parent
  useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);

  const rawSales = raw?.channelSales[tab] ?? { channel: tab, gross19: '0', gross7: '0', returns19: '0', returns7: '0' };
  const rawAds = raw?.ads ?? { meta: '0', google: '0', influencer: '0', amazonPpc: '0', tiktokAds: '0' };
  const rawShipping = raw?.shipping ?? { shopifyPackages: 0, tiktokPackages: 0 };

  // Effective Werte: raw + pending gemergt (Anzeige)
  const sales = { ...rawSales, ...pendingSales[tab] };
  const ads = { ...rawAds, ...pendingAds };
  const shipping = { ...rawShipping, ...pendingShipping };
  const computedChannel = computed?.[tab];

  const touch = () => setLastEditAt(Date.now());
  const stageAds = (patch: AdsPatch) => { setPendingAds((p) => ({ ...p, ...patch })); touch(); };
  const stageShipping = (patch: ShippingPatch) => { setPendingShipping((p) => ({ ...p, ...patch })); touch(); };
  const stageSales = (ch: Channel, patch: SalesPatch) => {
    setPendingSales((p) => ({ ...p, [ch]: { ...p[ch], ...patch } })); touch();
  };
  const stageProductSale = (ch: Channel, productId: string, quantity: number) => {
    setPendingProductSales((p) => ({ ...p, [`${ch}|${productId}`]: quantity })); touch();
  };

  // Flush: alle Buffer parallel per API absetzen, dann Monat neu laden
  const flush = useCallback(async () => {
    if (!isDirty || readonly || saving) return;
    setSaving(true); setSaveError(null);
    try {
      const promises: Promise<any>[] = [];
      if (Object.keys(pendingAds).length > 0) promises.push(profitAnalysisApi.daily.patchAds(date, pendingAds));
      if (Object.keys(pendingShipping).length > 0) promises.push(profitAnalysisApi.daily.patchShipping(date, pendingShipping));
      (['shopify', 'amazon', 'tiktok'] as Channel[]).forEach((ch) => {
        const p = pendingSales[ch];
        if (Object.keys(p).length > 0) promises.push(profitAnalysisApi.daily.patchSales(date, ch, p));
      });
      Object.entries(pendingProductSales).forEach(([key, qty]) => {
        const [ch, productId] = key.split('|');
        promises.push(profitAnalysisApi.daily.patchProductSale(date, ch as Channel, productId, qty));
      });
      await Promise.all(promises);
      setPendingAds({}); setPendingShipping({});
      setPendingSales({ shopify: {}, amazon: {}, tiktok: {} });
      setPendingProductSales({});
      setLastSavedAt(Date.now()); setLastEditAt(null);
      onSaved();
    } catch (e: any) {
      setSaveError(e?.message ?? 'Speichern fehlgeschlagen');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [isDirty, readonly, saving, date, pendingAds, pendingShipping, pendingSales, pendingProductSales, onSaved]);

  useEffect(() => { registerFlush(flush); }, [flush, registerFlush]);

  // 5-Minuten Inaktivitaets-Fallback: wenn seit letzter Eingabe >=5min, autosave
  useEffect(() => {
    if (!isDirty || !lastEditAt || saving) return;
    const t = setInterval(() => {
      if (lastEditAt && Date.now() - lastEditAt >= AUTO_SAVE_MS) {
        flush().catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [isDirty, lastEditAt, saving, flush]);

  // Warnung bei Browser-Close/Reload
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [isDirty]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] shadow-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Tages-Editor</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{formatDate(date)}</div>
        </div>
        <div className="flex items-center gap-3">
          {readonly && (
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">Nur-Lese-Modus</div>
          )}
          {!readonly && (
            <SaveBar
              isDirty={isDirty}
              dirtyCount={dirtyCount}
              saving={saving}
              saveError={saveError}
              lastSavedAt={lastSavedAt}
              onSave={() => { flush().catch(() => {}); }}
            />
          )}
        </div>
      </div>

      {/* Kanal-Tabs */}
      <div className="border-b border-slate-200 dark:border-white/8 flex gap-1">
        <ChannelTab active={tab === 'shopify'} onClick={() => setTab('shopify')} color="emerald" icon={ShoppingBag}>Shopify</ChannelTab>
        <ChannelTab active={tab === 'amazon'}  onClick={() => setTab('amazon')}  color="orange"  icon={Package2}>Amazon</ChannelTab>
        <ChannelTab active={tab === 'tiktok'}  onClick={() => setTab('tiktok')}  color="pink"    icon={Music2}>TikTok</ChannelTab>
      </div>

      {/* Sales-Eingabe — adaptive UX (Variante 3, §7) */}
      <SalesSection
        channel={tab}
        sales={sales}
        rawSales={rawSales}
        readonly={readonly}
        onStage={(patch) => stageSales(tab, patch)}
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
        channel={tab}
        productSales={raw?.productSales ?? []}
        pendingProductSales={pendingProductSales}
        readonly={readonly}
        onStage={(productId, qty) => stageProductSale(tab, productId, qty)}
      />

      {/* Werbekosten */}
      <div>
        <SectionLabel>Werbekosten (netto)</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {tab === 'shopify' && <>
            <MoneyField label="Meta Ads"  value={ads.meta}       rawValue={rawAds.meta}       disabled={readonly}
              onCommit={(v) => stageAds({ meta: v })} />
            <MoneyField label="Google Ads" value={ads.google}    rawValue={rawAds.google}     disabled={readonly}
              onCommit={(v) => stageAds({ google: v })} />
            <MoneyField label="Influencer" value={ads.influencer} rawValue={rawAds.influencer} disabled={readonly}
              onCommit={(v) => stageAds({ influencer: v })} />
          </>}
          {tab === 'amazon' && (
            <MoneyField label="Amazon PPC" value={ads.amazonPpc} rawValue={rawAds.amazonPpc} disabled={readonly}
              onCommit={(v) => stageAds({ amazonPpc: v })} />
          )}
          {tab === 'tiktok' && (
            <MoneyField label="TikTok Ads" value={ads.tiktokAds} rawValue={rawAds.tiktokAds} disabled={readonly}
              onCommit={(v) => stageAds({ tiktokAds: v })} />
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
                rawValue={rawShipping.shopifyPackages}
                disabled={readonly}
                onCommit={(v) => stageShipping({ shopifyPackages: v })}
              />
            ) : (
              <IntField
                label="TikTok Pakete"
                value={shipping.tiktokPackages}
                rawValue={rawShipping.tiktokPackages}
                disabled={readonly}
                onCommit={(v) => stageShipping({ tiktokPackages: v })}
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

      {/* Ergebnis + alle Kostenkacheln */}
      {computedChannel && (
        <div className="pt-3 border-t border-slate-200 dark:border-white/8 space-y-4">
          <div>
            <SectionLabel>Kostenaufschlüsselung {tabLabel(tab)}</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              <ResultCell
                label="Produktkosten"
                value={formatEur(computedChannel.profit.productCosts)}
                tooltip={{
                  description: 'Summe der verkauften Stückzahl × historisch gültige Produktkosten am Verkaufstag.',
                  formula: 'Σ (Menge × Produktkosten)',
                }}
              />
              <ResultCell
                label={tab === 'amazon' ? 'Amazon Fulfillment' : 'Versandkosten'}
                value={formatEur(computedChannel.profit.shippingCosts)}
                tooltip={{
                  description: tab === 'amazon'
                    ? 'Menge × produktbezogene Amazon-AWD/FBA-Pauschale.'
                    : 'Pakete × DHL-Preis am Tag.',
                  formula: tab === 'amazon'
                    ? 'Σ (Menge × Fulfillment-Kosten)'
                    : 'Pakete × DHL-Preis',
                }}
              />
              <ResultCell
                label={tab === 'shopify' ? 'Payment Fee' : tab === 'amazon' ? 'Amazon-Gebühr' : 'TikTok-Gebühr'}
                value={formatEur(computedChannel.profit.platformFees)}
                tooltip={{
                  description: tab === 'shopify'
                    ? 'Shopify Payments Fee — auf den Netto-Umsatz.'
                    : tab === 'amazon' ? 'Amazon Plattform-Gebühr — auf den Netto-Umsatz.'
                    : 'TikTok Shop-Gebühr — auf den Netto-Umsatz.',
                  formula: 'Netto × Prozentsatz',
                }}
              />
              <ResultCell
                label="Werbekosten"
                value={formatEur(computedChannel.profit.adsAttributed)}
                tooltip={{
                  description: tab === 'shopify'
                    ? 'Meta + Google + Influencer.'
                    : tab === 'amazon' ? 'Amazon PPC.' : 'TikTok Ads.',
                }}
              />
              <ResultCell
                label="Kosten ohne Ads"
                value={formatEur(computedChannel.profit.totalCostsWithoutAds)}
                tooltip={{
                  description: 'Produktkosten + Versand/Fulfillment + Plattformgebühr, ohne Werbekosten (§24–26).',
                }}
              />
              <ResultCell
                label="Netto-Umsatz"
                value={formatEur(computedChannel.profit.netSales)}
                tooltip={{
                  description: 'Brutto abzüglich USt (und Retouren).',
                  formula: 'Brutto / (1 + USt/100)',
                }}
              />
            </div>
          </div>

          <div>
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

function MoneyField({ label, value, rawValue, onCommit, disabled }: {
  label: string; value: string; rawValue: string;
  onCommit: (v: string) => void; disabled?: boolean;
}) {
  const [local, setLocal] = useState(value.replace('.', ','));
  useEffect(() => { setLocal(value.replace('.', ',')); }, [value]);
  const dirty = value !== rawValue;
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
        <span>{label}</span>
        {dirty && <span title="Ungespeicherte Änderung" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (disabled) return;
            const parsed = local.replace(',', '.');
            if (parsed === value) return;
            onCommit(parsed || '0');
          }}
          className={cn(
            'w-full rounded-lg border dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 pr-8',
            dirty
              ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/[0.04]'
              : 'border-slate-300 dark:border-white/10',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">€</span>
      </div>
    </label>
  );
}

function IntField({ label, value, rawValue, onCommit, disabled }: {
  label: string; value: number; rawValue: number;
  onCommit: (v: number) => void; disabled?: boolean;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const dirty = value !== rawValue;
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
        <span>{label}</span>
        {dirty && <span title="Ungespeicherte Änderung" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
      </div>
      <input
        type="number"
        min="0"
        step="1"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (disabled) return;
          const parsed = parseInt(local, 10);
          if (Number.isNaN(parsed) || parsed === value) return;
          onCommit(parsed);
        }}
        className={cn(
          'w-full rounded-lg border dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40',
          dirty
            ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/[0.04]'
            : 'border-slate-300 dark:border-white/10',
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
  const rows = daysOfMonth.map((d) => ({
    date: d, computed: computedByDate.get(d), raw: rawByDate.get(d),
  }));

  // §43 Ergebnis-Spalte view-abhaengig: bei shopify/amazon/tiktok den jeweiligen
  // Kanal-Profit, sonst das Gesamt-Aggregat.
  const resultOf = (c: ComputedDay | undefined): { profit: string; margin: string | null } | null => {
    if (!c) return null;
    if (view === 'shopify') return { profit: c.shopify.profit.profit, margin: c.shopify.profit.margin };
    if (view === 'amazon')  return { profit: c.amazon.profit.profit,  margin: c.amazon.profit.margin };
    if (view === 'tiktok')  return { profit: c.tiktok.profit.profit,  margin: c.tiktok.profit.margin };
    return { profit: c.aggregate.totalProfit, margin: c.aggregate.totalMargin };
  };
  const resultLabel = view === 'shopify' ? 'SH Ergebnis'
    : view === 'amazon' ? 'AM Ergebnis'
    : view === 'tiktok' ? 'TT Ergebnis'
    : 'Ergebnis';

  // Summen-Footer berechnen (§43) — analog view-abhaengig
  const totals = computeColumnTotals(cols, rows);
  const grandProfit = rows.reduce((a, r) => {
    if (!r.computed) return a;
    if (view === 'shopify') return a + Number(r.computed.shopify.profit.profit);
    if (view === 'amazon')  return a + Number(r.computed.amazon.profit.profit);
    if (view === 'tiktok')  return a + Number(r.computed.tiktok.profit.profit);
    return a + Number(r.computed.aggregate.totalProfit);
  }, 0);
  const grandNetSales = rows.reduce((a, r) => {
    if (!r.computed) return a;
    if (view === 'shopify') return a + Number(r.computed.shopify.profit.netSales);
    if (view === 'amazon')  return a + Number(r.computed.amazon.profit.netSales);
    if (view === 'tiktok')  return a + Number(r.computed.tiktok.profit.netSales);
    return a + Number(r.computed.aggregate.totalNetSales);
  }, 0);
  const grandMargin = grandNetSales > 0 ? (grandProfit / grandNetSales) * 100 : null;

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
          <thead className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1a1d26]">
            <tr>
              {/* Ecke oben-links: Datum — sticky in beide Richtungen */}
              <th className="text-left px-3 py-2 sticky top-0 left-0 z-30 bg-slate-50 dark:bg-[#1a1d26] border-r border-slate-200 dark:border-white/10">Datum</th>
              {/* Mittlere Header nur sticky top */}
              {cols.map((c) => (
                <th key={c.key} className={cn(
                  'sticky top-0 z-20 bg-slate-50 dark:bg-[#1a1d26] px-3 py-2 whitespace-nowrap',
                  c.align === 'right' ? 'text-right' : 'text-left',
                  c.group && 'border-l border-slate-200 dark:border-white/10',
                )}>{c.label}</th>
              ))}
              {/* Ecke oben-rechts: Ergebnis — kontextabhaengig zum aktiven View */}
              <th className="text-right px-3 py-2 sticky top-0 right-0 z-30 bg-slate-50 dark:bg-[#1a1d26] border-l border-slate-200 dark:border-white/10">{resultLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map(({ date: dateIso, computed: c, raw: rd }) => {
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
                    {(() => {
                      const r = resultOf(c);
                      if (!r) return '—';
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <ProfitCell value={r.profit} />
                          {r.margin !== null && <MarginPill value={r.margin} />}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* §43 Sticky Summen-Footer — Ecken (bottom+left/right) mit z-30 */}
          <tfoot className="bg-slate-100 dark:bg-[#1a1d26] border-t-2 border-slate-300 dark:border-white/10">
            <tr className="font-bold">
              <td className="text-left px-3 py-2 sticky bottom-0 left-0 z-30 bg-slate-100 dark:bg-[#1a1d26] border-r border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                Σ Summe
              </td>
              {cols.map((col) => (
                <td key={col.key} className={cn('sticky bottom-0 z-20 bg-slate-100 dark:bg-[#1a1d26] px-3 py-2 tabular-nums whitespace-nowrap',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.group && 'border-l border-slate-200 dark:border-white/10',
                  'text-slate-900 dark:text-white')}>
                  {col.total ? col.total(totals[col.key], rows) : ''}
                </td>
              ))}
              <td className="px-3 py-2 sticky bottom-0 right-0 z-30 bg-slate-100 dark:bg-[#1a1d26] border-l border-slate-200 dark:border-white/10 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn('tabular-nums font-bold',
                    grandProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {formatEur(grandProfit.toString())}
                  </span>
                  {grandMargin !== null && <MarginPill value={grandMargin.toString()} />}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function computeColumnTotals(cols: Col[], rows: Array<{ date: string; computed?: ComputedDay; raw?: RawDay }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const col of cols) {
    if (!col.sumFrom) continue;
    let sum = 0;
    for (const { computed, raw } of rows) {
      sum += col.sumFrom(computed, raw) ?? 0;
    }
    out[col.key] = sum;
  }
  return out;
}

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right';
  group?: boolean;
  render: (c: ComputedDay | undefined, r: RawDay | undefined) => React.ReactNode;
  /** Zahl-Extraktor pro Zeile fuer Summen-Footer. NULL = keine Summe. */
  sumFrom?: (c: ComputedDay | undefined, r: RawDay | undefined) => number | null;
  /** Wie die Summe formatiert wird. Erhaelt den bereits summierten Wert + Zeilen (fuer ROAS). */
  total?: (sum: number, rows: Array<{ computed?: ComputedDay; raw?: RawDay }>) => React.ReactNode;
}

function columnsForView(view: ViewKey): Col[] {
  const money = (v: string | null | undefined) => v !== null && v !== undefined ? formatEur(v) : '—';
  const num = (v: string | null | undefined) => v !== null && v !== undefined ? Number(v) : 0;
  const sumMoney = (sum: number) => sum > 0 ? formatEur(sum.toString()) : '—';

  // Weighted ROAS: Σ Umsatz / Σ Ads (nicht avg der Tages-ROAS)
  const roasTotal = (getSales: (c: ComputedDay) => number, getAds: (c: ComputedDay) => number) =>
    (_: number, rows: Array<{ computed?: ComputedDay }>) => {
      const sales = rows.reduce((a, r) => a + (r.computed ? getSales(r.computed) : 0), 0);
      const ads = rows.reduce((a, r) => a + (r.computed ? getAds(r.computed) : 0), 0);
      if (ads === 0) return '—';
      return (sales / ads).toFixed(2).replace('.', ',') + '×';
    };

  // Kanal-Kosten-Kacheln: Netto / Produktkosten / Versand-Fulfillment / Plattform-Fee / Werbekosten / Profit / Marge / ROAS
  const shopifyBlock: Col[] = [
    { key: 'sh.netto',    label: 'SH Netto',    align: 'right', group: true,
      render: (c) => c ? money(c.shopify.profit.netSales) : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.netSales) : 0, total: sumMoney },
    { key: 'sh.prod',     label: 'SH Produkte', align: 'right',
      render: (c) => c ? money(c.shopify.profit.productCosts) : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.productCosts) : 0, total: sumMoney },
    { key: 'sh.versand',  label: 'SH Versand',  align: 'right',
      render: (c) => c ? money(c.shopify.profit.shippingCosts) : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.shippingCosts) : 0, total: sumMoney },
    { key: 'sh.pfee',     label: 'SH Payment',  align: 'right',
      render: (c) => c ? money(c.shopify.profit.platformFees) : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.platformFees) : 0, total: sumMoney },
    { key: 'sh.ads',      label: 'SH Ads',      align: 'right',
      render: (c) => c ? money(c.shopify.profit.adsAttributed) : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.adsAttributed) : 0, total: sumMoney },
    { key: 'sh.profit',   label: 'SH Profit',   align: 'right',
      render: (c) => c ? <ProfitCell value={c.shopify.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
    { key: 'sh.roas',     label: 'SH ROAS',     align: 'right',
      render: (c) => c?.shopify.profit.roasNet !== null && c?.shopify.profit.roasNet !== undefined
        ? (Number(c.shopify.profit.roasNet).toFixed(2).replace('.', ',') + '×') : '—',
      total: roasTotal((c) => num(c.shopify.profit.netSales), (c) => num(c.shopify.profit.adsAttributed)) },
  ];

  const amazonBlock: Col[] = [
    { key: 'am.netto',    label: 'AM Netto',    align: 'right', group: true,
      render: (c) => c ? money(c.amazon.profit.netSales) : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.netSales) : 0, total: sumMoney },
    { key: 'am.prod',     label: 'AM Produkte', align: 'right',
      render: (c) => c ? money(c.amazon.profit.productCosts) : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.productCosts) : 0, total: sumMoney },
    { key: 'am.ff',       label: 'AM Fulfill.', align: 'right',
      render: (c) => c ? money(c.amazon.profit.shippingCosts) : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.shippingCosts) : 0, total: sumMoney },
    { key: 'am.fee',      label: 'AM Gebühr',   align: 'right',
      render: (c) => c ? money(c.amazon.profit.platformFees) : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.platformFees) : 0, total: sumMoney },
    { key: 'am.ads',      label: 'AM PPC',      align: 'right',
      render: (c) => c ? money(c.amazon.profit.adsAttributed) : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.adsAttributed) : 0, total: sumMoney },
    { key: 'am.profit',   label: 'AM Profit',   align: 'right',
      render: (c) => c ? <ProfitCell value={c.amazon.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
    { key: 'am.roas',     label: 'AM ROAS',     align: 'right',
      render: (c) => c?.amazon.profit.roasNet !== null && c?.amazon.profit.roasNet !== undefined
        ? (Number(c.amazon.profit.roasNet).toFixed(2).replace('.', ',') + '×') : '—',
      total: roasTotal((c) => num(c.amazon.profit.netSales), (c) => num(c.amazon.profit.adsAttributed)) },
  ];

  const tiktokBlock: Col[] = [
    { key: 'tt.netto',    label: 'TT Netto',    align: 'right', group: true,
      render: (c) => c ? money(c.tiktok.profit.netSales) : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.netSales) : 0, total: sumMoney },
    { key: 'tt.prod',     label: 'TT Produkte', align: 'right',
      render: (c) => c ? money(c.tiktok.profit.productCosts) : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.productCosts) : 0, total: sumMoney },
    { key: 'tt.versand',  label: 'TT Versand',  align: 'right',
      render: (c) => c ? money(c.tiktok.profit.shippingCosts) : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.shippingCosts) : 0, total: sumMoney },
    { key: 'tt.fee',      label: 'TT Gebühr',   align: 'right',
      render: (c) => c ? money(c.tiktok.profit.platformFees) : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.platformFees) : 0, total: sumMoney },
    { key: 'tt.ads',      label: 'TT Ads',      align: 'right',
      render: (c) => c ? money(c.tiktok.profit.adsAttributed) : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.adsAttributed) : 0, total: sumMoney },
    { key: 'tt.profit',   label: 'TT Profit',   align: 'right',
      render: (c) => c ? <ProfitCell value={c.tiktok.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
    { key: 'tt.roas',     label: 'TT ROAS',     align: 'right',
      render: (c) => c?.tiktok.profit.roasNet !== null && c?.tiktok.profit.roasNet !== undefined
        ? (Number(c.tiktok.profit.roasNet).toFixed(2).replace('.', ',') + '×') : '—',
      total: roasTotal((c) => num(c.tiktok.profit.netSales), (c) => num(c.tiktok.profit.adsAttributed)) },
  ];

  if (view === 'compact') return [...shopifyBlock, ...amazonBlock, ...tiktokBlock];
  if (view === 'shopify') return shopifyBlock;
  if (view === 'amazon')  return amazonBlock;
  if (view === 'tiktok')  return tiktokBlock;
  if (view === 'marketing') return [
    { key: 'meta',   label: 'Meta',    align: 'right', group: true,
      render: (_, r) => money(r?.ads.meta ?? '0'),
      sumFrom: (_, r) => num(r?.ads.meta ?? '0'), total: sumMoney },
    { key: 'google', label: 'Google',  align: 'right',
      render: (_, r) => money(r?.ads.google ?? '0'),
      sumFrom: (_, r) => num(r?.ads.google ?? '0'), total: sumMoney },
    { key: 'infl',   label: 'Infl.',   align: 'right',
      render: (_, r) => money(r?.ads.influencer ?? '0'),
      sumFrom: (_, r) => num(r?.ads.influencer ?? '0'), total: sumMoney },
    { key: 'appc',   label: 'AM PPC',  align: 'right',
      render: (_, r) => money(r?.ads.amazonPpc ?? '0'),
      sumFrom: (_, r) => num(r?.ads.amazonPpc ?? '0'), total: sumMoney },
    { key: 'ttads',  label: 'TT Ads',  align: 'right',
      render: (_, r) => money(r?.ads.tiktokAds ?? '0'),
      sumFrom: (_, r) => num(r?.ads.tiktokAds ?? '0'), total: sumMoney },
  ];
  if (view === 'profit') return [
    { key: 'sh.profit', label: 'SH Profit', align: 'right', group: true,
      render: (c) => c ? <ProfitCell value={c.shopify.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.shopify.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
    { key: 'am.profit', label: 'AM Profit', align: 'right',
      render: (c) => c ? <ProfitCell value={c.amazon.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.amazon.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
    { key: 'tt.profit', label: 'TT Profit', align: 'right',
      render: (c) => c ? <ProfitCell value={c.tiktok.profit.profit} /> : '—',
      sumFrom: (c) => c ? num(c.tiktok.profit.profit) : 0,
      total: (sum) => <span className={cn(sum < 0 ? 'text-red-600' : 'text-emerald-600', 'font-bold')}>{formatEur(sum.toString())}</span> },
  ];
  // 'all'
  return [...shopifyBlock, ...amazonBlock, ...tiktokBlock];
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

function SalesSection({ channel, sales, rawSales, readonly, onStage }: {
  channel: Channel;
  sales: { gross19: string; gross7: string; returns19: string; returns7: string };
  rawSales: { gross19: string; gross7: string; returns19: string; returns7: string };
  readonly: boolean;
  onStage: (patch: SalesPatch) => void;
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
          rawValue={rawSales.gross19}
          disabled={readonly}
          onCommit={(v) => onStage({ gross19: v })}
        />
        {showReduced && (
          <MoneyField
            label="Brutto 7 % (z.B. Bücher)"
            value={sales.gross7}
            rawValue={rawSales.gross7}
            disabled={readonly}
            onCommit={(v) => onStage({ gross7: v })}
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
          <MoneyField label="Retouren 19 %" value={sales.returns19} rawValue={rawSales.returns19} disabled={readonly}
            onCommit={(v) => onStage({ returns19: v })} />
          <MoneyField label="Retouren 7 %" value={sales.returns7} rawValue={rawSales.returns7} disabled={readonly}
            onCommit={(v) => onStage({ returns7: v })} />
        </div>
      )}
      {!showReduced && (
        <div className="mt-3 max-w-md">
          <MoneyField label="Retouren (optional)" value={sales.returns19} rawValue={rawSales.returns19} disabled={readonly}
            onCommit={(v) => onStage({ returns19: v })} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ProductSalesSection — §20-23 Verkaufte Produkte je Kanal
// -----------------------------------------------------------------------------

function ProductSalesSection({ channel, productSales, pendingProductSales, readonly, onStage }: {
  channel: Channel;
  productSales: Array<{ channel: Channel; productId: string; quantity: number }>;
  pendingProductSales: Record<string, number>;
  readonly: boolean;
  onStage: (productId: string, quantity: number) => void;
}) {
  const [products, setProducts] = useState<ProductCostRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await profitAnalysisApi.productCosts.list({ limit: 500, channel });
        setProducts(res.items);
      } finally { setLoading(false); }
    })();
  }, [channel]);

  // Menge fuer diesen Kanal + productId nachschlagen (raw und pending)
  const rawQtyOf = (productId: string) =>
    productSales.find((s) => s.channel === channel && s.productId === productId)?.quantity ?? 0;
  const effectiveQtyOf = (productId: string) => {
    const key = `${channel}|${productId}`;
    return key in pendingProductSales ? pendingProductSales[key] : rawQtyOf(productId);
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.title.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.externalId.toLowerCase().includes(s);
  });

  const withQty = filtered.filter((p) => effectiveQtyOf(p.productId) > 0);
  const withoutQty = filtered.filter((p) => effectiveQtyOf(p.productId) === 0);
  const orderedProducts = [...withQty, ...withoutQty];

  const totalUnits =
    productSales.filter((s) => s.channel === channel).reduce((a, s) => a + s.quantity, 0)
    + Object.entries(pendingProductSales).reduce((sum, [key, qty]) => {
        const [ch, pid] = key.split('|');
        if (ch !== channel) return sum;
        return sum + (qty - rawQtyOf(pid));
      }, 0);

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
              const currentQty = effectiveQtyOf(p.productId);
              const rawQty = rawQtyOf(p.productId);
              const dirty = currentQty !== rawQty;
              const hasNoCost = p.currentCost === null;
              const hasNoFulfillment = channel === 'amazon' && p.currentFulfillment === null;
              return (
                <div key={p.productId} className={cn('flex items-center gap-3 px-3 py-2 text-sm', currentQty > 0 && 'bg-amber-50/40 dark:bg-amber-500/[0.03]')}>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {p.title}
                      {dirty && <span title="Ungespeicherte Änderung" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      {p.sku && <span className="font-mono">{p.sku}</span>}
                      {hasNoCost && <span className="text-amber-600 dark:text-amber-400">· Produktkosten fehlen</span>}
                      {hasNoFulfillment && <span className="text-amber-600 dark:text-amber-400">· Fulfillment fehlt</span>}
                    </div>
                  </div>
                  <QtyInput
                    value={currentQty}
                    dirty={dirty}
                    disabled={readonly}
                    onCommit={(v) => onStage(p.productId, v)}
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

function QtyInput({ value, dirty, disabled, onCommit }: {
  value: number; dirty?: boolean; disabled?: boolean;
  onCommit: (v: number) => void;
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
          onCommit(Math.max(0, n));
        }}
        className={cn(
          'w-20 rounded-md border dark:bg-white/5 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500/40',
          dirty
            ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/[0.04]'
            : 'border-slate-300 dark:border-white/10',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      <span className="text-xs text-slate-400 w-4">Stk.</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SaveBar: manueller Speicher-Button, zeigt Anzahl offener Änderungen + Status
// -----------------------------------------------------------------------------

function SaveBar({ isDirty, dirtyCount, saving, saveError, lastSavedAt, onSave }: {
  isDirty: boolean;
  dirtyCount: number;
  saving: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {isDirty ? (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
          <Circle className="h-2 w-2 fill-current" />
          {dirtyCount} {dirtyCount === 1 ? 'Änderung' : 'Änderungen'}
        </div>
      ) : lastSavedAt ? (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ gespeichert
        </div>
      ) : null}

      {saveError && (
        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1" title={saveError}>
          <AlertCircle className="h-3.5 w-3.5" /> Fehler
        </div>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || saving}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
          isDirty
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed',
        )}
        title={isDirty ? 'Alle Änderungen jetzt speichern' : 'Keine Änderungen zu speichern'}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Speichern
      </button>
    </div>
  );
}
