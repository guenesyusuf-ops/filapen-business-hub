'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LiveblocksProvider, RoomProvider, useBroadcastEvent, useEventListener } from '@liveblocks/react';
import { Monitor, Mic, X, CheckCircle, Volume2, Send, Download } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { screenShareApi, setBroadcastFn, type ScreenShareInviteEvent } from '@/lib/screen-share';
import { setSendBroadcastFn, fmtSize, type FilapenSendReceivedEvent } from '@/lib/filapen-send';
import { whiteboardApi } from '@/lib/whiteboard';
import { cn } from '@/lib/utils';

/**
 * Globaler Wrapper fuer das DashboardLayout.
 *
 * Connectet jeden eingeloggten User zum org-presence-{orgId} Liveblocks-Room.
 * In diesem Room broadcasted der Host beim Sharing-Start einen
 * `screen-share-invite` Event — alle anderen User in der Org bekommen ihn
 * sofort und zeigen ein Popup.
 *
 * Faellt graceful zurueck wenn Liveblocks nicht konfiguriert ist:
 * Komponente rendert dann nur die children, kein Broadcast/Listener.
 */
export function OrgPresenceProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  // Solange kein User da ist (z.B. Login-Phase) → nur children rendern
  if (!user?.orgId) return <>{children}</>;
  return (
    <LiveblocksProvider
      // Dispatch nach Room-Name. Dieser EINE LiveblocksProvider hostet
      // alle RoomProvider im Dashboard-Tree (Screen-Share Org-Presence,
      // Whiteboard wb-{boardId}, ggf. weitere). Liveblocks v3 erlaubt
      // nur einen Provider pro Tree → wir routen die Auth zentral hier.
      authEndpoint={async (room?: string) => {
        if (!room) throw new Error('Liveblocks: kein Room angegeben');
        // Whiteboard-Rooms: "wb-{boardId}"
        if (room.startsWith('wb-')) {
          const boardId = room.slice(3);
          const r = await whiteboardApi.liveblocksAuth(boardId);
          if (!r.token) throw new Error(r.reason || 'Liveblocks: Whiteboard-Auth fehlgeschlagen');
          return { token: r.token };
        }
        // Default: Org-Presence Room (Screen-Share Invites)
        const r = await screenShareApi.liveblocksAuth();
        if (!r.token) throw new Error(r.reason || 'Liveblocks: Org-Presence-Auth fehlgeschlagen');
        return { token: r.token };
      }}
    >
      <RoomProvider id={`org-presence-${user.orgId}`} initialPresence={{}}>
        <BroadcasterBridge />
        <InvitePopupListener />
        <FilapenSendPopupListener />
        {children}
      </RoomProvider>
    </LiveblocksProvider>
  );
}

/**
 * Registriert die broadcast-Funktion auf der Modul-Bridge damit
 * Code ausserhalb dieses Subtrees (z.B. StartShareModal) Invites
 * verschicken kann.
 */
function BroadcasterBridge() {
  const broadcast = useBroadcastEvent();
  useEffect(() => {
    setBroadcastFn(broadcast as any);
    setSendBroadcastFn(broadcast as any);
    return () => {
      setBroadcastFn(null);
      setSendBroadcastFn(null);
    };
  }, [broadcast]);
  return null;
}

// ---------------------------------------------------------------------------
// InvitePopupListener — hoert Events, zeigt Popup nur wenn ICH eingeladen bin
// ---------------------------------------------------------------------------
function InvitePopupListener() {
  const currentUser = useAuthStore((s) => s.user);
  const [activeInvites, setActiveInvites] = useState<ScreenShareInviteEvent[]>([]);

  useEventListener(({ event }: { event: any }) => {
    if (event?.type === 'screen-share-invite') {
      const invite = event as ScreenShareInviteEvent;
      // Nicht selbst-einladen
      if (invite.hostUserId === currentUser?.id) return;
      // Nur wenn ich in der invited-Liste bin
      if (!invite.invitedUserIds.includes(currentUser?.id ?? '')) return;
      // Doppelte Invites unterdruecken
      setActiveInvites((prev) => {
        if (prev.some((p) => p.sessionId === invite.sessionId)) return prev;
        return [...prev, invite];
      });
      // Sound abspielen — kurzer Two-Tone-Ding via Web Audio API
      try { playInviteSound(); } catch { /* Audio-Permission verweigert, egal */ }
    } else if (event?.type === 'screen-share-ended') {
      setActiveInvites((prev) => prev.filter((p) => p.sessionId !== event.sessionId));
    }
  });

  if (activeInvites.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {activeInvites.map((inv) => (
        <InvitePopup
          key={inv.sessionId}
          invite={inv}
          onDismiss={() => setActiveInvites((prev) => prev.filter((p) => p.sessionId !== inv.sessionId))}
        />
      ))}
    </div>
  );
}

