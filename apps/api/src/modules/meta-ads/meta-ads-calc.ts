/**
 * Zentrale Berechnungslogik für das Meta-Ads-Modul.
 *
 * Reine Funktionen (keine Nest-Abhängigkeit) — damit sie isoliert testbar sind
 * und NIRGENDWO im Frontend oder in mehreren Services dupliziert werden.
 *
 * Grundregeln (aus der Spezifikation):
 *  - Division durch 0 ist immer abgesichert → null statt Infinity/NaN.
 *  - Hyros ROAS ist der FÜHRENDE ROAS und wird nie durch Umsatz/Spend ersetzt.
 *    `calculatedRoas` existiert nur als separater, klar benannter Vergleichswert.
 *  - Tages-ROAS-Werte werden NIE arithmetisch gemittelt. Über Zeiträume gibt es
 *    keinen aggregierten Hyros ROAS (null) — stattdessen steht der aus Summen
 *    gebildete calculatedRoas zur Verfügung.
 *  - Raten (Hook/Hold/CTR/Outbound/Ø-Wiedergabe) werden gewichtet gemittelt
 *    (Gewicht = Impressionen), nicht einfach arithmetisch.
 */

/** Ein einzelner normalisierter Tagesdatensatz (alle Werte als number|null). */
export interface DailyMetricInput {
  spend: number | null;
  impressions: number | null;
  hookRate: number | null;
  holdRate: number | null;
  videoViews3s: number | null;
  videoViews25: number | null;
  videoViews50: number | null;
  videoViews75: number | null;
  videoViews95: number | null;
  videoViews100: number | null;
  thruplays: number | null;
  averageWatchTimeSeconds: number | null;
  cpcAll: number | null;
  ctrAll: number | null;
  outboundCtr: number | null;
  totalSales: number | null;
  uniqueSales: number | null;
  hyrosRoas: number | null;
  revenue: number | null;
}

// ---------------------------------------------------------------------------
// Grundbausteine
// ---------------------------------------------------------------------------

/** Division mit Null-Absicherung. Nenner <= 0 oder null → null. */
export function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null) return null;
  if (!(denominator > 0)) return null;
  return numerator / denominator;
}

