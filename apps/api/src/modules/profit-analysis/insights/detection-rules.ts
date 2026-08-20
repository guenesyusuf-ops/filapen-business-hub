/**
 * Detection Rules (§14-28) — pure Functions.
 *
 * Input:  bereits berechnete Daten (Tages-Serien, Aggregate).
 * Output: Insight-Kandidaten (§7).
 *
 * KEIN I/O. KEIN Prisma. Getestet mit statischen Datenreihen.
 */

import { InsightCandidate, InsightPeriod, InsightSeverity } from './insight-types';
import { DateRange, daysInMonth } from './period-helpers';
import { fmtEur, fmtPct, fmtSignedPct, fmtRoas, fmtDate, fmtDateRange, channelLabel } from './formatters';

// ---------------------------------------------------------------------------
// Gemeinsame Bausteine
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date: string;                  // YYYY-MM-DD
  netSales: number;              // Netto-Umsatz gesamt (aller Kanaele)
  profit: number;                // Tages-Profit
  margin: number | null;         // Marge in % (null wenn nicht berechenbar)
  ads: {
    meta: number; google: number; influencer: number;
    amazonPpc: number; tiktokAds: number;
  };
  channels: {
    shopify: { grossAdjusted: number; net: number; ads: { meta: number; google: number; influencer: number } };
    amazon:  { grossAdjusted: number; net: number; ads: { amazonPpc: number } };
    tiktok:  { grossAdjusted: number; net: number; ads: { tiktokAds: number } };
  };
}

export interface RangeAggregate {
  netSales: number;
  profit: number;
  gross: number;
  metaGoogleAds: number;
  amazonPpc: number;
  tiktokAds: number;
  shopifyGross: number;
  amazonGross: number;
  tiktokGross: number;
  shopifyNet: number;
  amazonNet: number;
  tiktokNet: number;
}

/** §11: ROAS Zeitraum = Sum(Umsatz) / Sum(Ads). NIE Durchschnitt der Tages-ROAS. */
export function periodRoas(sales: number, adSpend: number): number | null {
  if (!Number.isFinite(sales) || !Number.isFinite(adSpend) || adSpend === 0) return null;
  return sales / adSpend;
}

/** Prozentuale Veraenderung mit Division-durch-0-Schutz. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Aggregiert Tages-Punkte zu einer Perioden-Summe. */
export function aggregateRange(points: DailyPoint[]): RangeAggregate {
  const zero: RangeAggregate = {
    netSales: 0, profit: 0, gross: 0,
    metaGoogleAds: 0, amazonPpc: 0, tiktokAds: 0,
    shopifyGross: 0, amazonGross: 0, tiktokGross: 0,
    shopifyNet: 0, amazonNet: 0, tiktokNet: 0,
  };
  return points.reduce<RangeAggregate>((acc, d) => ({
    netSales: acc.netSales + d.netSales,
    profit: acc.profit + d.profit,
    gross: acc.gross + d.channels.shopify.grossAdjusted + d.channels.amazon.grossAdjusted + d.channels.tiktok.grossAdjusted,
    metaGoogleAds: acc.metaGoogleAds + d.channels.shopify.ads.meta + d.channels.shopify.ads.google,
    amazonPpc: acc.amazonPpc + d.channels.amazon.ads.amazonPpc,
    tiktokAds: acc.tiktokAds + d.channels.tiktok.ads.tiktokAds,
    shopifyGross: acc.shopifyGross + d.channels.shopify.grossAdjusted,
    amazonGross: acc.amazonGross + d.channels.amazon.grossAdjusted,
    tiktokGross: acc.tiktokGross + d.channels.tiktok.grossAdjusted,
    shopifyNet: acc.shopifyNet + d.channels.shopify.net,
    amazonNet:  acc.amazonNet + d.channels.amazon.net,
    tiktokNet:  acc.tiktokNet + d.channels.tiktok.net,
  }), zero);
}

// ---------------------------------------------------------------------------
// §12/§19 ROAS 7-Tage-Vergleich (pro Kanal)
// ---------------------------------------------------------------------------

