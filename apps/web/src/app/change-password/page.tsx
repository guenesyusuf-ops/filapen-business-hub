'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { Lock, CheckCircle2 } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { token, user, setAuth, logout } = useAuthStore();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect away if not logged in, or password is already fine
  useEffect(() => {
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (!user.mustChangePassword) {
      router.replace('/home');
    }
  }, [token, user, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (next.length < 8) {
        setError('Neues Passwort muss mindestens 8 Zeichen haben');
        return;
      }
      if (next !== confirm) {
        setError('Passwörter stimmen nicht ueberein');
        return;
      }
      if (next === current) {
        setError('Neues Passwort muss sich vom aktuellen unterscheiden');
        return;
      }

      if (!token) {
        router.replace('/login');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Passwort konnte nicht geändert werden');
        }

        // Refresh user data so mustChangePassword flips to false
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setAuth(token, me);
        }

        setSuccess(true);
        setTimeout(() => router.replace('/home'), 1500);
      } catch (err: any) {
        setError(err.message || 'Etwas ist schiefgelaufen');
      } finally {
        setSubmitting(false);
      }
    },
    [current, next, confirm, token, router, setAuth],
  );

  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-200">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Passwort ändern</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aus Sicherheitsgründen musst du dein temporäres Passwort jetzt ändern.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {success ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-gray-900">Passwort erfolgreich geändert</p>
              <p className="text-xs text-gray-500 mt-1">Du wirst weitergeleitet ...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Temporäres Passwort (aktuell)
                </label>
                <input
                  type="password"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  placeholder="Aus der Einladungs-E-Mail"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Neues Passwort
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Neues Passwort bestätigen
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  placeholder="Erneut eingeben"
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
                {submitting ? 'Speichere ...' : 'Passwort ändern'}
              </button>

              <button
                type="button"
                onClick={() => { logout(); router.replace('/login'); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
              >
                Abmelden
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Angemeldet als {user.email}
        </p>
      </div>
    </div>
  );
}
