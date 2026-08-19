'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, BarChart3, Calculator, Package, Boxes, Receipt, BarChart2, Sliders, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/useTranslation';

const SUB_NAV = [
  { labelKey: 'nav.paOverview',     href: '/profit-analysis',                icon: BarChart3 },
  { labelKey: 'nav.paMonth',        href: '/profit-analysis/monat',          icon: Calculator },
  { labelKey: 'nav.paProductCosts', href: '/profit-analysis/produktkosten',  icon: Package },
  { labelKey: 'nav.paWholesale',    href: '/profit-analysis/grosshandel',    icon: Boxes },
  { labelKey: 'nav.paOverhead',     href: '/profit-analysis/gemeinkosten',   icon: Receipt },
  { labelKey: 'nav.paCompare',      href: '/profit-analysis/vergleiche',     icon: BarChart2 },
  { labelKey: 'nav.paSettings',     href: '/profit-analysis/einstellungen',  icon: Sliders },
  { labelKey: 'nav.paAudit',        href: '/profit-analysis/audit',          icon: FileText },
];

export default function ProfitAnalysisLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      {/* Modul-Header */}
      <div className="border-b border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.02]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('nav.profitAnalysis')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Internes Controlling · Umsatz, Kosten, Profit, ROAS je Verkaufskanal
              </p>
            </div>
          </div>

          {/* Sub-Navigation als horizontales Tab-Layout */}
          <nav className="mt-4 -mb-4 flex gap-1 overflow-x-auto scrollbar-thin">
            {SUB_NAV.map((item) => {
              // Exakter Match nur fuer "Uebersicht" (Root),
              // fuer alles andere Prefix-Match damit tiefere Unter-Routen aktiv bleiben.
              const active =
                item.href === '/profit-analysis'
                  ? pathname === '/profit-analysis'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm transition-colors border-b-2 whitespace-nowrap',
                    active
                      ? 'text-amber-600 dark:text-amber-400 border-amber-500 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border-transparent',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    </div>
  );
}
