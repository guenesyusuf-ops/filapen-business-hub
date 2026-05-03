'use client';

// tldraw bringt seine eigenen Styles mit — die muessen in den Browser geladen
// werden bevor das Canvas rendert, sonst sieht es kaputt aus.
import 'tldraw/tldraw.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Users, Loader2, MoreHorizontal, History, Trash2,
  Search, ListTodo, ShoppingCart, Package, Plus, Sparkles,
} from 'lucide-react';
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  loadSnapshot,
  getSnapshot,
  createShapeId,
  toRichText,
} from 'tldraw';
import { whiteboardApi, type WhiteboardDetail } from '@/lib/whiteboard';
// Non-suspense Liveblocks API — sonst suspendieren useRoom/useOthers ohne
// passenden Suspense-Boundary in der Auth-Phase und der ganze Canvas zeigt
// permanent den dynamic-Loading-Spinner.
import { LiveblocksProvider, RoomProvider, useRoom, useOthers } from '@liveblocks/react';
import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import { cn } from '@/lib/utils';

interface Props { board: WhiteboardDetail }

// ---------------------------------------------------------------------------
// Helpers — Entity-Drop + Template-Scaffolding
// ---------------------------------------------------------------------------

const ENTITY_COLORS = {
  task: 'yellow' as const,
  order: 'blue' as const,
  product: 'green' as const,
};

/**
 * Erzeugt eine sticky-note-aehnliche Karte mit den Daten einer Filapen-
 * Entitaet (Task/Order/Product). Wir nutzen tldraw's 'note' Shape weil das
 * out-of-the-box Drag/Edit/Connect kann — keine Custom-Shape-Definition
 * noetig. Der Text formatiert die wichtigsten Felder. Click-to-Open ins
 * jeweilige Modul ueber Meta-Daten in shape.meta — Phase 4 polish.
 */
function dropEntityNote(
  editor: Editor,
  type: 'task' | 'order' | 'product',
  entity: any,
  pos?: { x: number; y: number },
) {
  // Position: Mittelpunkt der aktuellen Viewport falls keine Position kam
  const center = pos ?? editor.getViewportPageBounds().center;
  const lines = formatEntityLines(type, entity);

  editor.createShape({
    id: createShapeId(),
    type: 'note',
    x: center.x - 100,
    y: center.y - 100,
    props: {
      color: ENTITY_COLORS[type],
      richText: toRichText(lines.join('\n')),
      size: 'm',
    },
    meta: {
      filapenType: type,
      filapenId: entity.id,
    },
  });
}

