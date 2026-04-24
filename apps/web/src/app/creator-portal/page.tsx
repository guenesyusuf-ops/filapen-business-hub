'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Handshake,
  FileText,
  TrendingUp,
  Loader2,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalCreator {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  platform: string;
  creatorNotes?: string;
  inviteCode: string;
}

const API_BASE = `${API_URL}/api`;

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------

function LoginScreen({ onLogin }: { onLogin: (creator: PortalCreator) => void }) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill code from URL
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;
      setError('');
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/creator-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: code.trim() }),
        });

        if (!res.ok) {
          setError('Invalid invite code. Please try again.');
          return;
        }

        const data = await res.json();
        sessionStorage.setItem('creator_token', data.token);
        sessionStorage.setItem('creator_data', JSON.stringify(data.creator));
        window.dispatchEvent(new Event('creator-portal-auth'));
        onLogin(data.creator);
      } catch {
        setError('Connection error. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [code, onLogin],
  );

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Welcome</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your invite code to access your portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="INVITE CODE"
              maxLength={8}
              className="w-full text-center rounded-xl border border-gray-200 px-4 py-3 text-lg font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 uppercase"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={code.length < 4 || loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Access Portal
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (logged in)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calendar Widget
// ---------------------------------------------------------------------------

function CalendarWidget() {
  const [currentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = currentDate.getDate();

  const monthName = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // Get first day of month (0=Sun) and total days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Adjust for Monday start (0=Mon ... 6=Sun)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const dayHeaders = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 capitalize">{monthName}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayHeaders.map((d) => (
          <div key={d} className="text-[10px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={
              day === today
                ? 'h-8 w-8 mx-auto rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold'
                : day
                  ? 'h-8 w-8 mx-auto flex items-center justify-center text-xs text-gray-700 hover:bg-gray-50 rounded-full'
                  : 'h-8 w-8'
            }
          >
            {day || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clock Widget
// ---------------------------------------------------------------------------

function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Analog clock calculations
  const secAngle = (time.getSeconds() / 60) * 360;
  const minAngle = ((time.getMinutes() + time.getSeconds() / 60) / 60) * 360;
  const hrAngle = (((time.getHours() % 12) + time.getMinutes() / 60) / 12) * 360;

  return (
    <div className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
      {/* Analog clock face */}
      <div className="relative w-32 h-32 mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Outer ring */}
          <circle cx="50" cy="50" r="48" fill="none" stroke="#e5e7eb" strokeWidth="1" />
          <circle cx="50" cy="50" r="46" fill="white" stroke="#f3f4f6" strokeWidth="0.5" />

          {/* Hour markers */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(angle);
            const y1 = 50 + 40 * Math.sin(angle);
            const x2 = 50 + 44 * Math.cos(angle);
            const y2 = 50 + 44 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 3 === 0 ? '#6b7280' : '#d1d5db'}
                strokeWidth={i % 3 === 0 ? '1.5' : '0.8'}
                strokeLinecap="round"
              />
            );
          })}

          {/* Hour hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 24 * Math.cos((hrAngle - 90) * (Math.PI / 180))}
            y2={50 + 24 * Math.sin((hrAngle - 90) * (Math.PI / 180))}
            stroke="#1f2937"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Minute hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 34 * Math.cos((minAngle - 90) * (Math.PI / 180))}
            y2={50 + 34 * Math.sin((minAngle - 90) * (Math.PI / 180))}
            stroke="#4b5563"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Second hand */}
          <line
            x1="50"
            y1="50"
            x2={50 + 38 * Math.cos((secAngle - 90) * (Math.PI / 180))}
            y2={50 + 38 * Math.sin((secAngle - 90) * (Math.PI / 180))}
            stroke="#7c3aed"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Center dot */}
          <circle cx="50" cy="50" r="2" fill="#7c3aed" />
        </svg>
      </div>

      {/* Digital time */}
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 font-mono tracking-wider">
          {hours}:{minutes}
          <span className="text-sm text-violet-500 ml-0.5">{seconds}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{dateStr}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (logged in)
// ---------------------------------------------------------------------------

function PortalDashboard({ creator }: { creator: PortalCreator }) {
  const [stats, setStats] = useState({ uploads: 0, deals: 0, briefings: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = sessionStorage.getItem('creator_token') || '';
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [uploadsRes, dealsRes] = await Promise.all([
          fetch(`${API_BASE}/creator-uploads?creatorId=${creator.id}`, { headers }),
          fetch(`${API_BASE}/deals?creatorId=${creator.id}`, { headers }),
        ]);
        const uploads = uploadsRes.ok ? await uploadsRes.json() : [];
        const deals = dealsRes.ok ? await dealsRes.json() : { items: [] };
        setStats({
          uploads: Array.isArray(uploads) ? uploads.length : 0,
          deals: Array.isArray(deals) ? deals.length : (deals.items?.length ?? 0),
          briefings: 0,
        });
      } catch {
        // ignore
      }
    }
    fetchStats();
  }, [creator.id]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
          Welcome back, {creator.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Here is an overview of your creator portal.
        </p>
      </div>

      {/* Creator notes from admin */}
      {creator.creatorNotes && (
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
          <p className="text-xs font-medium text-violet-600 mb-1">
            Message from your team
          </p>
          <p className="text-sm text-violet-800">{creator.creatorNotes}</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Upload className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.uploads}</p>
              <p className="text-xs text-gray-500">Total Uploads</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Handshake className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.deals}</p>
              <p className="text-xs text-gray-500">Active Deals</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.briefings}</p>
              <p className="text-xs text-gray-500">Briefings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clock & Calendar row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ClockWidget />
        <CalendarWidget />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/creator-portal/uploads"
          className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Inhalte hochladen</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Bilder, Videos oder Rohdateien hochladen
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
          </div>
        </Link>
        <Link
          href="/creator-portal/invitations"
          className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Meine Einladungen</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Projekteinladungen ansehen und annehmen
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
          </div>
        </Link>
        <Link
          href="/creator-portal/briefings"
          className="rounded-xl bg-white dark:bg-white/5 p-5 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Briefings</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                View your briefings
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function CreatorPortalInner() {
  const [creator, setCreator] = useState<PortalCreator | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        setCreator(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const stored = sessionStorage.getItem('creator_data');
      if (stored) {
        try {
          setCreator(JSON.parse(stored));
        } catch {
          setCreator(null);
        }
      } else {
        setCreator(null);
      }
    };
    window.addEventListener('creator-portal-auth', handler);
    return () => window.removeEventListener('creator-portal-auth', handler);
  }, []);

  if (!creator) {
    return <LoginScreen onLogin={setCreator} />;
  }

  return <PortalDashboard creator={creator} />;
}

export default function CreatorPortalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>}>
      <CreatorPortalInner />
    </Suspense>
  );
}
