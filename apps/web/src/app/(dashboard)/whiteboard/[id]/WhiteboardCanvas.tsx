'use client';

// tldraw bringt seine eigenen Styles mit — die muessen in den Browser geladen
// werden bevor das Canvas rendert, sonst sieht es kaputt aus.
import 'tldraw/tldraw.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, Loader2, MoreHorizontal, History, Trash2 } from 'lucide-react';
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  loadSnapshot,
  getSnapshot,
} from 'tldraw';
import { whiteboardApi, type WhiteboardDetail } from '@/lib/whiteboard';
import { LiveblocksProvider, RoomProvider, useRoom, useOthers } from '@liveblocks/react/suspense';
import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import { cn } from '@/lib/utils';

interface Props { board: WhiteboardDetail }

/**
 * Whiteboard-Canvas mit tldraw-Editor + Liveblocks-Multiplayer.
 *
 * Architektur:
 *  - tldraw rendert das Canvas (Shapes, Pen, Connector, Sticky etc.)
 *  - Liveblocks-Room-Provider haelt die Multiplayer-Verbindung
 *  - Yjs-CRDT (via Liveblocks) syncrt die Edits in Real-time
 *  - Auto-Save schreibt alle 30s einen Snapshot in unsere DB (R2 fuer
 *    Versions-History + Backup falls Liveblocks ausfaellt)
 *
 * Single-User-Fallback: wenn LIVEBLOCKS_PUBLIC_KEY nicht gesetzt ist,
 * lassen wir Liveblocks weg und verwenden nur den lokalen tldraw +
 * Auto-Save. Der User merkt nichts ausser dass keine Cursors anderer
 * User auftauchen.
 */
export function WhiteboardCanvas({ board }: Props) {
  const publicKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;
  // Wenn kein Liveblocks-Key konfiguriert ist → Single-User-Mode.
  // Praktisch fuer lokale Dev-Umgebung und als Fallback.
  if (!publicKey) {
    return <SingleUserCanvas board={board} />;
  }
  return (
    <LiveblocksProvider
      // Auth via unseren Backend-Endpoint — Backend nutzt LIVEBLOCKS_SECRET_KEY
      // und liefert ein room-scoped Token mit User-Identity (Name, Avatar) zurueck.
      // Liveblocks API verlangt entweder publicApiKey ODER authEndpoint, nicht beide.
      authEndpoint={async (room?: string) => {
        if (!room) throw new Error('No room provided');
        const r = await whiteboardApi.liveblocksAuth(board.id);
        if (!r.token) throw new Error(r.reason || 'Liveblocks not configured');
        return { token: r.token };
      }}
    >
      <RoomProvider id={board.liveblocksRoomId || `wb-${board.id}`} initialPresence={{}}>
        <MultiplayerCanvas board={board} />
      </RoomProvider>
    </LiveblocksProvider>
  );
}

