'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, ArrowLeft } from 'lucide-react';
import { screenShareApi, type JoinSessionResponse } from '@/lib/screen-share';

// LiveKit-Room dynamisch lazy-load — vermeidet SSR-Probleme weil
// die Browser-APIs (getUserMedia etc.) serverseitig nicht existieren.
const ScreenShareRoom = dynamic(() => import('@/components/screen-share/ScreenShareRoom'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0c0e1c]">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  ),
});

export default function ScreenShareSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [data, setData] = useState<JoinSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    screenShareApi.join(sessionId)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: any) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0c0e1c] text-white">
        <div className="text-lg">Beitritt nicht moeglich</div>
        <div className="text-sm text-gray-400 max-w-md text-center">{error}</div>
        <button
          onClick={() => router.push('/screen-share')}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Zurueck
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0c0e1c]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <ScreenShareRoom
      sessionId={data.session.id}
      sessionName={data.session.sessionName}
      hostUserId={data.session.hostUserId}
      isHost={data.isHost}
      voiceEnabled={data.session.voiceEnabled}
      audioEnabled={data.session.audioEnabled}
      livekitUrl={data.livekitUrl}
      livekitToken={data.livekitToken}
      onLeave={() => router.push('/screen-share')}
    />
  );
}
