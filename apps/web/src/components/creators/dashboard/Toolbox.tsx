'use client';

import { useRouter } from 'next/navigation';
import { PenTool, FileText, BarChart3, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Toolbox — 3 quick tool cards in the right sidebar.
// ---------------------------------------------------------------------------

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  comingSoon?: boolean;
}

function ToolCard({ icon, title, subtitle, onClick, comingSoon }: ToolCardProps) {
  const disabled = comingSoon || !onClick;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-3 rounded-xl border border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-black/20 px-3 py-3 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-gray-300 dark:hover:border-white/10 hover:bg-gray-100 dark:hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{title}</div>
        <div className="truncate text-xs text-gray-500 dark:text-white/40">
          {comingSoon ? 'Bald verfügbar' : subtitle}
        </div>
      </div>
      {!disabled && <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-white/30" />}
    </button>
  );
}

export function Toolbox() {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-5 shadow-card dark:shadow-[var(--card-shadow)]">
      <header className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
          <PenTool className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Toolbox</h2>
      </header>

      <div className="space-y-2">
        <ToolCard
          icon={<PenTool className="h-4 w-4" />}
          title="Headline Generator"
          subtitle="Titel per KI erstellen"
          onClick={() => router.push('/content/generate')}
        />
        <ToolCard
          icon={<FileText className="h-4 w-4" />}
          title="Skript Generator"
          subtitle=""
          comingSoon
        />
        <ToolCard
          icon={<BarChart3 className="h-4 w-4" />}
          title="Konkurrenz Analyse"
          subtitle=""
          comingSoon
        />
      </div>
    </section>
  );
}
