'use client';

/**
 * Pro-Features-Skeleton fuer das Whiteboard.
 *
 * Aktivierung nach Liveblocks-Upgrade:
 *   1. Liveblocks-Dashboard → Plan auf Pro upgraden
 *   2. Railway env: LIVEBLOCKS_TIER=pro setzen
 *   3. Diese Datei in WhiteboardCanvas einbinden:
 *      import { ProCommentsButton } from './WhiteboardProFeatures';
 *      → in MultiplayerCanvas, neben EntityDockPanel rendern.
 *
 * Was die Pro-Features konkret machen:
 *
 * COMMENTS + THREADS (Liveblocks Comments)
 *   - Klick auf eine Stelle im Canvas → Kommentar-Pin erscheint
 *   - Threaded Replies, @-mentions, Reactions
 *   - Persistiert automatisch in Liveblocks (kein eigener Server-Code)
 *
 * INBOX-NOTIFICATIONS
 *   - Bell-Icon in der Toolbar mit Unread-Counter
 *   - Liste aller @-Mentions, neuen Comments, Thread-Replies
 *   - Klick navigiert direkt auf den entsprechenden Comment
 *
 * MULTI-ROOM-TOKENS
 *   - Beim Login bekommt der User EIN Token fuer alle seine Boards
 *   - Wechsel zwischen Boards passiert ohne weiteren Auth-Roundtrip
 *   - Backend liefert das via /v2/authorize-user (siehe whiteboard.service.ts)
 *
 * Voraussetzungen heute:
 *   ✓ @liveblocks/react-ui ist installiert
 *   ✓ Backend hat tier-aware Auth (free | pro)
 *   ✓ Tier-Info kommt im liveblocksAuth-Response zum Frontend
 *
 * Was noch fehlt fuer Production-Ready Pro:
 *   - <Composer> oben einbinden + CSS importieren
 *   - Comment-Threads als Pin-Marker auf dem tldraw-Canvas anzeigen
 *   - InboxNotificationList fuer die App-weite Bell
 *   - Webhook-Endpoint fuer thread-events (E-Mail bei @mention)
 */

import { Sparkles } from 'lucide-react';

/**
 * Platzhalter-Button — wird durch echten Comments-Composer ersetzt
 * sobald LIVEBLOCKS_TIER=pro aktiv ist. Der Button selber tut noch
 * nichts; er signalisiert dem User "diese Features sind bald da".
 */
export function ProCommentsButton({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute top-16 right-4 z-20 rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-xl border border-amber-200 dark:border-amber-900/40 p-3 max-w-[260px] animate-fade-in">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
        <Sparkles className="h-3 w-3" />
        Pro-Features bereit
      </div>
      <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
        Comments + Threads + Inbox-Notifications koennen jetzt aktiviert werden.
        Sag Bescheid wenn ich die <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-mono">&lt;Composer&gt;</code> + Pin-Marker einbauen soll.
      </p>
    </div>
  );
}
