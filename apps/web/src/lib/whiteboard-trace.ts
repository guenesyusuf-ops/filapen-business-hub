'use client';

/**
 * Zentraler Diagnose-Trace fuer den Whiteboard-Bug "wird nach einigen
 * Sekunden weiss".
 *
 * REINES MESSINSTRUMENT. Diese Datei darf niemals React-State aendern, niemals
 * rendern, niemals ein Remount ausloesen und niemals das DOM veraendern.
 *
 * DATENSCHUTZ — laeuft in der Produktion. Ausgegeben werden ausschliesslich:
 * relative Zeit, Eventname, gekuerzte Board-ID, Zaehler, Booleans,
 * Instanz-IDs, DOM-Abmessungen, CSS-Werte, HTTP-Status.
 * NIEMALS: Tokens, Cookies, Authorization-Header, API-Responses,
 * E-Mail-Adressen, Namen, Board-Inhalte, Shape-Texte, Snapshots, HTML.
 *
 * Auswertung im Browser:  copy(__wbReport())
 */

interface TraceEntry {
  t: number;
  event: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 400;
let start = 0;
let entries: TraceEntry[] = [];
let instanceCounter = 0;
let sessionId = 0;
let attached = false;

// ---------------------------------------------------------------------------
// Instanz-Register — trennt die Faelle A bis F
//
// Jede Ebene fuehrt ihre EIGENE Identitaet. Entscheidend ist Fall E:
// StableTldraw kann als React-Komponente bestehen bleiben, waehrend das
// darin liegende <Tldraw> bzw. der Editor neu erzeugt wird. Ohne getrennte
// IDs waere das faelschlich als StableTldraw-Remount zu lesen.
// ---------------------------------------------------------------------------

const instances = {
  whiteboardCanvas: 0,
  singleUser: 0,
  stableTldraw: 0,
  editor: 0,
  editorMountNr: 0,
};

export type WbLayer = 'whiteboardCanvas' | 'singleUser' | 'stableTldraw' | 'editor';

/** Zieht eine neue Instanz-ID und merkt sie als aktuelle ID dieser Ebene. */
export function wbClaimInstance(layer: WbLayer): number {
  instanceCounter += 1;
  instances[layer] = instanceCounter;
  if (layer === 'editor') instances.editorMountNr += 1;
  return instanceCounter;
}

/** Aktuelle Identitaeten aller vier Ebenen — haengt an jedem Schluesselevent. */
export function wbInstances(): Record<string, number> {
  return {
    wbCanvas: instances.whiteboardCanvas,
    singleUser: instances.singleUser,
    stableTldraw: instances.stableTldraw,
    editor: instances.editor,
    editorMountNr: instances.editorMountNr,
  };
}

// ---------------------------------------------------------------------------

function now(): number {
  return start === 0 ? 0 : Math.round(performance.now() - start);
}

function line(e: TraceEntry): string {
  const rest = e.data
    ? ' ' + Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  return `[WB ${(e.t / 1000).toFixed(3).padStart(7, ' ')}] ${e.event}${rest}`;
}

/** Kuerzt Fehlertexte und schneidet Query-Strings ab (koennten Parameter tragen). */
export function wbSafeError(e: unknown): string {
  const raw = typeof e === 'string' ? e : (e as any)?.message ?? String(e);
  return String(raw).replace(/\?[^\s]*/g, '?…').slice(0, 160);
}

export function wbTrace(event: string, data?: Record<string, unknown>) {
  if (start === 0) start = performance.now();
  const entry: TraceEntry = { t: now(), event, data };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  // eslint-disable-next-line no-console
  console.log(line(entry));
}

export function wbReport(): string {
  return `# WB-Trace Session ${sessionId}\n` + entries.map(line).join('\n');
}

// ---------------------------------------------------------------------------
// Globale Fehler — REGEL 6, mit garantiertem Cleanup
// ---------------------------------------------------------------------------

function onWindowError(e: ErrorEvent) {
  wbTrace('WINDOW_ERROR', {
    name: (e.error as any)?.name ?? 'Error',
    msg: JSON.stringify(wbSafeError(e.message)),
    quelle: `${String(e.filename).split('/').pop()}:${e.lineno}`,
    ...wbInstances(),
  });
}

function onRejection(e: PromiseRejectionEvent) {
  wbTrace('UNHANDLED_REJECTION', {
    name: (e.reason as any)?.name ?? 'Rejection',
    msg: JSON.stringify(wbSafeError(e.reason)),
    ...wbInstances(),
  });
}

/**
 * Startet eine neue Trace-Session. Haengt Listener an und setzt alle Zaehler
 * zurueck, damit kein Rest einer vorherigen Session in die Auswertung faellt.
 * Idempotent: doppeltes Attach ist ausgeschlossen.
 */
export function wbTraceStart(boardId: string) {
  wbTraceStop('neustart');
  start = performance.now();
  entries = [];
  instanceCounter = 0;
  sessionId += 1;
  instances.whiteboardCanvas = 0;
  instances.singleUser = 0;
  instances.stableTldraw = 0;
  instances.editor = 0;
  instances.editorMountNr = 0;

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onRejection);
  (window as any).__wbReport = wbReport;
  attached = true;
  // Board-ID gekuerzt — reicht zur Unterscheidung zweier Tests.
  wbTrace('TRACE_ATTACH', { session: sessionId, board: boardId.slice(0, 8) });
}

