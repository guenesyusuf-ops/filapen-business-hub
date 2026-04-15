'use client';

import { cn } from '@/lib/utils';

export const TASK_COLORS = [
  { value: null, label: 'Keine', bg: 'bg-gray-200 dark:bg-gray-600' },
  { value: '#EF4444', label: 'Rot', bg: 'bg-red-500' },
  { value: '#F59E0B', label: 'Gelb', bg: 'bg-yellow-500' },
  { value: '#10B981', label: 'Gruen', bg: 'bg-green-500' },
  { value: '#3B82F6', label: 'Blau', bg: 'bg-blue-500' },
] as const;

interface TaskColorPickerProps {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
}

export function TaskColorPicker({ value, onChange }: TaskColorPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Farbe:</span>
      {TASK_COLORS.map((c) => {
        const isSelected = (c.value ?? null) === (value ?? null);
        return (
          <button
            key={c.value ?? 'none'}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              'h-5 w-5 rounded-full border-2 transition-all',
              c.bg,
              isSelected
                ? 'border-gray-900 dark:border-white scale-110'
                : 'border-transparent hover:border-gray-400 dark:hover:border-gray-500',
            )}
          />
        );
      })}
    </div>
  );
}
