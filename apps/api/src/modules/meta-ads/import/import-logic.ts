/**
 * Zeilen-Logik für den Meta-Ads-Import (rein, testbar). Wird sowohl beim
 * Analyze (Preview) als auch beim Commit (Re-Validierung) verwendet — eine
 * einzige Quelle der Wahrheit.
 */
import { FieldDef, ImportType, fieldsFor } from './alias-map';
import { isBlank, parseImportNumber, parseDate } from './parse-values';

export interface ParsedRow {
  metaAdId?: string;
  adName?: string;
  date: string | null;
  dateAmbiguous: boolean;
  /** Nur Felder, die tatsächlich geliefert wurden (blank → NICHT enthalten). 0 bleibt 0. */
  values: Record<string, number>;
  errors: string[];
  warnings: string[];
}

const RATE_FIELDS = new Set(['hookRate', 'holdRate', 'ctrAll', 'outboundCtr']);

/**
 * Eine bereits auf kanonische Felder gemappte Rohzeile parsen.
 * `raw` bildet jeden kanonischen Feld-Key auf den Original-Zellenwert (String) ab;
 * fehlende/leere Zellen sind undefined/'' und werden NICHT in `values` übernommen.
 */
export function parseRow(type: ImportType, raw: Record<string, string | undefined>, prefer?: 'dmy' | 'mdy'): ParsedRow {
  const fields = fieldsFor(type);
  const out: ParsedRow = { date: null, dateAmbiguous: false, values: {}, errors: [], warnings: [] };

  for (const f of fields) {
    const cell = raw[f.key];
    if (f.kind === 'id') {
      if (!isBlank(cell)) out.metaAdId = String(cell).trim();
      continue;
    }
    if (f.kind === 'name') {
      if (!isBlank(cell)) out.adName = String(cell).trim();
      continue;
    }
    if (f.kind === 'date') {
      if (isBlank(cell)) { out.errors.push('Datum fehlt'); continue; }
      const d = parseDate(cell, prefer);
      if (!d.iso) out.errors.push(`Datum nicht lesbar: "${cell}"`);
      out.date = d.iso;
      out.dateAmbiguous = d.ambiguous;
      continue;
    }
    // numerische Felder (int/decimal/rate)
    if (isBlank(cell)) continue; // leer = nicht geliefert → bestehende Daten nicht anfassen
    let n = parseImportNumber(cell);
    if (n === null) { out.errors.push(`${f.label} nicht lesbar: "${cell}"`); continue; }
    // Hook/Hold Rate: manche Exporte liefern einen Bruch (0.21 statt 21). Immer auf Prozent normalisieren.
    if ((f.key === 'hookRate' || f.key === 'holdRate') && n > 0 && n <= 1) n = Math.round(n * 10000) / 100;
    const rangeErr = checkRange(f, n);
    if (rangeErr) { out.errors.push(rangeErr); continue; }
    out.values[f.key] = f.kind === 'int' ? Math.round(n) : n;
  }

  addPlausibilityWarnings(out);
  return out;
}

function checkRange(f: FieldDef, n: number): string | null {
  if (n < 0) return `${f.label} darf nicht negativ sein`;
  if (RATE_FIELDS.has(f.key) && n > 100) return `${f.label} muss zwischen 0 und 100 liegen`;
  return null;
}

/** Weiche Plausibilitäts-Warnungen (nie automatisch korrigieren, nicht blockierend). */
export function addPlausibilityWarnings(row: ParsedRow): void {
  const v = row.values;
  const has = (k: string) => v[k] !== undefined;
  if (has('uniqueSales') && has('totalSales') && v.uniqueSales > v.totalSales) {
    row.warnings.push('Unique Sales größer als Sales gesamt');
  }
  const chain: [string, string][] = [
    ['videoViews50', 'videoViews25'],
    ['videoViews75', 'videoViews50'],
    ['videoViews95', 'videoViews75'],
    ['videoViews100', 'videoViews95'],
  ];
  for (const [later, earlier] of chain) {
    if (has(later) && has(earlier) && v[later] > v[earlier]) {
      row.warnings.push(`${later} größer als ${earlier} (Retention steigt normalerweise nicht)`);
    }
  }
}

export type RowStatus = 'ready' | 'warning' | 'unknown' | 'duplicate' | 'invalid' | 'skipped';
