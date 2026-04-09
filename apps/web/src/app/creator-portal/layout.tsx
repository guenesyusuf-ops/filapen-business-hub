'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PortalCreator {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  platform: string;
  inviteCode: string;
}

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
        {isLoggedIn && (
          <div className="flex items-center gap-3">
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
              href="/creator-portal/deals"
              label="My Deals"
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
    </div>
  );
}
