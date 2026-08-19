/**
 * Zentraler Decimal-Import fuer alle Domain-Berechnungen.
 *
 * Regel: NIE JavaScript-Float fuer Geldbetraege. Immer Prisma.Decimal (baut auf
 * decimal.js auf). Alle Domain-Functions nehmen und geben Decimal zurueck —
 * die Konvertierung nach/von String passiert nur an der API-Grenze.
 */
export { Prisma } from '@prisma/client';
import { Prisma as _P } from '@prisma/client';

export type D = _P.Decimal;
export const D = _P.Decimal;

export const ZERO = new _P.Decimal(0);
export const ONE = new _P.Decimal(1);
export const HUNDRED = new _P.Decimal(100);

/**
 * Sichere Konvertierung zu Decimal.
 * - number, string, Decimal -> Decimal
 * - null/undefined -> ZERO (fuer optional Felder in Berechnungen)
 * - NaN/Infinity -> ZERO (kein Rechnen mit ungueltigen Werten)
 */
export function toD(v: number | string | D | null | undefined): D {
  if (v === null || v === undefined) return ZERO;
  if (v instanceof _P.Decimal) return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ZERO;
    return new _P.Decimal(v);
  }
  try {
    return new _P.Decimal(v);
  } catch {
    return ZERO;
  }
}

/** Kaufmaennisches Runden auf 2 Nachkommastellen — nur an der API-Grenze. */
export function round2(v: D): D {
  return v.toDecimalPlaces(2, _P.Decimal.ROUND_HALF_UP);
}

/** Kaufmaennisches Runden auf 4 Nachkommastellen (z.B. Prozente). */
export function round4(v: D): D {
  return v.toDecimalPlaces(4, _P.Decimal.ROUND_HALF_UP);
}
