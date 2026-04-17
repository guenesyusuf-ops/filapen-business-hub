'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus,
  MoreVertical,
  Trash2,
  Mail,
  Clock,
  X,
  Copy,
  CheckCircle2,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuthHeaders } from '@/stores/auth';
import { API_URL } from '@/lib/api';
import { MENU_PERMISSIONS } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'admin' | 'member';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
  lastActiveAt: string | null;
  avatarUrl?: string | null;
  menuPermissions?: string[];
  createdAt?: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  menuPermissions?: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleBadge(role: string) {
  const isAdmin = role === 'owner' || role === 'admin';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isAdmin
          ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      )}
    >
      {isAdmin ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
      {role === 'owner' ? 'Owner' : isAdmin ? 'Admin' : 'Mitarbeiter'}
    </span>
  );
}

function formatLastActive(date: string | null): string {
  if (!date) return 'Nie';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Gerade eben';
  if (diffHours < 24) return `vor ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} d`;
  return d.toLocaleDateString('de-DE');
}

// ---------------------------------------------------------------------------
// Invite Modal
// ---------------------------------------------------------------------------

function InviteModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (email: string, role: Role, menuPermissions: string[]) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    () => new Set(MENU_PERMISSIONS.map((p) => p.key)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(key: string) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelectedPermissions((prev) =>
      prev.size === MENU_PERMISSIONS.length
        ? new Set()
        : new Set(MENU_PERMISSIONS.map((p) => p.key)),
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setSubmitting(true);
    setError(null);
    try {
      const perms = role === 'admin' ? [] : Array.from(selectedPermissions);
      await onInvite(email, role, perms);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Einladung fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = selectedPermissions.size === MENU_PERMISSIONS.length;
  const canSubmit = email.includes('@') && (role === 'admin' || selectedPermissions.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-2xl p-6 animate-scale-in border border-gray-200 dark:border-white/8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team-Mitglied einladen</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              E-Mail-Adresse
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kollege@firma.de"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* Role toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Rolle
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                  role === 'admin'
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5',
                )}
              >
                <Shield className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Admin</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Voller Zugriff auf alles</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole('member')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                  role === 'member'
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5',
                )}
              >
                <UserIcon className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Mitarbeiter</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nur ausgewaehlte Menues</div>
                </div>
              </button>
            </div>
          </div>

          {/* Menu permissions — only for Mitarbeiter */}
          {role === 'member' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Zugriff auf Menues
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {allSelected ? 'Alle abwaehlen' : 'Alle auswaehlen'}
                </button>
              </div>
              <div className="space-y-1.5 rounded-lg border border-gray-200 dark:border-white/10 p-2">
                {MENU_PERMISSIONS.map((perm) => {
                  const checked = selectedPermissions.has(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={cn(
                        'flex items-start gap-3 rounded-md p-2 cursor-pointer transition-colors',
                        checked
                          ? 'bg-primary-50/40 dark:bg-primary-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5 accent-primary-600 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{perm.label}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{perm.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all',
                canSubmit && !submitting
                  ? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
                  : 'bg-primary-400 cursor-not-allowed',
              )}
            >
              <UserPlus className="h-4 w-4" />
              {submitting ? 'Sende...' : 'Einladung senden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions Modal (edit existing member)
// ---------------------------------------------------------------------------

function PermissionsModal({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember;
  onClose: () => void;
  onSave: (memberId: string, perms: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(member.menuPermissions ?? []),
  );
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(member.id, Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-2xl p-6 border border-gray-200 dark:border-white/8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Berechtigungen</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{member.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5 rounded-lg border border-gray-200 dark:border-white/10 p-2 mb-4 max-h-80 overflow-y-auto">
          {MENU_PERMISSIONS.map((perm) => {
            const checked = selected.has(perm.key);
            return (
              <label key={perm.key} className={cn('flex items-start gap-3 rounded-md p-2 cursor-pointer transition-colors', checked ? 'bg-primary-50/40 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-white/5')}>
                <input type="checkbox" checked={checked} onChange={() => toggle(perm.key)} className="mt-0.5 accent-primary-600 h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{perm.label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{perm.description}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Menu
// ---------------------------------------------------------------------------

function ActionMenu({
  member,
  onEditPermissions,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember;
  onEditPermissions: (m: TeamMember) => void;
  onChangeRole: (id: string, role: 'admin' | 'member') => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean }>({ top: 0, left: 0, flip: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  if (member.role === 'owner') return null;

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 170;
      const flip = spaceBelow < menuHeight;
      setPos({
        top: flip ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: rect.right - 224, // 224 = menu width (w-56)
        flip,
      });
    }
    setOpen(!open);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] w-56 rounded-lg bg-white dark:bg-[var(--card-bg)] shadow-xl border border-gray-200 dark:border-white/10 py-1 animate-scale-in"
            style={{ top: pos.top, left: Math.max(8, pos.left) }}
          >
            {member.role !== 'admin' && (
              <button
                onClick={() => { onEditPermissions(member); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                Berechtigungen bearbeiten
              </button>
            )}
            {member.role === 'admin' ? (
              <button
                onClick={() => { onChangeRole(member.id, 'member'); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                Zu Mitarbeiter machen
              </button>
            ) : (
              <button
                onClick={() => { onChangeRole(member.id, 'admin'); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                Zu Admin befoerdern
              </button>
            )}
            <div className="border-t border-gray-200 dark:border-white/10 my-1" />
            <button
              onClick={() => { onRemove(member.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Entfernen
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/team`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMembers(
          (data.members || []).map((m: any) => ({
            ...m,
            name: m.name || null,
            menuPermissions: m.menuPermissions ?? [],
          })),
        );
        setInvites(data.invites || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleInvite = async (email: string, role: Role, menuPermissions: string[]) => {
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${API_URL}/api/admin/team/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role, menuPermissions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Fehler' }));
      throw new Error(err.message || 'Einladung fehlgeschlagen');
    }
    fetchTeam();
  };

  const handleUpdatePermissions = async (memberId: string, menuPermissions: string[]) => {
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${API_URL}/api/admin/team/${memberId}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ menuPermissions }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, menuPermissions } : m)),
      );
    }
  };

  const handleChangeRole = async (id: string, role: 'admin' | 'member') => {
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
    await fetch(`${API_URL}/api/admin/team/${id}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role }),
    });
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Mitglied wirklich entfernen?')) return;
    const headers = getAuthHeaders();
    await fetch(`${API_URL}/api/admin/team/${id}`, { method: 'DELETE', headers });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCancelInvite = async (id: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}/api/admin/team/invite/${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    }
  };

  const copyInviteLink = (inviteId: string) => {
    const link = `${window.location.origin}/login?invite=${inviteId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Team-Verwaltung</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Mitglieder einladen und Zugriffsrechte verwalten
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 active:scale-[0.98] transition-all w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          Mitglied einladen
        </button>
      </div>

      {/* Members Table */}
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Mitglieder ({members.length})
          </span>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
          {members.map((member) => {
            const isAdminMember = member.role === 'owner' || member.role === 'admin';
            const perms = member.menuPermissions ?? [];
            return (
              <div key={`m-${member.id}`} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-white">{(member.name || member.email).charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name || member.email.split('@')[0]}</span>
                      {roleBadge(member.role)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</div>
                  </div>
                  <ActionMenu member={member} onEditPermissions={setEditingMember} onChangeRole={handleChangeRole} onRemove={handleRemove} />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  {isAdminMember ? (
                    <span className="text-gray-400 italic">Alle Menues</span>
                  ) : perms.length > 0 ? (
                    perms.map((p) => {
                      const meta = MENU_PERMISSIONS.find((m) => m.key === p);
                      return <span key={p} className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-medium">{meta?.label || p}</span>;
                    })
                  ) : (
                    <span className="text-red-500 italic">Kein Zugriff</span>
                  )}
                  <span className="text-gray-400 ml-auto">{formatLastActive(member.lastActiveAt)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/8">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Benutzer</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Rolle</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Zugriff</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Zuletzt aktiv</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isAdmin = member.role === 'owner' || member.role === 'admin';
                const perms = member.menuPermissions ?? [];
                return (
                  <tr key={member.id} className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{(member.name || member.email).charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{member.name || member.email.split('@')[0]}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{roleBadge(member.role)}</td>
                    <td className="px-5 py-3">
                      {isAdmin ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">Alle Menues</span>
                      ) : perms.length === 0 ? (
                        <span className="text-xs text-red-500 italic">Kein Zugriff</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {perms.slice(0, 3).map((p) => {
                            const meta = MENU_PERMISSIONS.find((m) => m.key === p);
                            return (
                              <span key={p} className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                {meta?.label || p}
                              </span>
                            );
                          })}
                          {perms.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{perms.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatLastActive(member.lastActiveAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ActionMenu
                        member={member}
                        onEditPermissions={setEditingMember}
                        onChangeRole={handleChangeRole}
                        onRemove={handleRemove}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Offene Einladungen ({invites.length})
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {invites.map((invite) => {
              const isAdmin = invite.role === 'admin' || invite.role === 'owner';
              return (
                <div key={invite.id} className="flex items-center justify-between px-5 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{invite.email}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>Eingeladen {new Date(invite.createdAt).toLocaleDateString('de-DE')}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        {roleBadge(invite.role)}
                        {!isAdmin && invite.menuPermissions && invite.menuPermissions.length > 0 && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">·</span>
                            <span className="text-[10px]">{invite.menuPermissions.length} Menues</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyInviteLink(invite.id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                        copiedInviteId === invite.id
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-300',
                      )}
                      title="Einladungs-Link kopieren"
                    >
                      {copiedInviteId === invite.id ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Kopiert
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Link
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                      title="Einladung zurueckziehen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <PermissionsModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
}
