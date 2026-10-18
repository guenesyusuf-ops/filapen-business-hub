import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Kleines Uppercase-Label über dem Titel (z. B. Modulgruppe). */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Aktionen rechts (Buttons, Segmented-Control …). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Einheitlicher Seitenkopf: Eyebrow + großer Display-Titel + Beschreibung,
 * Aktionen rechtsbündig. Ersetzt die uneinheitlichen rohen <h1>-Köpfe.
 */
export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-end gap-4 flex-wrap', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-primary-600">{eyebrow}</div>
        )}
        <h1 className="mt-1.5 m-0 font-semibold text-[clamp(26px,3vw,36px)] leading-[1.1] tracking-[-0.021em] text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 m-0 max-w-[62ch] text-[15px] leading-[1.5] text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}
