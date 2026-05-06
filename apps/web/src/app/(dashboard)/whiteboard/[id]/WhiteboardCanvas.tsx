'use client';

// tldraw bringt seine eigenen Styles mit — die muessen in den Browser geladen
// werden bevor das Canvas rendert, sonst sieht es kaputt aus.
import 'tldraw/tldraw.css';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Users, Loader2, MoreHorizontal, History, Trash2,
  Search, ListTodo, ShoppingCart, Package, Plus, Sparkles, ZoomIn, ZoomOut, Maximize2,
  Table2, Lightbulb, Kanban as KanbanIcon, ListChecks, GitBranch, MapPinned, X,
} from 'lucide-react';
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  type TLComponents,
  type TLAsset,
  type TLShapeId,
  AssetRecordType,
  loadSnapshot,
  getSnapshot,
  createShapeId,
  toRichText,
  MediaHelpers,
  DefaultMainMenu,
  DefaultMainMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  useEditor,
  useValue,
} from 'tldraw';
import { whiteboardApi, type WhiteboardDetail } from '@/lib/whiteboard';
import { useAuthStore, getAuthHeaders } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';
// Non-suspense API: useRoom/useOthers koennten sonst suspendieren ohne
// passenden Suspense-Boundary in der Auth-Phase.
import { LiveblocksProvider, RoomProvider, useOthers, useSelf } from '@liveblocks/react';

// tldraw UI-Tweak: PageMenu (Seitenname) und NavigationPanel (Zoom-Selector
// unten rechts) ausblenden — gewinnen Canvas-Platz. Wichtige Funktionen
// (Undo/Redo, Pages, File-Ops) bleiben ueber das MainMenu (3 Punkte oben
// links) erreichbar.
//
// Bridge zwischen tldraw-internem Override (laeuft ausserhalb React-Lifecycle)
// und unserem React-State: SingleUserCanvas registriert seine setState-Calls
// auf diesem Modul-Level Objekt, das CustomMainMenu liest sie zur Klick-Zeit.
const insertActions: { table: null | (() => void); template: null | (() => void) } = {
  table: null,
  template: null,
};

// Custom MainMenu: standard tldraw Menue + zwei zusaetzliche Eintraege
// "Tabelle einfuegen" und "Vorlage einfuegen" oben.
//
// Casts auf `any` umgehen einen tldraw Typings-Quirk (Komponenten-Returntype
// enthaelt bigint und JSX akzeptiert das nicht).
const Group = TldrawUiMenuGroup as unknown as React.ComponentType<{ id: string; children: React.ReactNode }>;
const Item = TldrawUiMenuItem as unknown as React.ComponentType<{
  id: string;
  label: string;
  icon: string;
  readonlyOk?: boolean;
  onSelect: () => void;
}>;
function CustomMainMenu() {
  return (
    <DefaultMainMenu>
      <Group id="filapen-insert">
        <Item
          id="insert-table"
          label="Tabelle einfügen"
          icon="geo-rectangle"
          readonlyOk={false}
          onSelect={() => { insertActions.table?.(); }}
        />
        <Item
          id="insert-template"
          label="Vorlage einfügen"
          icon="star"
          readonlyOk={false}
          onSelect={() => { insertActions.template?.(); }}
        />
      </Group>
      <DefaultMainMenuContent />
    </DefaultMainMenu>
  );
}

// ---------------------------------------------------------------------------
// EMOJI-REACTIONS
// ---------------------------------------------------------------------------
// Speichern in shape.meta.reactions als Map { '🔥': ['userId1', 'userId2'] }
// → persistiert mit dem normalen Snapshot via Auto-Save
// → Toggle-Verhalten: User klickt Emoji nochmal → entfernt seine eigene Reaction
// → Counter zeigt Anzahl Users die so reagiert haben.
//
// currentUserIdRef-Bridge analog zu insertActions: SingleUserCanvas updated
// das Modul-Objekt damit OnTheCanvas-Components den aktuellen User kennen.
const REACTION_EMOJIS = ['🔥', '👍', '😍', '❤️', '🤔', '✅'];
const currentUserIdRef: { value: string | null } = { value: null };
// Shape-Typen die KEINE Reaktionen kriegen (Pfeile, freie Linien etc.).
const NO_REACTION_TYPES = new Set(['arrow', 'draw', 'line', 'highlight', 'frame']);

function toggleReaction(editor: Editor, shapeId: TLShapeId, emoji: string) {
  const userId = currentUserIdRef.value;
  if (!userId) return;
  const shape = editor.getShape(shapeId);
  if (!shape) return;
  const meta = (shape.meta as any) ?? {};
  const reactions: Record<string, string[]> = { ...(meta.reactions ?? {}) };
  const users = reactions[emoji] ?? [];
  const newUsers = users.includes(userId)
    ? users.filter((u) => u !== userId)
    : [...users, userId];
  if (newUsers.length === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = newUsers;
  }
  editor.updateShape({ id: shapeId, type: shape.type, meta: { ...meta, reactions } });
}

