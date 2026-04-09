'use client';

import { useState, useMemo, type ReactNode } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Settings2,
  X,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardLayout, type WidgetConfig } from '@/stores/dashboard-layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WidgetDefinition {
  id: string;
  title: string;
  component: ReactNode;
  /** full = 12 cols, half = 6 cols, third = 4 cols on xl screens */
  size: 'full' | 'half' | 'third';
}

interface DashboardGridProps {
  /** Unique page key, e.g. '/finance' */
  page: string;
  widgets: WidgetDefinition[];
}

// ---------------------------------------------------------------------------
// Widget Wrapper
// ---------------------------------------------------------------------------

function WidgetWrapper({
  widget,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  widget: WidgetDefinition;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const sizeClass =
    widget.size === 'full'
      ? 'col-span-full'
      : widget.size === 'half'
        ? 'col-span-full xl:col-span-6'
        : 'col-span-full xl:col-span-4';

  return (
    <div className={cn(sizeClass, 'group/widget relative')}>
      {/* Move controls - visible on hover */}
      <div className="absolute -top-2 right-2 z-10 flex items-center gap-0.5 rounded-lg bg-white dark:bg-[#232640] shadow-md border border-border dark:border-white/10 px-1 py-0.5 opacity-0 group-hover/widget:opacity-100 transition-opacity duration-200">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={cn(
            'rounded p-0.5 transition-colors',
            isFirst
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-300',
          )}
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={cn(
            'rounded p-0.5 transition-colors',
            isLast
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-300',
          )}
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {widget.component}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customization Panel
// ---------------------------------------------------------------------------

function CustomizePanel({
  widgets,
  layout,
  onToggle,
  onReset,
  onClose,
}: {
  widgets: WidgetDefinition[];
  layout: WidgetConfig[];
  onToggle: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const layoutMap = new Map(layout.map((w) => [w.id, w]));

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-dropdown border border-border dark:border-white/10 p-4 animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Customize Dashboard
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {widgets.map((widget) => {
          const config = layoutMap.get(widget.id);
          const visible = config?.visible ?? true;
          return (
            <button
              key={widget.id}
              onClick={() => onToggle(widget.id)}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-all',
                visible
                  ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5'
                  : 'text-gray-400 dark:text-gray-500',
              )}
            >
              {visible ? (
                <Eye className="h-3.5 w-3.5 text-primary-500" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span>{widget.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Grid
// ---------------------------------------------------------------------------

export function DashboardGrid({ page, widgets }: DashboardGridProps) {
  const { getLayout, toggleWidget, moveWidget, resetLayout } = useDashboardLayout();
  const [showCustomize, setShowCustomize] = useState(false);

  const defaults: WidgetConfig[] = useMemo(
    () => widgets.map((w, i) => ({ id: w.id, visible: true, order: i })),
    [widgets],
  );

  const layout = getLayout(page, defaults);
  const widgetMap = new Map(widgets.map((w) => [w.id, w]));

  // Sort by order, filter visible
  const visibleWidgets = layout
    .sort((a, b) => a.order - b.order)
    .filter((w) => w.visible)
    .map((w) => widgetMap.get(w.id))
    .filter(Boolean) as WidgetDefinition[];

  return (
    <div className="space-y-4">
      {/* Customize button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            showCustomize
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-200 border border-transparent',
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Customize
        </button>
      </div>

      {/* Customize Panel */}
      {showCustomize && (
        <CustomizePanel
          widgets={widgets}
          layout={layout}
          onToggle={(id) => toggleWidget(page, id, defaults)}
          onReset={() => resetLayout(page)}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-6">
        {visibleWidgets.map((widget, i) => (
          <WidgetWrapper
            key={widget.id}
            widget={widget}
            isFirst={i === 0}
            isLast={i === visibleWidgets.length - 1}
            onMoveUp={() => moveWidget(page, widget.id, 'up', defaults)}
            onMoveDown={() => moveWidget(page, widget.id, 'down', defaults)}
          />
        ))}
      </div>

      {visibleWidgets.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            All widgets are hidden. Click "Customize" to show them.
          </p>
        </div>
      )}
    </div>
  );
}
