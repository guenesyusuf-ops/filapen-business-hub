'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useFinanceUI } from '@/stores/finance-ui';
import { useTranslation } from '@/i18n/useTranslation';
import { formatDateRange } from '@filapen/shared/src/utils/date';
import type { DatePreset } from '@filapen/shared/src/types/finance';
import { cn } from '@/lib/utils';

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function DateRangePicker() {
  const {
    dateRange,
    datePreset,
    comparisonEnabled,
    setDateRange,
    toggleComparison,
  } = useFinanceUI();
  const { t } = useTranslation();

  const PRESETS: { label: string; value: DatePreset }[] = [
    { label: t('finance.today'), value: 'today' },
    { label: t('finance.last7Days'), value: '7d' },
    { label: t('finance.last30Days'), value: '30d' },
    { label: t('finance.last90Days'), value: '90d' },
    { label: t('finance.yearToDate'), value: 'ytd' },
  ];

  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateForInput(dateRange.start));
  const [customEnd, setCustomEnd] = useState(formatDateForInput(dateRange.end));
  const [open, setOpen] = useState(false);

  const presetLabel = PRESETS.find((p) => p.value === datePreset)?.label ?? t('finance.custom');
  const displayText = datePreset !== 'custom'
    ? `Last ${presetLabel}`
    : formatDateRange(dateRange.start, dateRange.end);

  function handlePresetClick(preset: DatePreset) {
    setDateRange(preset);
    setCustomMode(false);
    setOpen(false);
  }

  function handleApplyCustom() {
    const start = new Date(customStart + 'T00:00:00Z');
    const end = new Date(customEnd + 'T00:00:00Z');
    if (start <= end) {
      setDateRange({ start, end });
      setOpen(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2',
            'text-sm text-gray-700 shadow-sm transition-colors',
            'hover:bg-surface-secondary hover:border-border-strong',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          )}
        >
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>{displayText}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 w-72 rounded-xl border border-border bg-white p-4 shadow-dropdown',
            'animate-fade-in',
          )}
        >
          {/* Presets */}
          <div className="space-y-1 mb-3">
            <p className="text-xxs font-medium uppercase tracking-wider text-gray-400 mb-2">
              {t('common.quickSelect')}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    datePreset === preset.value && !customMode
                      ? 'bg-primary text-white'
                      : 'bg-surface-secondary text-gray-600 hover:bg-surface-tertiary',
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setCustomMode(true)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  customMode
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary text-gray-600 hover:bg-surface-tertiary',
                )}
              >
                {t('finance.custom')}
              </button>
            </div>
          </div>

          {/* Custom date inputs */}
          {customMode && (
            <div className="space-y-2 mb-3 border-t border-border-subtle pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">{t('common.start')}</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xxs text-gray-500 mb-1 block">{t('common.end')}</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <button
                onClick={handleApplyCustom}
                className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
              >
                {t('common.apply')}
              </button>
            </div>
          )}

          {/* Comparison toggle */}
          <div className="border-t border-border-subtle pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={comparisonEnabled}
                onChange={toggleComparison}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <span className="text-xs text-gray-600">{t('common.compareToPreviousPeriod')}</span>
            </label>
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
