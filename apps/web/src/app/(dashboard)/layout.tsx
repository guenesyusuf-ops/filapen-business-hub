'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  TrendingUp,
  Package,
  Receipt,
  Megaphone,
  Plug,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Search,
  Layers,
  Bell,
  UserCircle,
  Users,
  Heart,
  Eye,
  ListChecks,
  Building2,
  Wand2,
  BookOpen,
  LayoutTemplate,
  Mic,
  Settings,
  Sliders,
  GitBranch,
  UsersRound,
  Gauge,
  Palette,
  ExternalLink,
  ShieldCheck,
  Store,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinanceUI } from '@/stores/finance-ui';
import { useTranslation } from '@/i18n/useTranslation';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useThemeStore } from '@/stores/theme';

// ---------------------------------------------------------------------------
// Sidebar navigation definition
// ---------------------------------------------------------------------------

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/finance',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'nav.financeHub',
    href: '/finance',
    icon: DollarSign,
    children: [
      { labelKey: 'nav.overview', href: '/finance', icon: BarChart3 },
      { labelKey: 'nav.revenue', href: '/finance/revenue', icon: TrendingUp },
      { labelKey: 'nav.channels', href: '/finance/channels', icon: Layers },
      { labelKey: 'nav.products', href: '/finance/products', icon: Package },
      { labelKey: 'nav.costs', href: '/finance/costs', icon: Receipt },
      { labelKey: 'nav.campaigns', href: '/finance/campaigns', icon: Megaphone },
      { labelKey: 'nav.attribution', href: '/finance/attribution', icon: GitBranch },
      { labelKey: 'nav.cohorts', href: '/finance/cohorts', icon: UsersRound },
      { labelKey: 'nav.benchmarks', href: '/finance/benchmarks', icon: Gauge },
      { labelKey: 'nav.creativeAnalysis', href: '/finance/creative-analysis', icon: Palette },
      { labelKey: 'nav.integrations', href: '/finance/integrations', icon: Plug },
      { labelKey: 'nav.reports', href: '/finance/reports', icon: FileText },
    ],
  },
  {
    labelKey: 'nav.channelsHub',
    href: '/channels',
    icon: Store,
    children: [
      { labelKey: 'nav.overview', href: '/channels', icon: BarChart3 },
      { labelKey: 'nav.shopify', href: '/channels/shopify', icon: ShoppingBag },
    ],
  },
  {
    labelKey: 'nav.creatorHub',
    href: '/creators',
    icon: Users,
    children: [
      { labelKey: 'nav.overview', href: '/creators', icon: BarChart3 },
      { labelKey: 'nav.creators', href: '/creators/list', icon: UserCircle },
      { labelKey: 'nav.projects', href: '/creators/projects', icon: ListChecks },
      { labelKey: 'nav.briefings', href: '/creators/briefings', icon: FileText },
      { labelKey: 'nav.uploads', href: '/creators/uploads', icon: Layers },
      { labelKey: 'nav.creatorPortal', href: '/creator-portal', icon: ExternalLink },
    ],
  },
  {
    labelKey: 'nav.influencerHub',
    href: '/influencers',
    icon: Heart,
    children: [
      { labelKey: 'nav.overview', href: '/influencers', icon: BarChart3 },
      { labelKey: 'nav.discovery', href: '/influencers/discovery', icon: Search },
      { labelKey: 'nav.brands', href: '/influencers/brands', icon: Building2 },
      { labelKey: 'nav.watchlists', href: '/influencers/watchlists', icon: Eye },
    ],
  },
  {
    labelKey: 'nav.contentHub',
    href: '/content',
    icon: Wand2,
    children: [
      { labelKey: 'nav.overview', href: '/content', icon: BarChart3 },
      { labelKey: 'nav.library', href: '/content/library', icon: BookOpen },
      { labelKey: 'nav.generate', href: '/content/generate', icon: Wand2 },
      { labelKey: 'nav.templates', href: '/content/templates', icon: LayoutTemplate },
      { labelKey: 'nav.brandVoice', href: '/content/brand-voice', icon: Mic },
    ],
  },
  {
    labelKey: 'nav.settings',
    href: '/settings',
    icon: Settings,
    children: [
      { labelKey: 'nav.general', href: '/settings/general', icon: Sliders },
      { labelKey: 'nav.team', href: '/settings/team', icon: Users },
      { labelKey: 'nav.approvals', href: '/settings/approvals', icon: ShieldCheck },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

function Sidebar({ collapsed, user, pendingApprovalCount }: { collapsed: boolean; user: { name: string | null; email: string } | null; pendingApprovalCount: number }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (pathname.startsWith('/finance')) {
      initial.add('nav.financeHub');
    }
    if (pathname.startsWith('/channels')) {
      initial.add('nav.channelsHub');
    }
    if (pathname.startsWith('/creators')) {
      initial.add('nav.creatorHub');
    }
    if (pathname.startsWith('/influencers')) {
      initial.add('nav.influencerHub');
    }
    if (pathname.startsWith('/content')) {
      initial.add('nav.contentHub');
    }
    if (pathname.startsWith('/settings')) {
      initial.add('nav.settings');
    }
    return initial;
  });

  const toggleGroup = useCallback((labelKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(labelKey)) {
        next.delete(labelKey);
      } else {
        next.add(labelKey);
      }
      return next;
    });
  }, []);

  function isActive(href: string): boolean {
    if (href === '/finance') return pathname === '/finance';
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
  }

  return (
    <nav
      className={cn(
        'flex flex-col h-full border-r border-border transition-all duration-300 ease-in-out',
        'bg-gradient-to-b from-white via-white to-gray-50/80',
        'dark:from-[#0f1117] dark:via-[#0f1117] dark:to-[#1a1d2e]/80 dark:border-white/8',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-transparent bg-gradient-to-r from-transparent via-transparent to-transparent"
        style={{ borderImage: 'linear-gradient(to right, transparent, #e5e7eb, transparent) 1' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-white tracking-tight">F</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Filapen</span>
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 -mt-0.5 tracking-wide uppercase">Business Hub</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const expanded = expandedGroups.has(item.labelKey);
          const isHubActive = hasChildren && pathname.startsWith(item.href);

          return (
            <div key={item.labelKey} className="mb-0.5">
              {/* Parent item */}
              {hasChildren ? (
                <button
                  onClick={() => toggleGroup(item.labelKey)}
                  className={cn(
                    'flex items-center w-full rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
                    collapsed ? 'justify-center' : 'gap-2.5',
                    isHubActive
                      ? 'bg-primary-50/80 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium border-l-[3px] border-primary-500 pl-2'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 hover:scale-[1.01] border-l-[3px] border-transparent pl-2',
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className={cn(
                    'h-4.5 w-4.5 flex-shrink-0 transition-colors duration-200',
                    isHubActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600',
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      <ChevronDown className={cn(
                        'h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
                        expanded ? 'rotate-0' : '-rotate-90',
                      )} />
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
                    collapsed ? 'justify-center' : 'gap-2.5',
                    active
                      ? 'bg-primary-50/80 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium border-l-[3px] border-primary-500 pl-2'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 hover:scale-[1.01] border-l-[3px] border-transparent pl-2',
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className={cn(
                    'h-4.5 w-4.5 flex-shrink-0 transition-colors duration-200',
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500',
                  )} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              )}

              {/* Children (accordion) */}
              {hasChildren && !collapsed && (
                <div
                  className={cn(
                    'ml-4 mt-0.5 space-y-0.5 pl-2.5 overflow-hidden transition-all duration-200 ease-in-out',
                    'border-l-[1.5px] border-gray-200/80 dark:border-white/10',
                    expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const childLabel = t(child.labelKey);
                    const childActive = isActive(child.href);
                    const showBadge = child.labelKey === 'nav.approvals' && pendingApprovalCount > 0;

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all duration-150',
                          childActive
                            ? 'bg-primary-50/80 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300',
                        )}
                      >
                        <ChildIcon className={cn(
                          'h-3.5 w-3.5 flex-shrink-0',
                          childActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500',
                        )} />
                        <span className="flex-1">{childLabel}</span>
                        {showBadge && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {pendingApprovalCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom section - User */}
      <div className="border-t border-gray-100 dark:border-white/8 px-2 py-2 space-y-0.5">
        <div className={cn(
          'flex items-center rounded-lg px-2.5 py-2',
          collapsed ? 'justify-center' : 'gap-2.5',
        )}>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.name || 'User'}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {user?.email || 'user@filapen.com'}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Top Bar
// ---------------------------------------------------------------------------

function TopBar({ onToggleSidebar, sidebarCollapsed, user, onLogout }: { onToggleSidebar: () => void; sidebarCollapsed: boolean; user: { name: string | null; email: string } | null; onLogout: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  // Build breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="flex items-center h-14 px-4 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/8 gap-4 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-150 active:scale-95"
      >
        {sidebarCollapsed ? (
          <PanelLeft className="h-4.5 w-4.5" />
        ) : (
          <PanelLeftClose className="h-4.5 w-4.5" />
        )}
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-gray-300" />
            )}
            {crumb.isLast ? (
              <span className="font-medium text-gray-900 dark:text-white">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 rounded-xl border border-gray-200/80 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 px-3 py-1.5 text-sm text-gray-400 w-64 shadow-inner dark:shadow-none transition-all duration-200 focus-within:border-primary-300 focus-within:bg-white dark:focus-within:bg-white/10 focus-within:shadow-sm">
        <Search className="h-3.5 w-3.5 text-gray-400" />
        <span>{t('common.search')}...</span>
        <span className="ml-auto text-xxs border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-400 font-mono">
          /
        </span>
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Notifications */}
      <button className="relative rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-150 active:scale-95">
        <Bell className="h-4.5 w-4.5" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white dark:ring-[#0f1117]" />
        </span>
      </button>

      {/* User avatar + logout */}
      <div className="flex items-center gap-2">
        {user?.name && (
          <span className="hidden lg:inline text-xs font-medium text-gray-600 dark:text-gray-400">
            {user.name}
          </span>
        )}
        <button
          onClick={onLogout}
          title="Sign out"
          className="rounded-full transition-all duration-150 hover:ring-2 hover:ring-red-100 active:scale-95"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Layout
// ---------------------------------------------------------------------------

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useFinanceUI();
  const { theme, setTheme } = useThemeStore();
  const { logout } = useAuthStore();

  // Read localStorage directly — no Zustand hydration timing needed
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('filapen-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        const state = parsed?.state;
        if (state?.token && state?.user) {
          if (state.user.status !== 'active') {
            router.replace('/login');
            return;
          }
          setCurrentToken(state.token);
          setCurrentUser(state.user);
          setAuthChecked(true);
          return;
        }
      }
    } catch {
      // corrupted storage — fall through to redirect
    }
    // No valid auth — redirect to login
    router.replace('/login');
  }, [router]);

  // Fetch pending approval count for admin badge
  useEffect(() => {
    if (!currentToken || !currentUser) return;
    if (currentUser.role !== 'owner' && currentUser.role !== 'admin') return;

    fetch('/api/admin/pending-users/count', {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.count === 'number') {
          setPendingApprovalCount(data.count);
        }
      })
      .catch(() => {
        // Silently fail — badge just won't show
      });
  }, [currentToken, currentUser]);

  // Re-apply theme on mount (handles SSR hydration and system preference changes)
  useEffect(() => {
    setTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => setTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, setTheme]);

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  // Don't render dashboard content until auth is confirmed
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-secondary dark:bg-[#0f1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary dark:bg-[#0f1117]">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} user={currentUser} pendingApprovalCount={pendingApprovalCount} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          user={currentUser}
          onLogout={handleLogout}
        />

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