// Popover: kleine Emoji-Bar oberhalb der aktuell selektierten Shape
function ReactionPopover() {
  const editor = useEditor();
  const selectedIds = useValue('selectedIds', () => editor.getSelectedShapeIds(), [editor]);
  // Re-render wenn sich shape.meta aendert (fuer "reagiert"-Highlight).
  useValue('reactionsTick', () => {
    if (selectedIds.length !== 1) return 0;
    const s = editor.getShape(selectedIds[0]);
    return s ? JSON.stringify((s.meta as any)?.reactions ?? {}).length : 0;
  }, [editor, selectedIds]);

  if (selectedIds.length !== 1) return null;
  const shape = editor.getShape(selectedIds[0]);
  if (!shape) return null;
  if (NO_REACTION_TYPES.has(shape.type)) return null;
  const bounds = editor.getShapePageBounds(shape.id);
  if (!bounds) return null;

  const reactions = ((shape.meta as any)?.reactions ?? {}) as Record<string, string[]>;
  const userId = currentUserIdRef.value;

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.midX,
        top: bounds.minY - 12,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'all',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 rounded-full bg-white dark:bg-[#1a1d2e] shadow-lg border border-gray-200 dark:border-white/10 px-1.5 py-1 select-none"
    >
      {REACTION_EMOJIS.map((emoji) => {
        const reacted = !!userId && (reactions[emoji] ?? []).includes(userId);
        return (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              toggleReaction(editor, shape.id, emoji);
            }}
            className={
              'inline-flex items-center justify-center w-7 h-7 text-base rounded-full transition-all hover:scale-125 ' +
              (reacted ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-gray-100 dark:hover:bg-white/5')
            }
            title={reacted ? 'Reaktion zurueckziehen' : 'Reagieren'}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

// Badges: kleine Sticker mit Emoji + Counter unten rechts an der Shape
function ReactionBadges() {
  const editor = useEditor();
  const items = useValue(
    'shapesWithReactions',
    () => {
      return editor
        .getCurrentPageShapes()
        .map((s) => {
          const reactions = ((s.meta as any)?.reactions ?? {}) as Record<string, string[]>;
          const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
          return { shapeId: s.id, reactions: entries };
        })
        .filter((x) => x.reactions.length > 0);
    },
    [editor],
  );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ shapeId, reactions }) => {
        const bounds = editor.getShapePageBounds(shapeId);
        if (!bounds) return null;
        return (
          <div
            key={shapeId}
            style={{
              position: 'absolute',
              left: bounds.maxX,
              top: bounds.maxY,
              transform: 'translate(-100%, 4px)',
              pointerEvents: 'none',
            }}
            className="flex flex-wrap gap-0.5 max-w-[180px] justify-end"
          >
            {reactions.map(([emoji, users]) => (
              <span
                key={emoji}
                className="rounded-full bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-white/10 shadow-sm text-xs px-1.5 py-0.5 whitespace-nowrap inline-flex items-center gap-0.5"
              >
                <span>{emoji}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{users.length}</span>
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}

function ReactionsLayer() {
  return (
    <>
      <ReactionBadges />
      <ReactionPopover />
    </>
  );
}

// KONST auf Modul-Ebene damit React.memo immer dieselbe Referenz sieht
// und tldraw nicht reconciled.
const TLDRAW_COMPONENTS: TLComponents = {
  PageMenu: null,
  NavigationPanel: null,
  MainMenu: CustomMainMenu,
  // OnTheCanvas: lebt im transformed canvas → page coords funktionieren direkt
  OnTheCanvas: ReactionsLayer,
};

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
 * vom Backend bei Create) ODER spaeter ueber den "Vorlage einfuegen"-
 * Button im offenen Whiteboard.
 *
 * `origin` verschiebt alle Shapes um (origin.x, origin.y) — beim
 * Initial-Mount Default (0,0). Beim Einfuegen im offenen Board
 * uebergeben wir das Zentrum des aktuellen Viewports damit die neuen
 * Shapes dort landen wo der User gerade hinguckt.
 */
function applyTemplate(editor: Editor, template: string, origin: { x: number; y: number } = { x: 0, y: 0 }) {
  const ox = origin.x;
  const oy = origin.y;
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
        x: ox + c.x,
        y: oy + 0,
        props: { w: 500, h: 800, name: c.name },
      });
      // 2 Sticky-Notes als Beispiel
      for (let i = 0; i < 2; i++) {
        editor.createShape({
          id: createShapeId(),
          type: 'note',
          x: ox + c.x + 60 + (i % 2) * 220,
          y: oy + 80 + i * 220,
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
      x: ox + 0, y: oy + 0,
      props: { w: 1400, h: 900, name: 'Brainstorm' },
    });
    const center = { x: 700, y: 450 };
    const colors = ['yellow', 'blue', 'green', 'orange', 'red', 'violet'] as const;
    colors.forEach((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2;
      editor.createShape({
        id: createShapeId(),
        type: 'note',
        x: ox + center.x + Math.cos(angle) * 280 - 100,
        y: oy + center.y + Math.sin(angle) * 200 - 100,
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
        x: ox + c.x, y: oy + 0,
        props: { w: 500, h: 800, name: c.name },
      });
    });
  } else if (template === 'mindmap') {
    const center = { x: 700, y: 400 };
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: ox + center.x - 100, y: oy + center.y - 40,
      props: { geo: 'ellipse', w: 200, h: 80, color: 'violet', fill: 'semi', richText: toRichText('Hauptthema'), size: 'm' },
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: ox + center.x + Math.cos(angle) * 350 - 80,
        y: oy + center.y + Math.sin(angle) * 250 - 30,
        props: { geo: 'rectangle', w: 160, h: 60, color: 'blue', fill: 'semi', richText: toRichText(`Zweig ${i + 1}`), size: 's' },
      });
    }
  } else if (template === 'customer_journey') {
    const phases = ['Awareness', 'Consideration', 'Purchase', 'Retention', 'Advocacy'];
    phases.forEach((name, i) => {
      editor.createShape({
        id: createShapeId(),
        type: 'frame',
        x: ox + i * 420, y: oy + 0,
        props: { w: 380, h: 600, name },
      });
    });
  } else if (template === 'decision_tree') {
    // Hierarchischer Entscheidungsbaum: Problem → Frage → 2 Decisions →
    // je 2 Aktionen → je 1 Ergebnis. Mit Pfeilen zwischen den Ebenen.
    const box = (x: number, y: number, w: number, h: number, color: any, fill: any, text: string, size: any = 'm') => {
      const id = createShapeId();
      editor.createShape({
        id,
        type: 'geo',
        x: ox + x, y: oy + y,
        props: { geo: 'rectangle', w, h, color, fill, richText: toRichText(text), size },
      });
      return { id, cx: ox + x + w / 2, cy: oy + y + h / 2, top: oy + y, bottom: oy + y + h };
    };
    const arrow = (sx: number, sy: number, ex: number, ey: number) => {
      editor.createShape({
        id: createShapeId(),
        type: 'arrow',
        x: 0, y: 0,
        props: {
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          color: 'grey',
          size: 's',
        },
      });
    };
    const problem = box(550, 0, 300, 80, 'black', 'solid', 'Problem');
    const frage = box(575, 140, 250, 70, 'grey', 'semi', 'Was tun?');
    const dec1 = box(200, 280, 280, 90, 'orange', 'solid', 'Entscheidung 1');
    const dec2 = box(920, 280, 280, 90, 'orange', 'solid', 'Entscheidung 2');
    const a1 = box(40, 440, 220, 80, 'green', 'semi', 'Aktion 1', 's');
    const a2 = box(280, 440, 220, 80, 'green', 'semi', 'Aktion 2', 's');
    const a3 = box(820, 440, 220, 80, 'light-red', 'semi', 'Aktion 1', 's');
    const a4 = box(1060, 440, 220, 80, 'light-red', 'semi', 'Aktion 2', 's');
    const r1 = box(80, 580, 140, 60, 'black', 'none', 'Ergebnis', 's');
    const r2 = box(320, 580, 140, 60, 'black', 'none', 'Ergebnis', 's');
    const r3 = box(860, 580, 140, 60, 'black', 'none', 'Ergebnis', 's');
    const r4 = box(1100, 580, 140, 60, 'black', 'none', 'Ergebnis', 's');
    arrow(problem.cx, problem.bottom, frage.cx, frage.top);
    arrow(frage.cx, frage.bottom, dec1.cx, dec1.top);
    arrow(frage.cx, frage.bottom, dec2.cx, dec2.top);
    arrow(dec1.cx, dec1.bottom, a1.cx, a1.top);
    arrow(dec1.cx, dec1.bottom, a2.cx, a2.top);
    arrow(dec2.cx, dec2.bottom, a3.cx, a3.top);
    arrow(dec2.cx, dec2.bottom, a4.cx, a4.top);
    arrow(a1.cx, a1.bottom, r1.cx, r1.top);
    arrow(a2.cx, a2.bottom, r2.cx, r2.top);
    arrow(a3.cx, a3.bottom, r3.cx, r3.top);
    arrow(a4.cx, a4.bottom, r4.cx, r4.top);
  } else if (template === 'scamper') {
    // 7 horizontale Frames, jeder mit Methode + Hinweistext
    const items = [
      { letter: 'S', name: 'Substitute',         hint: 'Was ersetzen?' },
      { letter: 'C', name: 'Combine',            hint: 'Was kombinieren?' },
      { letter: 'A', name: 'Adapt',              hint: 'Was anpassen?' },
      { letter: 'M', name: 'Modify',             hint: 'Was vergroessern/aendern?' },
      { letter: 'P', name: 'Put to other use',   hint: 'Anderer Einsatz?' },
      { letter: 'E', name: 'Eliminate',          hint: 'Was weglassen?' },
      { letter: 'R', name: 'Reverse',            hint: 'Umkehren / neu ordnen?' },
    ];
    items.forEach((it, i) => {
      editor.createShape({
        id: createShapeId(),
        type: 'frame',
        x: ox + i * 280, y: oy + 0,
        props: { w: 260, h: 480, name: `${it.letter} — ${it.name}` },
      });
      editor.createShape({
        id: createShapeId(),
        type: 'note',
        x: ox + i * 280 + 30, y: oy + 60,
        props: { color: 'yellow', richText: toRichText(it.hint), size: 's' },
      });
    });
  } else if (template === '5_whys') {
    // 5 vertikale Boxen mit Pfeilen zwischen jeder Stufe
    const headerY = 0;
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: ox + 0, y: oy + headerY,
      props: { geo: 'rectangle', w: 600, h: 80, color: 'red', fill: 'solid', richText: toRichText('Problem-Beschreibung'), size: 'l' },
    });
    let prevBottom = oy + headerY + 80;
    let prevCx = ox + 300;
    for (let i = 1; i <= 5; i++) {
      const y = headerY + 130 + (i - 1) * 130;
      // Pfeil von vorherigem zu diesem
      editor.createShape({
        id: createShapeId(),
        type: 'arrow',
        x: 0, y: 0,
        props: {
          start: { x: prevCx, y: prevBottom },
          end:   { x: ox + 300, y: oy + y },
          color: 'grey',
          size: 's',
        },
      });
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: ox + 0, y: oy + y,
        props: {
          geo: 'rectangle',
          w: 600, h: 90,
          color: 'orange',
          fill: 'semi',
          richText: toRichText(`Warum #${i}?`),
          size: 'm',
        },
      });
      prevBottom = oy + y + 90;
      prevCx = ox + 300;
    }
    // Root-Cause unten
    editor.createShape({
      id: createShapeId(),
      type: 'arrow',
      x: 0, y: 0,
      props: {
        start: { x: prevCx, y: prevBottom },
        end:   { x: ox + 300, y: oy + headerY + 130 + 5 * 130 + 30 },
        color: 'grey',
        size: 's',
      },
    });
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: ox + 0, y: oy + headerY + 130 + 5 * 130 + 30,
      props: { geo: 'rectangle', w: 600, h: 90, color: 'green', fill: 'solid', richText: toRichText('Root Cause'), size: 'l' },
    });
  } else if (template === 'starbursting') {
    // Zentrum + 6 Frage-Spokes (Wer/Was/Wann/Wo/Warum/Wie)
    const center = { x: 600, y: 400 };
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: ox + center.x - 100, y: oy + center.y - 50,
      props: { geo: 'star', w: 200, h: 100, color: 'violet', fill: 'solid', richText: toRichText('Idee / Thema'), size: 'm' },
    });
    const questions = [
      { label: 'Wer?',    color: 'blue'   as const },
      { label: 'Was?',    color: 'green'  as const },
      { label: 'Wann?',   color: 'orange' as const },
      { label: 'Wo?',     color: 'red'    as const },
      { label: 'Warum?',  color: 'yellow' as const },
      { label: 'Wie?',    color: 'light-violet' as any },
    ];
    questions.forEach((q, i) => {
      const angle = (i / questions.length) * Math.PI * 2 - Math.PI / 2;
      const x = center.x + Math.cos(angle) * 360 - 110;
      const y = center.y + Math.sin(angle) * 280 - 50;
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: ox + x, y: oy + y,
        props: { geo: 'rectangle', w: 220, h: 100, color: q.color, fill: 'semi', richText: toRichText(q.label), size: 'm' },
      });
      // Pfeil vom Zentrum zur Frage
      editor.createShape({
        id: createShapeId(),
        type: 'arrow',
        x: 0, y: 0,
        props: {
          start: { x: ox + center.x, y: oy + center.y },
          end:   { x: ox + x + 110, y: oy + y + 50 },
          color: 'grey',
          size: 's',
        },
      });
    });
  } else if (template === 'idea_jam') {
    // Miro-Style: 5 Spalten (Teilnehmer), je 4 bunte Sticky-Notes als Vorlage
    const participants = [
      { name: 'Cassie', color: 'yellow' as const },
      { name: 'Trevor', color: 'blue'   as const },
      { name: 'Jules',  color: 'green'  as const },
      { name: 'Mark',   color: 'red'    as const },
      { name: 'Leslie', color: 'violet' as const },
    ];
    participants.forEach((p, i) => {
      const colX = i * 240;
      // Header (Name als Text-Shape)
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: ox + colX, y: oy + 0,
        props: { geo: 'rectangle', w: 220, h: 60, color: p.color, fill: 'solid', richText: toRichText(p.name), size: 'l' },
      });
      // 4 Sticky-Notes pro Spalte
      for (let j = 0; j < 4; j++) {
        editor.createShape({
          id: createShapeId(),
          type: 'note',
          x: ox + colX, y: oy + 90 + j * 220,
          props: { color: p.color, richText: toRichText('Idee…'), size: 'm' },
        });
      }
    });
    // Header oben drueber
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: ox - 40, y: oy - 100,
      props: { geo: 'rectangle', w: 1240, h: 70, color: 'black', fill: 'none', richText: toRichText('💡  Brainstorm-Session'), size: 'l' },
    });
  }
}

