'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, PencilRuler, Trash2, X, Sparkles, Lightbulb, Kanban as KanbanIcon, ListChecks, GitBranch, MapPinned } from 'lucide-react';
import { whiteboardApi, type WhiteboardListItem } from '@/lib/whiteboard';
import { cn } from '@/lib/utils';

const TEMPLATES: { value: string; label: string; icon: any; desc: string }[] = [
  { value: 'blank', label: 'Leer', icon: PencilRuler, desc: 'Komplett leeres Canvas' },
  { value: 'brainstorm', label: 'Brainstorm', icon: Lightbulb, desc: 'Sticky-Notes für Ideensammlung' },
  { value: 'kanban', label: 'Kanban', icon: KanbanIcon, desc: 'To Do / Doing / Done Spalten' },
  { value: 'retro', label: 'Retro', icon: ListChecks, desc: 'Was lief gut, schlecht, Action-Items' },
  { value: 'mindmap', label: 'Mindmap', icon: GitBranch, desc: 'Zentral-Knoten + Verzweigungen' },
  { value: 'customer_journey', label: 'Customer Journey', icon: MapPinned, desc: 'Touchpoint-Phasen horizontal' },
];

export default function WhiteboardListPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<WhiteboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState<string>('blank');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await whiteboardApi.list();
      setBoards(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const board = await whiteboardApi.create({ title: newTitle.trim(), template: newTemplate });
      router.push(`/whiteboard/${board.id}`);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      window.alert(`Erstellen fehlgeschlagen: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(b: WhiteboardListItem) {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      {/* Boards grid */}
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
      ) : boards.length === 0 ? (
        <EmptyState onCreate={() => setShowNew(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map((b) => (
            <BoardCard key={b.id} board={b} onDelete={() => handleDelete(b)} />
          ))}
        </div>
      )}

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
    </div>
  );
}

function BoardCard({ board, onDelete }: { board: WhiteboardListItem; onDelete: () => void }) {
  const updated = new Date(board.updatedAt);
  const dateStr = updated.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Link
      href={`/whiteboard/${board.id}`}
      className="group relative block rounded-2xl border border-gray-200/70 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Thumbnail / placeholder */}
      <div className="aspect-video bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-white/[0.02] dark:via-white/[0.04] dark:to-white/[0.02] relative overflow-hidden">
        {board.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={board.thumbnailUrl} alt={board.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PencilRuler className="h-12 w-12 text-gray-300 dark:text-white/15" />
          </div>
        )}
        {/* Hover delete */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-lg bg-white/90 dark:bg-black/70 backdrop-blur-sm p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-all shadow-sm"
          title="Löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
  // ESC to close
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
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
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Templates */}
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
            className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onCreate}
            disabled={!title.trim() || creating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {creating ? 'Wird erstellt …' : 'Erstellen & öffnen'}
          </button>
        </div>
      </div>
    </div>
  );
}
