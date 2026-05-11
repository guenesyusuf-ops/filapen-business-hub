'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useParticipants,
  VideoTrack,
  useChat,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState, type Participant } from 'livekit-client';
import {
  Mic, MicOff, Monitor, MonitorOff, MessageSquare, Users, X, Phone,
  Volume2, Maximize2, Send, Link2, Copy, Lock, Loader2,
} from 'lucide-react';
import '@livekit/components-styles';
import { screenShareApi, broadcastSessionEnded, type PublicLinkResponse } from '@/lib/screen-share';
import { cn } from '@/lib/utils';

interface Props {
  sessionId: string;
  sessionName: string | null;
  hostUserId: string;
  isHost: boolean;
  voiceEnabled: boolean;
  audioEnabled: boolean;
  livekitUrl: string;
  livekitToken: string;
  onLeave: () => void;
}

export default function ScreenShareRoom(props: Props) {
  // Diagnose-Log beim Mount — zeigt im Console welche LiveKit-Instanz wir
  // anpeilen + ob Token-Length plausibel ist. Hilft bei "engine not connected"
  // ohne weitere Symptome zu identifizieren ob Token/URL oder Netz Schuld sind.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(
      '[screen-share] connecting to LiveKit',
      { url: props.livekitUrl, tokenLength: props.livekitToken?.length, isHost: props.isHost },
    );
  }
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c18] text-white">
      <LiveKitRoom
        token={props.livekitToken}
        serverUrl={props.livekitUrl}
        connect
        audio={false}
        video={false}
        connectOptions={{ peerConnectionTimeout: 45000 }}
        options={{ adaptiveStream: true, dynacast: true }}
        onDisconnected={(reason) => {
          // eslint-disable-next-line no-console
          console.warn('[screen-share] LiveKitRoom disconnected', reason);
        }}
        onError={(e) => {
          // eslint-disable-next-line no-console
          console.error('[screen-share] LiveKitRoom error', e?.message, e);
        }}
      >
        <RoomAudioRenderer />
        <Inner {...props} />
      </LiveKitRoom>
    </div>
  );
}

