'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
      Bald
    </span>
  );
}

export function SectionCard({
  title, description, actions, children, className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-white/8">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
