'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Markdown } from './Markdown';

interface Props {
  content: string;
  sections: Array<{ id: string; title: string }>;
}

// Filter: reduziert Content auf Absaetze/Sektionen die zum Suchterm passen.
// Behaelt jede H2-Sektion die im Titel oder in ihrem Body den Term enthaelt.
function filterBySearch(content: string, term: string): string {
  const t = term.trim().toLowerCase();
  if (!t) return content;

  const lines = content.split('\n');
  const preamble: string[] = [];
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      if (current) sections.push(current);
      current = { title: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);

  const matched = sections.filter((s) =>
    s.title.toLowerCase().includes(t) ||
    s.body.join('\n').toLowerCase().includes(t)
  );

  if (matched.length === 0) return '';
  // Preamble weglassen bei aktiver Suche — nur die Trefferbereiche zeigen.
  return matched.map((s) => `${s.title}\n${s.body.join('\n')}`).join('\n\n');
}

export function ModuleContent({ content, sections }: Props) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => filterBySearch(content, q), [content, q]);

  const visibleSections = useMemo(() => {
    if (!q.trim()) return sections;
    const shown = new Set<string>();
    for (const line of filtered.split('\n')) {
      const m = /^##\s+(.+)$/.exec(line);
      if (m) shown.add(m[1].trim());
    }
    return sections.filter((s) => shown.has(s.title));
  }, [q, filtered, sections]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8">
      {/* Sidebar mit Kapiteln (nur Desktop sticky) */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <nav className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 px-2 mb-2">Kapitel</div>
          {visibleSections.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-1">Keine Treffer</p>
          ) : (
            <ul className="space-y-0.5">
              {visibleSections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-lg px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.03] hover:text-gray-900 dark:hover:text-white"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="In dieser Anleitung suchen …"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        <article className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.02] px-5 sm:px-8 py-6 sm:py-8">
          {q.trim() && !filtered ? (
            <p className="text-sm text-gray-500">Kein Kapitel enthält „{q}".</p>
          ) : (
            <Markdown text={filtered} />
          )}
        </article>
      </div>
    </div>
  );
}