/**
 * Erzeugt ein Tabellen-Raster aus geo-Rechtecken (rows x cols).
 * Jede Zelle ist einzeln editierbar (klick → Text rein). tldraw hat
 * keine native Tabelle — das ist die saubere Workaround-Variante.
 */
function insertTable(
  editor: Editor,
  rows: number,
  cols: number,
  origin: { x: number; y: number },
) {
  const CELL_W = 160;
  const CELL_H = 60;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Erste Zeile = Header (etwas anderer Style: dunkleres Fill)
      const isHeader = r === 0;
      editor.createShape({
        id: createShapeId(),
        type: 'geo',
        x: origin.x + c * CELL_W,
        y: origin.y + r * CELL_H,
        props: {
          geo: 'rectangle',
          w: CELL_W,
          h: CELL_H,
          color: isHeader ? 'grey' : 'black',
          fill: isHeader ? 'solid' : 'none',
          dash: 'solid',
          size: 's',
          richText: toRichText(isHeader ? `Spalte ${c + 1}` : ''),
        },
      });
    }
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
  // Auth-Phase: einmalig pruefen ob Liveblocks konfiguriert ist.
  // Wenn ja → wrappe SingleUserCanvas in LiveblocksProvider+RoomProvider
  // damit useOthers/useSelf funktionieren und wir Presence-Avatars zeigen
  // koennen. tldraw-State selbst wird (noch) nicht ueber Liveblocks
  // sync'd — das kommt mit @tldraw/sync wenn ihr das spaeter braucht.
  // Wenn nicht → Single-User Modus ohne Provider (currentUserCount=1).
  const publicKey = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY
    : undefined;
  type AuthPhase = 'loading' | 'no-liveblocks' | 'liveblocks-ok' | 'liveblocks-failed';
  const [authPhase, setAuthPhase] = useState<AuthPhase>(publicKey ? 'loading' : 'no-liveblocks');

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    whiteboardApi.liveblocksAuth(board.id)
      .then((r) => { if (!cancelled) setAuthPhase(r.token ? 'liveblocks-ok' : 'liveblocks-failed'); })
      .catch(() => { if (!cancelled) setAuthPhase('liveblocks-failed'); });
    return () => { cancelled = true; };
  }, [publicKey, board.id]);

  if (authPhase === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#fafafa] dark:bg-[#0c0e1c]">
        <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-primary-500 animate-spin" />
      </div>
    );
  }

  if (authPhase !== 'liveblocks-ok') {
    // Kein Liveblocks (nicht konfiguriert oder Auth fehlgeschlagen) → Single-User
    return <SingleUserCanvas board={board} />;
  }

  // Mit Liveblocks: Provider + Room → SingleUserCanvas kann useOthers nutzen
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
        <SingleUserCanvas board={board} withPresence />
      </RoomProvider>
    </LiveblocksProvider>
  );
}

