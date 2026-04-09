import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DatePreset } from '@filapen/shared/src/types/finance';
import { getPresetDateRange, getComparisonRange } from '@filapen/shared/src/utils/date';

interface FinanceUIState {
  dateRange: { start: Date; end: Date };
  datePreset: DatePreset | 'custom';
  comparisonEnabled: boolean;
  comparisonDateRange: { start: Date; end: Date } | null;
  selectedChannel: string | null;
  currency: string;
  sidebarCollapsed: boolean;
  setDateRange: (preset: DatePreset | { start: Date; end: Date }) => void;
  toggleComparison: () => void;
  setChannel: (channel: string | null) => void;
  setCurrency: (currency: string) => void;
  toggleSidebar: () => void;
}

function computeComparison(
  enabled: boolean,
  range: { start: Date; end: Date },
): { start: Date; end: Date } | null {
  if (!enabled) return null;
  return getComparisonRange(range.start, range.end);
}

const defaultRange = getPresetDateRange('30d');

export const useFinanceUI = create<FinanceUIState>()(
  persist(
    (set, get) => ({
      dateRange: defaultRange,
      datePreset: '30d',
      comparisonEnabled: false,
      comparisonDateRange: null,
      selectedChannel: null,
      currency: 'USD',
      sidebarCollapsed: false,

      setDateRange: (preset) => {
        if (typeof preset === 'string') {
          const range = getPresetDateRange(preset);
          set({
            dateRange: range,
            datePreset: preset,
            comparisonDateRange: computeComparison(get().comparisonEnabled, range),
          });
        } else {
          set({
            dateRange: preset,
            datePreset: 'custom',
            comparisonDateRange: computeComparison(get().comparisonEnabled, preset),
          });
        }
      },

      toggleComparison: () => {
        const enabled = !get().comparisonEnabled;
        set({
          comparisonEnabled: enabled,
          comparisonDateRange: computeComparison(enabled, get().dateRange),
        });
      },

      setChannel: (channel) => set({ selectedChannel: channel }),
      setCurrency: (currency) => set({ currency }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    {
      name: 'filapen-finance-ui',
      partialize: (state) => ({
        datePreset: state.datePreset,
        currency: state.currency,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.datePreset && state.datePreset !== 'custom') {
          const range = getPresetDateRange(state.datePreset);
          state.dateRange = range;
        }
      },
    },
  ),
);