function InvitePopup({
  invite,
  onDismiss,
}: {
  invite: ScreenShareInviteEvent;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const decideRef = useRef<'accept' | 'decline' | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (!decideRef.current) handleDecline();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAccept() {
    if (busy) return;
    decideRef.current = 'accept';
    setBusy('accept');
    router.push(`/screen-share/${invite.sessionId}`);
    // onDismiss verzoegert damit User nicht zwischen 2 Klicks Routen-Switch sieht
    setTimeout(onDismiss, 250);
  }

  async function handleDecline() {
    if (busy) return;
    decideRef.current = 'decline';
    setBusy('decline');
    try { await screenShareApi.decline(invite.sessionId); } catch { /* ignore */ }
    onDismiss();
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-fade-in-down">
      <div className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
          <Monitor className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            🖥 {invite.hostName} teilt seinen Bildschirm
          </div>
          {invite.sessionName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              "{invite.sessionName}"
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
            {invite.voiceEnabled && (
              <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" /> Voice-Chat</span>
            )}
            {invite.audioEnabled && (
              <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" /> mit Audio</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={handleDecline}
          disabled={!!busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Ablehnen
        </button>
        <button
          onClick={handleAccept}
          disabled={!!busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" /> Beitreten
        </button>
      </div>
      <div
        className={cn(
          'h-1 bg-gray-100 dark:bg-white/5',
          secondsLeft <= 5 && 'bg-red-100 dark:bg-red-900/30',
        )}
      >
        <div
          className={cn(
            'h-full transition-all bg-primary-500',
            secondsLeft <= 5 && 'bg-red-500',
          )}
          style={{ width: `${(secondsLeft / 30) * 100}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-400 text-center pb-1">
        Auto-Ablehnen in {secondsLeft}s
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filapen Send — Toast-Popup wenn jemand uns Dateien sendet
// Stiller Toast unten rechts mit Sender, Anzahl, Groesse + "Zum Inbox"
// ---------------------------------------------------------------------------
function FilapenSendPopupListener() {
  const currentUser = useAuthStore((s) => s.user);
  const router = useRouter();
  const [received, setReceived] = useState<FilapenSendReceivedEvent[]>([]);

  useEventListener(({ event }: { event: any }) => {
    if (event?.type !== 'filapen-send-received') return;
    const ev = event as FilapenSendReceivedEvent;
    if (ev.senderUserId === currentUser?.id) return; // nicht selber
    if (!ev.recipientUserIds.includes(currentUser?.id ?? '')) return; // nicht fuer mich
    setReceived((prev) => {
      if (prev.some((p) => p.transferId === ev.transferId)) return prev;
      return [...prev, ev];
    });
    try { playInviteSound(); } catch { /* ignore */ }
  });

  function dismiss(id: string) {
    setReceived((prev) => prev.filter((p) => p.transferId !== id));
  }

  if (received.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {received.map((ev) => (
        <div key={ev.transferId} className="rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-fade-in-down">
          <div className="flex items-start gap-3 p-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                📩 {ev.senderName} hat dir Dateien gesendet
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {ev.fileCount} {ev.fileCount === 1 ? 'Datei' : 'Dateien'} · {fmtSize(ev.totalSize)}
              </div>
              {ev.message && (
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic truncate">
                  "{ev.message}"
                </div>
              )}
            </div>
            <button onClick={() => dismiss(ev.transferId)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => { router.push('/send'); dismiss(ev.transferId); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              <Download className="h-3.5 w-3.5" /> Zum Inbox
            </button>
            <button
              onClick={() => dismiss(ev.transferId)}
              className="flex-1 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 border-l border-gray-100 dark:border-white/5"
            >
              Spaeter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sound — Two-Tone-Ding via Web Audio API (kein extra Asset noetig)
// ---------------------------------------------------------------------------
function playInviteSound() {
  // @ts-ignore — webkitAudioContext fuer aeltere Safari
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const tones = [880, 1175]; // A5 → D6, freundlich + erkennbar
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const start = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.start(start);
    osc.stop(start + 0.3);
  });
  // Context nach 1s schliessen damit kein Memory-Leak
  setTimeout(() => ctx.close().catch(() => {}), 1000);
}
