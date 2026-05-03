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
// Diese Bruecke haelt fuer jede Temp-ID eine Promise<string>. useCreateWmTask
// erstellt sie beim onMutate, resolvt mit der echten ID im onSuccess und
// rejected im onError. Alle anderen Hooks rufen `resolveTaskId(maybeTempId)`
// und bekommen entweder sofort die echte ID zurueck oder warten bis der
// Server geantwortet hat.

type Pending = {
  promise: Promise<string>;
  resolve: (realId: string) => void;
  reject: (err: unknown) => void;
};

const registry = new Map<string, Pending>();

export function isTempId(id: string | null | undefined): boolean {
  return !!id && typeof id === 'string' && id.startsWith('temp-');
}

/**
 * Registriert eine neue Temp-ID. Liefert die Promise zurueck, die spaeter
 * mit der echten ID resolved wird. Doppelte Registrierung ist idempotent —
 * wenn schon vorhanden, wird die existierende Pending zurueckgegeben.
 */
export function registerTempTask(tempId: string): Pending {
  const existing = registry.get(tempId);
  if (existing) return existing;
  let resolve!: (id: string) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  const entry: Pending = { promise, resolve, reject };
  registry.set(tempId, entry);
  return entry;
}

export function resolveTempTask(tempId: string, realId: string) {
  const entry = registry.get(tempId);
  if (entry) {
    entry.resolve(realId);
    // Eintrag noch ~30s halten falls weitere late callers reinkommen
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
 * Liefert eine echte Task-ID. Wenn id keine temp-ID ist, sofort. Wenn
 * temp-id und Pending registriert: wartet bis Create fertig ist. Wenn
 * temp-ID aber keine Pending bekannt: failt — sollte nicht passieren,
 * waere aber ein Hinweis auf einen Bug im Create-Flow.
 */
export function resolveTaskId(id: string): Promise<string> {
  if (!isTempId(id)) return Promise.resolve(id);
  const entry = registry.get(id);
  if (!entry) {
    return Promise.reject(
      new Error(`Temp-Task ${id} ist nicht registriert — Create-Flow defekt?`),
    );
  }
  return entry.promise;
}
