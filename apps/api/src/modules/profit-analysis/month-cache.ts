/**
 * Gewinnanalyse — kleiner In-Memory-Cache für berechnete OFFENE Monate.
 *
 * Phase-1-Optimierung (Dashboard-Geschwindigkeit). Bewusst minimal & sicher:
 * - Nur OFFENE Monate werden hier zwischengespeichert. Abgeschlossene Monate
 *   kommen direkt aus dem gespeicherten Snapshot (an anderer Stelle).
 * - Sehr kurze TTL (15s): selbst wenn eine seltene Schreib-Quelle (z. B. eine
 *   Settings-/Kostenänderung) die Invalidierung nicht auslöst, heilt sich der
 *   Cache binnen 15s selbst — es können NIE dauerhaft falsche Zahlen entstehen.
 * - Häufige Bearbeitungen (Tagesdaten) rufen invalidateMonth() direkt auf, der
 *   betroffene Monat ist dann sofort wieder frisch.
 * - Reiner Lese-Cache: speichert exakt das Ergebnis von computeMonth. Es wird
 *   nichts berechnet oder verändert — nur zwischengelagert.
 *
 * Der Prozess auf Railway ist langlebig, daher überdauert der Cache einzelne
 * Requests (anders als eine Serverless-Funktion).
 */

const TTL_MS = 15_000;

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();

function keyOf(orgId: string, year: number, month: number): string {
  return `${orgId}:${year}:${month}`;
}

export function getCachedMonth<T>(orgId: string, year: number, month: number): T | undefined {
  const k = keyOf(orgId, year, month);
  const e = store.get(k);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    store.delete(k);
    return undefined;
  }
  return e.value as T;
}

export function setCachedMonth(orgId: string, year: number, month: number, value: unknown): void {
  store.set(keyOf(orgId, year, month), { value, expires: Date.now() + TTL_MS });
}

/** Einen konkreten Monat sofort verwerfen (z. B. nach einer Tages-Bearbeitung). */
export function invalidateMonth(orgId: string, year: number, month: number): void {
  store.delete(keyOf(orgId, year, month));
}

/** Alle Monate einer Org verwerfen (Sicherheitsnetz für breite Änderungen). */
export function invalidateOrgMonths(orgId: string): void {
  const prefix = `${orgId}:`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
