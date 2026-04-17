'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, CheckSquare, FolderOpen, MessageCircle, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTotalUnread } from '@/hooks/useHome';

const TABS = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/work-management', icon: CheckSquare, label: 'Aufgaben' },
  { href: '/documents', icon: FolderOpen, label: 'Dokumente' },
  { href: '/home#chat', icon: MessageCircle, label: 'Chat', isChatTrigger: true },
  { href: '#more', icon: Menu, label: 'Mehr', isMore: true },
];

const MORE_ITEMS: { href: string; label: string; isAI?: boolean }[] = [
  { href: '#ask-filapen', label: '✨ Ask Filapen (KI)', isAI: true },
  { href: '/finance', label: 'Finanzen' },
  { href: '/channels', label: 'Channels' },
  { href: '/creators', label: 'Creator Hub' },
  { href: '/influencers', label: 'Influencer Hub' },
  { href: '/content', label: 'Content Hub' },
  { href: '/settings/profile', label: 'Profil' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/general', label: 'Einstellungen' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: unread } = useTotalUnread();
  const [showMore, setShowMore] = useState(false);
  const totalUnread = unread?.count ?? 0;

  function isActive(href: string): boolean {
    if (href === '/home') return pathname === '/home';
    if (href === '/work-management') return pathname.startsWith('/work-management');
    if (href === '/documents') return pathname.startsWith('/documents');
    return false;
  }

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[75]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-16 left-0 right-0 z-[91] mx-3 mb-1 rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-scale-in">
            <div className="py-2 max-h-[50vh] overflow-y-auto">
              {MORE_ITEMS.map((item) =>
                item.isAI ? (
                  <button
                    key={item.href}
                    onClick={() => {
                      setShowMore(false);
                      // Trigger Cmd+K
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
                    }}
                    className="flex items-center w-full px-5 py-3 text-sm font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-100 dark:border-white/5"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex items-center px-5 py-3 text-sm font-medium transition-colors',
                      pathname.startsWith(item.href)
                        ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[70] md:hidden bg-white dark:bg-[#0f1117] border-t border-gray-200 dark:border-white/10 safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;

            if (tab.isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors',
                    showMore ? 'text-primary-600' : 'text-gray-400',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            }

            if (tab.isChatTrigger) {
              return (
                <button
                  key="chat"
                  onClick={() => {
                    // Trigger the global messenger
                    const btn = document.querySelector('[data-messenger-toggle]') as HTMLElement;
                    btn?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg text-gray-400 relative"
                >
                  <Icon className="h-5 w-5" />
                  {totalUnread > 0 && (
                    <span className="absolute top-0 right-1/4 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors',
                  active
                    ? 'text-primary-600'
                    : 'text-gray-400',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-primary-600')} />
                <span className={cn('text-[10px] font-medium', active && 'text-primary-600')}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
