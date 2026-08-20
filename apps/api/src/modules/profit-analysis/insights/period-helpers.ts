/**
 * §12 Zeitraum-Berechnung fuer Insights.
 *
 * Regel: der laufende (unvollstaendige) Tag darf Vergleiche nicht verfaelschen.
 * "Letzte 7 Tage" = letzte 7 abgeschlossene Tage (also: gestern und 6 davor).
 * "Vorherige 7 Tage" = die 7 Tage davor.
 */

export interface DateRange {
  from: Date;
  to: Date;
  dayCount: number;
}

/** Gibt YYYY-MM-DD als String zurueck (UTC). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Datum ohne Zeit-Anteil (00:00 UTC). */
export function toDateOnly(d: Date): Date {
  return new Date(isoDate(d) + 'T00:00:00.000Z');
}

/** Datum n Tage frueher als d. */
export function daysBefore(d: Date, n: number): Date {
  return new Date(toDateOnly(d).getTime() - n * 24 * 60 * 60 * 1000);
}

/**
 * Letzte N abgeschlossene Tage vor referenceDate.
 * referenceDate default = heute UTC.
 * Wenn heute = 2026-08-20:
 *   last(7) → 2026-08-13 bis 2026-08-19 (7 Tage, gestern ist der letzte)
 */
export function lastNCompleteDays(n: number, referenceDate?: Date): DateRange {
  const today = toDateOnly(referenceDate ?? new Date());
  const to = new Date(today.getTime() - 24 * 60 * 60 * 1000);        // gestern
  const from = new Date(to.getTime() - (n - 1) * 24 * 60 * 60 * 1000);
  return { from, to, dayCount: n };
}

/** Die 7 Tage die unmittelbar VOR einem lastNCompleteDays(7)-Bereich liegen. */
export function previousNDays(rangeAfter: DateRange, n: number): DateRange {
  const to = new Date(rangeAfter.from.getTime() - 24 * 60 * 60 * 1000);
  const from = new Date(to.getTime() - (n - 1) * 24 * 60 * 60 * 1000);
  return { from, to, dayCount: n };
}

/**
 * §15 "gleicher Monatszeitraum" — MTD fair vergleichen.
 * Wenn heute = 2026-08-18, MTD ist 2026-08-01 bis 2026-08-17 (gestern).
 * Vormonatsequivalent: 2026-07-01 bis 2026-07-17.
 */
export function monthToDate(referenceDate?: Date): DateRange {
  const today = toDateOnly(referenceDate ?? new Date());
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(today.getTime() - 24 * 60 * 60 * 1000);   // gestern
  const dayCount = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return { from, to, dayCount: Math.max(0, dayCount) };
}

export function sameMonthRangeInPreviousMonth(mtd: DateRange): DateRange {
  const from = new Date(Date.UTC(mtd.from.getUTCFullYear(), mtd.from.getUTCMonth() - 1, mtd.from.getUTCDate()));
  const to   = new Date(Date.UTC(mtd.to.getUTCFullYear(),   mtd.to.getUTCMonth()   - 1, mtd.to.getUTCDate()));
  const dayCount = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return { from, to, dayCount };
}

/** Anzahl Tage im Monat (z.B. 31 fuer August). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
