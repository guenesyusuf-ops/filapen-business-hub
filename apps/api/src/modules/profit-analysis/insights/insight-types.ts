/**
 * §7 Structured Insight Object — internes Format der Insight Detection Engine.
 *
 * Deterministisch erzeugt in Ebene B. Optionale KI-Umformulierung in Ebene C
 * fuellt aiTitle + aiMessage, ueberschreibt aber niemals die deterministischen
 * Felder title/message.
 */

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'critical';
export type InsightChannel = 'webshop' | 'amazon' | 'tiktok' | 'wholesale' | 'total';
export type InsightUnit = 'EUR' | 'percent' | 'roas' | 'count';

export interface InsightPeriod {
  from: Date;
  to: Date;
  /** Menschenlesbares Label, z.B. "letzte 7 Tage" oder "August 2026". */
  label: string;
  /** Kanonischer Key fuer die Deduplizierung, z.B. "rolling-7d-2026-08-20". */
  key: string;
}

export interface InsightCandidate {
  /** Typ-Konstante, z.B. "roas.rolling7d.dropped". */
  type: string;
  severity: InsightSeverity;
  channel?: InsightChannel;
  period: InsightPeriod;
  metric?: string;
  currentValue?: number;
  comparisonValue?: number;
  absoluteChange?: number;
  percentageChange?: number;
  unit?: InsightUnit;
  facts?: Record<string, number | string | null>;

  /** Deterministischer Titel — funktioniert immer ohne KI (§33). */
  title: string;
  /** Deterministische Nachricht — 1-2 Saetze. */
  message: string;

  /** Priority-Score fuer Sortierung (0-100, hoeher = wichtiger). */
  priorityScore: number;
}

/** Ergebnis eines "Warum?"-Aufrufs — mathematisch hergeleitete Treiber. */
export interface DriverAnalysis {
  headline: string;
  drivers: Array<{
    label: string;
    metric: string;
    change: number;
    unit: InsightUnit;
    direction: 'up' | 'down';
  }>;
}
