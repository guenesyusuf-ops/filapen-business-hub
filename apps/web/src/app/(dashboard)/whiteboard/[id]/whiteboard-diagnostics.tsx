'use client';

/**
 * Whiteboard-Diagnose-Layer.
 *
 * WICHTIG: Logs liegen auf `globalThis.__wbLogs` — ueberlebt damit
 * Component-Unmounts. Wenn ein hidden Remount stattfindet (z.B. durch
 * Liveblocks-RoomProvider Reconnect) und der Panel-Component selbst
 * neu montiert wird, sind die alten Logs trotzdem noch da.
 *
 * MOUNT/UNMOUNT-Events werden ueber logMount(label) / logUnmount(label)
 * ins gleiche Buffer geschrieben — eine sichtbare Sequenz
 *   visibility=visible
 *   UNMOUNT MultiplayerCanvas
 *   MOUNT MultiplayerCanvas
 *   tldraw onMount fired (multiplayer)
 * ist der definitive Beweis fuer einen Hidden-Remount.
 */

import { useEffect, useState } from 'react';
import type { Editor } from 'tldraw';

type LogEntry = { ts: number; level: 'info' | 'warn' | 'error'; msg: string };

// Persistenter Log-Speicher auf globalThis — ueberlebt Component-Unmounts
declare global {
  // eslint-disable-next-line no-var
  var __wbLogs: LogEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __wbSubs: Set<() => void> | undefined;
}

function getLogs(): LogEntry[] {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__wbLogs) globalThis.__wbLogs = [];
    return globalThis.__wbLogs;
  }
  return [];
}
function getSubs(): Set<() => void> {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__wbSubs) globalThis.__wbSubs = new Set();
    return globalThis.__wbSubs;
  }
  return new Set();
}

function notify() {
  for (const s of getSubs()) s();
}

export function logDiag(level: 'info' | 'warn' | 'error', msg: string) {
  const entry: LogEntry = { ts: Date.now(), level, msg };
  const logs = getLogs();
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  // eslint-disable-next-line no-console
  console.log(`[wb-diag/${level}]`, msg);
  notify();
}

/** Kurz-Helper fuer Mount/Unmount-Tracing — eine konsistente Form. */
export function logMount(label: string) {
  logDiag('info', `MOUNT ${label}`);
}
export function logUnmount(label: string) {
  logDiag('info', `UNMOUNT ${label}`);
}

export function getDiagDump(): string {
  return getLogs()
    .map((l) => `${new Date(l.ts).toISOString().slice(11, 23)} [${l.level}] ${l.msg}`)
    .join('\n');
}