/** Auf n Nachkommastellen runden (null bleibt null). */
export function round(value: number | null, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

const num = (v: number | null): number => (v == null ? 0 : v);

// ---------------------------------------------------------------------------
// Einzelkennzahlen
// ---------------------------------------------------------------------------

/** CPA bezogen auf Unique Sales = Spend / Unique Sales. */
export function cpaUnique(spend: number | null, uniqueSales: number | null): number | null {
  return round(safeDiv(spend, uniqueSales), 2);
}

/** CPA bezogen auf Sales gesamt = Spend / Sales gesamt. */
export function cpaTotal(spend: number | null, totalSales: number | null): number | null {
  return round(safeDiv(spend, totalSales), 2);
}

/**
 * Berechneter ROAS = Umsatz / Spend. NUR Vergleichswert — ersetzt niemals den
 * führenden Hyros ROAS.
 */
export function calculatedRoas(revenue: number | null, spend: number | null): number | null {
  return round(safeDiv(revenue, spend), 4);
}

/** Average Watch Percentage = Ø Wiedergabedauer / Video-Länge × 100. */
export function watchPercentage(
  averageWatchTimeSeconds: number | null,
  videoLengthSeconds: number | null,
): number | null {
  const ratio = safeDiv(averageWatchTimeSeconds, videoLengthSeconds);
  return ratio == null ? null : round(ratio * 100, 2);
}

/** Retention in % zwischen zwei Stufen = later / earlier × 100. */
export function retention(later: number | null, earlier: number | null): number | null {
  const ratio = safeDiv(later, earlier);
  return ratio == null ? null : round(ratio * 100, 2);
}

/** Drop-Off in % zwischen zwei Stufen = (1 − later/earlier) × 100. */
export function dropOff(later: number | null, earlier: number | null): number | null {
  const ratio = safeDiv(later, earlier);
  return ratio == null ? null : round((1 - ratio) * 100, 2);
}

/** Zeitposition (Sekunden) eines Retention-Prozentsatzes im Video. */
export function timePositionSeconds(percent: number, videoLengthSeconds: number | null): number | null {
  if (videoLengthSeconds == null || !(videoLengthSeconds > 0)) return null;
  return round((videoLengthSeconds * percent) / 100, 1);
}

/** Gewichteter Durchschnitt; Paare mit null-Wert oder null/0-Gewicht werden ignoriert. */
export function weightedAverage(pairs: Array<{ value: number | null; weight: number | null }>): number | null {
  let wSum = 0;
  let acc = 0;
  for (const { value, weight } of pairs) {
    if (value == null || weight == null || !(weight > 0)) continue;
    acc += value * weight;
    wSum += weight;
  }
  return wSum > 0 ? acc / wSum : null;
}

// ---------------------------------------------------------------------------
// Abgeleitete Kennzahlen eines einzelnen Tages (für die Daily-History-Tabelle)
// ---------------------------------------------------------------------------

export interface DerivedRowMetrics {
  cpaUnique: number | null;
  cpaTotal: number | null;
  calculatedRoas: number | null;
  watchPercentage: number | null;
  retention25to50: number | null;
  retention50to75: number | null;
  retention75to95: number | null;
  retention95to100: number | null;
  completion25to100: number | null;
  drop25to50: number | null;
  drop50to75: number | null;
  drop75to95: number | null;
  drop95to100: number | null;
}

export function deriveRow(row: DailyMetricInput, videoLengthSeconds: number | null): DerivedRowMetrics {
  return {
    cpaUnique: cpaUnique(row.spend, row.uniqueSales),
    cpaTotal: cpaTotal(row.spend, row.totalSales),
    calculatedRoas: calculatedRoas(row.revenue, row.spend),
    watchPercentage: watchPercentage(row.averageWatchTimeSeconds, videoLengthSeconds),
    retention25to50: retention(row.videoViews50, row.videoViews25),
    retention50to75: retention(row.videoViews75, row.videoViews50),
    retention75to95: retention(row.videoViews95, row.videoViews75),
    retention95to100: retention(row.videoViews100, row.videoViews95),
    completion25to100: retention(row.videoViews100, row.videoViews25),
    drop25to50: dropOff(row.videoViews50, row.videoViews25),
    drop50to75: dropOff(row.videoViews75, row.videoViews50),
    drop75to95: dropOff(row.videoViews95, row.videoViews75),
    drop95to100: dropOff(row.videoViews100, row.videoViews95),
  };
}

// ---------------------------------------------------------------------------
// Zeitraum-Aggregation (über mehrere Tage / mehrere Ads)
// ---------------------------------------------------------------------------

export interface AggregatedMetrics {
  // Summen
  spend: number;
  impressions: number;
  videoViews3s: number;
  videoViews25: number;
  videoViews50: number;
  videoViews75: number;
  videoViews95: number;
  videoViews100: number;
  thruplays: number;
  totalSales: number;
  uniqueSales: number;
  revenue: number;
  // Aus Summen abgeleitet (NICHT Tagesmittel)
  cpaUnique: number | null;
  cpaTotal: number | null;
  calculatedRoas: number | null;
  /** Über Zeiträume gibt es keinen korrekten aggregierten Hyros ROAS → immer null. */
  hyrosRoas: null;
  // Gewichtete Mittel (Gewicht = Impressionen)
  hookRate: number | null;
  holdRate: number | null;
  ctrAll: number | null;
  outboundCtr: number | null;
  cpcAll: number | null;
  averageWatchTimeSeconds: number | null;
  // Retention/Drop-Off aus den summierten View-Zahlen
  retention25to50: number | null;
  retention50to75: number | null;
  retention75to95: number | null;
  retention95to100: number | null;
  completion25to100: number | null;
  drop25to50: number | null;
  drop50to75: number | null;
  drop75to95: number | null;
  drop95to100: number | null;
  dataPoints: number;
}

/**
 * Aggregiert eine Menge Tagesdatensätze korrekt:
 *  - additive Felder werden summiert,
 *  - CPA/ROAS aus den Summen gebildet (nicht Tagesmittel),
 *  - Raten gewichtet nach Impressionen,
 *  - Hyros ROAS NICHT gemittelt (null) — stattdessen calculatedRoas aus Summen.
 */
export function aggregate(rows: DailyMetricInput[]): AggregatedMetrics {
  const spend = sum(rows, (r) => r.spend);
  const impressions = sum(rows, (r) => r.impressions);
  const v25 = sum(rows, (r) => r.videoViews25);
  const v50 = sum(rows, (r) => r.videoViews50);
  const v75 = sum(rows, (r) => r.videoViews75);
  const v95 = sum(rows, (r) => r.videoViews95);
  const v100 = sum(rows, (r) => r.videoViews100);
  const totalSales = sum(rows, (r) => r.totalSales);
  const uniqueSales = sum(rows, (r) => r.uniqueSales);
  const revenue = sum(rows, (r) => r.revenue);

  const byImpressions = (pick: (r: DailyMetricInput) => number | null) =>
    weightedAverage(rows.map((r) => ({ value: pick(r), weight: r.impressions })));

  return {
    spend: round2(spend),
    impressions,
    videoViews3s: sum(rows, (r) => r.videoViews3s),
    videoViews25: v25,
    videoViews50: v50,
    videoViews75: v75,
    videoViews95: v95,
    videoViews100: v100,
    thruplays: sum(rows, (r) => r.thruplays),
    totalSales,
    uniqueSales,
    revenue: round2(revenue),
    cpaUnique: cpaUnique(spend, uniqueSales),
    cpaTotal: cpaTotal(spend, totalSales),
    calculatedRoas: calculatedRoas(revenue, spend),
    hyrosRoas: null,
    hookRate: round(byImpressions((r) => r.hookRate), 4),
    holdRate: round(byImpressions((r) => r.holdRate), 4),
    ctrAll: round(byImpressions((r) => r.ctrAll), 4),
    outboundCtr: round(byImpressions((r) => r.outboundCtr), 4),
    cpcAll: round(byImpressions((r) => r.cpcAll), 4),
    averageWatchTimeSeconds: round(byImpressions((r) => r.averageWatchTimeSeconds), 3),
    retention25to50: retention(v50, v25),
    retention50to75: retention(v75, v50),
    retention75to95: retention(v95, v75),
    retention95to100: retention(v100, v95),
    completion25to100: retention(v100, v25),
    drop25to50: dropOff(v50, v25),
    drop50to75: dropOff(v75, v50),
    drop75to95: dropOff(v95, v75),
    drop95to100: dropOff(v100, v95),
    dataPoints: rows.length,
  };
}

function sum(rows: DailyMetricInput[], pick: (r: DailyMetricInput) => number | null): number {
  return rows.reduce((acc, r) => acc + num(pick(r)), 0);
}

// ---------------------------------------------------------------------------
// Retention-Analytics (deterministisch, keine KI)
// ---------------------------------------------------------------------------

export interface RetentionStep {
  key: '25' | '50' | '75' | '95' | '100';
  label: string;
  /** Absolute Viewer auf dieser Stufe. */
  viewers: number;
  /** Retention gegenüber der vorherigen Stufe in % (null bei erster Stufe). */
  retentionFromPrev: number | null;
  /** Drop-Off gegenüber der vorherigen Stufe in % (null bei erster Stufe). */
  dropFromPrev: number | null;
  /** Anteil an den 25%-Viewern in % (Completion-Basis). */
  completionFrom25: number | null;
  /** Zeitpunkt dieser Stufe in Sekunden (nur bei bekannter Video-Länge). */
  timeSeconds: number | null;
}

const STEP_DEFS: { key: RetentionStep['key']; pct: number; field: keyof AggregatedMetrics }[] = [
  { key: '25', pct: 25, field: 'videoViews25' },
  { key: '50', pct: 50, field: 'videoViews50' },
  { key: '75', pct: 75, field: 'videoViews75' },
  { key: '95', pct: 95, field: 'videoViews95' },
  { key: '100', pct: 100, field: 'videoViews100' },
];

/** Baut die Retention-Stufen aus den aggregierten View-Zahlen. */
export function buildRetentionSteps(agg: AggregatedMetrics, videoLengthSeconds: number | null): RetentionStep[] {
  const v25 = agg.videoViews25;
  let prev: number | null = null;
  return STEP_DEFS.map((d) => {
    const viewers = agg[d.field] as number;
    const step: RetentionStep = {
      key: d.key,
      label: `${d.pct} %`,
      viewers,
      retentionFromPrev: prev == null ? null : retention(viewers, prev),
      dropFromPrev: prev == null ? null : dropOff(viewers, prev),
      completionFrom25: d.key === '25' ? 100 : retention(viewers, v25),
      timeSeconds: timePositionSeconds(d.pct, videoLengthSeconds),
    };
    prev = viewers;
    return step;
  });
}

export interface BiggestDrop {
  segment: string;
  fromPct: number;
  toPct: number;
  dropPct: number;
  fromSeconds: number | null;
  toSeconds: number | null;
}

/** Ermittelt den Abschnitt mit dem größten relativen Drop-Off. */
export function biggestDrop(agg: AggregatedMetrics, videoLengthSeconds: number | null): BiggestDrop | null {
  const segs: { from: number; to: number; drop: number | null }[] = [
    { from: 25, to: 50, drop: agg.drop25to50 },
    { from: 50, to: 75, drop: agg.drop50to75 },
    { from: 75, to: 95, drop: agg.drop75to95 },
    { from: 95, to: 100, drop: agg.drop95to100 },
  ];
  const valid = segs.filter((s) => s.drop != null) as { from: number; to: number; drop: number }[];
  if (!valid.length) return null;
  const top = valid.reduce((a, b) => (b.drop > a.drop ? b : a));
  return {
    segment: `${top.from}–${top.to} %`,
    fromPct: top.from,
    toPct: top.to,
    dropPct: round(top.drop, 1) as number,
    fromSeconds: timePositionSeconds(top.from, videoLengthSeconds),
    toSeconds: timePositionSeconds(top.to, videoLengthSeconds),
  };
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export interface Confidence { level: ConfidenceLevel; reasons: string[] }

/**
 * Deterministische Aussagekraft anhand Datenvolumen — KEINE KI.
 * high  = genug Reichweite UND Laufzeit; medium = eins von beiden solide; sonst low.
 */
export function confidenceFrom(agg: AggregatedMetrics): Confidence {
  const impr = agg.impressions;
  const days = agg.dataPoints;
  const uniq = agg.uniqueSales;
  const reasons: string[] = [];
  reasons.push(`${impr.toLocaleString('de-DE')} Impressionen`);
  reasons.push(`${days} Tag${days === 1 ? '' : 'e'} mit Daten`);
  if (uniq > 0) reasons.push(`${uniq} Unique Sales`);

  let level: ConfidenceLevel;
  if (impr >= 50000 && days >= 7) level = 'high';
  else if (impr >= 10000 || days >= 4) level = 'medium';
  else level = 'low';
  return { level, reasons };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
