'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, PencilRuler, Trash2, X, Sparkles, Lightbulb, Kanban as KanbanIcon,
  ListChecks, GitBranch, MapPinned, Folder, FolderPlus, MoreHorizontal,
  Edit3, FolderOpen, FolderInput, Inbox, FolderX,
} from 'lucide-react';
import {
  whiteboardApi,
  type WhiteboardListItem,
  type WhiteboardFolder,
} from '@/lib/whiteboard';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

const TEMPLATES: { value: string; label: string; icon: any; desc: string }[] = [
  { value: 'blank', label: 'Leer', icon: PencilRuler, desc: 'Komplett leeres Canvas' },
  { value: 'brainstorm', label: 'Brainstorm', icon: Lightbulb, desc: 'Sticky-Notes für Ideensammlung' },
  { value: 'kanban', label: 'Kanban', icon: KanbanIcon, desc: 'To Do / Doing / Done Spalten' },
  { value: 'retro', label: 'Retro', icon: ListChecks, desc: 'Was lief gut, schlecht, Action-Items' },
  { value: 'mindmap', label: 'Mindmap', icon: GitBranch, desc: 'Zentral-Knoten + Verzweigungen' },
  { value: 'customer_journey', label: 'Customer Journey', icon: MapPinned, desc: 'Touchpoint-Phasen horizontal' },
];

// Spezial-Selektoren fuer die Sidebar (keine echten Ordner-IDs)
type FolderSel = 'all' | 'unfiled' | string;

