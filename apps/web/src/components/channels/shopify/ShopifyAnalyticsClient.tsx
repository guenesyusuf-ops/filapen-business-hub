'use client';

import { ShoppingBag } from 'lucide-react';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useShopifyAnalytics } from '@/hooks/finance/useShopifyAnalytics';
import { AnalyticsCard, formatEur, formatInt } from './AnalyticsCard';
import { LineChartCard } from './LineChartCard';
import { BarChartCard } from './BarChartCard';
import { BreakdownTable } from './BreakdownTable';
import { PlaceholderCard } from './PlaceholderCard';
import { ReturnsTable } from './ReturnsTable';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')} Uhr`;
}

const dayFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
});

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return dayFormatter.format(d);
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingGrid() {
  return (
    <div className="space-y-10">
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="space-y-4">
          <div className="h-3 w-40 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((c) => (
              <div
                key={c}
                className="h-[340px] animate-pulse rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export function ShopifyAnalyticsClient() {
  const { data, isLoading, isError, error } = useShopifyAnalytics();

  // ---- Header ----
  const header = (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]">
          <ShoppingBag className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Shopify Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Replica des Shopify Admin Analytics Dashboards
          </p>
        </div>
      </div>
      <DateRangePicker />
    </div>
  );

  if (isLoading) {
    return (
      <div className="text-gray-900 dark:text-white">
        {header}
        <LoadingGrid />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-gray-900 dark:text-white">
        {header}
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-700 dark:text-red-300">
          <strong>Fehler beim Laden der Shopify Analytics.</strong>{' '}
          {error instanceof Error ? error.message : 'Bitte erneut versuchen.'}
        </div>
      </div>
    );
  }

  // ---- Derived series ----
  const hourlyRevenueSeries = data.hourlyRevenue.map((p) => ({
    label: formatHourLabel(p.hour),
    value: p.revenue,
  }));

  const ordersDaily = data.ordersTimeSeries.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.orders,
  }));

  const aovDaily = data.aovTimeSeries.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.aov,
  }));

  const returningRateDaily = data.returningCustomerRate.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.rate,
  }));

  const returnedItemsDaily = data.returnedItemsTimeSeries.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.count,
  }));

  const returnRateDaily = data.returnRateTimeSeries.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.rate,
  }));

  const itemsDaily = data.itemsOrderedTimeSeries.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.items,
  }));

  const avgItemsDaily = data.avgItemsPerOrder.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.avg,
  }));

  // ---- Big numbers ----
  const totalRevenue = data.revenueBreakdown.totalSales;
  const totalOrders = data.ordersTimeSeries.reduce((s, d) => s + d.orders, 0);
  const avgAov =
    totalOrders > 0
      ? Math.round((data.revenueBreakdown.netSales / totalOrders) * 100) / 100
      : 0;
  const totalReturningRate =
    returningRateDaily.length > 0
      ? Math.round(
          (returningRateDaily.reduce((s, d) => s + d.value, 0) /
            returningRateDaily.length) *
            100,
        ) / 100
      : 0;
  const totalReturnedItems = data.returnedItemsTimeSeries.reduce(
    (s, d) => s + d.count,
    0,
  );
  const avgReturnRate =
    returnRateDaily.length > 0
      ? Math.round(
          (returnRateDaily.reduce((s, d) => s + d.value, 0) /
            returnRateDaily.length) *
            100,
        ) / 100
      : 0;
  const totalItems = data.itemsOrderedTimeSeries.reduce((s, d) => s + d.items, 0);
  const avgItemsPerOrderOverall =
    totalOrders > 0
      ? Math.round((totalItems / totalOrders) * 100) / 100
      : 0;

  return (
    <div className="text-gray-900 dark:text-white">
      {header}

      <div className="space-y-10">
        {/* =======================================================
             Section 1: Umsatz & Traffic
             ======================================================= */}
        <Section title="Umsatz & Traffic">
          <LineChartCard
            title="Gesamtumsatz im Zeitverlauf"
            bigNumber={formatEur(totalRevenue)}
            bigNumberSubLabel="Stündlich / Täglich"
            data={hourlyRevenueSeries}
            color="#22c55e"
            format="currency"
            chartType="bar"
          />
          <PlaceholderCard title="Sitzungen im Zeitverlauf" />
          <BarChartCard
            title="Gesamtumsatz nach Produkt"
            data={data.revenueByProduct.map((p) => ({
              label: p.title,
              value: p.revenue,
            }))}
            color="#22c55e"
            format="currency"
            orientation="horizontal"
          />
        </Section>

        {/* =======================================================
             Section 2: Bestellungen & Conversion
             ======================================================= */}
        <Section title="Bestellungen & Conversion">
          <LineChartCard
            title="Bestellungen im Zeitverlauf"
            bigNumber={formatInt(totalOrders)}
            bigNumberSubLabel="Gesamt im Zeitraum"
            data={ordersDaily}
            color="#3b82f6"
            format="count"
            chartType="line"
          />
          <LineChartCard
            title="Durchschnittlicher Bestellwert"
            bigNumber={formatEur(avgAov)}
            bigNumberSubLabel="Ø AOV im Zeitraum"
            data={aovDaily}
            color="#a855f7"
            format="currency"
            chartType="line"
          />
          <PlaceholderCard title="Conversion Funnel" />
        </Section>

        {/* =======================================================
             Section 3: Kundenverhalten
             ======================================================= */}
        <Section title="Kundenverhalten">
          <LineChartCard
            title="Rate wiederkehrender Kunden"
            bigNumber={`${totalReturningRate.toLocaleString('de-DE')} %`}
            bigNumberSubLabel="Ø über den Zeitraum"
            data={returningRateDaily}
            color="#f59e0b"
            format="percent"
            chartType="line"
          />
          <PlaceholderCard title="Sitzungen nach Gerätetyp" />
          <BarChartCard
            title="Bestellungen nach Produkt"
            data={data.ordersByProduct.map((p) => ({
              label: p.title,
              value: p.orderCount,
            }))}
            color="#3b82f6"
            format="count"
            orientation="vertical"
          />
        </Section>

        {/* =======================================================
             Section 4: Umsatz-Aufschlüsselung
             ======================================================= */}
        <Section title="Umsatz-Aufschlüsselung">
          <BreakdownTable data={data.revenueBreakdown} />
          <LineChartCard
            title="Zurückgegebene Artikel im Zeitverlauf"
            bigNumber={formatInt(totalReturnedItems)}
            bigNumberSubLabel="Summe Einheiten"
            data={returnedItemsDaily}
            color="#ef4444"
            format="count"
            chartType="line"
          />
          <BarChartCard
            title="Gesamtumsatz nach Produktvariante"
            data={data.revenueByVariant.map((v) => ({
              label: v.title,
              value: v.revenue,
            }))}
            color="#22c55e"
            format="currency"
            orientation="horizontal"
          />
        </Section>

        {/* =======================================================
             Section 5: Retouren & Bounce
             ======================================================= */}
        <Section title="Retouren & Bounce">
          <ReturnsTable rows={data.returns} />
          <LineChartCard
            title="Rückgabequote im Zeitverlauf"
            bigNumber={`${avgReturnRate.toLocaleString('de-DE')} %`}
            bigNumberSubLabel="Ø im Zeitraum"
            data={returnRateDaily}
            color="#ef4444"
            format="percent"
            chartType="line"
          />
          <PlaceholderCard title="Absprungrate im Zeitverlauf" />
        </Section>

        {/* =======================================================
             Section 6: Produkt Performance
             ======================================================= */}
        <Section title="Produkt Performance">
          <LineChartCard
            title="Bestellte Artikel im Zeitverlauf"
            bigNumber={formatInt(totalItems)}
            bigNumberSubLabel="Summe Einheiten"
            data={itemsDaily}
            color="#22c55e"
            format="count"
            chartType="line"
          />
          <BarChartCard
            title="Top-Produktvarianten nach verkauften Einheiten"
            data={data.topVariantsByUnits.map((v) => ({
              label: v.title,
              value: v.units,
            }))}
            color="#3b82f6"
            format="count"
            orientation="horizontal"
          />
          <LineChartCard
            title="Durchschnittliche Bestellmenge"
            bigNumber={avgItemsPerOrderOverall.toLocaleString('de-DE')}
            bigNumberSubLabel="Ø Artikel pro Bestellung"
            data={avgItemsDaily}
            color="#a855f7"
            format="decimal"
            chartType="line"
          />
        </Section>
      </div>
    </div>
  );
}