function formatEntityLines(type: 'task' | 'order' | 'product', e: any): string[] {
  if (type === 'task') {
    const due = e.dueDate ? `Fällig: ${new Date(e.dueDate).toLocaleDateString('de-DE')}` : '';
    return [
      `[Task] ${e.title}`,
      e.projectName ? `Projekt: ${e.projectName}` : '',
      `Priorität: ${e.priority}`,
      e.columnName ? `Status: ${e.columnName}` : '',
      due,
    ].filter(Boolean);
  }
  if (type === 'order') {
    const status = e.shippedAt ? 'versendet' : e.paidAt ? 'bezahlt' : e.status;
    return [
      `[Bestellung] ${e.orderNumber}`,
      e.customerName || '',
      `${e.totalNet.toLocaleString('de-DE', { style: 'currency', currency: e.currency || 'EUR' })}`,
      `Status: ${status}`,
    ].filter(Boolean);
  }
  // product
  return [
    `[Produkt] ${e.productTitle}`,
    e.variantTitle && e.variantTitle !== 'Default Title' ? `Variante: ${e.variantTitle}` : '',
    e.sku ? `SKU: ${e.sku}` : '',
    e.price != null ? `${Number(e.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : '',
  ].filter(Boolean);
}

/**
 * Generiert initialen Canvas-Inhalt fuer ein Template. Wird beim ersten
 * Mount aufgerufen wenn board.state.__template gesetzt ist (Marker
 * vom Backend bei Create). Danach wird der Marker entfernt + der echte
 * Snapshot gespeichert.
 */
function applyTemplate(editor: Editor, template: string) {
  if (template === 'kanban') {
    // 3 Frames horizontal: To Do, Doing, Done
    const cols = [
      { name: 'To Do', color: 'grey' as const, x: 0 },
      { name: 'Doing', color: 'blue' as const, x: 600 },
      { name: 'Done', color: 'green' as const, x: 1200 },
    ];
    cols.forEach((c) => {
      const frameId = createShapeId();
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: c.x,
        y: 0,
        props: { w: 500, h: 800, name: c.name },
      });
      // 2 Sticky-Notes als Beispiel
      for (let i = 0; i < 2; i++) {
        editor.createShape({
          id: createShapeId(),
          type: 'note',
          x: c.x + 60 + (i % 2) * 220,
          y: 80 + i * 220,
          props: { color: c.color, richText: toRichText('Neue Karte'), size: 'm' },
        });
      }
    });
  } else if (template === 'brainstorm') {
    // Zentral-Frame + 6 Sticky-Notes als Spinne
    const frameId = createShapeId();
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: 0, y: 0,
      props: { w: 1400, h: 900, name: 'Brainstorm' },
    });
    const center = { x: 700, y: 450 };
    const colors = ['yellow', 'blue', 'green', 'orange', 'red', 'violet'] as const;
    colors.forEach((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2;
      editor.createShape({
        id: createShapeId(),
        type: 'note',
        x: center.x + Math.cos(angle) * 280 - 100,
        y: center.y + Math.sin(angle) * 200 - 100,
        props: { color, richText: toRichText('Idee…'), size: 'm' },
      });
    });
  } else if (template === 'retro') {
    const cols = [
      { name: 'Was lief gut?', color: 'green' as const, x: 0 },
      { name: 'Was lief schlecht?', color: 'red' as const, x: 600 },
      { name: 'Action Items', color: 'blue' as const, x: 1200 },
    ];
    cols.forEach((c) => {
      editor.createShape({
        id: createShapeId(),
        type: 'frame',
        x: c.x, y: 0,
        props: { w: 500, h: 800, name: c.name },
      });
    });
  } else if (template === 'mindmap') {
    const center = { x: 700, y: 400 };
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: center.x - 100, y: center.y - 40,
      props: { geo: 'ellipse', w: 200, h: 80, color: 'violet', fill: 'semi', richText: toRichText('Hauptthema'), size: 'm' },
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: center.x + Math.cos(angle) * 350 - 80,
        y: center.y + Math.sin(angle) * 250 - 30,
        props: { geo: 'rectangle', w: 160, h: 60, color: 'blue', fill: 'semi', richText: toRichText(`Zweig ${i + 1}`), size: 's' },
      });
    }
  } else if (template === 'customer_journey') {
    const phases = ['Awareness', 'Consideration', 'Purchase', 'Retention', 'Advocacy'];
    phases.forEach((name, i) => {
      editor.createShape({
        id: createShapeId(),
        type: 'frame',
        x: i * 420, y: 0,
        props: { w: 380, h: 600, name },
      });
    });
  }
}

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
  // Multiplayer-Decision: Wir testen einmal pro Mount ob unser Backend ein
  // Liveblocks-Auth-Token zurueckliefert. Solange das laeuft → Single-User
  // (das User-Erlebnis wird trotzdem instant geladen). Sobald das Token da
  // ist, wechseln wir auf Multiplayer-Modus. Wenn das Token nie kommt
  // (LIVEBLOCKS_SECRET fehlt, Liveblocks down, Auth fail) bleiben wir
  // dauerhaft Single-User.
  const publicKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY : undefined;
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      setAuthChecked(true);
      return;
    }
    whiteboardApi.liveblocksAuth(board.id)
      .then((r) => {
        if (cancelled) return;
        if (r.token) setAuthToken(r.token);
        setAuthChecked(true);
      })
      .catch(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, [publicKey, board.id]);

  // Solange Auth-Check laeuft → Single-User-Canvas zeigen (ladet sofort,
  // bricht nicht). Wenn Auth-Check done und kein Token: bleibt Single-User.
  if (!authChecked || !authToken) {
    return <SingleUserCanvas board={board} />;
  }

  return (
    <LiveblocksProvider
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
  // Verhindert double-mount-Initialisierung in React Strict Mode
  // (effect/onMount feuert dort 2x — sonst landen Templates doppelt im Canvas
  // oder loadSnapshot kollidiert mit sich selbst und das Board wird weiss).
  const mountedOnceRef = useRef(false);

  // tldraw-Snapshot beim Mount laden falls vorhanden
  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    if (mountedOnceRef.current) return;
    mountedOnceRef.current = true;
    try {
      if (board.state && Object.keys(board.state).length > 0 && !board.state.__template) {
        loadSnapshot(ed.store, board.state as TLEditorSnapshot);
      } else if (board.state?.__template) {
        // Fresh-Board mit Template-Marker: Initial-Shapes erzeugen.
        // Beim ersten Auto-Save wird der Marker durch den echten Snapshot ersetzt.
        applyTemplate(ed, board.state.__template);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Whiteboard mount init failed:', e);
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
        {editor && <EntityDockPanel editor={editor} />}
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
  const mountedOnceRef = useRef(false);

  // Yjs-Doc fuer CRDT-Sync. tldraw kennt von sich aus kein Yjs — wir
  // syncen manuell: Yjs-Map haelt das tldraw-Snapshot, jeder lokale Edit
  // schreibt ins Map, jeder Remote-Update wird in tldraw geladen.
  const ydoc = useMemo(() => new Y.Doc(), []);
  const yProvider = useMemo(() => new LiveblocksYjsProvider(room as any, ydoc), [room, ydoc]);
  const yState = useMemo(() => ydoc.getMap('tldraw-state'), [ydoc]);

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    if (mountedOnceRef.current) return;
    mountedOnceRef.current = true;
    try {
      // Initial-Load: bevorzuge Yjs-Map (live state), fallback auf DB-Snapshot
      const yStateValue = yState.get('snapshot') as TLEditorSnapshot | undefined;
      if (yStateValue) {
        loadSnapshot(ed.store, yStateValue);
      } else if (board.state && Object.keys(board.state).length > 0 && !board.state.__template) {
        loadSnapshot(ed.store, board.state as TLEditorSnapshot);
      } else if (board.state?.__template) {
        applyTemplate(ed, board.state.__template);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Whiteboard mount init failed:', e);
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
        {editor && <EntityDockPanel editor={editor} />}
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

// ---------------------------------------------------------------------------
// Entity-Dock: Such-Panel rechts unten — Tasks, Bestellungen, Produkte
// ---------------------------------------------------------------------------
// User klickt einen Treffer → ein Sticky-Note mit Filapen-Daten landet im
// Canvas. Reduziert "leere Brainstorm"-Felder auf "Brainstorm mit echten
// Geschaeftsdaten" — der Filapen-Differentiator zu Miro.
function EntityDockPanel({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'task' | 'order' | 'product'>('task');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Tab-Switch sofort die Treffer leeren — sonst rendern wir
  // weiter Task-Daten in der Order-View → undefined-Access-Crash.
  const handleTabChange = (newTab: 'task' | 'order' | 'product') => {
    setTab(newTab);
    setQuery('');
    setResults([]);
  };

  // Debounced search
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let r: any[] = [];
        if (tab === 'task') r = await whiteboardApi.searchTasks(query);
        else if (tab === 'order') r = await whiteboardApi.searchOrders(query);
        else r = await whiteboardApi.searchProducts(query);
        setResults(r);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, tab, query]);

  function handleAdd(entity: any) {
    dropEntityNote(editor, tab, entity);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        // BOTTOM-CENTER: bewusst weg von links (Sidebar) und rechts
        // (tldraw Chat/Share Icons). Mittig im Canvas-Bereich →
        // immer sichtbar, kollidiert nirgends.
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.03] active:scale-[0.97] transition-all"
        title="Filapen-Daten einfuegen"
      >
        <Sparkles className="h-4 w-4" />
        Daten einfügen
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[380px] max-h-[75vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Sparkles className="h-4 w-4 text-primary-500" />
          Filapen-Daten
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <Plus className="h-4 w-4 rotate-45" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 border-b border-gray-100 dark:border-white/5">
        {([
          { v: 'task' as const, label: 'Tasks', icon: ListTodo },
          { v: 'order' as const, label: 'Bestellungen', icon: ShoppingCart },
          { v: 'product' as const, label: 'Produkte', icon: Package },
        ]).map((t) => {
          const Icon = t.icon;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => handleTabChange(t.v)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-t-lg transition-colors',
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.02]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative px-3 py-2 border-b border-gray-100 dark:border-white/5">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'task' ? 'Task-Titel suchen…' : tab === 'order' ? 'Bestellnummer oder Kunde…' : 'Produktname oder SKU…'}
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-xs">
            <Loader2 className="h-3 w-3 animate-spin mr-2" /> Suche…
          </div>
        ) : results.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Keine Ergebnisse
          </div>
        ) : (
          <div className="py-1">
            {results.map((e) => (
              <button
                key={e.id}
                onClick={() => handleAdd(e)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                title="Aufs Whiteboard ziehen"
              >
                {tab === 'task' && e.title && (
                  <div>
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{e.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {e.projectName && <span>{e.projectName}</span>}
                      {e.priority && <span>· {e.priority}</span>}
                      {e.columnName && <span>· {e.columnName}</span>}
                    </div>
                  </div>
                )}
                {tab === 'order' && e.orderNumber && (
                  <div>
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {e.orderNumber} · {e.customerName || '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {Number(e.totalNet ?? 0).toLocaleString('de-DE', { style: 'currency', currency: e.currency || 'EUR' })}
                      {' · '}
                      {e.shippedAt ? 'versendet' : e.paidAt ? 'bezahlt' : (e.status ?? '—')}
                    </div>
                  </div>
                )}
                {tab === 'product' && e.productTitle && (
                  <div className="flex items-center gap-2">
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-100 dark:bg-white/5 flex-shrink-0 flex items-center justify-center">
                        <Package className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{e.productTitle}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {e.sku ? `${e.sku}` : ''}
                        {e.price != null ? ` · ${Number(e.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/5">
        Klick fügt eine Sticky-Note mit den Live-Daten ein.
      </div>
    </div>
  );
}