export function DiagnosticsPanel({
  canvasContainerRef,
  editor,
  variant,
}: {
  canvasContainerRef?: React.RefObject<HTMLDivElement>;
  editor?: Editor | null;
  variant?: string;
}) {
  const [, force] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [domHealth, setDomHealth] = useState<{
    canvasChildren: number;
    width: number;
    height: number;
    descendantCount: number;
  } | null>(null);

  // Subscribe to log changes
  useEffect(() => {
    const cb = () => force((v) => v + 1);
    getSubs().add(cb);
    return () => { getSubs().delete(cb); };
  }, []);

  // DOM-Health: MutationObserver + Periodic Dimension-Check.
  useEffect(() => {
    if (!canvasContainerRef?.current) return;
    const target = canvasContainerRef.current;

    const measure = () => {
      const rect = target.getBoundingClientRect();
      const descendantCount = target.querySelectorAll('*').length;
      setDomHealth({
        canvasChildren: target.children.length,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        descendantCount,
      });
    };

    measure();
    logDiag('info', `canvas-init: ${Math.round(target.getBoundingClientRect().width)}×${Math.round(target.getBoundingClientRect().height)}px`);

    // WICHTIG: subtree:false. Mit subtree:true entstand eine Endlos-
    // schleife — der DiagnosticsPanel lebt selber im observed subtree,
    // sein setState-Re-Render mutated das DOM, Observer feuert, wieder
    // setState, Re-Render … Nach ~5s brach React aus und der ganze
    // Tldraw-Subtree wurde abgeworfen → weisser Bildschirm.
    const observer = new MutationObserver(() => {
      measure();
      const desc = target.querySelectorAll('*').length;
      logDiag('info', `tldraw-DOM mutated: ${target.children.length} children / ${desc} desc`);
    });
    observer.observe(target, { childList: true, subtree: false });

    const healthInterval = window.setInterval(() => {
      const prev = target.getBoundingClientRect();
      measure();
      if (prev.width < 50 || prev.height < 50) {
        logDiag('error', `canvas collapsed: ${Math.round(prev.width)}×${Math.round(prev.height)}px`);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      window.clearInterval(healthInterval);
    };
  }, [canvasContainerRef]);

  // STEP 3: Rich Visibility-Resume Snapshot.
  // Bei visibility=visible loggen wir alles was zur Diagnose der drei
  // Render-Failure-Modi noetig ist:
  //   A) Render-Loop tot     → rect ok, shapes>0, canvas-children=0
  //   B) Viewport-Bug        → rect=0x0 oder <50
  //   C) CSS-Issue           → display:none / visibility:hidden / opacity:0
  useEffect(() => {
    const onVisChange = () => {
      logDiag('info', `visibility=${document.visibilityState}`);
      if (document.visibilityState !== 'visible') return;
      if (!canvasContainerRef?.current) return;

      const target = canvasContainerRef.current;
      const rect = target.getBoundingClientRect();
      const cs = getComputedStyle(target);
      const canvasEls = target.querySelectorAll('canvas').length;
      logDiag('info', `vis-resume rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
      logDiag('info', `vis-resume cs=display:${cs.display}/vis:${cs.visibility}/op:${cs.opacity}`);
      logDiag('info', `vis-resume canvas-elements=${canvasEls}, descendants=${target.querySelectorAll('*').length}`);

      if (editor) {
        try {
          const cam = editor.getCamera();
          const zoom = editor.getZoomLevel();
          const shapes = editor.getCurrentPageShapes().length;
          logDiag('info', `vis-resume cam=${Math.round(cam.x)},${Math.round(cam.y)},z${cam.z.toFixed(2)} zoom=${zoom.toFixed(2)} shapes=${shapes}`);
        } catch (e: any) {
          logDiag('error', `vis-resume editor-read failed: ${e?.message ?? e}`);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [canvasContainerRef, editor]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-14 right-2 z-50 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 px-2 py-1 text-[10px] font-mono"
        title="Diagnose anzeigen"
      >
        Diag ▸
      </button>
    );
  }

  const recentLogs = getLogs().slice(-14);

  return (
    <div className="absolute top-14 right-2 z-50 w-[380px] max-h-[60vh] flex flex-col rounded-xl bg-white dark:bg-[#1a1d2e] border border-yellow-300 dark:border-yellow-700 shadow-xl text-[10px] font-mono">
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-t-xl">
        <span className="font-semibold text-yellow-800 dark:text-yellow-300">
          🛠 Whiteboard-Diagnose{variant ? ` · ${variant}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(getDiagDump()); } catch { /* ignore */ }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 text-[9px] hover:bg-yellow-300 dark:hover:bg-yellow-700"
          >
            {copied ? '✓ Kopiert' : 'Kopieren'}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded text-yellow-700 dark:text-yellow-400 px-1 hover:bg-yellow-200 dark:hover:bg-yellow-800"
          >
            ✕
          </button>
        </div>
      </div>

      {domHealth && (
        <div className="px-2 py-1 border-b border-yellow-100 dark:border-yellow-900/50 text-yellow-700 dark:text-yellow-400 space-y-0.5">
          <div>
            Container: {domHealth.canvasChildren} children · {domHealth.descendantCount} desc
            {domHealth.canvasChildren === 0 && <span className="ml-1 text-red-600 dark:text-red-400 font-bold">⚠ LEER</span>}
          </div>
          <div>
            Größe: {domHealth.width}×{domHealth.height}px
            {(domHealth.width < 50 || domHealth.height < 50) && <span className="ml-1 text-red-600 dark:text-red-400 font-bold">⚠ COLLAPSED</span>}
          </div>
        </div>
      )}

      <div className="overflow-y-auto px-2 py-1 space-y-0.5">
        {recentLogs.length === 0 && (
          <div className="text-gray-400 italic">Noch keine Events…</div>
        )}
        {recentLogs.map((l, i) => (
          <div key={i} className={
            l.level === 'error' ? 'text-red-600 dark:text-red-400' :
            l.level === 'warn'  ? 'text-orange-600 dark:text-orange-400' :
                                  'text-gray-700 dark:text-gray-300'
          }>
            <span className="opacity-60 mr-1">{new Date(l.ts).toISOString().slice(14, 23)}</span>
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
