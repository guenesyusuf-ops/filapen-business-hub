/**
 * Zahl-/Datum-Formatierer fuer die Gewinnanalyse.
 *
 * Wichtig: Betraege kommen vom Backend als Decimal-STRINGS ("1234.56") um
 * Float-Rundungsfehler zu vermeiden. Wir parsen erst hier ins UI-Rendering,
 * NIE fuer Berechnungen (die passieren serverseitig).
 */

const eurFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const intFmt = new Intl.NumberFormat('de-DE');
const dateFmt = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
const dateLongFmt = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });

/** "1234.56" -> "1.234,56 €". Ungueltige Werte -> "—". */
export function formatEur(decimalString: string | number | null | undefined): string {
  if (decimalString === null || decimalString === undefined || decimalString === '') return '—';
  const n = typeof decimalString === 'string' ? Number(decimalString) : decimalString;
  if (!Number.isFinite(n)) return '—';
  return eurFmt.format(n);
}

/** "24.8" -> "24,8 %". Fuer bereits berechnete Prozentwerte (nicht 0..1). */
export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${percentFmt.format(n)} %`;
}

/** Ganze Zahl mit deutschem Tausendertrenner. */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value)) return '—';
  return intFmt.format(value);
}

/** "2026-08-20" -> "20.08.2026" */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T00:00:00.000Z' : iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return dateFmt.format(d);
}

/** "2026-08-20" -> "20. August 2026" */
export function formatDateLong(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T00:00:00.000Z' : iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return dateLongFmt.format(d);
}

/** "3.0" -> "3,0" — fuer Input-Felder, damit User ihre gewohnte Notation sehen. */
export function decimalToInputString(decimalString: string): string {
  return decimalString.replace('.', ',');
}

/** "3,0" -> "3.0" — beim Speichern zurueck ins ISO-Zahlformat. */
export function inputStringToDecimal(input: string): string {
  return input.replace(',', '.').trim();
}