// ---------------------------------------------------------------------------
// StableTldraw — React.memo wrapper mit STABILEN Props.
//
// Verhindert dass Parent-Re-Renders (saveState-Updates, Toolbar-Animation
// etc.) den tldraw-Subtree reconcilen. Damit bleiben tldraws interne
// signia-Subscriptions stabil ueber den Lifetime des Whiteboards.
//
// onMount muss vom Parent via useCallback mit empty deps stabil sein,
// TLDRAW_COMPONENTS ist eine Modul-Konstante — beide Referenzen aendern
// sich nie → memo bailed alle Re-Renders.
// ---------------------------------------------------------------------------
const StableTldraw = memo(function StableTldraw({
  onMount,
}: {
  onMount: (editor: Editor) => void;
}) {
  return <Tldraw onMount={onMount} components={TLDRAW_COMPONENTS} />;
});

// ---------------------------------------------------------------------------
// Single-User Mode (kein Liveblocks) — STABILIZED
// ---------------------------------------------------------------------------
function SingleUserCanvas({
  board,
  withPresence = false,
}: {
  board: WhiteboardDetail;
  /** True wenn dieser Canvas innerhalb eines RoomProviders gemounted ist —
   *  dann zeigen wir die Multi-User-Avatars in der Toolbar. */
  withPresence?: boolean;
}) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  // Loesch-Berechtigung: Ersteller des Boards ODER role=owner
  const canDelete = !!currentUser
    && (board.createdById === currentUser.id || currentUser.role === 'owner');
  // saveState in React-state, weil Toolbar das darstellt. Aenderungen
  // re-rendern SingleUserCanvas; StableTldraw bailed via memo.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // ONE-TIME flip nach onMount → einmaliger Re-Render damit EntityDock mountet.
  const [editorReady, setEditorReady] = useState(false);
  // Modals fuer Insert-Aktionen
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);

  // editor in REF, nicht in state — siehe Architektur-Notes oben.
  const editorRef = useRef<Editor | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedOnceRef = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // board.state/id in Refs damit handleMount EMPTY DEPS bleibt.
  const boardStateRef = useRef(board.state);
  const boardIdRef = useRef(board.id);
  useEffect(() => { boardStateRef.current = board.state; }, [board.state]);
  useEffect(() => { boardIdRef.current = board.id; }, [board.id]);

  // STABLE handleMount — empty deps, NIEMALS re-created.
  const handleMount = useCallback((ed: Editor) => {
    if (mountedOnceRef.current) return;
    mountedOnceRef.current = true;
    editorRef.current = ed;

    // KRITISCH: Asset-Handler fuer File-Drops (Bilder, Videos, etc.)
    // Default-Verhalten von tldraw waere `URL.createObjectURL(file)` →
    // ein temporaerer blob:// Link der beim Tab-Schliessen tot ist.
    // Wir laden stattdessen zu R2 hoch und nutzen die persistente URL.
    ed.registerExternalAssetHandler('file', async ({ file }) => {
      const upload = await whiteboardApi.uploadAsset(boardIdRef.current, file);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      // Dimensionen ermitteln — tldraw braucht w/h fuer korrekte Darstellung
      let w = 0, h = 0, isAnimated = false;
      try {
        if (isImage) {
          const size = await MediaHelpers.getImageSize(file);
          w = size.w; h = size.h;
          isAnimated = file.type === 'image/gif';
        } else if (isVideo) {
          const size = await MediaHelpers.getVideoSize(file);
          w = size.w; h = size.h;
          isAnimated = true;
        }
      } catch { /* dimensions unknown — tldraw faellt auf default zurueck */ }
      const asset: TLAsset = AssetRecordType.create({
        id: AssetRecordType.createId(),
        type: isVideo ? 'video' : 'image',
        typeName: 'asset',
        props: {
          name: upload.name,
          src: upload.url,
          w: w || 600,
          h: h || 400,
          mimeType: upload.mimeType || file.type,
          isAnimated,
        },
        meta: {},
      });
      // Direkt nach Asset-Upload Auto-Save antriggern (kurz statt 30s warten)
      // damit das neue Asset garantiert in der DB landet bevor User wegnavigiert.
      // 1 Sekunde gibt tldraw Zeit das Shape mit dem neuen Asset zu erstellen.
      setTimeout(() => triggerSaveRef.current?.(), 1000);
      return asset;
    });

    try {
      const state = boardStateRef.current;
      if (state && Object.keys(state).length > 0 && !state.__template) {
        loadSnapshot(ed.store, state as TLEditorSnapshot);
      } else if (state?.__template) {
        applyTemplate(ed, state.__template);
      }
      try {
        ed.zoomToFit({ animation: { duration: 0 } });
      } catch { /* no shapes — no-op */ }
    } catch { /* mount init failed — non-fatal */ }

    lastSavedJsonRef.current = JSON.stringify(getSnapshot(ed.store));
    setEditorReady(true);
  }, []);

  // Trigger fuer sofortiges Speichern (z.B. nach Asset-Upload).
  // Wird vom Auto-Save-Effekt unten gesetzt damit handleMount es nutzen kann.
  const triggerSaveRef = useRef<(() => void) | null>(null);

  // Bridge zu tldraw MainMenu: registriere Modal-Opener-Callbacks
  // damit Klicks im tldraw-MainMenu unsere React-Modals oeffnen koennen.
  useEffect(() => {
    insertActions.table = () => setShowTablePicker(true);
    insertActions.template = () => setShowTemplatePicker(true);
    return () => {
      insertActions.table = null;
      insertActions.template = null;
    };
  }, []);

  // currentUserIdRef sync — damit ReactionPopover/Badges (laufen auf
  // Modul-Ebene ausserhalb dieses Components) wissen wer reagiert hat.
  useEffect(() => {
    currentUserIdRef.value = currentUser?.id ?? null;
    return () => { currentUserIdRef.value = null; };
  }, [currentUser?.id]);

  // Auto-Save: tickt alle 5 Sekunden (war 30s — wurde reduziert weil
  // User-Aenderungen sonst beim Verlassen der Seite verloren gehen koennen
  // bevor der erste Save laeuft).
  const SAVE_INTERVAL_MS = 5_000;
  useEffect(() => {
    if (!editorReady) return;
    const ed = editorRef.current;
    if (!ed) return;
    const tick = async () => {
      let snap: any;
      try {
        snap = getSnapshot(ed.store);
      } catch (e: any) {
        console.error('[wb-save] getSnapshot failed:', e?.message ?? e);
        saveTimerRef.current = setTimeout(tick, SAVE_INTERVAL_MS);
        return;
      }
      let json: string;
      try {
        json = JSON.stringify(snap);
      } catch (e: any) {
        console.error('[wb-save] JSON.stringify failed:', e?.message ?? e);
        saveTimerRef.current = setTimeout(tick, SAVE_INTERVAL_MS);
        return;
      }
      if (json === lastSavedJsonRef.current) {
        saveTimerRef.current = setTimeout(tick, SAVE_INTERVAL_MS);
        return;
      }
      setSaveState('saving');
      console.log(`[wb-save] saving ${json.length} bytes…`);
      try {
        await whiteboardApi.update(boardIdRef.current, { state: snap });
        lastSavedJsonRef.current = json;
        setSaveState('saved');
        setLastSavedAt(new Date());
        console.log('[wb-save] OK');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (e: any) {
        setSaveState('error');
        console.error('[wb-save] FAILED:', e?.message ?? e);
        setTimeout(() => setSaveState('idle'), 4000);
      }
      saveTimerRef.current = setTimeout(tick, SAVE_INTERVAL_MS);
    };
    saveTimerRef.current = setTimeout(tick, SAVE_INTERVAL_MS);
    triggerSaveRef.current = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      tick();
    };
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      triggerSaveRef.current = null;
    };
  }, [editorReady]);

  // Save on unmount via fetch keepalive — Request laeuft auch nach
  // Component-Unmount + Page-Navigation weiter. Behaelt Bearer-Token im
  // Authorization-Header (anders als sendBeacon).
  useEffect(() => {
    return () => {
      const ed = editorRef.current;
      if (!ed) return;
      try {
        const snap = getSnapshot(ed.store);
        const json = JSON.stringify(snap);
        if (json === lastSavedJsonRef.current) return;
        const url = `${API_URL}/api/whiteboard/boards/${boardIdRef.current}`;
        fetch(url, {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ state: snap }),
        }).catch(() => { /* ignore */ });
        console.log(`[wb-save] unmount keepalive PUT, ${json.length} bytes`);
      } catch (e: any) {
        console.error('[wb-save] unmount failed:', e?.message ?? e);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#fafafa] dark:bg-[#0c0e1c]">
      <Toolbar
        title={board.title}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        onSaveNow={() => triggerSaveRef.current?.()}
        userCount={1}
        tier="free"
        canDelete={canDelete}
        usersSlot={withPresence ? <PresenceAvatars /> : null}
        onBack={() => router.push('/whiteboard')}
        onTitleChange={async (t) => { await whiteboardApi.update(board.id, { title: t }); }}
        onDelete={async () => {
          if (!canDelete) {
            // eslint-disable-next-line no-alert
            window.alert('Nur der Ersteller oder ein Owner darf dieses Whiteboard loeschen.');
            return;
          }
          // eslint-disable-next-line no-alert
          if (!window.confirm('Whiteboard wirklich löschen?')) return;
          try {
            await whiteboardApi.remove(board.id);
            router.push('/whiteboard');
          } catch (e: any) {
            // eslint-disable-next-line no-alert
            window.alert(e.message);
          }
        }}
        onZoomIn={() => editorRef.current?.zoomIn()}
        onZoomOut={() => editorRef.current?.zoomOut()}
        onZoomToFit={() => editorRef.current?.zoomToFit({ animation: { duration: 200 } })}
        onInsertTemplate={() => setShowTemplatePicker(true)}
        onInsertTable={() => setShowTablePicker(true)}
      />
      {/* min-h-0 verhindert flex-collapse */}
      <div className="flex-1 relative min-h-0" ref={canvasContainerRef}>
        <StableTldraw onMount={handleMount} />
        {editorReady && editorRef.current && <EntityDockPanel editor={editorRef.current} />}
        {/* Floating-Action-Buttons direkt UEBER "Daten einfuegen"-Button —
            gleiche horizontale Position (480px links vom Center), drueber
            gestackt mit kleinem Abstand. */}
        <div
          className="absolute left-1/2 z-30 flex flex-col gap-2"
          style={{
            bottom: '70px', // ueber Daten-Button (bottom-4 = 16px + Button-Hoehe ~42 + gap 12)
            transform: 'translateX(calc(-50% - 480px))',
          }}
        >
          <button
            onClick={() => setShowTablePicker(true)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.03] active:scale-[0.97] transition-all"
            title="Tabelle einfügen"
          >
            <Table2 className="h-4 w-4" />
            Tabelle
          </button>
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 px-4 py-2.5 text-sm font-medium text-white shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.03] active:scale-[0.97] transition-all"
            title="Vorlage einfügen"
          >
            <Sparkles className="h-4 w-4" />
            Vorlage
          </button>
        </div>
      </div>

      {/* Vorlage einfuegen — opens template picker, applies at viewport center */}
      {showTemplatePicker && editorRef.current && (
        <TemplatePickerModal
          onClose={() => setShowTemplatePicker(false)}
          onPick={(template) => {
            const ed = editorRef.current!;
            const center = ed.getViewportPageBounds().center;
            applyTemplate(ed, template, { x: center.x - 700, y: center.y - 400 });
            setShowTemplatePicker(false);
          }}
        />
      )}

      {/* Tabelle einfuegen */}
      {showTablePicker && editorRef.current && (
        <TablePickerModal
          onClose={() => setShowTablePicker(false)}
          onInsert={(rows, cols) => {
            const ed = editorRef.current!;
            const center = ed.getViewportPageBounds().center;
            const totalW = cols * 160;
            const totalH = rows * 60;
            insertTable(ed, rows, cols, { x: center.x - totalW / 2, y: center.y - totalH / 2 });
            setShowTablePicker(false);
          }}
        />
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// SaveStateBadge — kompakte Anzeige fuer Auto-Save mit "vor X Sek" Timestamp.
// ---------------------------------------------------------------------------
function SaveStateBadge({
  state, lastSavedAt,
}: { state: 'idle' | 'saving' | 'saved' | 'error'; lastSavedAt?: Date | null }) {
  // re-render alle 30s damit der "vor X Min"-Text live tickt
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Speichern…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
        ⚠ Speicher-Fehler — neu versuchen
      </span>
    );
  }
  // saved oder idle — Wenn lastSavedAt da ist, "vor X" anzeigen
  if (lastSavedAt) {
    const ago = Date.now() - lastSavedAt.getTime();
    const sec = Math.floor(ago / 1000);
    const min = Math.floor(sec / 60);
    const text = sec < 5 ? 'soeben gespeichert' : sec < 60 ? `vor ${sec} Sek gespeichert` : `vor ${min} Min gespeichert`;
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Save className="h-3 w-3" /> {text}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
      Auto-Save aktiv
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar (oben)
// ---------------------------------------------------------------------------
function Toolbar({
  title, saveState, lastSavedAt, onSaveNow,
  userCount, tier, canDelete, usersSlot, onBack, onTitleChange, onDelete,
  onZoomIn, onZoomOut, onZoomToFit, onInsertTemplate, onInsertTable,
}: {
  title: string;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: Date | null;
  onSaveNow?: () => void;
  userCount: number;
  tier: 'free' | 'pro';
  canDelete?: boolean;
  /** Optional Slot fuer Multi-User-Avatars (Liveblocks Presence). */
  usersSlot?: React.ReactNode;
  onBack: () => void;
  onTitleChange: (t: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomToFit?: () => void;
  onInsertTemplate?: () => void;
  onInsertTable?: () => void;
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
        {/* Insert-Gruppe: Vorlage + Tabelle direkt sichtbar in Toolbar */}
        {(onInsertTemplate || onInsertTable) && (
          <div className="flex items-center rounded-lg border border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] overflow-hidden">
            {onInsertTemplate && (
              <button
                onClick={onInsertTemplate}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Vorlage in dieses Whiteboard einfuegen"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Vorlage
              </button>
            )}
            {onInsertTable && (
              <button
                onClick={onInsertTable}
                className="flex items-center gap-1.5 border-l border-gray-200/70 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Tabelle einfuegen"
              >
                <Table2 className="h-3.5 w-3.5" />
                Tabelle
              </button>
            )}
          </div>
        )}

        {/* Zoom-Gruppe: Lupe-Buttons fuer rein/raus + Reset (zoom-to-fit) */}
        {(onZoomIn || onZoomOut || onZoomToFit) && (
          <div className="flex items-center rounded-lg border border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] overflow-hidden">
            {onZoomOut && (
              <button
                onClick={onZoomOut}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                title="Rauszoomen"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            )}
            {onZoomToFit && (
              <button
                onClick={onZoomToFit}
                className="border-x border-gray-200/70 dark:border-white/10 p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                title="An Inhalt anpassen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {onZoomIn && (
              <button
                onClick={onZoomIn}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                title="Reinzoomen"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Save-State + Jetzt-speichern Button */}
        <div className="hidden sm:flex items-center gap-2 min-w-[140px] justify-end">
          <SaveStateBadge state={saveState} lastSavedAt={lastSavedAt} />
          {onSaveNow && (
            <button
              onClick={onSaveNow}
              disabled={saveState === 'saving'}
              className="rounded-lg p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Jetzt speichern"
            >
              <Save className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Pro-Badge: leuchtet wenn LIVEBLOCKS_TIER=pro auf dem Backend */}
        {tier === 'pro' && (
          <div
            className="hidden sm:flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 shadow-sm"
            title="Liveblocks Pro aktiv: Comments, Notifications, Multi-Room-Tokens"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Pro
          </div>
        )}

        {/* User-Indicator: Multi-User-Avatars (mit Liveblocks) ODER Solo-Badge */}
        {usersSlot ? (
          usersSlot
        ) : (
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            userCount > 1
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400',
          )}>
            <Users className="h-3 w-3" />
            {userCount}
          </div>
        )}

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
                {onInsertTemplate && (
                  <button
                    onClick={() => { setMenuOpen(false); onInsertTemplate(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary-500" /> Vorlage einfügen
                  </button>
                )}
                {onInsertTable && (
                  <button
                    onClick={() => { setMenuOpen(false); onInsertTable(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Table2 className="h-3.5 w-3.5 text-primary-500" /> Tabelle einfügen
                  </button>
                )}
                {(onInsertTemplate || onInsertTable) && canDelete !== false && (
                  <div className="my-1 h-px bg-gray-100 dark:bg-white/5" />
                )}
                {canDelete !== false && (
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Whiteboard löschen
                  </button>
                )}
                {canDelete === false && (
                  <div className="px-3 py-2 text-[10px] italic text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/5">
                    Nur der Ersteller darf löschen
                  </div>
                )}
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
        // BOTTOM-LINKS-VERSETZT: 3x Buttonbreite (~480px) links vom
        // Zentrum, damit der Button nicht hinter tldraws zentralem
        // Toolbar / Style-Panel verschwindet.
        className="absolute bottom-4 left-1/2 z-30 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.03] active:scale-[0.97] transition-all"
        style={{ transform: 'translateX(calc(-50% - 480px))' }}
        title="Filapen-Daten einfuegen"
      >
        <Sparkles className="h-4 w-4" />
        Daten einfügen
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-4 left-1/2 z-30 w-[380px] max-h-[75vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden animate-fade-in"
      style={{ transform: 'translateX(calc(-50% - 480px))' }}
    >
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

// ---------------------------------------------------------------------------
// PresenceAvatars — Multi-User-Indikator in der Toolbar (Liveblocks).
// Zeigt overlapping Initial-Avatar fuer jeden anderen + sich selbst.
// Hover zeigt den vollen Namen.
// ---------------------------------------------------------------------------
function PresenceAvatars() {
  // useOthers + useSelf funktionieren nur INSIDE eines RoomProviders.
  // WhiteboardCanvas mountet PresenceAvatars nur dann (withPresence=true).
  const others = useOthers();
  const self = useSelf();

  // Eigene Avatar-Daten kommen aus userInfo (vom Backend per Auth-Token).
  // Falls noch nicht da, leere Liste.
  const selfInfo = self?.info as { name?: string; avatarUrl?: string } | undefined;

  const all = [
    ...(self ? [{ id: 'self', name: selfInfo?.name ?? 'Du', avatarUrl: selfInfo?.avatarUrl, isMe: true }] : []),
    ...others.map((o) => {
      const info = o.info as { name?: string; avatarUrl?: string } | undefined;
      return {
        id: String(o.connectionId),
        name: info?.name ?? `User ${o.connectionId}`,
        avatarUrl: info?.avatarUrl,
        isMe: false,
      };
    }),
  ];

  if (all.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
        <Users className="h-3 w-3" />
        1
      </div>
    );
  }

  // Maximum 4 sichtbare Avatare, Rest als "+N"
  const MAX = 4;
  const visible = all.slice(0, MAX);
  const overflow = Math.max(0, all.length - MAX);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-2">
        {visible.map((u) => (
          <div
            key={u.id}
            title={u.name + (u.isMe ? ' (du)' : '')}
            className={cn(
              'relative h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#0c0e1c] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden',
              u.isMe ? 'bg-gradient-to-br from-primary-500 to-primary-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700',
            )}
          >
            {u.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatarUrl} alt={u.name} className="h-full w-full object-cover" />
            ) : (
              <span>{(u.name || '?').charAt(0).toUpperCase()}</span>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="relative h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#0c0e1c] flex items-center justify-center text-[10px] font-bold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200"
            title={`${overflow} weitere`}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="hidden sm:inline text-[11px] text-gray-500 dark:text-gray-400">
        {all.length} {all.length === 1 ? 'aktiv' : 'aktiv'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insert-Modals: Vorlage auswaehlen + Tabelle konfigurieren
// ---------------------------------------------------------------------------

const INSERT_TEMPLATES = [
  { value: 'brainstorm',       label: 'Brainstorm',         icon: Lightbulb,  desc: 'Sticky-Notes als Spinnen-Layout' },
  { value: 'idea_jam',         label: 'Idea Jam',           icon: Sparkles,   desc: 'Miro-Style: 5 Teilnehmer-Spalten mit Sticky-Notes' },
  { value: 'decision_tree',    label: 'Decision Tree',      icon: GitBranch,  desc: 'Problem → Entscheidung → Aktion → Ergebnis (mit Pfeilen)' },
  { value: 'kanban',           label: 'Kanban',             icon: KanbanIcon, desc: 'To Do / Doing / Done' },
  { value: 'retro',            label: 'Retro',              icon: ListChecks, desc: 'Was lief gut, schlecht, Action-Items' },
  { value: 'mindmap',          label: 'Mindmap',            icon: GitBranch,  desc: 'Zentral-Knoten + Verzweigungen' },
  { value: 'customer_journey', label: 'Customer Journey',   icon: MapPinned,  desc: 'Touchpoint-Phasen' },
  { value: 'scamper',          label: 'SCAMPER',            icon: ListChecks, desc: '7 Denkfilter: Substitute, Combine, Adapt …' },
  { value: '5_whys',           label: '5 Whys',             icon: GitBranch,  desc: 'Vertikale Warum-Kette zur Root-Cause' },
  { value: 'starbursting',     label: 'Starbursting',       icon: Sparkles,   desc: 'Zentrum + 6 Fragen (Wer/Was/Wann/Wo/Warum/Wie)' },
] as const;

function TemplatePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (template: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-[5] w-full max-w-xl rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5">
          <h3 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white">
            Vorlage einfügen
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INSERT_TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => onPick(t.value)}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 p-3 text-left hover:border-primary-300 dark:hover:border-primary-500/30 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all"
              >
                <Icon className="h-5 w-5 text-primary-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-5 py-3 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/5">
          Wird ans Zentrum deines aktuellen Viewports eingefügt.
        </div>
      </div>
    </div>
  );
}

function TablePickerModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
}) {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = rows >= 1 && rows <= 20 && cols >= 1 && cols <= 20;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-[5] w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5">
          <h3 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white">
            Tabelle einfügen
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Zeilen</span>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Spalten</span>
              <input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </label>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Erste Zeile wird automatisch als Header formatiert. Jede Zelle ist klickbar zum Editieren.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onInsert(rows, cols)}
            disabled={!valid}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Table2 className="h-3.5 w-3.5" />
            Einfügen
          </button>
        </div>
      </div>
    </div>
  );
}
