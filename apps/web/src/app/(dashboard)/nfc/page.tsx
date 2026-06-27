'use client';

import { useQuery } from '@tanstack/react-query';
import { Radio, Hash, ListChecks, Users, Loader2, TrendingUp, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import { nfcApi, type NfcDashboard } from '@/lib/nfc';

export default function NfcOverviewPage() {
  const q = useQuery({
    queryKey: ['nfc-dashboard'],
    queryFn: () => nfcApi.dashboard(),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center shadow-md">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            NFC4you
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            NFC-Bänder mit Notfall-Kontaktdaten für Kinder
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <div className="p-12 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
        </div>
      ) : q.data ? (
        <>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <Kpi label="Gesamt" value={q.data.totalBands} icon={<Radio className="h-3.5 w-3.5" />} />
            <Kpi label="Aktiviert" value={q.data.active} accent="text-emerald-600 dark:text-emerald-400" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
            <Kpi label="Noch nicht" value={q.data.inactive} accent="text-gray-600 dark:text-gray-300" icon={<AlertCircle className="h-3.5 w-3.5" />} />
            <Kpi label="Heute aktiviert" value={q.data.activatedToday} accent="text-cyan-600 dark:text-cyan-400" icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <Kpi label="7 Tage" value={q.data.activatedLast7} accent="text-cyan-600 dark:text-cyan-400" />
            <Kpi label="Scans (30d)" value={q.data.totalScansLast30} accent="text-blue-600 dark:text-blue-400" icon={<Activity className="h-3.5 w-3.5" />} />
          </div>

          {/* Quick-Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickLink href="/nfc/generate" icon={<Hash className="h-5 w-5" />} title="Codes generieren" desc="Neuen Batch von 1–10.000 Codes erstellen + CSV-Export" />
            <QuickLink href="/nfc/bands" icon={<ListChecks className="h-5 w-5" />} title="Alle Bänder" desc="Liste aller Bänder mit Status, Filter und Suche" />
            <QuickLink href="/nfc/customer-data" icon={<Users className="h-5 w-5" />} title="Kundendaten" desc="Aktivierte Bänder mit Kontaktdaten (DSGVO)" />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, accent, icon }: { label: string; value: number; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] hover:border-cyan-300 dark:hover:border-cyan-500/40 hover:shadow-md transition-all p-4">
      <div className="inline-flex h-9 w-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300 items-center justify-center mb-2">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
    </Link>
  );
}
