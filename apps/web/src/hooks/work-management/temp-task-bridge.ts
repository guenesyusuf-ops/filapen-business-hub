// =============================================================================
// Temp-ID-Bruecke fuer optimistic Task-Creates
// =============================================================================
//
// Wenn ein Task optimistisch mit einer "temp-XXX"-ID angelegt wird und der
// User sofort die Beschreibung tippt / Kommentar schreibt / Anhang hochlaedt,
// muessen diese Folge-Calls warten bis der CREATE-Request fertig ist und dann
// auf die ECHTE Task-ID gehen — sonst:
//   - Update endet im Noop (Beschreibung verschwindet beim Schliessen)
//   - Comment-POST liefert 404 ("Task not found")
//   - Attachment-POST liefert 500
//
// ZWEI-STUFIGE BRUECKE damit auch SPÄTER ankommende Updates noch
// auf die richtige ID gemapped werden:
//   1. registry: Pending<Promise>           — fuer aktuell wartende Calls
//   2. resolvedMap: tempId → realId         — bleibt fuer die ganze Session,
//      damit auch Calls die nach >30s kommen (z.B. User hatte Modal offen,
//      Tab im Hintergrund, kommt nach 5min zurueck und tippt) noch
//      die richtige ID finden.

type Pending = {
  promise: Promise<string>;
  resolve: (realId: string) => void;
  reject: (err: unknown) => void;
};

const registry = new Map<string, Pending>();
// Historisches Mapping: tempId → realId. Wird NIE auto-geleert — die
// paar kB Strings pro Session sind kein Problem; verlorene Daten waeren
// teurer. Plus: persistent in localStorage damit auch Reloads den
// Mapping behalten.
const resolvedMap = new Map<string, string>();

const LS_KEY = 'filapen-wm-temp-real-map';
const MAX_PERSIST = 200;

// Hydrate beim Modul-Load (laeuft einmal pro Tab-Session)
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as [string, string][];
      for (const [t, r] of arr) resolvedMap.set(t, r);
    }
  } catch { /* corrupt LS, ignore */ }
}

function persistResolvedMap() {
  if (typeof window === 'undefined') return;
  try {
    // FIFO Cap: nur die letzten N Eintraege behalten — sonst waechst LS
    // unbegrenzt bei Power-Usern.
    const entries = Array.from(resolvedMap.entries()).slice(-MAX_PERSIST);
    window.localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch { /* quota / private mode, ignore */ }
}

export function isTempId(id: string | null | undefined): boolean {
  return !!id && typeof id === 'string' && id.startsWith('temp-');
}

/**
 * Registriert eine neue Temp-ID. Liefert die Promise zurueck, die spaeter
 * mit der echten ID resolved wird. Doppelte Registrierung ist idempotent.
 *
 * Falls die Temp-ID schon im resolvedMap liegt (z.B. bei Hot-Reload oder
 * doppeltem Mount): die schon-aufgeloeste ID direkt resolven.
 */
export function registerTempTask(tempId: string): Pending {
  const existing = registry.get(tempId);
  if (existing) return existing;
  let resolve!: (id: string) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  const entry: Pending = { promise, resolve, reject };
  registry.set(tempId, entry);
  // Falls wir schon mal aufgeloest haben (Hot-Reload, Doppel-Mount):
  // sofort resolve damit wartende Calls nicht haengenbleiben.
  const alreadyResolved = resolvedMap.get(tempId);
  if (alreadyResolved) entry.resolve(alreadyResolved);
  return entry;
}

export function resolveTempTask(tempId: string, realId: string) {
  resolvedMap.set(tempId, realId);
  persistResolvedMap();
  const entry = registry.get(tempId);
  if (entry) {
    entry.resolve(realId);
    // Pending-Promise nach 30s aus der registry — der resolvedMap-Eintrag
    // bleibt damit spaete Update-Calls trotzdem noch die echte ID finden.
    setTimeout(() => registry.delete(tempId), 30_000);
  }
}

export function rejectTempTask(tempId: string, err: unknown) {
  const entry = registry.get(tempId);
  if (entry) {
    entry.reject(err);
    setTimeout(() => registry.delete(tempId), 30_000);
  }
}

/**
 * Liefert eine echte Task-ID:
 *   1. Keine temp-ID → sofort die ID zurueck
 *   2. Temp-ID + Pending registriert → wartet bis Create fertig ist
 *   3. Temp-ID + im resolvedMap historisch geloest → sofort die echte ID
 *   4. Temp-ID ohne jede Spur → failt (Bug-Indikator)
 *
 * (3) ist der wichtige Pfad: User hat einen Task vor 5min angelegt, das
 * Modal noch offen oder selectedTask haelt noch die Temp-ID, jetzt tippt
 * er was → wir kennen die echte ID aus der History und mappen rueber.
 */
export function resolveTaskId(id: string): Promise<string> {
  if (!isTempId(id)) return Promise.resolve(id);
  const entry = registry.get(id);
  if (entry) return entry.promise;
  const historical = resolvedMap.get(id);
  if (historical) return Promise.resolve(historical);
  return Promise.reject(
    new Error(`Temp-Task ${id} ist nicht registriert — Create-Flow defekt?`),
  );
}

/**
 * Synchroner Lookup: liefert die echte ID falls bekannt, sonst null.
 * Wird von der UI genutzt um selectedTask von temp- auf real-ID zu
 * upgraden ohne async Promise-Handling.
 */
export function getRealIdSync(id: string): string | null {
  if (!isTempId(id)) return id;
  return resolvedMap.get(id) ?? null;
}
