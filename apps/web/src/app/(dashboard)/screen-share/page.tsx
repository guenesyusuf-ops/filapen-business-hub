'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Plus, Users, Mic, Volume2, Clock, ArrowRight } from 'lucide-react';
import { screenShareApi, type ScreenShareSession } from '@/lib/screen-share';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import { StartShareModal } from './StartShareModal';

export default function ScreenSharePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<ScreenShareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await screenShareApi.listActive();
      setSessions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // Poll alle 5s damit neue Sessions auch ohne Page-Reload auftauchen
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleJoin(s: ScreenShareSession) {
    router.push(`/screen-share/${s.id}`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Bildschirm teilen
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Live mit dem Team oder externen Gaesten — niedrige Latenz, optionaler Voice-Chat.
          </p>
        </div>
        <button
          onClick={() => setShowStart(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Bildschirm teilen
        </button>
      </div>

      {/* Aktive Sessions */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Aktive Sessions im Team
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 p-6 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState onStart={() => setShowStart(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isHost={s.hostUserId === currentUser?.id}
                onJoin={() => handleJoin(s)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Start Modal */}
      {showStart && currentUser && (
        <StartShareModal
          onClose={() => setShowStart(false)}
          onStarted={(sessionId) => {
            setShowStart(false);
            router.push(`/screen-share/${sessionId}`);
          }}
        />
      )}
    </div>
  );
}

function SessionCard({
  session, isHost, onJoin,
}: {
  session: ScreenShareSession;
  isHost: boolean;
  onJoin: () => void;
}) {
  const startedAt = new Date(session.startedAt);
  const minutesAgo = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
  const viewerCount = (session.participants ?? []).filter((p) => p.status === 'joined' && p.role === 'viewer').length;

  return (
    <button
      onClick={onJoin}
      className="text-left flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] hover:border-primary-300 dark:hover:border-primary-500/30 hover:shadow-md transition-all p-4"
    >
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <Monitor className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {session.sessionName || 'Bildschirm-Session'}
          </span>
          {isHost && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
              Du teilst
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />vor {minutesAgo} min</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{viewerCount} Zuschauer</span>
          {session.voiceEnabled && <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" />Voice</span>}
          {session.audioEnabled && <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" />Audio</span>}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] py-16 px-6 text-center">
      <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-950/30 items-center justify-center mb-4">
        <Monitor className="h-8 w-8 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-2">
        Keine aktive Session
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
        Starte eine neue Bildschirm-Session und lade Team-Mitglieder oder externe Gaeste ein.
      </p>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <Plus className="h-4 w-4" />
        Sharing starten
      </button>
    </div>
  );
}
