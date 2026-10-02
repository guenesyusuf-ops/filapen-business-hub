/** Formatierungs-Helfer für Meta-Ads-Kennzahlen. null → "—". */

const DASH = '—';

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat('de-DE').format(Math.round(n));
}

export function fmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export function fmtPct(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n)} %`;
}

export function fmtRoas(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}×`;
}

export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n);
}

export function fmtSeconds(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n)} s`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
