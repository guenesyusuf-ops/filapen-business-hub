'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Star, X, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  userId?: string;
  userName?: string;
  name?: string;
}

interface InlineTaskCreateProps {
  onSubmit: (data: { title: string; assigneeIds?: string[]; priority: string }) => void;
  members?: Member[];
}

const PRIORITY_MAP: Record<number, string> = {
  1: 'low',
  2: 'medium',
  3: 'high',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Niedrig',
  2: 'Mittel',
  3: 'Hoch',
};

export function InlineTaskCreate({ onSubmit, members = [] }: InlineTaskCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [stars, setStars] = useState(2); // default medium
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      priority: PRIORITY_MAP[stars] || 'medium',
    });
    setTitle('');
    setAssigneeIds([]);
    setStars(2);
    setIsOpen(false);
  }

  function handleCancel() {
    setTitle('');
    setAssigneeIds([]);
    setStars(2);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4" />
        Aufgabe hinzufuegen
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary-300 dark:border-primary-500/40 bg-white dark:bg-[#1a1d2e] p-3 space-y-2 shadow-md">
      {/* Title */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Aufgabentitel..."
        className="w-full rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-2.5 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />

      {/* Assignees — multi-select */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="flex items-center gap-2 w-full rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-2 py-1 text-xs text-left focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <UserCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          {assigneeIds.length === 0 ? (
            <span className="text-gray-400">Mitarbeiter waehlen...</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {assigneeIds.map((id) => {
                const m = members.find((x) => (x.userId || x.id) === id);
                const name = m?.userName || m?.name || '?';
                return (
                  <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                    {name}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleAssignee(id); }}
                      className="hover:text-primary-900"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-lg py-1">
              {members.length === 0 && (
                <div className="px-3 py-1.5 text-[11px] text-gray-400">Keine Mitarbeiter</div>
              )}
              {members.map((m) => {
                const uid = m.userId || m.id;
                const checked = assigneeIds.includes(uid);
                const name = m.userName || m.name || 'Unbekannt';
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => toggleAssignee(uid)}
                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-left hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <input type="checkbox" checked={checked} readOnly className="accent-primary-600 h-3 w-3" />
                    <span className="text-gray-700 dark:text-gray-300">{name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Priority Stars */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Prio:</span>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            title={PRIORITY_LABELS[n]}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-4 w-4 transition-colors',
                n <= stars
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-gray-300 dark:text-gray-600',
              )}
            />
          </button>
        ))}
        <span className="text-[10px] text-gray-400 ml-1">{PRIORITY_LABELS[stars]}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="h-3 w-3" />
          Abbrechen
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Erstellen
        </button>
      </div>
    </div>
  );
}