/** Loest ALLE Listener und Beobachter. Muss beim Verlassen laufen. */
export function wbTraceStop(grund: string) {
  if (!attached) return;
  observer?.disconnect();
  observer = null;
  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onRejection);
  wbTrace('TRACE_DETACH', { session: sessionId, grund });
  delete (window as any).__wbReport;
  attached = false;
}

// ---------------------------------------------------------------------------
// DOM-/Layout-Messung — REGEL 8. Nur Geometrie und CSS, nie Inhalte.
// ---------------------------------------------------------------------------

function messen(el: Element | null | undefined): string {
  if (!el) return 'FEHLT';
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return [
    `${Math.round(r.width)}x${Math.round(r.height)}`,
    `@${Math.round(r.left)},${Math.round(r.top)}`,
    s.display, s.visibility, `op:${s.opacity}`, s.position, `z:${s.zIndex}`,
    `imDoc:${document.contains(el) ? 'ja' : 'NEIN'}`,
  ].join(' ');
}

export function wbMeasureDom(container: HTMLElement | null, anlass: string) {
  wbTrace('DOM_MESSUNG', { anlass, ...wbInstances() });
  // eslint-disable-next-line no-console
  console.log(
    `[WB]   pageWrapper  : ${messen(document.querySelector('[data-wb-page]'))}\n`
    + `[WB]   container    : ${messen(container)}\n`
    + `[WB]   tl-container : ${messen(container?.querySelector('.tl-container'))}\n`
    + `[WB]   tl-canvas    : ${messen(container?.querySelector('.tl-canvas'))}`,
  );
}

// ---------------------------------------------------------------------------
// MutationObserver — REGEL 7: ausschliesslich lesend
// ---------------------------------------------------------------------------

let observer: MutationObserver | null = null;

export function wbObserveRemovals(container: HTMLElement | null) {
  if (!container || typeof MutationObserver === 'undefined') return () => {};
  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of Array.from(m.removedNodes)) {
        if (!(n instanceof HTMLElement)) continue;
        const relevant = n.classList.contains('tl-container')
          || n.classList.contains('tl-canvas')
          || !!n.querySelector?.('.tl-canvas');
        if (!relevant) continue;
        wbTrace('DOM_ENTFERNT', {
          knoten: (n.className?.toString().split(/\s+/)[0] || n.tagName).slice(0, 40),
          parent: ((m.target as HTMLElement)?.className?.toString().split(/\s+/)[0] || '?').slice(0, 40),
          isConnected: n.isConnected,
          tlContainerNochDa: !!container.querySelector('.tl-container'),
          tlCanvasNochDa: !!container.querySelector('.tl-canvas'),
          ...wbInstances(),
        });
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
  wbTrace('OBSERVER_AKTIV');
  return () => { observer?.disconnect(); observer = null; };
}
