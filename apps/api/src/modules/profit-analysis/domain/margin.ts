import { D, toD, HUNDRED, round2 } from './decimal';

/**
 * Marge = Profit / Netto-Umsatz × 100.
 * Bei Netto-Umsatz = 0 -> NULL (nicht 0, nicht Infinity!) — der Konsument
 * muss den "keine Marge berechenbar"-Fall explizit rendern.
 *
 * Master-Prompt §28: "Bei Nettoumsatz 0 muss Division durch 0 sauber
 * behandelt werden."
 */
export function margin(profit: number | string | D, netSales: number | string | D): D | null {
  const p = toD(profit);
  const n = toD(netSales);
  if (n.isZero()) return null;
  return round2(p.div(n).times(HUNDRED));
}

/**
 * ROAS = Umsatz / Werbekosten.
 * Bei Werbekosten = 0 -> NULL (Division durch 0).
 * Master-Prompt §29/32/35: "Kein Division-by-zero Fehler."
 */
export function roas(sales: number | string | D, adSpend: number | string | D): D | null {
  const s = toD(sales);
  const a = toD(adSpend);
  if (a.isZero()) return null;
  return round2(s.div(a));
}

/**
 * Ampel-Kategorie fuer eine Marge basierend auf Zielen.
 * Standard: criticalBelow=20, goodFrom=25, target=30 (Master-Prompt §38).
 */
export type MarginTone = 'critical' | 'warn' | 'good' | 'target';

export function marginTone(
  margin: D | null,
  criticalBelow = 20,
  goodFrom = 25,
  target = 30,
): MarginTone | null {
  if (margin === null) return null;
  if (margin.lt(criticalBelow)) return 'critical';
  if (margin.lt(goodFrom)) return 'warn';
  if (margin.lt(target)) return 'good';
  return 'target';
}

/**
 * Prozentualer Kostenanteil (Kosten / Nettoumsatz × 100).
 * Selbe Division-durch-0-Behandlung wie margin().
 */
export function costRatio(cost: number | string | D, netSales: number | string | D): D | null {
  const c = toD(cost);
  const n = toD(netSales);
  if (n.isZero()) return null;
  return round2(c.div(n).times(HUNDRED));
}
