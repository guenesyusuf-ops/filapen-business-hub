'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore, getAuthHeaders } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { Camera, Save, CheckCircle2, X, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_AVATAR_BYTES = 300 * 1024; // 300KB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File, maxSize = 400): Promise<string> {
  // Resize to max 400x400 (keeping aspect) + JPEG compression to keep payload small.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not available'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    fileToDataUrl(file).then((url) => (img.src = url)).catch(reject);
  });
}

export default function ProfileSettingsPage() {
  const { user, token, setAuth } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep form in sync when the store refreshes (e.g. after /me fetch on mount)
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user?.id, user?.firstName, user?.lastName, user?.phone, user?.avatarUrl]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte eine Bilddatei auswaehlen');
      return;
    }
    setError(null);
    try {
      const dataUrl = await resizeImage(file, 400);
      if (dataUrl.length > MAX_AVATAR_BYTES * 2) {
        setError('Bild ist zu gross. Bitte ein kleineres Bild verwenden.');
        return;
      }
      setAvatarUrl(dataUrl);
    } catch {
      setError('Bild konnte nicht verarbeitet werden');
    }
  }, []);

  const handleRemoveAvatar = () => setAvatarUrl(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
          avatarUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Speichern fehlgeschlagen');
      }

      const updated = await res.json();
      setAuth(token, updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const initial = firstName
    ? firstName.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Persoenliche Einstellungen</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Dein Profil, Bild und Kontaktdaten.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover border-2 border-white dark:border-white/10 shadow-md"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                <span className="text-2xl font-bold text-white">{initial}</span>
              </div>
            )}
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                title="Bild entfernen"
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              <Camera className="h-4 w-4" />
              {avatarUrl ? 'Bild aendern' : 'Bild hochladen'}
            </button>
            <p className="text-[11px] text-gray-400">
              JPG oder PNG, wird auf 400x400 skaliert (max 300KB).
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Vorname
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              placeholder="Max"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Nachname
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              placeholder="Mustermann"
            />
          </div>
        </div>

        {/* Email (readonly) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            E-Mail
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-500 dark:text-gray-500 cursor-not-allowed"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            E-Mail kann nur von einem Admin geaendert werden.
          </p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Telefonnummer
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            placeholder="+49 151 12345678"
          />
        </div>

        {/* Role (readonly info) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Rolle
          </label>
          <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            <UserIcon className="h-3.5 w-3.5 text-gray-400" />
            {user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
          </div>
        </div>

        {/* Error / success */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Profil gespeichert
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all',
              saving ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]',
            )}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
