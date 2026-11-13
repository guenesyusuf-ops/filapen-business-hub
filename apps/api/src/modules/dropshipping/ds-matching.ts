/**
 * Gemeinsame Matching-Hilfen fuer das Dropshipping-Modul.
 */

export interface MatchLine {
  sku: string | null;
  title?: string | null;
}

const IGNORE_SKUS = new Set([
  'free_shipping', 'freeshipping', 'shipping', 'versand', 'free-shipping',
]);

const IGNORE_TITLE = /(gratis\s*versand|free\s*shipping|kostenlose?r?\s*versand|express\s*versand|versandkosten)/i;

/**
 * Versand-/Rabatt-Pseudo-Positionen zaehlen beim Matching NICHT als Produkt
 * (sie koennen eine Bestellung nicht ausschliessen und werden dem Dropshipper
 * nicht angezeigt). Shopify fuehrt "Gratis Versand" teils als Katalog-Artikel
 * mit eigener SKU — der darf das "exakt passen" nicht blockieren.
 */
export function isIgnorableLine(li: MatchLine): boolean {
  const sku = (li.sku ?? '').trim().toLowerCase();
  if (sku && IGNORE_SKUS.has(sku)) return true;
  // SKU-lose Positionen, deren Titel klar auf Versand hinweist.
  if (!sku && IGNORE_TITLE.test(li.title ?? '')) return true;
  return false;
}

export function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
