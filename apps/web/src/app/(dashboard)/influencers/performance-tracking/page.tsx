'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { influencerPerformanceApi, type PerformanceEntry } from '@/lib/influencer-performance';

/**
 * Phase 1 Skeleton — Daten-Connection ist live, sobald Migration durch ist.
 * Naechste Phase bringt: Filter-Bar, KPI-Cards, Tabelle, Add/Edit-Modal,
 * Multi-Views, Score-System.
 */
export default function PerformanceTrackingPage() {
  const [items, setItems] = useState<PerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    influencerPerformanceApi.list({ limit: 50 })
      .then((d) => { setItems(d.items); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Performance Tracking
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Influencer-Kampagnen tracken + Profitabilitaet analysieren
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 px-3 py-2 text-xs text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-700/30">
          <TrendingUp className="h-3.5 w-3.5" />
          Phase 1/6 · Schema + API live
        </div>
      </div>

      {/* Status-Banner — bis das volle UI in Phase 2-6 dazu kommt. */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-white to-gray-50/30 dark:from-white/[0.02] dark:to-white/[0.01] p-8 text-center">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            ⚠ Backend-Connection: {error}
            <p className="text-xs text-gray-500 mt-2">
              Falls "table not found": Migration in Supabase noch nicht ausgefuehrt.
            </p>
          </div>
        ) : (
          <>
            <TrendingUp className="h-12 w-12 mx-auto text-violet-500 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Modul-Foundation steht — {items.length} Eintrag{items.length === 1 ? '' : 'e'} in der DB
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              Nächste Phasen bringen: Hauptdatenbank-Tabelle mit allen Properties,
              KPI-Dashboard, Multi-Views, Score-System, Pipeline-Kanban,
              Whitelist/Blacklist, Trends, Content-Library.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6 max-w-2xl mx-auto text-left">
              <PhaseTile n="1" label="Schema + API" status="done" />
              <PhaseTile n="2" label="CRUD + Tabelle" status="next" />
              <PhaseTile n="3" label="Multi-Views" status="pending" />
              <PhaseTile n="4" label="KPI-Dashboard" status="pending" />
              <PhaseTile n="5" label="Score + Rankings" status="pending" />
              <PhaseTile n="6" label="Polish + Extras" status="pending" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PhaseTile({ n, label, status }: { n: string; label: string; status: 'done' | 'next' | 'pending' }) {
  const styles = {
    done:    'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    next:    'border-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 ring-2 ring-violet-200 dark:ring-violet-900/40',
    pending: 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400',
  };
  const icon = status === 'done' ? '✓' : status === 'next' ? '→' : '·';
  return (
    <div className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${styles[status]}`}>
      <span className="font-bold w-5 h-5 inline-flex items-center justify-center rounded-full bg-white/60 dark:bg-white/10">{n}</span>
      <span className="flex-1 font-medium">{label}</span>
      <span className="text-base">{icon}</span>
    </div>
  );
}
