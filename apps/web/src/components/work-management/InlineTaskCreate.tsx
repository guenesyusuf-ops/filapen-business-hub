'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface InlineTaskCreateProps {
  onSubmit: (title: string) => void;
}

export function InlineTaskCreate({ onSubmit }: InlineTaskCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setTitle('');
    }
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setTitle('');
      setIsOpen(false);
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
    <div className="p-2">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder="Aufgabe eingeben..."
        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
  );
}