export function detectRoasChange(opts: {
  channel: 'webshop' | 'amazon' | 'tiktok';
  currentRange: DateRange;
  previousRange: DateRange;
  currentPoints: DailyPoint[];
  previousPoints: DailyPoint[];
  /** minimale prozentuale Veraenderung ab der ein Insight erzeugt wird. */
  minChangePct?: number;
}): InsightCandidate | null {
  const min = opts.minChangePct ?? 10;
  const cur = aggregateRange(opts.currentPoints);
  const prev = aggregateRange(opts.previousPoints);

  const [curSales, curAds, prevSales, prevAds] =
    opts.channel === 'webshop' ? [cur.shopifyNet, cur.metaGoogleAds, prev.shopifyNet, prev.metaGoogleAds]
    : opts.channel === 'amazon' ? [cur.amazonNet, cur.amazonPpc, prev.amazonNet, prev.amazonPpc]
    :                             [cur.tiktokNet, cur.tiktokAds, prev.tiktokNet, prev.tiktokAds];

  const curRoas = periodRoas(curSales, curAds);
  const prevRoas = periodRoas(prevSales, prevAds);
  if (curRoas === null || prevRoas === null) return null;

  const change = pctChange(curRoas, prevRoas);
  if (change === null || Math.abs(change) < min) return null;

  const dropped = change < 0;
  const severity: InsightSeverity = dropped ? (change < -25 ? 'critical' : 'warning') : 'positive';
  const chLabel = channelLabel(opts.channel);

  return {
    type: `roas.rolling7d.${dropped ? 'dropped' : 'improved'}.${opts.channel}`,
    severity,
    channel: opts.channel,
    period: rangePeriod(opts.currentRange, 'rolling-7d'),
    metric: 'roas_net',
    currentValue: round2(curRoas),
    comparisonValue: round2(prevRoas),
    percentageChange: round2(change),
    unit: 'roas',
    facts: { previousRange: fmtDateRange(opts.previousRange.from, opts.previousRange.to) },
    title: `${chLabel}-ROAS ${dropped ? 'rückläufig' : 'gestiegen'}`,
    message: `Der ${chLabel}-ROAS liegt in den letzten 7 Tagen bei ${fmtRoas(curRoas)} — das sind ${fmtSignedPct(change)} gegenüber den vorherigen 7 Tagen (${fmtRoas(prevRoas)}).`,
    priorityScore: computePriority(severity, Math.abs(change), 'roas'),
  };
}

// ---------------------------------------------------------------------------
// §14 Umsatz-Streak (3 Tage in Folge steigend/fallend)
// ---------------------------------------------------------------------------

export function detectRevenueStreak(opts: {
  points: DailyPoint[];
  /** Mindestveraenderung pro Schritt in %, um Rauschen zu ignorieren. */
  minStepPct?: number;
  /** Wie viele aufeinanderfolgende Tage. */
  minStreakLength?: number;
}): InsightCandidate | null {
  const min = opts.minStepPct ?? 2;
  const len = opts.minStreakLength ?? 3;
  const points = opts.points.slice(-len - 1); // wir brauchen len+1 Punkte fuer len Vergleiche
  if (points.length < len + 1) return null;

  let up = true, down = true;
  for (let i = 1; i < points.length; i++) {
    const change = pctChange(points[i].netSales, points[i - 1].netSales);
    if (change === null) return null;
    if (change < min) up = false;
    if (change > -min) down = false;
  }
  if (!up && !down) return null;

  const first = points[0].netSales;
  const last = points[points.length - 1].netSales;
  const totalChange = pctChange(last, first) ?? 0;
  const rising = up;
  const severity: InsightSeverity = rising ? 'positive' : totalChange < -20 ? 'critical' : 'warning';
  const period = rangePeriod(
    { from: new Date(points[1].date + 'T00:00:00.000Z'), to: new Date(points[points.length - 1].date + 'T00:00:00.000Z'), dayCount: len },
    `streak-${len}d`,
  );

  return {
    type: `revenue.streak.${rising ? 'up' : 'down'}`,
    severity,
    channel: 'total',
    period,
    metric: 'net_sales_streak',
    currentValue: round2(last),
    comparisonValue: round2(first),
    percentageChange: round2(totalChange),
    unit: 'EUR',
    facts: { streakDays: len, points: points.slice(1).map((p) => ({ date: p.date, netSales: round2(p.netSales) })) as any },
    title: `Umsatz ${len} Tage in Folge ${rising ? 'gestiegen' : 'gefallen'}`,
    message: `Der Netto-Umsatz ist über die letzten ${len} Tage ${rising ? 'kontinuierlich gestiegen' : 'kontinuierlich gefallen'} (${fmtSignedPct(totalChange)}, aktuell ${fmtEur(last)}).`,
    priorityScore: computePriority(severity, Math.abs(totalChange), 'revenue'),
  };
}

