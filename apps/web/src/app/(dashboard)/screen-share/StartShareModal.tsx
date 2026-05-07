'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Users, Mic, Volume2, Search, Loader2, Link2, Copy, Lock, Check } from 'lucide-react';
import { screenShareApi, broadcastInvite, type PublicLinkResponse } from '@/lib/screen-share';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: string;
  status: string;
  lastActiveAt?: string | null;
}

export function StartShareModal({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessionName, setSessionName] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Voice an als Default — User wollte das
  const [starting, setStarting] = useState(false);
  // Externer Gast-Link Optionen
  const [createGuestLink, setCreateGuestLink] = useState(false);
  const [guestPassword, setGuestPassword] = useState('');
  // Nach Start gesetzt wenn Link erstellt wurde — zeigt Result-View
  const [linkResult, setLinkResult] = useState<{ link: PublicLinkResponse; sessionId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Team-Mitglieder laden
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/admin/team`, { headers: getAuthHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        if (cancelled) return;
        const list: TeamMember[] = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : [];
        // Aktuellen User aus der Liste filtern (kann sich nicht selbst einladen)
        setMembers(list.filter((m) => m.id !== currentUser?.id));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // ESC schliesst
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`).toLowerCase();
      return name.includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, search]);

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filteredMembers.map((m) => m.id)));
  const clearAll = () => setSelected(new Set());

  function isOnline(m: TeamMember): boolean {
    if (!m.lastActiveAt) return false;
    const ms = Date.now() - new Date(m.lastActiveAt).getTime();
    return ms < 5 * 60 * 1000; // 5 Minuten Toleranz
  }

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      const invitedUserIds = Array.from(selected);
      const res = await screenShareApi.start({
        sessionName: sessionName.trim() || undefined,
        audioEnabled,
        voiceEnabled,
        invitedUserIds,
      });
      // Sofort an alle in der Org broadcasten — eingeladene User kriegen Popup,
      // andere ignorieren das Event (siehe InvitePopupListener-Filter).
      if (invitedUserIds.length > 0 && currentUser) {
        const hostName = currentUser.name
          || [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim()
          || currentUser.email.split('@')[0];
        broadcastInvite({
          type: 'screen-share-invite',
          sessionId: res.session.id,
          hostUserId: currentUser.id,
          hostName,
          hostAvatarUrl: currentUser.avatarUrl,
          sessionName: res.session.sessionName,
          voiceEnabled: res.session.voiceEnabled,
          audioEnabled: res.session.audioEnabled,
          invitedUserIds,
          startedAt: res.session.startedAt,
        });
      }
      // Externer Gast-Link erstellen falls gewuenscht — Modal zeigt dann
      // den Link statt direkt zur Viewer-Page zu navigieren. User kann
      // den Link kopieren + dann selbst zur Session.
      if (createGuestLink) {
        try {
          const link = await screenShareApi.createPublicLink(
            res.session.id,
            guestPassword.trim() || undefined,
          );
          setLinkResult({ link, sessionId: res.session.id });
          setStarting(false);
          return; // NICHT navigieren — User schaut sich den Link erst an
        } catch (e: any) {
          // Wenn Link-Erstellung fehlschlaegt: Session ist trotzdem aktiv.
          // Wir loggen + zeigen Hinweis aber lassen den User trotzdem rein.
          // eslint-disable-next-line no-alert
          window.alert(`Session gestartet, aber Link-Erstellung fehlgeschlagen: ${e.message}\n\nDu kannst den Link jederzeit ueber den Link-Button in der Toolbar erstellen.`);
        }
      }
      onStarted(res.session.id);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(`Sharing-Start fehlgeschlagen: ${e.message}`);
      setStarting(false);
    }
  }

  // Link-Result-View: nach erfolgreichem Start mit createGuestLink=true
  if (linkResult) {
    const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${linkResult.link.token}`;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative z-[5] w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Session läuft — Link bereit</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Kopier den Link und schick ihn deinem Gast.</p>
          </div>
          <div className="p-6 space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-3 py-2.5 text-xs break-all font-mono text-primary-600 dark:text-primary-300">
              {fullUrl}
            </div>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 px-4 py-2.5 text-sm font-medium"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Kopiert!' : 'Link kopieren'}
            </button>
            {linkResult.link.passwordRequired && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                ⚠ Vergiss nicht das Passwort separat an den Gast zu schicken.
              </div>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Gueltig bis {new Date(linkResult.link.expiresAt).toLocaleString('de-DE')} · 4h
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              Schliessen
            </button>
            <button
              onClick={() => onStarted(linkResult.sessionId)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white"
            >
              <Users className="h-3.5 w-3.5" /> Zur Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-[5] w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white">
            Bildschirm teilen
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Session-Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Session-Titel (optional)
            </label>
            <input
              autoFocus
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="z.B. Sprint Review, Design Sync, Quartalsplanung …"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 cursor-pointer">
              <div className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                voiceEnabled
                  ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02]',
              )}>
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => setVoiceEnabled(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <Mic className="h-4 w-4 text-primary-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Voice-Chat</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Mikrofone aktiv</div>
                </div>
              </div>
            </label>
            <label className="flex-1 cursor-pointer">
              <div className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                audioEnabled
                  ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02]',
              )}>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <Volume2 className="h-4 w-4 text-primary-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Bildschirm-Audio</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Tab/System-Sound mitteilen</div>
                </div>
              </div>
            </label>
          </div>

          {/* Externer Gast-Link */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Externer Gast-Link
            </label>
            <label className={cn(
              'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all',
              createGuestLink
                ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02]',
            )}>
              <input
                type="checkbox"
                checked={createGuestLink}
                onChange={(e) => setCreateGuestLink(e.target.checked)}
                className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
              />
              <Link2 className="h-4 w-4 text-primary-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Auch externen Gast-Link erstellen
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Fuer Personen ohne Filapen-Account. 4h gueltig, optional Passwort. Kein Mic, nur zuschauen.
                </div>
                {createGuestLink && (
                  <div className="mt-2 flex items-center gap-2">
                    <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={guestPassword}
                      onChange={(e) => setGuestPassword(e.target.value)}
                      onClick={(e) => e.preventDefault()}
                      placeholder="Passwort optional (leer = offen)"
                      className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.05] px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* User-Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Mit wem teilen? ({selected.size} ausgewaehlt)
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={selectAll} className="text-primary-600 dark:text-primary-400 hover:underline">Alle</button>
                <span className="text-gray-300">·</span>
                <button onClick={clearAll} className="text-gray-500 dark:text-gray-400 hover:underline">Keine</button>
              </div>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Team-Mitglied suchen…"
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 max-h-[260px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
              {loading ? (
                <div className="p-6 flex items-center justify-center text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" /> Lade Team…
                </div>
              ) : error ? (
                <div className="p-4 text-xs text-red-600 dark:text-red-400">Team konnte nicht geladen werden: {error}</div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-6 text-xs text-gray-400 text-center italic">Keine Treffer</div>
              ) : (
                filteredMembers.map((m) => {
                  const isSel = selected.has(m.id);
                  const online = isOnline(m);
                  const displayName = m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email.split('@')[0];
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleUser(m.id)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {displayName}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{m.email}</div>
                      </div>
                      <span className={cn(
                        'text-[10px] inline-flex items-center gap-1',
                        online ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400',
                      )}>
                        <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-gray-300')} />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              Offline-User bekommen keine sofortige Benachrichtigung — sie sehen die Session beim naechsten Login.
              Externen Gast-Link kannst du in der Session generieren.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            Abbrechen
          </button>
          <button
            onClick={handleStart}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {starting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starte…</>
            ) : (
              <><Users className="h-3.5 w-3.5" /> Sharing starten</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
