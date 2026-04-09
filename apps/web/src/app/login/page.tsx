'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register' | 'loading'>('loading');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (token) {
      router.replace('/finance');
      return;
    }

    // Check if setup is required
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        setMode(data.setupRequired ? 'register' : 'login');
      })
      .catch(() => {
        // If API is unreachable, show login by default
        setMode('login');
      });
  }, [token, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSubmitting(true);

      try {
        const endpoint =
          mode === 'register' ? '/api/auth/register' : '/api/auth/login';
        const payload =
          mode === 'register'
            ? { email: form.email, password: form.password, name: form.name }
            : { email: form.email, password: form.password };

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
        router.replace('/finance');
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    },
    [mode, form, setAuth, router],
  );

  if (mode === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
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
          <p className="mt-1 text-sm text-gray-500">
            {mode === 'register'
              ? 'Create your admin account to get started'
              : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
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
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder={
                  mode === 'register' ? 'Min 8 characters' : 'Your password'
                }
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
              {submitting
                ? mode === 'register'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'register'
                  ? 'Create Admin Account'
                  : 'Sign In'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-center text-[11px] text-gray-400">
              This is the first-time setup. The first account will have full admin access.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Filapen Business Hub v0.1
        </p>
      </div>
    </div>
  );
}
