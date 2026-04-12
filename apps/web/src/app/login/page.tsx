'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

type PageMode = 'login' | 'register' | 'signup' | 'invite' | 'pending' | 'rejected' | 'loading';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, setAuth, logout } = useAuthStore();

  const inviteToken = searchParams.get('invite');

  const [mode, setMode] = useState<PageMode>('loading');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Determine initial mode
  useEffect(() => {
    // If already logged in, check status
    if (token && user) {
      if (user.status === 'pending') {
        setMode('pending');
        return;
      }
      if (user.status === 'rejected') {
        setMode('rejected');
        return;
      }
      if (user.status === 'active') {
        router.replace('/finance');
        return;
      }
    }

    if (token && !user) {
      // Token but no user — corrupted state
      logout();
    }

    // If invite token present, show invite registration form
    if (inviteToken) {
      setMode('invite');
      return;
    }

    // Check if setup is required
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.setupRequired) {
          setMode('register');
        } else {
          setMode('login');
        }
      })
      .catch(() => {
        setMode('login');
      });
  }, [token, user, router, inviteToken, logout]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);

      try {
        const isRegistration = mode === 'register' || mode === 'signup' || mode === 'invite';
        const endpoint = isRegistration ? `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/register` : `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/login`;

        const payload: Record<string, string> = {
          email: form.email,
          password: form.password,
        };

        if (isRegistration) {
          payload.name = form.name;
        }

        if (mode === 'invite' && inviteToken) {
          payload.inviteToken = inviteToken;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Error: ${res.status}`);
        }

        const data = await res.json();
        setAuth(data.token, data.user);

        // Route based on user status
        if (data.user.status === 'active') {
          router.replace('/finance');
        } else if (data.user.status === 'pending') {
          setMode('pending');
        } else if (data.user.status === 'rejected') {
          setMode('rejected');
        }
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    },
    [mode, form, setAuth, router, inviteToken],
  );

  const handleLogoutAndReset = useCallback(() => {
    logout();
    setMode('login');
    setForm({ email: '', password: '', name: '' });
    setError('');
  }, [logout]);

  if (mode === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  // Pending approval screen
  if (mode === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50/30 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Waiting for Approval</h1>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-sm text-amber-800 text-center leading-relaxed">
              Your account is pending approval. An administrator will review your registration shortly.
              You will receive full access once approved.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>Signed up as <span className="font-medium text-gray-700">{user?.email}</span></p>
              <p>Status: <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span></p>
            </div>
          </div>

          <button
            onClick={handleLogoutAndReset}
            className="mt-4 w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>

          <p className="mt-6 text-center text-[11px] text-gray-400">
            Filapen Business Hub v0.1
          </p>
        </div>
      </div>
    );
  }

  // Rejected screen
  if (mode === 'rejected') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-red-50/30 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="text-sm text-red-800 text-center leading-relaxed">
              Your registration has been declined. Please contact the administrator for more information.
            </p>
          </div>

          <button
            onClick={handleLogoutAndReset}
            className="mt-4 w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>

          <p className="mt-6 text-center text-[11px] text-gray-400">
            Filapen Business Hub v0.1
          </p>
        </div>
      </div>
    );
  }

  // Determine display text based on mode
  const isRegistrationMode = mode === 'register' || mode === 'signup' || mode === 'invite';
  const showNameField = isRegistrationMode;

  let heading = 'Sign in to your account';
  let subtext = '';
  let submitLabel = 'Sign In';
  let submittingLabel = 'Signing in...';

  if (mode === 'register') {
    heading = 'Create your admin account to get started';
    submitLabel = 'Create Admin Account';
    submittingLabel = 'Creating account...';
  } else if (mode === 'signup') {
    heading = 'Create your account';
    subtext = 'Your account will require admin approval before access is granted.';
    submitLabel = 'Request Access';
    submittingLabel = 'Registering...';
  } else if (mode === 'invite') {
    heading = 'Complete your registration';
    subtext = 'You have been invited to join Filapen Business Hub.';
    submitLabel = 'Complete Registration';
    submittingLabel = 'Registering...';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-200">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Filapen Business Hub</h1>
          <p className="mt-1 text-sm text-gray-500">{heading}</p>
          {subtext && (
            <p className="mt-1 text-xs text-gray-400">{subtext}</p>
          )}
        </div>

        {/* Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {showNameField && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete={isRegistrationMode ? 'new-password' : 'current-password'}
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder={isRegistrationMode ? 'Min 8 characters' : 'Your password'}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-center text-[11px] text-gray-400">
              This is the first-time setup. The first account will have full admin access.
            </p>
          )}

          {/* Toggle between login and signup */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(''); }}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Request access
                </button>
              </p>
            </div>
          )}

          {mode === 'signup' && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Filapen Business Hub v0.1
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
