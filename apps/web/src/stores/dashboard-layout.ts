import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

interface DashboardLayoutState {
  /** Layouts keyed by page path, e.g. '/finance' */
  layouts: Record<string, WidgetConfig[]>;
  getLayout: (page: string, defaults: WidgetConfig[]) => WidgetConfig[];
  setLayout: (page: string, widgets: WidgetConfig[]) => void;
  toggleWidget: (page: string, widgetId: string, defaults: WidgetConfig[]) => void;
  moveWidget: (page: string, widgetId: string, direction: 'up' | 'down', defaults: WidgetConfig[]) => void;
  resetLayout: (page: string) => void;
}

export const useDashboardLayout = create<DashboardLayoutState>()(
  persist(
    (set, get) => ({
      layouts: {},

      getLayout: (page, defaults) => {
        const stored = get().layouts[page];
        if (!stored || stored.length === 0) return defaults;

        // Merge: keep stored order/visibility, but include any new defaults
        const storedMap = new Map(stored.map((w) => [w.id, w]));
        const merged: WidgetConfig[] = [];
        let maxOrder = stored.reduce((max, w) => Math.max(max, w.order), 0);

        for (const def of defaults) {
          const s = storedMap.get(def.id);
          if (s) {
            merged.push(s);
          } else {
            maxOrder += 1;
            merged.push({ ...def, order: maxOrder });
          }
        }

        return merged.sort((a, b) => a.order - b.order);
      },

      setLayout: (page, widgets) => {
        set((state) => ({
          layouts: { ...state.layouts, [page]: widgets },
        }));
      },

      toggleWidget: (page, widgetId, defaults) => {
        const layout = get().getLayout(page, defaults);
        const updated = layout.map((w) =>
          w.id === widgetId ? { ...w, visible: !w.visible } : w,
        );
        set((state) => ({
          layouts: { ...state.layouts, [page]: updated },
        }));
      },

      moveWidget: (page, widgetId, direction, defaults) => {
        const layout = [...get().getLayout(page, defaults)].sort((a, b) => a.order - b.order);
        const idx = layout.findIndex((w) => w.id === widgetId);
        if (idx === -1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= layout.length) return;

        // Swap orders
        const tempOrder = layout[idx]!.order;
        layout[idx] = { ...layout[idx]!, order: layout[swapIdx]!.order };
        layout[swapIdx] = { ...layout[swapIdx]!, order: tempOrder };

        set((state) => ({
          layouts: { ...state.layouts, [page]: layout },
        }));
      },

      resetLayout: (page) => {
        set((state) => {
          const { [page]: _, ...rest } = state.layouts;
          return { layouts: rest };
        });
      },
    }),
    { name: 'filapen-dashboard-layout' },
  ),
);
