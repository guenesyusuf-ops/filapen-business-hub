'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search, ChevronRight } from 'lucide-react';
import { MANUAL_MODULES, MODULE_GROUPS, type ModuleGroup } from '@/lib/manual/modules';

export default function ManualLandingPage() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return MANUAL_MODULES;
    return MANUAL_MODULES.filter((m) =>
      m.label.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term) ||
      m.slug.includes(term)
    );
  }, [q]);

  const grouped = useMemo(() => {
    const groups: Record<ModuleGroup, typeof MANUAL_MODULES> = {
      operativ: [], analytics: [], marketing: [], admin: [],
    };
    for (const m of filtered) groups[m.group].push(m);
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center shadow-md flex-shrink-0">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            Anleitungen
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kompakte Nachschlagewerke pro Modul — Funktionen, Workflows, Verknüpfungen und häufige Fragen.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Modul oder Thema suchen …"
          autoFocus
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-10 text-center">
          <p className="text-sm text-gray-500">Keine Anleitung passt zu „{q}".</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(MODULE_GROUPS) as ModuleGroup[]).map((g) => {
            const items = grouped[g];
            if (items.length === 0) return null;
            return (
              <section key={g}>
                <h2 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-3">
                  {MODULE_GROUPS[g]}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((m) => {
                    const Icon = m.icon;
                    return (
                      <Link
                        key={m.slug}
                        href={`/settings/manual/${m.slug}`}
                        className="group rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.03] hover:border-primary-300 dark:hover:border-primary-500/40 hover:shadow-md transition-all p-4 flex items-start gap-3"
                      >
                        <div className={`inline-flex h-10 w-10 rounded-xl bg-gray-50 dark:bg-white/[0.05] items-center justify-center flex-shrink-0 ${m.accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.label}</h3>
                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{m.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
