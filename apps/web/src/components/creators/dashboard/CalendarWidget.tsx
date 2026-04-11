'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  useCalendarNotesForMonth,
  useCreateCalendarNote,
  useUpdateCalendarNote,
  useDeleteCalendarNote,
  type CalendarNote,
} from '@/hooks/creators/useCalendarNotes';

// ---------------------------------------------------------------------------
// CalendarWidget
// Month grid with notes + reminders. Click a day to open the note editor.
// ---------------------------------------------------------------------------

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES_DE = [
  'Januar',
  'Februar',
  'Maerz',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  // Monday-first layout. Returns 42 cells (6 weeks) with nulls for padding days
  // outside the current month so we can render a clean grid.
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  // getDay(): 0=So, 1=Mo, ..., 6=Sa. Remap so Mo=0.
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CalendarWidget() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStr = `${viewYear}-${pad(viewMonth + 1)}`;
  const { data: notes = [] } = useCalendarNotesForMonth(monthStr);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Group notes by date (YYYY-MM-DD) for fast lookup.
  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarNote[]>();
    for (const n of notes) {
      const list = map.get(n.date) || [];
      list.push(n);
      map.set(n.date, list);
    }
    return map;
  }, [notes]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleClickDay = (date: Date) => {
    setSelectedDate(toDateString(date));
  };

  const selectedNotes = selectedDate ? notesByDate.get(selectedDate) || [] : [];
  const todayStr = toDateString(today);

  return (
    <section className="rounded-2xl border border-white/5 bg-[#111] p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Kalender</h2>
            <p className="text-xs text-white/40">
              {MONTH_NAMES_DE[viewMonth]} {viewYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
            aria-label="Naechster Monat"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-white/40">
        {WEEKDAYS_DE.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`pad-${idx}`} className="aspect-square" />;
          }
          const str = toDateString(date);
          const isToday = str === todayStr;
          const hasNotes = notesByDate.has(str);
          const isSelected = selectedDate === str;

          return (
            <button
              key={str}
              onClick={() => handleClickDay(date)}
              className={[
                'relative flex aspect-square items-center justify-center rounded-lg text-xs transition-colors',
                isSelected
                  ? 'bg-white/10 text-white ring-1 ring-white/20'
                  : isToday
                    ? 'bg-white/5 text-white ring-1 ring-white/15'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              {date.getDate()}
              {hasNotes && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayNoteEditor
          date={selectedDate}
          notes={selectedNotes}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DayNoteEditor — modal that manages notes + reminders for a single day
// ---------------------------------------------------------------------------

interface DayNoteEditorProps {
  date: string;
  notes: CalendarNote[];
  onClose: () => void;
}

function DayNoteEditor({ date, notes, onClose }: DayNoteEditorProps) {
  const [draft, setDraft] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const createMut = useCreateCalendarNote();
  const updateMut = useUpdateCalendarNote();
  const deleteMut = useDeleteCalendarNote();

  const handleCreate = async () => {
    if (!draft.trim()) return;
    let reminderAt: string | null = null;
    if (reminderTime) {
      reminderAt = new Date(`${date}T${reminderTime}:00`).toISOString();
    }
    await createMut.mutateAsync({ date, content: draft.trim(), reminderAt });
    setDraft('');
    setReminderTime('');
  };

  const handleStartEdit = (note: CalendarNote) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateMut.mutateAsync({
      id: editingId,
      data: { content: editingContent.trim() },
    });
    setEditingId(null);
    setEditingContent('');
  };

  const handleDelete = async (id: string) => {
    await deleteMut.mutateAsync(id);
    if (editingId === id) setEditingId(null);
  };

  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#111]">
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">{formatted}</h3>
            <p className="text-xs text-white/40">{notes.length} Notiz(en)</p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-white/50 hover:text-white"
          >
            Schliessen
          </button>
        </header>

        <div className="max-h-[55vh] overflow-y-auto">
          {notes.length === 0 && (
            <p className="px-5 py-6 text-center text-xs text-white/40">
              Noch keine Notizen fuer diesen Tag.
            </p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="border-b border-white/5 px-5 py-3">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-2 py-1 text-xs text-white/50 hover:text-white"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={updateMut.isPending}
                      className="rounded-md bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm text-white/80">
                      {note.content}
                    </p>
                    {note.reminderAt && (
                      <p className="mt-1 text-[10px] text-emerald-400">
                        Erinnerung:{' '}
                        {new Date(note.reminderAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-white"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deleteMut.isPending}
                      className="rounded-md px-2 py-1 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    >
                      Loeschen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="border-t border-white/5 px-5 py-4">
          <label className="mb-1 block text-xs font-medium text-white/60">Neue Notiz</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Was willst du dir fuer diesen Tag merken?"
            className="mb-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          />
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs text-white/50">Erinnerung um</label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
            />
            {reminderTime && (
              <button
                onClick={() => setReminderTime('')}
                className="text-[10px] text-white/40 hover:text-white"
              >
                zuruecksetzen
              </button>
            )}
          </div>
          <button
            onClick={handleCreate}
            disabled={!draft.trim() || createMut.isPending}
            className="w-full rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMut.isPending ? 'Speichere...' : 'Notiz speichern'}
          </button>
        </footer>
      </div>
    </div>
  );
}
