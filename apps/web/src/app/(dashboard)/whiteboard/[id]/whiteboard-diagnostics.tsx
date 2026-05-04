'use client';

/**
 * Whiteboard-Diagnose-Layer.
 *
 * Sammelt Logs zu Mount-Status, Auto-Save, Tldraw-DOM-Health und
 * visualisiert sie in einem schwebenden Panel rechts oben. User kann
 * den Status mit einem Klick kopieren und mir schicken — dann sehen
 * wir GENAU welche Sequenz zum White-Screen gefuehrt hat.
 *
 * Das Panel ist immer sichtbar. Sobald wir den Bug haben kann ich es
 * verstecken (?debug-Query oder ganz weg).
 */

import { useEffect, useState } from 'react';

type LogEntry = { ts: number; level: 'info' | 'warn' | 'error'; msg: string };

const logs: LogEntry[] = [];
const subscribers = new Set<() => void>();

function notify() {
  for (const s of subscribers) s();
}

export function logDiag(level: 'info' | 'warn' | 'error', msg: string) {
  const entry: LogEntry = { ts: Date.now(), level, msg };
  logs.push(entry);
  if (logs.length > 100) logs.shift();
  // eslint-disable-next-line no-console
  console.log(`[wb-diag/${level}]`, msg);
  notify();
}

export function getDiagDump(): string {
  return logs
    .map((l) => `${new Date(l.ts).toISOString().slice(11, 23)} [${l.level}] ${l.msg}`)
    .join('\n');
}

export function DiagnosticsPanel({ canvasContainerRef }: {
  canvasContainerRef?: React.RefObject<HTMLDivElement>;
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
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);

  // DOM-Health: MutationObserver + Periodic Dimension-Check.
  //  - Children-Count: zeigt Top-Level Aenderungen (tldraw mount/unmount)
  //  - Descendant-Count: tiefer Scan, deckt auf wenn tldraw intern leer wird
  //  - Width/Height: deckt flex-collapse auf — beliebter "weiss"-Trigger
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

    const observer = new MutationObserver(() => {
      measure();
      const desc = target.querySelectorAll('*').length;
      logDiag('info', `tldraw-DOM mutated: ${target.children.length} children / ${desc} desc`);
    });
    observer.observe(target, { childList: true, subtree: true });

    // Periodischer Health-Check alle 3s — fuer stille Zustands-Aenderungen
    // wo nichts mutated aber Pixels weg sind (z.B. CSS-transitions, GPU-loss).
    const healthInterval = window.setInterval(() => {
      const prev = target.getBoundingClientRect();
      measure();
      // Loggen wenn die Dimensionen drastisch geschrumpft sind
      if (prev.width < 50 || prev.height < 50) {
        logDiag('error', `canvas collapsed: ${Math.round(prev.width)}×${Math.round(prev.height)}px`);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      window.clearInterval(healthInterval);
    };
  }, [canvasContainerRef]);

  // Page Visibility tracking — falls das Tab in den Hintergrund geht
  // und beim Zurueckkommen das Whiteboard "leer" ist, sehen wir das.
  useEffect(() => {
    const onVisChange = () => {
      logDiag('info', `visibility=${document.visibilityState}`);
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

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

  const recentLogs = logs.slice(-12);

  return (
    <div className="absolute top-14 right-2 z-50 w-[360px] max-h-[60vh] flex flex-col rounded-xl bg-white dark:bg-[#1a1d2e] border border-yellow-300 dark:border-yellow-700 shadow-xl text-[10px] font-mono">
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-t-xl">
        <span className="font-semibold text-yellow-800 dark:text-yellow-300">🛠 Whiteboard-Diagnose</span>
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
