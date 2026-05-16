'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { useMyWmTasks } from '@/hooks/work-management/useWm';
import {
  usePersonalNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  usePersonalEvents,
  useCreateEvent,
  useDeleteEvent,
  type PersonalCalendarEvent,
  type PersonalNote,
} from '@/hooks/useHome';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Pin,
  PinOff,
  Plus,
  Trash2,
  StickyNote,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Clock,
  AlertTriangle,
  Bell,
  X,
} from 'lucide-react';
// Phosphor Duotone-Icons geben optische Tiefe durch zwei Farblayer —
// die sehen sofort premium aus. Nur für WOW-Bereiche (KPI-Cards, Hero).
import {
  ListChecks as PhListChecks,
  Clock as PhClock,
  CheckCircle as PhCheckCircle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { OnlineUsersWidget } from '@/components/home/OnlineUsersWidget';
import { PendingApprovalsWidget } from '@/components/home/PendingApprovalsWidget';
import { ShortcutInbox } from '@/components/home/ShortcutInbox';
import { CurrencyWidget } from '@/components/home/CurrencyWidget';
import { VacationModal } from '@/components/home/VacationModal';
import { VacationInbox } from '@/components/home/VacationInbox';
import { vacationApi, type VacationRequest } from '@/lib/vacation';
import { colorForUser, splitGradient } from '@/lib/userColor';
import { Plane } from 'lucide-react';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Hallo';
  if (h < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

const WELCOME_MESSAGES = [
  'Schön, dass du wieder da bist',
  'Bereit, etwas Großes zu erledigen?',
  'Heute ist ein guter Tag, um Dinge zu bewegen',
  'Lass uns loslegen',
  'Fokussiert bleibt am meisten hängen',
];

function messageForToday(): string {
  // Deterministic per day — same greeting all day
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) % 997;
  return WELCOME_MESSAGES[h % WELCOME_MESSAGES.length];
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOTE_COLORS = [
  { value: '#FEF3C7', label: 'Gelb' },
  { value: '#DBEAFE', label: 'Blau' },
  { value: '#D1FAE5', label: 'Gruen' },
  { value: '#FCE7F3', label: 'Pink' },
  { value: '#EDE9FE', label: 'Lila' },
];

// -----------------------------------------------------------------------------
// Greeting card
// -----------------------------------------------------------------------------

function GreetingCard() {
  const { user } = useAuthStore();
  const firstName = user?.firstName || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Team';
  const initial = (user?.firstName || user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const greeting = greetingFor();
  const message = messageForToday();

  const now = new Date();
  const weekday = now.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateLong = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-bento">
      {/* Theme-Sättigungs-Layer: stark sichtbarer Akzent-Gradient damit der
          Theme-Wechsel sofort auffällt (Standard zu Mystic = navy → tiefes
          Lila). Kombiniert mit dem subtileren Mesh oben drauf. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-90"
        style={{
          backgroundImage:
            'linear-gradient(110deg, transparent 0%, transparent 35%, rgb(var(--accent-1) / 0.25) 60%, rgb(var(--accent-3) / 0.35) 85%, rgb(var(--accent-4) / 0.4) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-mesh pointer-events-none opacity-90" />
      {/* Weicher Fade nur auf der linken ~40% damit der Avatar-/Greeting-
          Bereich lesbar bleibt — Theme-Akzent zeigt sich rechts deutlich. */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white via-white/85 to-transparent dark:from-[var(--card-bg)] dark:via-[color:var(--card-bg)]/85 dark:to-transparent" style={{ backgroundSize: '60% 100%', backgroundRepeat: 'no-repeat' }} />
      {/* Grain-Overlay für Premium-Haptik */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      <div className="relative p-7 md:p-9 flex items-start gap-6">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={firstName}
            className="h-14 w-14 rounded-2xl object-cover ring-2 ring-gray-100 dark:ring-white/10"
          />
        ) : (
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-blue flex items-center justify-center shadow-glow-soft">
            <span className="text-xl font-bold text-white">{initial}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 font-semibold mb-2">
            {greeting}
          </p>
          <h1 className="font-display-serif text-4xl md:text-5xl font-medium leading-[1.05] tracking-tight text-gray-900 dark:text-white">
            {firstName}<span className="text-brand-amber">.</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-xl">{message}</p>
        </div>
        <div className="hidden md:block text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold">{weekday}</p>
          <p className="font-display-serif text-3xl font-medium mt-1 text-gray-900 dark:text-white tracking-tight">
            {now.getDate()}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">{dateLong.split(' ').slice(1).join(' ')}</p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tasks widget
// -----------------------------------------------------------------------------

function TasksWidget() {
  const { data: tasks, isLoading } = useMyWmTasks();
  const open = useMemo(() => (tasks ?? []).filter((t) => !t.completed), [tasks]);
  const todayStr = isoDay(new Date());
  const overdue = open.filter((t) => t.dueDate && t.dueDate.split('T')[0] < todayStr).length;

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent-work" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Meine Aufgaben</h2>
          {open.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-[10px] font-bold text-primary-700 dark:text-primary-300">
              {open.length}
            </span>
          )}
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1 ml-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {overdue} überfällig
            </span>
          )}
        </div>
        <Link
          href="/work-management/my-tasks"
          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium inline-flex items-center gap-1"
        >
          Alle
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 divide-y divide-gray-100 dark:divide-white/5 max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="py-8 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
        {!isLoading && open.length === 0 && (
          <div className="py-10 px-5 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alles erledigt</p>
            <p className="text-xs text-gray-400 mt-1">Dir sind aktuell keine offenen Aufgaben zugewiesen.</p>
          </div>
        )}
        {!isLoading && open.slice(0, 8).map((task) => {
          const overdueTask =
            task.dueDate && task.dueDate.split('T')[0] < todayStr;
          return (
            <Link
              key={task.id}
              href={`/work-management/${task.projectId}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
              {task.dueDate && (
                <span
                  className={cn(
                    'text-[10px] font-medium flex-shrink-0',
                    overdueTask ? 'text-red-500' : 'text-gray-400',
                  )}
                >
                  {new Date(task.dueDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Calendar widget
// -----------------------------------------------------------------------------

function CalendarWidget() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showVacation, setShowVacation] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(isoDay(now));
  const [vacations, setVacations] = useState<VacationRequest[]>([]);

  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);

  const { data: events = [] } = usePersonalEvents(
    monthStart.toISOString(),
    new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 1).toISOString(),
  );

  // Genehmigte Urlaube des aktuellen Monats holen
  useEffect(() => {
    const from = isoDay(monthStart);
    const to = isoDay(monthEnd);
    vacationApi.listApproved(from, to).then(setVacations).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PersonalCalendarEvent[]>();
    for (const ev of events) {
      const key = isoDay(new Date(ev.startsAt));
      const existing = map.get(key) ?? [];
      existing.push(ev);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  // Urlaubs-Map: pro Tag alle Urlaubs-Eintraege (kann sich ueber mehrere Tage spannen)
  const vacationsByDay = useMemo(() => {
    const map = new Map<string, VacationRequest[]>();
    for (const v of vacations) {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = isoDay(d);
        const arr = map.get(key) ?? [];
        arr.push(v);
        map.set(key, arr);
      }
    }
    return map;
  }, [vacations]);

  // Monday-first week layout
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent-purchase" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Kalender</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowVacation(true)}
            className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20"
          >
            <Plus className="h-3 w-3" />
            Urlaub
          </button>
          <button
            onClick={() => { setSelectedDate(isoDay(new Date())); setShowAdd(true); }}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            <Plus className="h-3 w-3" />
            Termin
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {viewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setMonthOffset((o) => o + 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
            <div key={d} className="text-[10px] font-bold text-gray-400 text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="h-8" />;
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const key = isoDay(date);
            const isToday = key === isoDay(new Date());
            const isSelected = key === selectedDate;
            const hasEvents = eventsByDay.has(key);
            const dayVacations = vacationsByDay.get(key) ?? [];
            const hasVacation = dayVacations.length > 0;
            // Pro Mitarbeiter einmalige Farbe; bei mehreren → split-Gradient
            const colors = dayVacations.map((v) => colorForUser(v.userId));
            // Dedupliziert nach Farbe (falls zwei Antraege vom gleichen User)
            const uniqueColors = colors.filter((c, idx, arr) => arr.findIndex((x) => x.name === c.name) === idx);
            const vacationStyle = hasVacation && !isSelected
              ? { background: splitGradient(uniqueColors), color: uniqueColors[0].text }
              : undefined;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(key)}
                style={vacationStyle}
                className={cn(
                  'h-8 rounded-md text-xs font-bold relative transition-colors overflow-hidden',
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : hasVacation
                      ? '' // Background kommt via inline style
                      : isToday
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium',
                )}
                title={hasVacation ? dayVacations.map((v) => v.user?.name || v.user?.firstName || 'Mitarbeiter').join(' · ') : undefined}
              >
                {d}
                {hasEvents && (
                  <span className={cn(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full',
                    isSelected ? 'bg-white' : 'bg-primary-500',
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events for selected day */}
      <div className="border-t border-gray-100 dark:border-white/5 px-5 py-3 max-h-40 overflow-y-auto flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {new Date(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
        {(() => {
          const dayVacations = vacationsByDay.get(selectedDate) ?? [];
          if (selectedEvents.length === 0 && dayVacations.length === 0) {
            return <p className="text-xs text-gray-400 italic">Keine Termine</p>;
          }
          return (
            <div className="space-y-2">
              {dayVacations.map((v) => (
                <VacationRow key={v.id} vacation={v} />
              ))}
              {selectedEvents.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          );
        })()}
      </div>

      {showAdd && (
        <AddEventModal defaultDate={selectedDate} onClose={() => setShowAdd(false)} />
      )}
      {showVacation && (
        <VacationModal
          defaultStart={selectedDate}
          onClose={() => setShowVacation(false)}
          onCreated={() => {
            // Re-fetch nach Submit — falls Owner selber Urlaub eintraegt + sofort genehmigt
            const from = isoDay(monthStart);
            const to = isoDay(monthEnd);
            vacationApi.listApproved(from, to).then(setVacations).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function VacationRow({ vacation }: { vacation: VacationRequest }) {
  const userName = vacation.user?.name
    || [vacation.user?.firstName, vacation.user?.lastName].filter(Boolean).join(' ').trim()
    || 'Mitarbeiter';
  const color = colorForUser(vacation.userId);
  return (
    <div
      className="flex items-start gap-2 rounded-md px-2 py-1.5"
      style={{ background: `${color.bg}20`, borderLeft: `3px solid ${color.bg}` }}
    >
      <span
        className="h-3 w-3 rounded-full mt-0.5 flex-shrink-0 ring-2 ring-white dark:ring-gray-900"
        style={{ background: color.bg }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
          Urlaub · {userName}
        </p>
        <p className="text-[10px] text-gray-600 dark:text-gray-400">
          {new Date(vacation.startDate).toLocaleDateString('de-DE')} – {new Date(vacation.endDate).toLocaleDateString('de-DE')}
        </p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: PersonalCalendarEvent }) {
  const deleteEvent = useDeleteEvent();
  const start = new Date(event.startsAt);
  return (
    <div className="group flex items-start gap-2 rounded-md bg-gray-50 dark:bg-white/[0.03] px-2 py-1.5">
      <div
        className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ backgroundColor: event.color || '#8b5cf6' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{event.title}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          {event.allDay
            ? 'Ganztägig'
            : start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {event.reminderAt && (
            <span className="inline-flex items-center gap-0.5 ml-2">
              <Bell className="h-2.5 w-2.5" />
              Erinnerung
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => deleteEvent.mutate(event.id)}
        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function AddEventModal({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const createEvent = useCreateEvent();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [allDay, setAllDay] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [color, setColor] = useState('#8b5cf6');

  async function handleSave() {
    if (!title.trim()) return;
    const startsAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${time}`);
    const reminderAt = reminder ? new Date(startsAt.getTime() - reminderMinutes * 60_000) : undefined;
    await createEvent.mutateAsync({
      title: title.trim(),
      startsAt: startsAt.toISOString(),
      allDay,
      reminderAt: reminderAt?.toISOString(),
      color,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-2xl p-6 border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Neuer Termin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
            />
            {!allDay && (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
              />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-primary-600" />
            Ganztägig
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} className="accent-primary-600" />
            Erinnerung
          </label>
          {reminder && (
            <div className="flex items-center gap-2 pl-6">
              <input
                type="number"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-20 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-500">Minuten vorher</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Farbe:</span>
            {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn('h-5 w-5 rounded-full border-2', color === c ? 'border-gray-900 dark:border-white' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || createEvent.isPending}
            className="px-4 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Notes widget
// -----------------------------------------------------------------------------

function NotesWidget() {
  const { data: notes = [], isLoading } = usePersonalNotes();
  const createNote = useCreateNote();
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState<string>(NOTE_COLORS[0].value);

  function handleAdd() {
    if (!newNote.trim()) return;
    createNote.mutate({ content: newNote.trim(), color: newColor });
    setNewNote('');
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200/70 dark:border-white/8 shadow-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-accent-email" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Notizen</h2>
          {notes.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-[10px] font-bold text-primary-700 dark:text-primary-300">
              {notes.length}
            </span>
          )}
        </div>
      </div>

      {/* New note input */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 space-y-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Neue Notiz..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setNewColor(c.value)}
                title={c.label}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-all',
                  newColor === c.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newNote.trim()}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Speichern
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto auto-rows-max">
        {isLoading && (
          <div className="col-span-2 py-8 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
        {!isLoading && notes.length === 0 && (
          <div className="col-span-2 py-8 text-center">
            <StickyNote className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Noch keine Notizen</p>
          </div>
        )}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: PersonalNote }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  function save() {
    if (content.trim() && content !== note.content) {
      updateNote.mutate({ id: note.id, content: content.trim() });
    }
    setEditing(false);
  }

  return (
    <div
      className="group relative rounded-lg p-3 text-xs shadow-sm hover:shadow-md transition-all"
      style={{ backgroundColor: note.color || '#FEF3C7' }}
    >
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => updateNote.mutate({ id: note.id, pinned: !note.pinned })}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300"
          title={note.pinned ? 'Loesen' : 'Anpinnen'}
        >
          {note.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          onClick={() => deleteNote.mutate(note.id)}
          className="p-1 rounded hover:bg-red-500/20 text-red-700"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {note.pinned && (
        <Pin className="absolute top-1 left-1 h-3 w-3 text-gray-600" />
      )}
      {editing ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
          rows={3}
          className="w-full bg-transparent text-gray-900 dark:text-white resize-none focus:outline-none pt-3"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-gray-900 dark:text-white whitespace-pre-wrap pt-3 pr-5 cursor-text break-words"
        >
          {note.content}
        </p>
      )}
      <p className="text-[9px] text-gray-600 mt-1.5 opacity-60">
        {new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Quick stats
// -----------------------------------------------------------------------------

function QuickStats() {
  const { data: tasks = [] } = useMyWmTasks();
  const open = tasks.filter((t) => !t.completed).length;
  const completedToday = tasks.filter(
    (t) => t.completed && t.updatedAt?.split('T')[0] === isoDay(new Date()),
  ).length;
  const todayStr = isoDay(new Date());
  const dueToday = tasks.filter(
    (t) => !t.completed && t.dueDate?.split('T')[0] === todayStr,
  ).length;

  // 3 Theme-Akzent-Rollen rotieren über die Cards. Tints bei /35 alpha damit
  // der Theme-Wechsel auf weißem Hintergrund deutlich sichtbar wird (vorher
  // /15 war zu subtil — User hat berechtigt nichts gesehen).
  const items = [
    {
      label: 'Offene Aufgaben', value: open,
      Icon: PhListChecks,
      tint: 'from-theme-2/30 to-theme-2/5',
      iconColor: 'text-theme-2',
      ring: 'ring-theme-2/40',
    },
    {
      label: 'Heute fällig', value: dueToday,
      Icon: PhClock,
      tint: 'from-theme-4/30 to-theme-4/5',
      iconColor: 'text-theme-4',
      ring: 'ring-theme-4/40',
    },
    {
      label: 'Heute erledigt', value: completedToday,
      Icon: PhCheckCircle,
      tint: 'from-theme-3/30 to-theme-3/5',
      iconColor: 'text-theme-3',
      ring: 'ring-theme-3/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            'group relative overflow-hidden rounded-2xl bg-white dark:bg-[var(--card-bg)]',
            'border border-gray-200/70 dark:border-white/8 shadow-card hover:shadow-card-hover',
            'transition-all duration-300 hover:-translate-y-0.5',
            'p-5',
          )}
        >
          {/* Gradient-Tint im Hintergrund — dezent, nur sichtbar wenn man hinschaut */}
          <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', it.tint)} />

          <div className="relative flex items-start justify-between">
            <div className={cn(
              'h-12 w-12 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center',
              'ring-1', it.ring, 'shadow-sm',
            )}>
              <it.Icon className={cn('h-6 w-6', it.iconColor)} weight="duotone" />
            </div>
          </div>
          <div className="relative mt-4">
            <p className="font-display-serif text-5xl font-medium tracking-tight text-gray-900 dark:text-white leading-none">
              {it.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium uppercase tracking-wider">
              {it.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const canReview = user?.role === 'owner' || user?.role === 'admin';
  return (
    <div className="space-y-5 animate-fade-in w-full">
      <GreetingCard />
      <QuickStats />
      <PendingApprovalsWidget />
      {/* Owner/Admin: offene Urlaubsantraege */}
      <VacationInbox canReview={canReview} />
      <VacationDecisionPopup />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <TasksWidget />
        <CalendarWidget />
        <NotesWidget />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <ShortcutInbox />
        <OnlineUsersWidget />
        <CurrencyWidget />
      </div>
    </div>
  );
}

/**
 * Popup-Benachrichtigung fuer Mitarbeiter: zeigt frische Entscheidungen
 * (approved/rejected innerhalb der letzten 7 Tage), die der User noch
 * nicht "gesehen" hat (LocalStorage-Tracking — kein DB-Read-State).
 */
function VacationDecisionPopup() {
  const [decisions, setDecisions] = useState<VacationRequest[]>([]);
  useEffect(() => {
    vacationApi.listMine().then((all) => {
      const seenRaw = typeof window !== 'undefined' ? localStorage.getItem('vacation:seen') : null;
      const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const fresh = all.filter((r) =>
        (r.status === 'approved' || r.status === 'rejected') &&
        r.reviewedAt && new Date(r.reviewedAt).getTime() > cutoff &&
        !seen.has(r.id),
      );
      setDecisions(fresh);
    }).catch(() => {});
  }, []);
  function dismiss(id: string) {
    const seenRaw = localStorage.getItem('vacation:seen');
    const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
    seen.add(id);
    localStorage.setItem('vacation:seen', JSON.stringify(Array.from(seen)));
    setDecisions((prev) => prev.filter((r) => r.id !== id));
  }
  if (decisions.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:max-w-sm">
      {decisions.map((r) => {
        const approved = r.status === 'approved';
        return (
          <div
            key={r.id}
            className={cn(
              'rounded-2xl shadow-2xl border overflow-hidden animate-fade-in-down',
              approved
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-500/30',
            )}
          >
            <div className="flex items-start gap-3 p-4">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                approved ? 'bg-emerald-500' : 'bg-red-500',
              )}>
                <Plane className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-sm font-semibold',
                  approved ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100',
                )}>
                  {approved ? 'Urlaub genehmigt' : 'Urlaub abgelehnt'}
                </div>
                <div className={cn(
                  'text-xs mt-0.5',
                  approved ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
                )}>
                  {new Date(r.startDate).toLocaleDateString('de-DE')} – {new Date(r.endDate).toLocaleDateString('de-DE')}
                </div>
                {r.reviewNote && (
                  <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-1.5 italic break-words">
                    Notiz: {r.reviewNote}
                  </div>
                )}
              </div>
              <button onClick={() => dismiss(r.id)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