// ---------------------------------------------------------------------------
// §17 Marge-Schwelle
// ---------------------------------------------------------------------------

export function detectMarginThreshold(opts: {
  period: DateRange;
  currentMargin: number | null;
  criticalBelow?: number;
  goodFrom?: number;
  target?: number;
}): InsightCandidate | null {
  if (opts.currentMargin === null || !Number.isFinite(opts.currentMargin)) return null;
  const critical = opts.criticalBelow ?? 20;
  const good = opts.goodFrom ?? 25;
  const target = opts.target ?? 30;
  const m = opts.currentMargin;
  const period = rangePeriod(opts.period, `margin-${opts.period.from.toISOString().slice(0, 10)}`);

  if (m < critical) {
    return {
      type: 'margin.critical',
      severity: 'critical',
      channel: 'total',
      period,
      metric: 'margin_before_overhead',
      currentValue: round2(m),
      comparisonValue: critical,
      unit: 'percent',
      title: 'Marge unter kritischer Schwelle',
      message: `Die Marge liegt bei ${fmtPct(m)} und damit unter der Warnschwelle von ${fmtPct(critical)}.`,
      priorityScore: 90,
    };
  }
  if (m >= target) {
    return {
      type: 'margin.target_reached',
      severity: 'positive',
      channel: 'total',
      period,
      metric: 'margin_before_overhead',
      currentValue: round2(m),
      comparisonValue: target,
      unit: 'percent',
      title: 'Margen-Ziel erreicht',
      message: `Die Marge liegt bei ${fmtPct(m)} und damit über dem Zielwert von ${fmtPct(target)}.`,
      priorityScore: 40,
    };
  }
  if (m >= good) {
    return {
      type: 'margin.good',
      severity: 'positive',
      channel: 'total',
      period,
      metric: 'margin_before_overhead',
      currentValue: round2(m),
      comparisonValue: good,
      unit: 'percent',
      title: 'Marge im grünen Bereich',
      message: `Die Marge liegt bei ${fmtPct(m)} — über dem "Gut"-Bereich von ${fmtPct(good)}.`,
      priorityScore: 25,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// §18 Werbekosten steigen schneller als Umsatz
// ---------------------------------------------------------------------------

export function detectAdsOutpacingRevenue(opts: {
  currentRange: DateRange;
  previousRange: DateRange;
  currentPoints: DailyPoint[];
  previousPoints: DailyPoint[];
  minSpreadPct?: number;      // wie stark muss Ad-Wachstum > Umsatz-Wachstum sein
}): InsightCandidate | null {
  const spread = opts.minSpreadPct ?? 10;
  const cur = aggregateRange(opts.currentPoints);
  const prev = aggregateRange(opts.previousPoints);

  const curAds = cur.metaGoogleAds;
  const prevAds = prev.metaGoogleAds;
  const revChange = pctChange(cur.shopifyNet, prev.shopifyNet);
  const adsChange = pctChange(curAds, prevAds);
  if (revChange === null || adsChange === null) return null;
  const diff = adsChange - revChange;
  if (diff < spread) return null;

  const severity: InsightSeverity = revChange < 0 ? 'critical' : 'warning';
  return {
    type: 'ads.outpacing_revenue.webshop',
    severity,
    channel: 'webshop',
    period: rangePeriod(opts.currentRange, 'rolling-7d'),
    metric: 'ads_vs_revenue_gap',
    currentValue: round2(diff),
    unit: 'percent',
    facts: {
      adsChange: round2(adsChange),
      revenueChange: round2(revChange),
      currentAds: round2(curAds),
      previousAds: round2(prevAds),
    },
    title: 'Werbekosten steigen schneller als Umsatz',
    message: `Meta+Google-Kosten liegen ${fmtSignedPct(adsChange)} über dem Vergleichszeitraum, während der Webshop-Netto-Umsatz nur ${fmtSignedPct(revChange)} verändert ist.`,
    priorityScore: computePriority(severity, diff, 'ads'),
  };
}

// ---------------------------------------------------------------------------
// §28 Anomalie-Erkennung mit Median + MAD
// ---------------------------------------------------------------------------

/**
 * Median Absolute Deviation — robuste Alternative zur Standardabweichung.
 * MAD-Score > 3 gilt als starke Anomalie.
 */
export function detectAnomaly(opts: {
  metric: 'meta_spend' | 'shopify_revenue' | 'profit';
  historyValues: number[];       // z.B. letzte 28 Tage OHNE den letzten
  currentValue: number;
  currentDate: Date;
  channel?: 'webshop' | 'amazon' | 'tiktok' | 'total';
  minMadScore?: number;
}): InsightCandidate | null {
  if (opts.historyValues.length < 7) return null;
  const min = opts.minMadScore ?? 3;
  const median = medianOf(opts.historyValues);
  const mad = medianOf(opts.historyValues.map((v) => Math.abs(v - median)));
  if (mad === 0) return null;
  const score = Math.abs(opts.currentValue - median) / mad;
  if (score < min) return null;

  const higher = opts.currentValue > median;
  const isNegative = (opts.metric === 'meta_spend' && higher) || (opts.metric !== 'meta_spend' && !higher);
  const severity: InsightSeverity = isNegative ? 'warning' : opts.metric === 'meta_spend' ? 'info' : 'positive';
  const label =
    opts.metric === 'meta_spend' ? (higher ? 'Ungewöhnlich hoher Meta-Spend' : 'Ungewöhnlich niedriger Meta-Spend')
    : opts.metric === 'shopify_revenue' ? (higher ? 'Ungewöhnlich hoher Shopify-Umsatz' : 'Ungewöhnlich niedriger Shopify-Umsatz')
    : (higher ? 'Außergewöhnlich hoher Profit' : 'Außergewöhnlich niedriger Profit');
  const dateStr = fmtDate(opts.currentDate);

  return {
    type: `anomaly.${opts.metric}`,
    severity,
    channel: opts.channel,
    period: {
      from: opts.currentDate, to: opts.currentDate,
      label: dateStr, key: `anomaly-${opts.metric}-${opts.currentDate.toISOString().slice(0, 10)}`,
    },
    metric: opts.metric,
    currentValue: round2(opts.currentValue),
    comparisonValue: round2(median),
    absoluteChange: round2(opts.currentValue - median),
    unit: opts.metric === 'meta_spend' ? 'EUR' : 'EUR',
    facts: { madScore: round2(score) },
    title: label,
    message: `Am ${dateStr} liegt der Wert bei ${fmtEur(opts.currentValue)} — der historische Median der letzten Vergleichstage ist ${fmtEur(median)}.`,
    priorityScore: computePriority(severity, score * 5, 'anomaly'),
  };
}

// ---------------------------------------------------------------------------
// §27 Run-Rate / Monatsziel-Hochrechnung
// ---------------------------------------------------------------------------

export function detectRunRateTargetGap(opts: {
  year: number;
  month: number;
  completedDays: number;                      // Tage im Monat mit Daten
  currentMtdNetSales: number;
  currentMtdProfit: number;
  monthlyRevenueTarget: number;
  monthlyProfitTarget: number;
}): InsightCandidate[] {
  const results: InsightCandidate[] = [];
  const totalDays = daysInMonth(opts.year, opts.month);
  if (opts.completedDays < 3 || totalDays <= opts.completedDays) return results;

  const revenueRunRate = (opts.currentMtdNetSales / opts.completedDays) * totalDays;
  const profitRunRate  = (opts.currentMtdProfit / opts.completedDays) * totalDays;
  const monthLabel = `${['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][opts.month - 1]} ${opts.year}`;
  const period: InsightPeriod = {
    from: new Date(Date.UTC(opts.year, opts.month - 1, 1)),
    to: new Date(Date.UTC(opts.year, opts.month, 0)),
    label: monthLabel, key: `forecast-${opts.year}-${opts.month}`,
  };

  if (opts.monthlyRevenueTarget > 0) {
    const pctOfTarget = (revenueRunRate / opts.monthlyRevenueTarget) * 100;
    const reachable = pctOfTarget >= 95;
    results.push({
      type: `forecast.revenue.${reachable ? 'on_track' : 'off_track'}`,
      severity: reachable ? 'positive' : pctOfTarget < 80 ? 'warning' : 'info',
      channel: 'total',
      period,
      metric: 'run_rate_revenue',
      currentValue: round2(revenueRunRate),
      comparisonValue: round2(opts.monthlyRevenueTarget),
      percentageChange: round2(pctOfTarget - 100),
      unit: 'EUR',
      facts: { completedDays: opts.completedDays, totalDays, mtdRevenue: round2(opts.currentMtdNetSales) },
      title: reachable ? 'Umsatzziel wahrscheinlich erreichbar' : 'Umsatzziel unter aktueller Run-Rate',
      message: `Hochrechnung ${monthLabel}: ${fmtEur(revenueRunRate)} (${fmtPct(pctOfTarget)} vom Ziel ${fmtEur(opts.monthlyRevenueTarget)}). Basis: ${opts.completedDays} abgeschlossene Tage.`,
      priorityScore: reachable ? 20 : 60,
    });
  }
  if (opts.monthlyProfitTarget > 0) {
    const pctOfTarget = (profitRunRate / opts.monthlyProfitTarget) * 100;
    const reachable = pctOfTarget >= 95;
    results.push({
      type: `forecast.profit.${reachable ? 'on_track' : 'off_track'}`,
      severity: reachable ? 'positive' : pctOfTarget < 80 ? 'warning' : 'info',
      channel: 'total',
      period,
      metric: 'run_rate_profit',
      currentValue: round2(profitRunRate),
      comparisonValue: round2(opts.monthlyProfitTarget),
      percentageChange: round2(pctOfTarget - 100),
      unit: 'EUR',
      facts: { completedDays: opts.completedDays, totalDays, mtdProfit: round2(opts.currentMtdProfit) },
      title: reachable ? 'Gewinnziel wahrscheinlich erreichbar' : 'Gewinnziel unter aktueller Run-Rate',
      message: `Hochrechnung ${monthLabel}: ${fmtEur(profitRunRate)} (${fmtPct(pctOfTarget)} vom Ziel ${fmtEur(opts.monthlyProfitTarget)}).`,
      priorityScore: reachable ? 20 : 60,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// §29 Prioritaets-Score + §30 Deduplizierung (Helper)
// ---------------------------------------------------------------------------

export function computePriority(severity: InsightSeverity, magnitude: number, category: string): number {
  const base =
    severity === 'critical' ? 80
    : severity === 'warning' ? 55
    : severity === 'positive' ? 30
    : 15;
  // Magnitude-Boost (0..20)
  const boost = Math.min(20, magnitude / 2);
  return Math.min(100, Math.round(base + boost));
}

/** Fingerprint fuer Deduplizierung. Gleicher Fingerprint = Update statt Insert. */
export function fingerprintOf(c: InsightCandidate): string {
  const ch = c.channel ?? 'na';
  return `${c.type}|${ch}|${c.period.key}`;
}

// ---------------------------------------------------------------------------
// Interne Helpers
// ---------------------------------------------------------------------------

function medianOf(values: number[]): number {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rangePeriod(r: DateRange, keyPrefix: string): InsightPeriod {
  return {
    from: r.from, to: r.to,
    label: `${fmtDate(r.from)}–${fmtDate(r.to)}`,
    key: `${keyPrefix}-${r.to.toISOString().slice(0, 10)}`,
  };
}
