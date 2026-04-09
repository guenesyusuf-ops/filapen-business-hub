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
} from 'lucide-react';
import Link from 'next/link';

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

const API_BASE = '/api';

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
          <h1 className="text-xl font-semibold text-gray-900">Welcome</h1>
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

function PortalDashboard({ creator }: { creator: PortalCreator }) {
  const [stats, setStats] = useState({ uploads: 0, deals: 0, briefings: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [uploadsRes, dealsRes] = await Promise.all([
          fetch(`${API_BASE}/creator-uploads?creatorId=${creator.id}`),
          fetch(`${API_BASE}/deals?creatorId=${creator.id}`),
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
        <h1 className="text-xl font-semibold text-gray-900">
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
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Upload className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.uploads}</p>
              <p className="text-xs text-gray-500">Total Uploads</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Handshake className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.deals}</p>
              <p className="text-xs text-gray-500">Active Deals</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.briefings}</p>
              <p className="text-xs text-gray-500">Briefings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/creator-portal/uploads"
          className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Upload Content</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload images, videos, or raw files
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
          </div>
        </Link>
        <Link
          href="/creator-portal/deals"
          className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">View Deals</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Check your active and completed deals
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
