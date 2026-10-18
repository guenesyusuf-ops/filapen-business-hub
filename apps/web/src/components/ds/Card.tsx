import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ohne Schatten (reine Haarlinien-Fläche). */
  flat?: boolean;
  /** Hover-Anhebung (für klickbare Karten). */
  interactive?: boolean;
}

/** Neutrale Premium-Fläche: Haarlinie + präziser Radius, Schatten nur gezielt. */
export function Card({ flat, interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        ds.card,
        ds.rCard,
        'overflow-hidden',
        !flat && ds.shadowCard,
        interactive && cn(ds.ease, 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--border-color)]'),
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 px-[18px] py-4 border-b', ds.hairline, className)}>
      <h3 className="m-0 text-[16px] font-semibold tracking-[-0.012em] text-[var(--text-primary)]">{title}</h3>
      {meta && <span className="text-[12.5px] text-[var(--text-secondary)]">{meta}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-[18px]', className)} {...rest}>
      {children}
    </div>
  );
}
