'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Monitor, Lock, Loader2, ArrowRight } from 'lucide-react';
import { screenShareApi, type GuestJoinResponse } from '@/lib/screen-share';

// LiveKit-Room als pure-client lazy-load
const ScreenShareRoom = dynamic(() => import('@/components/screen-share/ScreenShareRoom'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0c0e1c]">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  ),
});

export default function GuestSharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState<GuestJoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await screenShareApi.joinAsGuest(token, name.trim(), password.trim() || undefined);
      setJoined(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <ScreenShareRoom
        sessionId={joined.sessionId}
        sessionName={joined.sessionName}
        hostUserId="" // Gast kennt keine Host-Identity
        isHost={false}
        voiceEnabled={false} // Gaeste duerfen kein Mic
        audioEnabled={false}
        livekitUrl={joined.livekitUrl}
        livekitToken={joined.livekitToken}
        onLeave={() => { setJoined(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c0e1c] via-[#11141f] to-[#0c0e1c] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 text-center">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center mb-3">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white">
            Bildschirm-Session beitreten
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Du wurdest als Gast eingeladen.
          </p>
        </div>
        <form onSubmit={handleJoin} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Wie heisst du?
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Daniel"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Passwort (falls vom Einlader gesetzt)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="leer lassen falls keins"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            Beitreten
          </button>
        </form>
      </div>
    </div>
  );
}
