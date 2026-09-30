/**
 * Zentrale Timeout-Werte für externe Netzwerkaufrufe.
 *
 * Zweck: kein externer Request darf minutenlang hängen und dabei einen
 * UI-Request, einen Event-Loop-Slot oder eine DB-Pool-Verbindung blockieren.
 * Gleichzeitig dürfen legitime langsame Operationen (v. a. KI) nicht unnötig
 * abgebrochen werden. Die Werte sind daher bewusst großzügig gewählt — es geht
 * um die Beseitigung von Minuten-Hängern, nicht um aggressive Abbrüche.
 *
 * Verwendung bei fetch:  { signal: AbortSignal.timeout(STANDARD_EXTERNAL_TIMEOUT_MS) }
 * Verwendung beim Anthropic-SDK:  new Anthropic({ apiKey, timeout, maxRetries })
 *
 * Bewusst KEINE Timeout-Infrastruktur / kein Wrapper-Framework — nur Konstanten.
 */

/** Kurze JSON-Reads/Writes, die normal in 1–3 s antworten. */
export const FAST_API_TIMEOUT_MS = 15_000;

/** Normale externe API-Calls (Label, Dokument, GraphQL). */
export const STANDARD_EXTERNAL_TIMEOUT_MS = 20_000;

/** Datei-Downloads (PDFs), die je nach Größe etwas länger dauern dürfen. */
export const LONG_API_TIMEOUT_MS = 30_000;

/** UI-synchroner KI-Aufruf (kurze Generierung). */
export const AI_UI_TIMEOUT_MS = 60_000;

/** UI-synchroner KI-Aufruf mit längerer Generierung/Parsing. */
export const AI_UI_LONG_TIMEOUT_MS = 90_000;

/** Vision-/OCR-KI-Aufruf (große Bilder, dauert legitim länger). */
export const AI_OCR_TIMEOUT_MS = 120_000;

/**
 * Retries bei UI-nahen KI-Aufrufen bewusst auf 1 begrenzen, damit der
 * Worst-Case = timeout × (maxRetries+1) + Backoff überschaubar bleibt.
 * Das SDK-Default ist 2 → bis zu ~30 min bei Default-Timeout.
 */
export const AI_UI_MAX_RETRIES = 1;

/**
 * Erkennt einen durch AbortSignal.timeout() ausgelösten Abbruch.
 * Node/undici wirft je nach Version 'TimeoutError' oder 'AbortError'.
 */
export function isTimeoutError(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}
