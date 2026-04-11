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
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-6 shadow-card dark:shadow-[var(--card-shadow)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/80">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Hallo, {userName}</h1>
          <blockquote className="mt-3 border-l-2 border-gray-200 dark:border-white/10 pl-4 text-sm italic text-gray-700 dark:text-white/70">
            &bdquo;{quote.text}&ldquo;
            <span className="ml-2 text-xs not-italic text-gray-500 dark:text-white/40">&mdash; {quote.author}</span>
          </blockquote>
          <p className="mt-3 text-sm text-gray-500 dark:text-white/50">Hier ist dein Ueberblick fuer heute.</p>
        </div>
      </div>
    </section>
  );
}
