'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  /** true = tabulare Zahlendarstellung, rechtsbündig. */
  numeric?: boolean;
  width?: string;
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  minWidth?: number;
  className?: string;
  /** Wird angezeigt, wenn rows leer ist. */
  empty?: ReactNode;
}

/**
 * Premium-Datentabelle: präzise Zeilenhöhen/Spaltenabstände, Haarlinien,
 * tabulare Zahlen, ruhige Hover-/Auswahl-Zustände. Horizontal scrollbar im
 * eigenen Container (Seitenkörper scrollt nie seitwärts).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  minWidth = 640,
  className,
  empty,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }
  return (
    <div className={cn('overflow-x-auto', className)} style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full border-collapse text-[13.5px]" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(
                  'sticky top-0 z-[1] bg-[var(--card-bg)] px-4 py-3 font-bold text-[11px] uppercase tracking-[0.04em] text-[rgb(var(--color-text-tertiary))] whitespace-nowrap border-b',
                  ds.hairline,
                  c.numeric || c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row);
            const selected = selectedKey != null && k === selectedKey;
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'transition-colors duration-100',
                  onRowClick && 'cursor-pointer',
                  selected ? 'bg-primary-500/10' : 'hover:bg-primary-500/[0.05]',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 whitespace-nowrap border-b',
                      ds.hairline,
                      (c.numeric || c.align === 'right') && 'text-right [font-variant-numeric:tabular-nums] tracking-[-0.01em]',
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