// ---------------------------------------------------------------------------
// Single-User Mode (kein Liveblocks)
// ---------------------------------------------------------------------------
function SingleUserCanvas({ board }: { board: WhiteboardDetail }) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedJsonRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tldraw-Snapshot beim Mount laden falls vorhanden
  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    if (board.state && Object.keys(board.state).length > 0 && !board.state.__template) {
      try {
        loadSnapshot(ed.store, board.state as TLEditorSnapshot);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Snapshot load failed (corrupted state?):', e);
      }
    }
    lastSavedJsonRef.current = JSON.stringify(getSnapshot(ed.store));
  }, [board.state]);

  // Auto-Save Loop: alle 30s pruefen ob sich was geaendert hat
  useEffect(() => {
    if (!editor) return;
    const tick = async () => {
      const snap = getSnapshot(editor.store);
      const json = JSON.stringify(snap);
      if (json === lastSavedJsonRef.current) {
        // Nichts geaendert — Timer einfach neu setzen
        saveTimerRef.current = setTimeout(tick, 30_000);
        return;
      }
      setSaveState('saving');
      try {
        await whiteboardApi.update(board.id, { state: snap });
        lastSavedJsonRef.current = json;
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (e) {
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 4000);
      }
      saveTimerRef.current = setTimeout(tick, 30_000);
    };
    saveTimerRef.current = setTimeout(tick, 30_000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editor, board.id]);

  // Beim Unmount letzten Stand sichern (fire-and-forget)
  useEffect(() => {
    return () => {
      if (!editor) return;
      const snap = getSnapshot(editor.store);
      const json = JSON.stringify(snap);
      if (json !== lastSavedJsonRef.current) {
        whiteboardApi.update(board.id, { state: snap }).catch(() => {});
      }
    };
  }, [editor, board.id]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#fafafa] dark:bg-[#0c0e1c]">
      <Toolbar
        title={board.title}
        saveState={saveState}
        userCount={1}
        onBack={() => router.push('/whiteboard')}
        onTitleChange={async (t) => { await whiteboardApi.update(board.id, { title: t }); }}
        onDelete={async () => {
          // eslint-disable-next-line no-alert
          if (!window.confirm('Whiteboard wirklich löschen?')) return;
          await whiteboardApi.remove(board.id);
          router.push('/whiteboard');
        }}
      />
      <div className="flex-1 relative">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiplayer Canvas (mit Liveblocks)
// ---------------------------------------------------------------------------
function MultiplayerCanvas({ board }: { board: WhiteboardDetail }) {
  const router = useRouter();
  const room = useRoom();
  const others = useOthers();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedJsonRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Yjs-Doc fuer CRDT-Sync. tldraw kennt von sich aus kein Yjs — wir
  // syncen manuell: Yjs-Map haelt das tldraw-Snapshot, jeder lokale Edit
  // schreibt ins Map, jeder Remote-Update wird in tldraw geladen.
  const ydoc = useMemo(() => new Y.Doc(), []);
  const yProvider = useMemo(() => new LiveblocksYjsProvider(room as any, ydoc), [room, ydoc]);
  const yState = useMemo(() => ydoc.getMap('tldraw-state'), [ydoc]);

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    // Initial-Load: bevorzuge Yjs-Map (live state), fallback auf DB-Snapshot
    const yStateValue = yState.get('snapshot') as TLEditorSnapshot | undefined;
    if (yStateValue) {
      try { loadSnapshot(ed.store, yStateValue); } catch { /* ignore */ }
    } else if (board.state && Object.keys(board.state).length > 0 && !board.state.__template) {
      try { loadSnapshot(ed.store, board.state as TLEditorSnapshot); } catch { /* ignore */ }
    }
    lastSavedJsonRef.current = JSON.stringify(getSnapshot(ed.store));

    // Lokal → Yjs: bei jeder Editor-Aenderung in Yjs-Map schreiben
    const onLocalChange = () => {
      const snap = getSnapshot(ed.store);
      yState.set('snapshot', snap);
    };
    ed.store.listen(onLocalChange, { source: 'user' });

    // Yjs → Lokal: wenn andere User Aenderungen machen, ins tldraw laden
    yState.observe((event) => {
      if (event.transaction.local) return; // unser eigenes update
      const snap = yState.get('snapshot') as TLEditorSnapshot | undefined;
      if (snap) {
        try { loadSnapshot(ed.store, snap); } catch { /* ignore */ }
      }
    });
  }, [board.state, yState]);

  // Auto-Save in DB (Backup, unabhaengig von Liveblocks)
  useEffect(() => {
    if (!editor) return;
    const tick = async () => {
      const snap = getSnapshot(editor.store);
      const json = JSON.stringify(snap);
      if (json === lastSavedJsonRef.current) {
        saveTimerRef.current = setTimeout(tick, 30_000);
        return;
      }
      setSaveState('saving');
      try {
        await whiteboardApi.update(board.id, { state: snap });
        lastSavedJsonRef.current = json;
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 4000);
      }
      saveTimerRef.current = setTimeout(tick, 30_000);
    };
    saveTimerRef.current = setTimeout(tick, 30_000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      yProvider.destroy();
    };
  }, [editor, board.id, yProvider]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#fafafa] dark:bg-[#0c0e1c]">
      <Toolbar
        title={board.title}
        saveState={saveState}
        userCount={others.length + 1}
        onBack={() => router.push('/whiteboard')}
        onTitleChange={async (t) => { await whiteboardApi.update(board.id, { title: t }); }}
        onDelete={async () => {
          // eslint-disable-next-line no-alert
          if (!window.confirm('Whiteboard wirklich löschen?')) return;
          await whiteboardApi.remove(board.id);
          router.push('/whiteboard');
        }}
      />
      <div className="flex-1 relative">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar (oben)
// ---------------------------------------------------------------------------
function Toolbar({
  title, saveState, userCount, onBack, onTitleChange, onDelete,
}: {
  title: string;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  userCount: number;
  onBack: () => void;
  onTitleChange: (t: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200/60 dark:border-white/8 bg-white/80 dark:bg-[#0c0e1c]/80 backdrop-blur-sm z-50">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          title="Zurück zur Liste"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={async () => {
              setEditingTitle(false);
              if (titleDraft.trim() && titleDraft !== title) await onTitleChange(titleDraft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false); }
            }}
            className="font-display-serif text-lg font-medium bg-transparent border-b-2 border-primary-500 focus:outline-none text-gray-900 dark:text-white px-1"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
            className="font-display-serif text-lg font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
            title="Titel bearbeiten"
          >
            {title}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Save-State */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 min-w-[100px] justify-end">
          {saveState === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin" /> Speichern…</>)}
          {saveState === 'saved' && (<><Save className="h-3 w-3 text-emerald-500" /> Gespeichert</>)}
          {saveState === 'error' && (<><span className="text-red-500">⚠</span> Fehler</>)}
          {saveState === 'idle' && (<>Auto-Save aktiv</>)}
        </div>

        {/* User-Indicator */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          userCount > 1
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400',
        )}>
          <Users className="h-3 w-3" />
          {userCount}
        </div>

        {/* More-Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Mehr"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 py-1 overflow-hidden animate-fade-in">
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Whiteboard löschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