function Inner({
  sessionId, sessionName, isHost, voiceEnabled, audioEnabled, hostUserId, onLeave,
}: Omit<Props, 'livekitUrl' | 'livekitToken'>) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [chatOpen, setChatOpen] = useState(true);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Eigenes Connection-Tracking ueber RoomEvent — useConnectionState aus
  // @livekit/components-react triggerte in unserem Setup nicht zuverlaessig
  // (Loader hing ewig auf "Verbinde mit LiveKit").
  const [isRoomConnected, setIsRoomConnected] = useState(room.state === ConnectionState.Connected);

  // Connection-State direkt am Room mitlesen + auf Events reagieren
  useEffect(() => {
    if (room.state === ConnectionState.Connected) setIsRoomConnected(true);
    const onConnected = () => setIsRoomConnected(true);
    const onDisconnected = () => setIsRoomConnected(false);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  // ScreenShare-Tracks aller Teilnehmer holen. WICHTIG: ALLE Tracks holen
  // (auch lokale), dann manuell filtern — `useTracks` mit `{ onlySubscribed }`
  // verhaelt sich teilweise inkonsistent zwischen Versionen.
  const allScreenTracks = useTracks([Track.Source.ScreenShare]);
  // Der Stream den die Hauptflaeche zeigt = der EINE remote Screen-Track.
  // Lokale Tracks NIE im Main-View rendern — das produziert pixel-recursion
  // wenn Host den eigenen Tab/Bildschirm capturet.
  const remoteScreen = allScreenTracks.find((t) => !t.participant?.isLocal && t.publication?.isSubscribed);
  // Lokaler Track nur fuer kleine Self-Preview unten rechts (off by default).
  const localScreen = allScreenTracks.find((t) => t.participant?.isLocal);

  // Sync screenOn-State mit der tatsaechlichen LiveKit-Publikation —
  // deckt Browser-Stop ("Freigabe beenden"-Button), Reconnect, Tab-Close ab.
  useEffect(() => {
    const enabled = localParticipant.isScreenShareEnabled;
    setScreenOn(enabled);
    // eslint-disable-next-line no-console
    console.log('[screen-share] localParticipant.isScreenShareEnabled =', enabled);
  }, [localParticipant.isScreenShareEnabled]);

  // Diagnose-Log fuer Remote-Subscription — hilft "Gast sieht nichts" Fragen
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[screen-share] tracks update', allScreenTracks.map((t) => ({
      participant: t.participant?.identity,
      isLocal: t.participant?.isLocal,
      subscribed: t.publication?.isSubscribed,
      source: t.source,
    })));
  }, [allScreenTracks]);

  // Lokale Preview off by default — Host kann sie an/aus toggeln
  const [showLocalPreview, setShowLocalPreview] = useState(false);
  // Capture-Surface-Warnung wenn Host eigenen Tab/Monitor capturet
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);

  // KEINE useEffect-Publikation. KEINE Retries. KEIN Auto-Start.
  // `setScreenShareEnabled()` darf ausschliesslich aus einem echten Click
  // gerufen werden (siehe handleStartShare unten).

  // Sync micOn state mit LiveKit
  useEffect(() => {
    setMicOn(localParticipant.isMicrophoneEnabled);
  }, [localParticipant.isMicrophoneEnabled]);

  async function toggleMic() {
    if (!voiceEnabled) return;
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert('Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.');
    }
  }

  /**
   * Start Screen-Share. MUSS aus einem echten Click-Handler kommen — keine
   * useEffect/setTimeout/Retry-Wraps. Sonst zerstoert der Browser die
   * User-Activation und blockt getDisplayMedia.
   */
  async function handleStartShare() {
    if (!isHost) return;
    // eslint-disable-next-line no-console
    console.log('[screen-share] start clicked');
    setShareError(null);
    setCaptureWarning(null);
    try {
      // eslint-disable-next-line no-console
      console.log('[screen-share] publishing screen (audio=' + audioEnabled + ')');
      await localParticipant.setScreenShareEnabled(true, { audio: audioEnabled });
      // eslint-disable-next-line no-console
      console.log('[screen-share] local track published');

      // Capture-Surface inspizieren → Mirror-Warnung zeigen
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const settings = pub?.track?.mediaStreamTrack?.getSettings() as MediaTrackSettings & { displaySurface?: string };
      const surface = settings?.displaySurface;
      // eslint-disable-next-line no-console
      console.log('[screen-share] displaySurface =', surface);
      if (surface === 'browser') {
        // Tab-Sharing: wahrscheinlich rekursiv wenn unser eigener Tab gewaehlt wurde
        setCaptureWarning('Du teilst einen Browser-Tab. Wenn das der Filapen-Tab ist, sehen Andere einen Spiegel-Effekt. Wechsle ggf. zu einem anderen Fenster.');
      } else if (surface === 'monitor') {
        setCaptureWarning('Du teilst den gesamten Bildschirm. Wenn dieses Filapen-Fenster sichtbar ist, sehen Andere einen Spiegel. Minimiere Filapen oder schiebe es ausserhalb des geteilten Bereichs.');
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[screen-share] start failed', e?.name, e?.message);
      // Spezifische Fehler — keine Retries, sondern klare Hinweise
      const msg =
        e?.name === 'NotAllowedError' ? 'Bildschirm-Auswahl abgebrochen oder Berechtigung verweigert.' :
        e?.name === 'NotFoundError' ? 'Kein teilbarer Bildschirm/Fenster gefunden.' :
        e?.name === 'AbortError' ? 'Bildschirm-Auswahl abgebrochen.' :
        String(e?.message || '').toLowerCase().includes('engine not connected')
          ? 'WebRTC-Verbindung nicht hergestellt. Pruefe Internet/Firewall und lade neu.'
          : `Konnte Bildschirm nicht starten: ${e?.message ?? 'Unbekannter Fehler'}`;
      setShareError(msg);
    }
  }

  /** Stop Screen-Share. Beendet Session nicht — Host kann nochmal neu starten. */
  async function handleStopShare() {
    if (!isHost) return;
    // eslint-disable-next-line no-console
    console.log('[screen-share] stop clicked');
    try {
      await localParticipant.setScreenShareEnabled(false);
      setCaptureWarning(null);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[screen-share] stop failed', e);
      setShareError(`Konnte Bildschirm nicht stoppen: ${e?.message ?? 'Unbekannter Fehler'}`);
    }
  }

  async function handleLeave() {
    if (busy) return;
    setBusy(true);
    try {
      if (isHost) {
        await screenShareApi.end(sessionId);
        broadcastSessionEnded(sessionId);
      } else {
        await screenShareApi.leave(sessionId);
      }
      await room.disconnect();
    } catch { /* ignore */ }
    onLeave();
  }

  // Liste der Teilnehmer (deduplicate)
  const allParticipants = participants;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10 bg-black/40 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <Monitor className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {sessionName || 'Bildschirm-Session'}
            </div>
            <div className="text-[10px] text-gray-400">
              {isHost ? 'Du teilst' : 'Du schaust zu'}
              {voiceEnabled && ' · Voice-Chat'}
              {audioEnabled && ' · mit Audio'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Mic-Toggle */}
          {voiceEnabled && (
            <button
              onClick={toggleMic}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                micOn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white',
              )}
              title={micOn ? 'Mikro stummschalten' : 'Mikro aktivieren'}
            >
              {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              {micOn ? 'Mic an' : 'Mic aus'}
            </button>
          )}
          {/* Screen-Toggle (nur Host) — getrennte Start/Stop-Click-Handler
              damit getDisplayMedia immer eine frische User-Activation hat */}
          {isHost && (
            <button
              onClick={screenOn ? handleStopShare : handleStartShare}
              disabled={!isRoomConnected}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                screenOn
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white',
                'disabled:opacity-50',
              )}
            >
              {screenOn ? <Monitor className="h-3.5 w-3.5" /> : <MonitorOff className="h-3.5 w-3.5" />}
              {screenOn ? 'Sharing an' : 'Bildschirm waehlen'}
            </button>
          )}
          {/* Lokale Preview-Toggle (nur Host wenn am Sharen) */}
          {isHost && screenOn && (
            <button
              onClick={() => setShowLocalPreview((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                showLocalPreview ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20',
              )}
              title="Eigene Vorschau ein/aus"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Externer Link (nur Host) */}
          {isHost && (
            <button
              onClick={() => setLinkOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20"
              title="Externen Gast-Link erstellen"
            >
              <Link2 className="h-3.5 w-3.5" /> Link
            </button>
          )}
          {/* Teilnehmer */}
          <button
            onClick={() => setParticipantsOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
              participantsOpen ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20',
            )}
          >
            <Users className="h-3.5 w-3.5" /> {allParticipants.length}
          </button>
          {/* Chat-Toggle */}
          <button
            onClick={() => setChatOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
              chatOpen ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20',
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </button>
          {/* Verlassen */}
          <button
            onClick={handleLeave}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5 rotate-[135deg]" /> {isHost ? 'Beenden' : 'Verlassen'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stream */}
        <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
          {/* PRIORITAET 1: Remote Screen anzeigen (= was Viewer sehen) */}
          {remoteScreen ? (
            <VideoTrack trackRef={remoteScreen} className="max-w-full max-h-full object-contain" />
          ) : isHost && screenOn ? (
            /* Host teilt aktiv — eigenen Stream NIE gross rendern (Pixel-
               Recursion bei Tab/Monitor-Share). Stattdessen Status-Panel
               + optionale kleine Self-Preview. */
            <div className="text-center text-gray-300 text-sm max-w-lg px-6">
              <div className="inline-flex h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 items-center justify-center mb-4">
                <Monitor className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="text-base font-medium text-white">Du teilst deinen Bildschirm</div>
              <div className="text-xs text-gray-400 mt-1">
                Andere Teilnehmer sehen jetzt deinen Bildschirm live.
              </div>
              {captureWarning && (
                <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 text-left">
                  ⚠ {captureWarning}
                </div>
              )}
              <button
                onClick={handleStopShare}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white"
              >
                <MonitorOff className="h-3.5 w-3.5" /> Teilen stoppen
              </button>
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm max-w-md px-6">
              {isHost ? (
                <>
                  <Monitor className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <div>Waehle einen Bildschirm zum Teilen</div>
                  {!isRoomConnected && (
                    <div className="mt-2 text-[11px] text-gray-500 inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> verbinde mit LiveKit …
                    </div>
                  )}
                  {shareError && (
                    <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 text-left">
                      {shareError}
                    </div>
                  )}
                  <button
                    onClick={handleStartShare}
                    disabled={!isRoomConnected}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 px-3 py-1.5 text-xs text-white"
                  >
                    <Monitor className="h-3.5 w-3.5" /> Bildschirm waehlen
                  </button>
                  <div className="mt-3 text-[10px] text-gray-500">
                    Tipp: Teile NICHT diesen Tab oder dieses Browser-Fenster —
                    sonst sehen Andere einen Spiegel-Effekt.
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                  <div>
                    {!isRoomConnected
                      ? 'Verbinde mit LiveKit…'
                      : 'Warte auf Bildschirm vom Host…'}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Kleine Self-Preview unten rechts — off by default, Host kann
              im Header an/aus toggeln. Bewusst klein gehalten damit
              Rekursion praktisch nicht sichtbar ist. */}
          {isHost && screenOn && showLocalPreview && localScreen && (
            <div className="absolute bottom-3 right-3 w-48 rounded-lg overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-black">
              <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[9px] uppercase tracking-wider text-emerald-300">
                Du
              </div>
              <VideoTrack trackRef={localScreen} className="w-full h-auto" />
            </div>
          )}
        </div>

        {/* Sidebar — Chat oder Teilnehmer */}
        {(chatOpen || participantsOpen) && (
          <aside className="w-[320px] flex-shrink-0 border-l border-white/10 bg-[#11141f] flex flex-col">
            {participantsOpen ? (
              <ParticipantsPanel participants={allParticipants} hostIdentity={hostUserId} />
            ) : (
              <ChatPanel />
            )}
          </aside>
        )}
      </div>

      {/* Externer-Link-Modal (nur Host) */}
      {linkOpen && isHost && (
        <PublicLinkModal sessionId={sessionId} onClose={() => setLinkOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat-Panel (LiveKit Data-Channel)
// ---------------------------------------------------------------------------
function ChatPanel() {
  const { chatMessages, send } = useChat();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatMessages]);

  function handleSend() {
    if (!draft.trim() || !send) return;
    send(draft.trim());
    setDraft('');
  }

  return (
    <>
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-white/5">
        Chat
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {chatMessages.length === 0 && (
          <div className="text-xs text-gray-500 italic text-center mt-6">
            Noch keine Nachrichten. Sag Hallo!
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className="text-xs">
            <div className="text-[10px] text-gray-500 mb-0.5">
              {m.from?.name || m.from?.identity || 'Anonym'} · {new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 text-gray-100 break-words">
              {m.message}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 p-2 flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Nachricht schreiben…"
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          className="rounded-lg bg-primary-600 hover:bg-primary-500 px-2 disabled:opacity-50"
          title="Senden"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Teilnehmer-Liste mit Speaking-Indikator
// ---------------------------------------------------------------------------
function ParticipantsPanel({ participants, hostIdentity }: { participants: Participant[]; hostIdentity: string }) {
  return (
    <>
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-white/5">
        Teilnehmer ({participants.length})
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {participants.map((p) => {
          const isHost = p.identity === hostIdentity;
          const isGuest = p.identity.startsWith('guest-');
          const speaking = p.isSpeaking;
          const micOn = p.isMicrophoneEnabled;
          return (
            <div
              key={p.identity}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                speaking ? 'bg-emerald-900/30 ring-1 ring-emerald-500/40' : 'bg-white/5',
              )}
            >
              <div className={cn(
                'relative h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                isHost ? 'bg-gradient-to-br from-primary-500 to-primary-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700',
              )}>
                {(p.name || p.identity).charAt(0).toUpperCase()}
                {speaking && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name || p.identity}</div>
                <div className="text-[10px] text-gray-400">
                  {isHost ? 'Host' : isGuest ? 'Gast' : 'Viewer'}
                </div>
              </div>
              {micOn ? (
                <Mic className={cn('h-3 w-3', speaking ? 'text-emerald-400' : 'text-gray-400')} />
              ) : (
                <MicOff className="h-3 w-3 text-gray-500" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Externer-Link-Modal
// ---------------------------------------------------------------------------
function PublicLinkModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [link, setLink] = useState<PublicLinkResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const r = await screenShareApi.createPublicLink(sessionId, password.trim() || undefined);
      setLink(r);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  const fullUrl = link
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${link.token}`
    : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-[5] w-full max-w-md rounded-2xl bg-[#1a1d2e] shadow-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <h3 className="text-base font-semibold">Externer Gast-Link</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {!link ? (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Passwort (optional)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="leer lassen fuer offenen Link"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={create}
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Link erstellen
              </button>
              <p className="text-[11px] text-gray-400">
                Link gilt 4 Stunden. Gaeste koennen nur zuschauen, nicht selbst teilen.
                Mikro-Zugriff ist deaktiviert.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs break-all font-mono text-primary-300">
                {fullUrl}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm"
                >
                  <Copy className="h-3.5 w-3.5" /> {copied ? 'Kopiert!' : 'Link kopieren'}
                </button>
              </div>
              {link.passwordRequired && (
                <p className="text-[11px] text-amber-300">
                  ⚠ Passwort separat uebermitteln — der Gast braucht es zum Beitreten.
                </p>
              )}
              <p className="text-[11px] text-gray-400">
                Gueltig bis {new Date(link.expiresAt).toLocaleString('de-DE')}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
