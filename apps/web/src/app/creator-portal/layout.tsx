'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Radio, Mail, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatWidget } from '@/components/creators/ChatWidget';
import {
  useCreatorNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/creators/useNotifications';
import type { CreatorNotification } from '@/hooks/creators/useNotifications';

interface PortalCreator {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  platform: string;
  inviteCode: string;
}

// ---------------------------------------------------------------------------
// Notification Icon Map
// ---------------------------------------------------------------------------

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'content_live':
      return <Radio className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'project_invite':
      return <Mail className="h-4 w-4 text-blue-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-gray-400 shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Notification Bell
// ---------------------------------------------------------------------------

function NotificationBell({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useCreatorNotifications(creatorId);
  const { data: unreadData } = useUnreadNotificationCount(creatorId);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleNotificationClick = (notification: CreatorNotification) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
    // Navigate based on notification type
    const meta = notification.metadata as Record<string, string> | undefined;
    if (notification.type === 'comment' && meta?.uploadId) {
      // Navigate to uploads page — the upload will be highlighted
      window.location.href = `/creator-portal/uploads?highlight=${meta.uploadId}`;
    } else if (notification.type === 'project_invite' && meta?.projectId) {
      window.location.href = '/creator-portal/invitations';
    } else if (notification.type === 'content_live' || notification.type === 'content_offline') {
      window.location.href = '/creator-portal/uploads';
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Benachrichtigungen"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              Benachrichtigungen
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate(creatorId)}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Alle gelesen
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0',
                    !n.read && 'bg-violet-50/40',
                  )}
                >
                  <NotificationIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm leading-snug',
                        n.read ? 'text-gray-600' : 'text-gray-900 font-medium',
                      )}
                    >
                      {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav Tab
// ---------------------------------------------------------------------------

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
        active
          ? 'border-violet-600 text-violet-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
      )}
    >
      {label}
    </Link>
  );
}

export default function CreatorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creator, setCreator] = useState<PortalCreator | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        setCreator(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    setChecked(true);
  }, []);

  // Listen for storage changes (login/logout from other components)
  useEffect(() => {
    const handler = () => {
      const stored = sessionStorage.getItem('creator_data');
      if (stored) {
        try {
          setCreator(JSON.parse(stored));
        } catch {
          setCreator(null);
        }
      } else {
        setCreator(null);
      }
    };
    window.addEventListener('creator-portal-auth', handler);
    return () => window.removeEventListener('creator-portal-auth', handler);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('creator_token');
    sessionStorage.removeItem('creator_data');
    setCreator(null);
    window.dispatchEvent(new Event('creator-portal-auth'));
    router.push('/creator-portal');
  }, [router]);

  if (!checked) return null;

  // If not logged in, only show children (the login page handles this)
  const isLoggedIn = !!creator;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">F</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Creator Portal</span>
        </div>
        {isLoggedIn && creator && (
          <div className="flex items-center gap-3">
            <NotificationBell creatorId={creator.id} />
            <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center">
              <span className="text-xs font-bold text-violet-600">
                {creator.name.charAt(0)}
              </span>
            </div>
            <span className="text-sm text-gray-600 hidden sm:inline">{creator.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Portal navigation tabs */}
      {isLoggedIn && (
        <nav className="bg-white border-b border-gray-200">
          <div className="flex items-center gap-1 px-6 overflow-x-auto">
            <NavTab
              href="/creator-portal"
              label="Dashboard"
              active={pathname === '/creator-portal'}
            />
            <NavTab
              href="/creator-portal/uploads"
              label="My Uploads"
              active={pathname === '/creator-portal/uploads'}
            />
            <NavTab
              href="/creator-portal/invitations"
              label="Einladungen"
              active={pathname === '/creator-portal/invitations'}
            />
            <NavTab
              href="/creator-portal/deals"
              label="Meine Projekte"
              active={pathname === '/creator-portal/deals'}
            />
            <NavTab
              href="/creator-portal/briefings"
              label="Briefings"
              active={pathname === '/creator-portal/briefings'}
            />
            <NavTab
              href="/creator-portal/profile"
              label="Profile"
              active={pathname === '/creator-portal/profile'}
            />
          </div>
        </nav>
      )}

      <main className="max-w-6xl mx-auto p-6">{children}</main>

      {/* Floating Chat Widget — visible on all portal pages */}
      {isLoggedIn && creator && (
        <ChatWidget
          creatorId={creator.id}
          creatorName={creator.name}
          role="creator"
        />
      )}
    </div>
  );
}
