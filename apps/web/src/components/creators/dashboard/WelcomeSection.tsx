'use client';

import { useMemo } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { getQuoteForDate } from '@/lib/quotes';

interface WelcomeSectionProps {
  userName?: string;
  stats?: { uploadCount?: number; creatorCount?: number } | null;
}

export function WelcomeSection({ userName = 'Admin', stats }: WelcomeSectionProps) {
  const quote = useMemo(() => getQuoteForDate(new Date()), []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-theme-3 via-theme-3 to-theme-2 p-6 sm:p-8 text-white shadow-lg">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-white/80" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Creator Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {greeting}, {userName}
          </h1>
          <p className="mt-2 text-sm text-white/70 max-w-md">
            Hier ist dein Überblick für heute. Verwalte deine Creator, Projekte und Content.
          </p>
        </div>

        {/* Quick insight chips */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {stats.creatorCount ?? 0} Creator aktiv
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-medium">
              {stats.uploadCount ?? 0} Uploads
            </div>
          </div>
        )}
      </div>

      {/* Quote */}
      <div className="relative mt-5 pt-4 border-t border-white/10">
        <p className="text-xs text-white/50 italic">
          &bdquo;{quote.text}&ldquo; <span className="not-italic text-white/30">&mdash; {quote.author}</span>
        </p>
      </div>
    </section>
  );
}
