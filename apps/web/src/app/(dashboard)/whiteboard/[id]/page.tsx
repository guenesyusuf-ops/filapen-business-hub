'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { whiteboardApi, type WhiteboardDetail } from '@/lib/whiteboard';

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

  useEffect(() => {
    if (!params.id) return;
    whiteboardApi.get(params.id)
      .then(setBoard)
      .catch((e) => setError(e.message));
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

  return <WhiteboardCanvas board={board} />;
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
