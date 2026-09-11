import { D, toD, HUNDRED, round2 } from './decimal';

/**
 * Marge = Profit / Netto-Umsatz × 100.
 * Bei Netto-Umsatz <= 0 -> NULL (nicht 0, nicht Infinity!) — der Konsument
 * muss den "keine Marge berechenbar"-Fall explizit rendern.
 *
 * Master-Prompt §28: "Bei Nettoumsatz 0 muss Division durch 0 sauber
 * behandelt werden."
 *
 * Negativer Nenner ist ebenfalls NULL: bei retourenbedingt negativem
 * Netto-Umsatz dreht die Division das Vorzeichen, margin(-50, -100) waere
 * "+50 %". Der schlechteste Kanal des Monats erschiene damit als bester und
 * marginTone() stufte ihn auf 'target' ein. Eine Marge auf negativen Umsatz
 * ist wirtschaftlich nicht definiert — also nicht berechenbar.
 */
export function margin(profit: number | string | D, netSales: number | string | D): D | null {
  const p = toD(profit);
  const n = toD(netSales);
  if (n.lte(0)) return null;
  return round2(p.div(n).times(HUNDRED));
}

/**
 * ROAS = Umsatz / Werbekosten.
 * Bei Werbekosten <= 0 -> NULL (Division durch 0).
 * Master-Prompt §29/32/35: "Kein Division-by-zero Fehler."
 *
 * Negativer Umsatz -> NULL. An einem retourenstarken Tag ist grossAdjusted
 * negativ; ein negativer ROAS ("-11,9") ist keine interpretierbare Kennzahl.
 * Umsatz genau 0 bleibt dagegen ROAS 0 — "Geld ausgegeben, nichts verkauft"
 * ist eine echte Aussage.
 */
export function roas(sales: number | string | D, adSpend: number | string | D): D | null {
  const s = toD(sales);
  const a = toD(adSpend);
  if (a.lte(0)) return null;
  if (s.isNegative()) return null;
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
 * Selbe Behandlung wie margin(): Nenner <= 0 -> NULL.
 */
export function costRatio(cost: number | string | D, netSales: number | string | D): D | null {
  const c = toD(cost);
  const n = toD(netSales);
  if (n.lte(0)) return null;
  return round2(c.div(n).times(HUNDRED));
}