export default function WhiteboardListPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [boards, setBoards] = useState<WhiteboardListItem[]>([]);
  const [folders, setFolders] = useState<WhiteboardFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<FolderSel>('all');

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState<string>('blank');
  const [creating, setCreating] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Move-Board Modal: welches Board ist gerade in Bewegung
  const [moveBoard, setMoveBoard] = useState<WhiteboardListItem | null>(null);

  // Delete-Folder Modal
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [boardsData, foldersData] = await Promise.all([
        whiteboardApi.list(),
        whiteboardApi.listFolders(),
      ]);
      setBoards(boardsData);
      setFolders(foldersData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Boards nach gewaehltem Ordner filtern
  const visibleBoards = useMemo(() => {
    if (selectedFolder === 'all') return boards;
    if (selectedFolder === 'unfiled') return boards.filter((b) => !b.folderId);
    return boards.filter((b) => b.folderId === selectedFolder);
  }, [boards, selectedFolder]);

  // Permission-Check: nur Ersteller oder Owner darf loeschen
  const canDeleteBoard = (b: WhiteboardListItem) =>
    !!currentUser && (b.createdById === currentUser.id || currentUser.role === 'owner');
  const canManageFolder = (f: WhiteboardFolder) =>
    !!currentUser && (f.createdById === currentUser.id || currentUser.role === 'owner');

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const board = await whiteboardApi.create({ title: newTitle.trim(), template: newTemplate });
      // wenn ein Ordner gewaehlt ist, neues Board direkt dort einsortieren
      if (selectedFolder !== 'all' && selectedFolder !== 'unfiled') {
        await whiteboardApi.move(board.id, selectedFolder);
      }
      router.push(`/whiteboard/${board.id}`);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(`Erstellen fehlgeschlagen: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(b: WhiteboardListItem) {
    if (!canDeleteBoard(b)) {
      // eslint-disable-next-line no-alert
      window.alert('Nur der Ersteller oder ein Owner darf dieses Whiteboard loeschen.');
      return;
    }
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Whiteboard "${b.title}" wirklich löschen? Kann nicht rückgängig gemacht werden.`)) return;
    try {
      await whiteboardApi.remove(b.id);
      setBoards((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(e.message);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await whiteboardApi.createFolder(newFolderName.trim());
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFolder(folder.id);
      setShowNewFolder(false);
      setNewFolderName('');
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(`Ordner anlegen fehlgeschlagen: ${e.message}`);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameFolder(folderId: string, currentName: string) {
    // eslint-disable-next-line no-alert
    const next = window.prompt('Neuer Ordnername:', currentName)?.trim();
    if (!next || next === currentName) return;
    try {
      const updated = await whiteboardApi.renameFolder(folderId, next);
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f))
        .sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(e.message);
    }
  }

  async function handleDeleteFolderConfirmed(cascadeMove: 'unfiled' | string | null) {
    if (!deleteFolderId) return;
    // Optional vor dem Loeschen alle Boards verschieben
    const boardsInFolder = boards.filter((b) => b.folderId === deleteFolderId);
    try {
      if (cascadeMove !== null) {
        // cascadeMove ist 'unfiled' (=null im Backend) oder eine Ziel-Ordner-ID
        const targetFolderId = cascadeMove === 'unfiled' ? null : cascadeMove;
        for (const b of boardsInFolder) {
          await whiteboardApi.move(b.id, targetFolderId);
        }
      }
      await whiteboardApi.removeFolder(deleteFolderId);
      setFolders((prev) => prev.filter((f) => f.id !== deleteFolderId));
      // Boards lokal updaten je nach Cascade-Choice
      if (cascadeMove !== null) {
        const targetFolderId = cascadeMove === 'unfiled' ? null : cascadeMove;
        setBoards((prev) => prev.map((b) => (b.folderId === deleteFolderId ? { ...b, folderId: targetFolderId } : b)));
      } else {
        // Boards bleiben (Backend setzt FK SET NULL)
        setBoards((prev) => prev.map((b) => (b.folderId === deleteFolderId ? { ...b, folderId: null } : b)));
      }
      if (selectedFolder === deleteFolderId) setSelectedFolder('all');
      setDeleteFolderId(null);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(e.message);
    }
  }

  async function handleMoveBoard(boardId: string, targetFolderId: string | null) {
    try {
      await whiteboardApi.move(boardId, targetFolderId);
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, folderId: targetFolderId } : b)));
      setMoveBoard(null);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(e.message);
    }
  }

  // ----------------------------------------------------------------

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Whiteboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kollaboratives Canvas für Brainstorming, Roadmaps und Workshops
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Neues Board
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5">
        {/* Sidebar: Ordner-Liste */}
        <FolderSidebar
          folders={folders}
          selected={selectedFolder}
          onSelect={setSelectedFolder}
          onCreateFolder={() => setShowNewFolder(true)}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={(id) => setDeleteFolderId(id)}
          canManageFolder={canManageFolder}
          unfiledCount={boards.filter((b) => !b.folderId).length}
          allCount={boards.length}
        />

        {/* Boards-Bereich */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 p-6 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : visibleBoards.length === 0 ? (
            <EmptyState onCreate={() => setShowNew(true)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleBoards.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  canDelete={canDeleteBoard(b)}
                  onDelete={() => handleDelete(b)}
                  onMove={() => setMoveBoard(b)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New-Board Modal */}
      {showNew && (
        <NewBoardModal
          title={newTitle}
          template={newTemplate}
          creating={creating}
          onClose={() => { setShowNew(false); setNewTitle(''); setNewTemplate('blank'); }}
          onTitleChange={setNewTitle}
          onTemplateChange={setNewTemplate}
          onCreate={handleCreate}
        />
      )}

      {/* New-Folder Modal */}
      {showNewFolder && (
        <SimpleModal
          title="Neuer Ordner"
          onClose={() => { setShowNewFolder(false); setNewFolderName(''); }}
        >
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newFolderName.trim() && !creatingFolder) handleCreateFolder(); }}
            placeholder="z.B. Workshops, Q3 Planung …"
            className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creatingFolder ? 'Wird angelegt …' : 'Anlegen'}
            </button>
          </div>
        </SimpleModal>
      )}

      {/* Move-Board Modal */}
      {moveBoard && (
        <MoveBoardModal
          board={moveBoard}
          folders={folders}
          onClose={() => setMoveBoard(null)}
          onMove={(folderId) => handleMoveBoard(moveBoard.id, folderId)}
        />
      )}

      {/* Delete-Folder Modal */}
      {deleteFolderId && (
        <DeleteFolderModal
          folder={folders.find((f) => f.id === deleteFolderId)!}
          boardsInFolder={boards.filter((b) => b.folderId === deleteFolderId)}
          otherFolders={folders.filter((f) => f.id !== deleteFolderId)}
          onClose={() => setDeleteFolderId(null)}
          onConfirm={handleDeleteFolderConfirmed}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — Ordner-Liste links neben den Boards
// ---------------------------------------------------------------------------

function FolderSidebar({
  folders, selected, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder,
  canManageFolder, unfiledCount, allCount,
}: {
  folders: WhiteboardFolder[];
  selected: FolderSel;
  onSelect: (s: FolderSel) => void;
  onCreateFolder: () => void;
  onRenameFolder: (id: string, currentName: string) => void;
  onDeleteFolder: (id: string) => void;
  canManageFolder: (f: WhiteboardFolder) => boolean;
  unfiledCount: number;
  allCount: number;
}) {
  return (
    <aside className="rounded-2xl border border-gray-200/70 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-2 h-fit lg:sticky lg:top-3">
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        Ordner
      </div>

      <SidebarItem
        icon={Inbox}
        label="Alle Boards"
        count={allCount}
        active={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      <SidebarItem
        icon={FolderX}
        label="Kein Ordner"
        count={unfiledCount}
        active={selected === 'unfiled'}
        onClick={() => onSelect('unfiled')}
      />

      <div className="my-1 h-px bg-gray-100 dark:bg-white/5" />

      {folders.length === 0 && (
        <div className="px-2 py-1.5 text-[11px] italic text-gray-400 dark:text-gray-500">
          Keine Ordner angelegt
        </div>
      )}

      {folders.map((f) => (
        <FolderRow
          key={f.id}
          folder={f}
          active={selected === f.id}
          canManage={canManageFolder(f)}
          onClick={() => onSelect(f.id)}
          onRename={() => onRenameFolder(f.id, f.name)}
          onDelete={() => onDeleteFolder(f.id)}
        />
      ))}

      <div className="my-1 h-px bg-gray-100 dark:bg-white/5" />

      <button
        onClick={onCreateFolder}
        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium transition-colors"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Neuer Ordner
      </button>
    </aside>
  );
}

function SidebarItem({
  icon: Icon, label, count, active, onClick,
}: {
  icon: any; label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center w-full gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
        active
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{count}</span>
    </button>
  );
}

function FolderRow({
  folder, active, canManage, onClick, onRename, onDelete,
}: {
  folder: WhiteboardFolder;
  active: boolean;
  canManage: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = active ? FolderOpen : Folder;

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          'flex items-center w-full gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
          active
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
        )}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{folder._count?.whiteboards ?? 0}</span>
      </button>
      {canManage && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
            title="Ordner-Aktionen"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onRename(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Edit3 className="h-3 w-3" /> Umbenennen
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3 w-3" /> Löschen
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardCard — mit 3-Punkte-Menue fuer Verschieben + Loeschen
// ---------------------------------------------------------------------------

function BoardCard({
  board, canDelete, onDelete, onMove,
}: {
  board: WhiteboardListItem;
  canDelete: boolean;
  onDelete: () => void;
  onMove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const updated = new Date(board.updatedAt);
  const dateStr = updated.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Link
      href={`/whiteboard/${board.id}`}
      className="group relative block rounded-2xl border border-gray-200/70 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="aspect-video bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-white/[0.02] dark:via-white/[0.04] dark:to-white/[0.02] relative overflow-hidden">
        {board.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={board.thumbnailUrl} alt={board.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PencilRuler className="h-12 w-12 text-gray-300 dark:text-white/15" />
          </div>
        )}

        {/* Menue (3 Punkte) — immer sichtbar bei Hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="rounded-lg bg-white/90 dark:bg-black/70 backdrop-blur-sm p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all shadow-sm"
            title="Aktionen"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }}
              />
              <div
                className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 py-1"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onMove(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <FolderInput className="h-3 w-3" /> Verschieben
                </button>
                {canDelete && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3 w-3" /> Löschen
                  </button>
                )}
                {!canDelete && (
                  <div className="px-3 py-1.5 text-[10px] italic text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/5 mt-0.5">
                    Nur der Ersteller darf löschen
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{board.title}</div>
        {board.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{board.description}</div>
        )}
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
          Bearbeitet {dateStr}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] py-20 px-6 text-center">
      <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-950/30 items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-2">
        Erstes Whiteboard erstellen
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
        Visualisiere Ideen, plane mit deinem Team, ordne Aufgaben an. Wähle ein Template oder starte mit leerem Canvas.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <Plus className="h-4 w-4" />
        Neues Board
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function SimpleModal({
  title, children, onClose,
}: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-[5] w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function MoveBoardModal({
  board, folders, onClose, onMove,
}: {
  board: WhiteboardListItem;
  folders: WhiteboardFolder[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <SimpleModal title={`"${board.title}" verschieben`} onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Ziel-Ordner waehlen:
      </p>
      <div className="space-y-1 max-h-[50vh] overflow-y-auto">
        <button
          onClick={() => onMove(null)}
          className={cn(
            'flex items-center w-full gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
            board.folderId === null
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
          )}
        >
          <FolderX className="h-4 w-4" />
          Kein Ordner
          {board.folderId === null && <span className="ml-auto text-[10px]">aktuell</span>}
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => onMove(f.id)}
            className={cn(
              'flex items-center w-full gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              board.folderId === f.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
            )}
          >
            <Folder className="h-4 w-4" />
            <span className="flex-1 text-left truncate">{f.name}</span>
            {board.folderId === f.id && <span className="text-[10px]">aktuell</span>}
          </button>
        ))}
      </div>
    </SimpleModal>
  );
}

function DeleteFolderModal({
  folder, boardsInFolder, otherFolders, onClose, onConfirm,
}: {
  folder: WhiteboardFolder;
  boardsInFolder: WhiteboardListItem[];
  otherFolders: WhiteboardFolder[];
  onClose: () => void;
  onConfirm: (cascadeMove: 'unfiled' | string | null) => void;
}) {
  const [cascadeChoice, setCascadeChoice] = useState<'unfiled' | string | null>('unfiled');

  return (
    <SimpleModal title={`Ordner "${folder.name}" löschen`} onClose={onClose}>
      {boardsInFolder.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Der Ordner ist leer und wird sofort geloescht.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            ⚠ Im Ordner liegen <strong>{boardsInFolder.length}</strong> Whiteboard{boardsInFolder.length === 1 ? '' : 's'}.
            Bevor du loeschst, waehle was damit passieren soll:
          </div>
          <div className="space-y-1.5 mt-2">
            <RadioRow
              checked={cascadeChoice === 'unfiled'}
              onSelect={() => setCascadeChoice('unfiled')}
              label="Boards in &quot;Kein Ordner&quot; verschieben"
              icon={FolderX}
            />
            {otherFolders.map((f) => (
              <RadioRow
                key={f.id}
                checked={cascadeChoice === f.id}
                onSelect={() => setCascadeChoice(f.id)}
                label={`In &quot;${f.name}&quot; verschieben`}
                icon={Folder}
              />
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-end gap-2 pt-3">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          Abbrechen
        </button>
        <button
          onClick={() => onConfirm(boardsInFolder.length === 0 ? null : cascadeChoice)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-600 to-red-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Ordner löschen
        </button>
      </div>
    </SimpleModal>
  );
}

function RadioRow({
  checked, onSelect, label, icon: Icon,
}: { checked: boolean; onSelect: () => void; label: string; icon: any }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center w-full gap-2 rounded-lg px-3 py-2 text-sm border transition-colors',
        checked
          ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5',
      )}
    >
      <span className={cn(
        'inline-flex h-4 w-4 rounded-full border items-center justify-center flex-shrink-0',
        checked ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-white/20',
      )}>
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <Icon className="h-3.5 w-3.5 text-gray-500" />
      <span className="text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: label }} />
    </button>
  );
}

function NewBoardModal({
  title, template, creating, onClose, onTitleChange, onTemplateChange, onCreate,
}: {
  title: string;
  template: string;
  creating: boolean;
  onClose: () => void;
  onTitleChange: (s: string) => void;
  onTemplateChange: (s: string) => void;
  onCreate: () => void;
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
        className="relative z-[5] w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white">
            Neues Whiteboard
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Titel
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && title.trim() && !creating) onCreate(); }}
              placeholder="z.B. Q3 Roadmap, Customer Journey, Team Retro …"
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const active = template === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onTemplateChange(t.value)}
                    className={cn(
                      'group relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                        : 'border-gray-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/30 hover:bg-gray-50 dark:hover:bg-white/[0.02]',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400')} />
                    <div>
                      <div className={cn('text-xs font-semibold', active ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white')}>
                        {t.label}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-500 leading-tight mt-0.5">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            Abbrechen
          </button>
          <button
            onClick={onCreate}
            disabled={!title.trim() || creating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? 'Wird erstellt …' : 'Erstellen & öffnen'}
          </button>
        </div>
      </div>
    </div>
  );
}
