'use client';

/**
 * Crash-sicherer Entwurfs-Speicher fuer den Tages-Editor.
 *
 * Hintergrund: Bis 29.08.2026 lebten ungespeicherte Eingaben ausschliesslich
 * im React-State. Wenn das Speichern fehlschlug (Race-Condition im Backend),
 * blieben die Werte zwar sichtbar im UI — waren aber bei Tab-Close, Crash oder
 * Tageswechsel unwiederbringlich weg. So sind im August 2026 18 Tage
 * verlorengegangen.
 *
 * Ab jetzt wird jede Aenderung sofort zusaetzlich in localStorage gespiegelt.
 * Der Entwurf ueberlebt Reload, Crash und Tageswechsel und wird erst geloescht,
 * wenn das Backend den Batch-Save bestaetigt hat.
 *
 * Alle Zugriffe sind defensiv: localStorage kann in Private-Windows, bei
 * blockierten Site-Daten oder vollem Quota werfen. Ein Fehler hier darf den
 * Editor niemals lahmlegen.
 */

const PREFIX = 'pa:draft:v1:';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage — deutlich laenger als jeder Monatsabschluss

export interface DayDraft {
  ads: Record<string, string>;
  shipping: Record<string, number>;
  sales: Record<string, Record<string, string>>;
  productSales: Record<string, number>;
  updatedAt: number;
}

export type DayDraftInput = Omit<DayDraft, 'updatedAt'>;

function keyFor(date: string): string {
  return `${PREFIX}${date}`;
}

/** Ein Entwurf ist leer, wenn kein einziges Feld im Buffer liegt. */
export function isDraftEmpty(d: DayDraftInput): boolean {
  if (Object.keys(d.ads).length > 0) return false;
  if (Object.keys(d.shipping).length > 0) return false;
  if (Object.keys(d.productSales).length > 0) return false;
  for (const ch of Object.keys(d.sales)) {
    if (Object.keys(d.sales[ch] ?? {}).length > 0) return false;
  }
  return true;
}

/** Zaehlt die Einzelaenderungen eines Entwurfs — fuer "N Änderungen"-Anzeigen. */
export function draftFieldCount(d: DayDraftInput): number {
  let n = Object.keys(d.ads).length
    + Object.keys(d.shipping).length
    + Object.keys(d.productSales).length;
  for (const ch of Object.keys(d.sales)) n += Object.keys(d.sales[ch] ?? {}).length;
  return n;
}

/**
 * Entwurf schreiben. Ein leerer Entwurf loescht den Eintrag — dadurch raeumt
 * sich der Speicher nach erfolgreichem Save von selbst auf.
 */
export function saveDraft(date: string, draft: DayDraftInput): void {
  try {
    if (isDraftEmpty(draft)) {
      window.localStorage.removeItem(keyFor(date));
      return;
    }
    const payload: DayDraft = { ...draft, updatedAt: Date.now() };
    window.localStorage.setItem(keyFor(date), JSON.stringify(payload));
  } catch {
    // Quota voll / Storage blockiert — Editor laeuft normal weiter.
  }
}

/** Entwurf lesen. Abgelaufene oder kaputte Eintraege werden verworfen. */
export function loadDraft(date: string): DayDraft | null {
  try {
    const rawValue = window.localStorage.getItem(keyFor(date));
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as DayDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.updatedAt !== 'number' || Date.now() - parsed.updatedAt > TTL_MS) {
      window.localStorage.removeItem(keyFor(date));
      return null;
    }
    return {
      ads: parsed.ads ?? {},
      shipping: parsed.shipping ?? {},
      sales: parsed.sales ?? {},
      productSales: parsed.productSales ?? {},
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function clearDraft(date: string): void {
  try {
    window.localStorage.removeItem(keyFor(date));
  } catch {
    // ignorieren
  }
}

/**
 * Alle Tage eines Monats, fuer die noch ein ungespeicherter Entwurf existiert.
 * Sortiert aufsteigend. Raeumt abgelaufene Eintraege nebenbei weg.
 */
export function listDraftDates(year: number, month: number): string[] {
  const prefix = `${PREFIX}${year}-${String(month).padStart(2, '0')}-`;
  const found: string[] = [];
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const date = k.slice(PREFIX.length);
      const draft = loadDraft(date);
      if (draft) found.push(date);
      else stale.push(k);
    }
    stale.forEach((k) => {
      try { window.localStorage.removeItem(k); } catch { /* ignorieren */ }
    });
  } catch {
    return [];
  }
  return found.sort();
}
