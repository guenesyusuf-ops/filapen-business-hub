'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Copy, Check, Loader2 } from 'lucide-react';

interface PortalCreator {
  id: string;
  name: string;
  handle: string;
  email: string;
  phone?: string;
  location?: string;
  avatarUrl?: string;
  platform: string;
  inviteCode: string;
}

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

export default function PortalProfilePage() {
  const router = useRouter();
  const [creator, setCreator] = useState<PortalCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Editable fields
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (!stored) {
      router.push('/creator-portal');
      return;
    }
    try {
      const c = JSON.parse(stored);
      // Fetch fresh profile data
      fetch(`${API_BASE}/creator-portal/me?creatorId=${c.id}`)
        .then((res) => (res.ok ? res.json() : c))
        .then((data) => {
          setCreator(data);
          setPhone(data.phone || '');
          setLocation(data.location || '');
        })
        .catch(() => {
          setCreator(c);
          setPhone(c.phone || '');
          setLocation(c.location || '');
        })
        .finally(() => setLoading(false));
    } catch {
      router.push('/creator-portal');
    }
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!creator) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/creator-portal/me?creatorId=${creator.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, location }),
        },
      );
      if (res.ok) {
        const updated = await res.json();
        setCreator(updated);
        // Update session storage
        const stored = sessionStorage.getItem('creator_data');
        if (stored) {
          const current = JSON.parse(stored);
          sessionStorage.setItem(
            'creator_data',
            JSON.stringify({ ...current, phone, location }),
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [creator, phone, location]);

  const handleCopyCode = useCallback(() => {
    if (!creator?.inviteCode) return;
    navigator.clipboard.writeText(creator.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [creator?.inviteCode]);

  if (loading || !creator) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="rounded-xl bg-white p-6 border border-gray-100">
          <div className="h-16 w-16 rounded-full bg-gray-200 mb-4" />
          <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
          <div className="h-3 w-32 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View and update your profile
        </p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl bg-white p-6 border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xl shrink-0">
            {creator.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {creator.name}
            </h2>
            <p className="text-sm text-gray-500">{creator.handle}</p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {creator.platform}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Email (read-only)</label>
            <input
              type="text"
              value={creator.email}
              disabled
              className={inputCls + ' bg-gray-50 text-gray-500'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 ..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Invite code */}
      <div className="rounded-xl bg-white p-6 border border-gray-100">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
          Your Invite Code
        </h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono font-bold text-violet-700 tracking-widest">
            {creator.inviteCode}
          </code>
          <button
            onClick={handleCopyCode}
            className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Copy invite code"
          >
            {copiedCode ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          This is your personal access code for the Creator Portal.
        </p>
      </div>
    </div>
  );
}
