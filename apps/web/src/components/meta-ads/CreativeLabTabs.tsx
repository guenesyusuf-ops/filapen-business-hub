'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Activity, Boxes, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Creative Lab = Arbeitsplatz für Creative Strategy. Insights, Attention,
 * Components und AI Recommendations sind Tabs DESSELBEN Arbeitsplatzes —
 * nicht separate Produkte. Bestehende URLs bleiben technisch erhalten.
 */
const TABS = [
  { href: '/meta-ads/creative-lab', label: 'Insights', icon: Wand2, exact: true },
  { href: '/meta-ads/creative-lab/attention', label: 'Attention', icon: Activity },
  { href: '/meta-ads/components', label: 'Components', icon: Boxes },
  { href: '/meta-ads/ai-insights', label: 'AI Recommendations', icon: Sparkles },
];

export function CreativeLabTabs() {
  const pathname = usePathname();
  const isActive = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname.startsWith(t.href));
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200/70 pb-px dark:border-white/[0.08]">
      {TABS.map((t) => {
        const active = isActive(t);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[8px] border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors',
              active
                ? 'border-accent-meta text-accent-meta'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
