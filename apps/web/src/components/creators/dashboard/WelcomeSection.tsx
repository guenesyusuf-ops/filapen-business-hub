'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { getQuoteForDate } from '@/lib/quotes';

// ---------------------------------------------------------------------------
// WelcomeSection
// Greets the admin and shows a deterministic quote-of-the-day.
// ---------------------------------------------------------------------------

interface WelcomeSectionProps {
  userName?: string;
}

export function WelcomeSection({ userName = 'Admin' }: WelcomeSectionProps) {
  // Stable for the current calendar day, re-computed on remount.
  const quote = useMemo(() => getQuoteForDate(new Date()), []);

  return (
    <section className="rounded-2xl border border-white/5 bg-[#111] p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/80">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-white">Hallo, {userName}</h1>
          <blockquote className="mt-3 border-l-2 border-white/10 pl-4 text-sm italic text-white/70">
            &bdquo;{quote.text}&ldquo;
            <span className="ml-2 text-xs not-italic text-white/40">&mdash; {quote.author}</span>
          </blockquote>
          <p className="mt-3 text-sm text-white/50">Hier ist dein Ueberblick fuer heute.</p>
        </div>
      </div>
    </section>
  );
}
