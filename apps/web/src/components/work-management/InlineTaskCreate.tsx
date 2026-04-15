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
  onSubmit: (data: { title: string; assigneeId?: string; priority: string }) => void;
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
  const [assigneeId, setAssigneeId] = useState('');
  const [stars, setStars] = useState(2); // default medium
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      assigneeId: assigneeId || undefined,
      priority: PRIORITY_MAP[stars] || 'medium',
    });
    setTitle('');
    setAssigneeId('');
    setStars(2);
    setIsOpen(false);
  }

  function handleCancel() {
    setTitle('');
    setAssigneeId('');
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

      {/* Assignee */}
      <div className="flex items-center gap-2">
        <UserCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="flex-1 rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">Nicht zugewiesen</option>
          {members.map((m) => (
            <option key={m.userId || m.id} value={m.userId || m.id}>
              {m.userName || m.name || 'Unbekannt'}
            </option>
          ))}
        </select>
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
