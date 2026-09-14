'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { whiteboardApi, type WhiteboardDetail } from '@/lib/whiteboard';
import { wbTrace, wbTraceStart, wbTraceStop } from '@/lib/whiteboard-trace';
import { WhiteboardErrorBoundary } from './WhiteboardErrorBoundary';

// tldraw + Liveblocks bringen viel Code mit (Canvas-Engine, Yjs, …) — und sie
// brauchen window/document. Daher dynamisch importieren mit ssr:false damit
// der Build nicht waehrend SSR-Pre-Render bricht.
const WhiteboardCanvas = dynamic(
  () => import('./WhiteboardCanvas').then((m) => m.WhiteboardCanvas),
  { ssr: false, loading: () => <CanvasSkeleton /> },
);

export default function WhiteboardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<WhiteboardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Diagnose: Lebenszyklus der PAGE selbst. Verschwindet diese, war es
  // Routing/Navigation — bleibt sie, liegt es tiefer im Baum.
  useEffect(() => {
    if (!params.id) return;
    // Startet eine frische Session (setzt Zaehler + Listener zurueck) und
    // loest beim Verlassen garantiert alles wieder — sonst laufen nach dem
    // zweiten Oeffnen zwei Diagnose-Instanzen parallel.
    wbTraceStart(String(params.id));
    wbTrace('PAGE_MOUNT');
    return () => {
      wbTrace('PAGE_UNMOUNT');
      wbTraceStop('page-unmount');
    };
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    wbTrace('BOARD_FETCH_START');
    let cancelled = false;
    // 15s Hard-Timeout damit der Spinner nicht ewig dreht wenn die API
    // hangt oder das dynamic chunk nicht laedt.
    const timeoutId = setTimeout(() => {
      if (!cancelled && !error) {
        setError('Whiteboard konnte nicht geladen werden (Timeout). Lade die Seite neu.');
      }
    }, 15000);
    whiteboardApi.get(params.id)
      .then((b) => {
        wbTrace('BOARD_FETCH_END', {
          abgebrochen: cancelled,
          stateKeys: b?.state ? Object.keys(b.state as any).length : 0,
        });
        if (!cancelled) { clearTimeout(timeoutId); setBoard(b); }
      })
      .catch((e) => {
        wbTrace('BOARD_FETCH_ERROR', { msg: JSON.stringify(e.message) });
        if (!cancelled) { clearTimeout(timeoutId); setError(e.message); }
      });
    return () => { cancelled = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/whiteboard')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            ← Zurück zur Liste
          </button>
        </div>
      </div>
    );
  }

  if (!board) {
    return <CanvasSkeleton />;
  }

  return (
    <div data-wb-page="1" className="contents">
      <WhiteboardErrorBoundary>
        <WhiteboardCanvas board={board} />
      </WhiteboardErrorBoundary>
    </div>
  );
}

function CanvasSkeleton() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#fafafa] dark:bg-[#0c0e1c]">
      <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Whiteboard wird geladen…</p>
      </div>
    </div>
  );
}
