'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowUp, ArrowDown, ArrowUpDown, ChevronRight,
  MoreHorizontal, Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  key: string;
  /** Header-Label — falls weggelassen, wird der key genutzt. */
  label?: string;
  /** Wie der Wert in der Tabelle gerendert wird (Desktop + Mobile-Hauptzeile). */
  render: (row: T) => React.ReactNode;
  /** Verstecke diese Spalte auf bestimmten Breakpoints.
   *  'mobile'  = nur ab sm:
   *  'tablet'  = nur ab md: (Desktop only)
   *  'never'   = immer sichtbar
   *  Default:  'never' */
  hide?: 'mobile' | 'tablet' | 'never';
  /** Sortier-Key (server-side). Wenn gesetzt, wird der Header klickbar. */
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Auf Mobile: zeige als Label-Wert-Paar unter der Hauptzeile. */
  mobileLabel?: string;
  /** Auf Mobile: rendert anders als Desktop (z.B. mit Label). */
  mobileRender?: (row: T) => React.ReactNode;
  /** Auf Mobile: wird komplett ausgeblendet (nicht in Card). */
  mobileHidden?: boolean;
  /** Mindestbreite in der Tabelle. */
  minWidth?: string;
  className?: string;
}

export interface RowAction<T> {
  label: string;
  icon: React.ReactNode;
  onClick: (row: T) => void;
  /** rote Variante z.B. fuer Loeschen. */
  danger?: boolean;
  /** Nur anzeigen wenn diese Funktion true returnt. */
  visible?: (row: T) => boolean;
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Row-Klick zum Oeffnen einer Detailansicht. */
  onRowClick?: (row: T) => void;
  /** Inline-Aktionen rechts (auf Desktop in der letzten Spalte, auf Mobile als Icon-Reihe unten). */
  actions?: RowAction<T>[];
  /** Server-side Sort: gibt key zurueck wenn User klickt. */
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  /** Eindeutiger Key pro Row. */
  rowKey: (row: T) => string;
  /** Loading-State (zeigt Skeleton/Spinner). */
  loading?: boolean;
  /** Was anzeigen wenn keine Daten. */
  empty?: React.ReactNode;
  /** Auf Mobile: was als "Titelzeile" der Card dienen soll (1-2 Spalten-Keys). */
  mobilePrimary?: string;
  mobileSecondary?: string;
  /** Footer-Slot (Pagination etc). */
  footer?: React.ReactNode;
  /** Zusatz-Klassen am Wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResponsiveTable<T>({
  data, columns, onRowClick, actions = [],
  sortKey, sortDir, onSortChange, rowKey,
  loading, empty, mobilePrimary, mobileSecondary,
  footer, className,
}: ResponsiveTableProps<T>) {
  function handleSort(col: ColumnDef<T>) {
    if (!col.sortable || !onSortChange) return;
    if (sortKey === col.key) onSortChange(col.key, sortDir === 'asc' ? 'desc' : 'asc');
    else onSortChange(col.key, 'desc');
  }

  if (loading && data.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]', className)}>
        <div className="p-16 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]', className)}>
        {empty ?? (
          <div className="p-12 text-center text-sm text-gray-500">Keine Einträge.</div>
        )}
      </div>
    );
  }

  // Visible columns auf Desktop (alle), auf Mobile (mit hide-Logik)
  const desktopCols = columns.filter((c) => c.hide !== 'never' ? true : true);
  const mobileCols = columns.filter((c) => !c.mobileHidden && c.hide !== 'tablet');

  const primaryCol = mobilePrimary ? columns.find((c) => c.key === mobilePrimary) : columns[0];
  const secondaryCol = mobileSecondary ? columns.find((c) => c.key === mobileSecondary) : null;
  // Restliche Spalten als Label-Wert-Paare auf Mobile
  const restMobileCols = mobileCols.filter(
    (c) => c.key !== primaryCol?.key && c.key !== secondaryCol?.key,
  );

  return (
    <div className={cn('rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden', className)}>
      {/* DESKTOP — Klassische Tabelle (ab sm) */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
              <tr>
                {desktopCols.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-3',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.hide === 'tablet' && 'hidden md:table-cell',
                    )}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200',
                          sortKey === col.key && 'text-primary-700 dark:text-primary-300',
                        )}
                      >
                        {col.label ?? col.key}
                        {sortKey === col.key
                          ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                          : <ArrowUpDown className="h-3 w-3 opacity-40" />
                        }
                      </button>
                    ) : (col.label ?? col.key)}
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className="w-1 px-3 py-3"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors group',
                    onRowClick && 'hover:bg-primary-50/40 dark:hover:bg-primary-900/10 cursor-pointer',
                  )}
                >
                  {desktopCols.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-3',
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                        col.hide === 'tablet' && 'hidden md:table-cell',
                        col.className,
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {actions.filter((a) => !a.visible || a.visible(row)).map((a) => (
                          <button
                            key={a.label}
                            onClick={() => a.onClick(row)}
                            title={a.label}
                            className={cn(
                              'p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8',
                              a.danger ? 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:text-primary-600',
                            )}
                          >
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE — Karten-Stack */}
      <div className="sm:hidden divide-y divide-gray-100 dark:divide-white/5">
        {data.map((row) => (
          <MobileCard
            key={rowKey(row)}
            row={row}
            primary={primaryCol}
            secondary={secondaryCol}
            rest={restMobileCols}
            actions={actions.filter((a) => !a.visible || a.visible(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          />
        ))}
      </div>

      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Card
// ---------------------------------------------------------------------------

function MobileCard<T>({
  row, primary, secondary, rest, actions, onClick,
}: {
  row: T;
  primary?: ColumnDef<T>;
  secondary?: ColumnDef<T> | null;
  rest: ColumnDef<T>[];
  actions: RowAction<T>[];
  onClick?: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className={cn('px-4 py-3 active:bg-primary-50/40 dark:active:bg-primary-900/10', onClick && 'cursor-pointer')}>
      {/* Click-Surface fuer Hauptzeile */}
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="w-full text-left disabled:cursor-default"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Primary */}
            {primary && (
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {primary.mobileRender ? primary.mobileRender(row) : primary.render(row)}
              </div>
            )}
            {/* Secondary */}
            {secondary && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {secondary.mobileRender ? secondary.mobileRender(row) : secondary.render(row)}
              </div>
            )}
            {/* Rest — Label/Wert-Paare */}
            {rest.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {rest.slice(0, 4).map((col) => (
                  <div key={col.key} className={cn(col.align === 'right' && 'text-right')}>
                    {(col.mobileLabel || col.label) && (
                      <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">
                        {col.mobileLabel ?? col.label}
                      </div>
                    )}
                    <div className="text-gray-800 dark:text-gray-200 truncate">
                      {col.mobileRender ? col.mobileRender(row) : col.render(row)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {onClick && (
            <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 flex-shrink-0 mt-1" />
          )}
        </div>
      </button>

      {/* Mobile-Action-Reihe */}
      {actions.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
          {actions.slice(0, 3).map((a) => (
            <button
              key={a.label}
              onClick={() => a.onClick(row)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                a.danger
                  ? 'text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                  : 'text-gray-700 dark:text-gray-300 bg-gray-50/80 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08]',
              )}
            >
              {a.icon} {a.label}
            </button>
          ))}
          {actions.length > 3 && (
            <button
              onClick={() => setActionsOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {/* Zusatz-Aktionen wenn mehr als 3 */}
      {actionsOpen && actions.length > 3 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {actions.slice(3).map((a) => (
            <button
              key={a.label}
              onClick={() => a.onClick(row)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                a.danger
                  ? 'text-red-600 bg-red-50/60 hover:bg-red-100'
                  : 'text-gray-700 dark:text-gray-300 bg-gray-50/80 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08]',
              )}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
