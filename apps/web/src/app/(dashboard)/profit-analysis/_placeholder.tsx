import { Sparkles } from 'lucide-react';

/**
 * Gemeinsame Placeholder-Card fuer alle Modul-Bereiche die in Phase 1
 * noch leer sind. Zeigt dem User dass die Route existiert und was hier
 * in welcher Phase entsteht.
 *
 * Wird schrittweise durch die echten Seiten ersetzt.
 */
export function PlaceholderCard({
  title,
  subtitle,
  phase,
  description,
}: {
  title: string;
  subtitle: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                {phase}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{subtitle}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
