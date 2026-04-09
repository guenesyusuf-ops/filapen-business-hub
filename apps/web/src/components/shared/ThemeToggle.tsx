'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface-secondary dark:bg-[var(--bg-tertiary)] dark:border-white/10 p-0.5 gap-0.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex items-center justify-center rounded-md p-1.5 transition-all duration-150',
              active
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
            )}
            title={opt.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
