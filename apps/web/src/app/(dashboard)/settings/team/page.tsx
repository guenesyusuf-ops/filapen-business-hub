'use client';

import { useState, useMemo } from 'react';
import {
  UserPlus,
  MoreVertical,
  Trash2,
  Shield,
  Mail,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'invited';
  lastActiveAt: string | null;
  avatarInitials: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data (will be replaced by API calls)
// ---------------------------------------------------------------------------

const MOCK_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Anna Schmidt', email: 'anna@filapen.com', role: 'owner', status: 'active', lastActiveAt: '2026-04-08T10:30:00Z', avatarInitials: 'AS' },
  { id: '2', name: 'Max Muster', email: 'max@filapen.com', role: 'admin', status: 'active', lastActiveAt: '2026-04-07T14:00:00Z', avatarInitials: 'MM' },
  { id: '3', name: 'Lisa Weber', email: 'lisa@filapen.com', role: 'member', status: 'active', lastActiveAt: '2026-04-06T09:15:00Z', avatarInitials: 'LW' },
  { id: '4', name: 'Tom Braun', email: 'tom@filapen.com', role: 'viewer', status: 'active', lastActiveAt: null, avatarInitials: 'TB' },
];

const MOCK_INVITES: PendingInvite[] = [
  { id: 'i1', email: 'new@example.com', role: 'member', createdAt: '2026-04-07T12:00:00Z' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full access, billing, and team management' },
  { value: 'admin', label: 'Admin', description: 'All features except billing and ownership' },
  { value: 'member', label: 'Analyst', description: 'View and edit dashboards and data' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards' },
];

function roleBadge(role: Role) {
  const styles: Record<Role, string> = {
    owner: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    admin: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    member: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    viewer: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  };
  const labels: Record<Role, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Analyst',
    viewer: 'Viewer',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[role])}>
      {labels[role]}
    </span>
  );
}

function formatLastActive(date: string | null): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Invite Modal
// ---------------------------------------------------------------------------

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (email: string, role: Role) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) {
      onInvite(email, role);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Team Member</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Role
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all',
                    role === opt.value
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20'
                      : 'border-border dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!email.includes('@')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all',
                email.includes('@')
                  ? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
                  : 'bg-primary-400 cursor-not-allowed',
              )}
            >
              <UserPlus className="h-4 w-4" />
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Menu
// ---------------------------------------------------------------------------

function ActionMenu({
  member,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember;
  onChangeRole: (id: string, role: Role) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (member.role === 'owner') return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg bg-white dark:bg-[#232640] shadow-dropdown border border-border dark:border-white/10 py-1 animate-scale-in">
            <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Change Role
            </div>
            {ROLE_OPTIONS.filter((r) => r.value !== member.role && r.value !== 'owner').map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChangeRole(member.id, opt.value); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                {opt.label}
              </button>
            ))}
            <div className="border-t border-border dark:border-white/10 my-1" />
            <button
              onClick={() => { onRemove(member.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [invites, setInvites] = useState<PendingInvite[]>(MOCK_INVITES);
  const [showInvite, setShowInvite] = useState(false);

  const handleInvite = (email: string, role: Role) => {
    setInvites((prev) => [
      { id: `i${Date.now()}`, email, role, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const handleChangeRole = (id: string, role: Role) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role } : m)),
    );
  };

  const handleRemove = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCancelInvite = (id: string) => {
    setInvites((prev) => prev.filter((inv) => inv.id !== id));
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Team Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage team members and their roles
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 active:scale-[0.98] transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      {/* Members Table */}
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border dark:border-white/8">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Members ({members.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/8">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Active</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{member.avatarInitials}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{roleBadge(member.role)}</td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      member.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    )}>
                      {member.status === 'active' ? 'Active' : 'Invited'}
                    </span>
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
                      onChangeRole={handleChangeRole}
                      onRemove={handleRemove}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border dark:border-white/8">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Pending Invites ({invites.length})
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{invite.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Invited {new Date(invite.createdAt).toLocaleDateString()} as {invite.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(invite.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                  title="Cancel invite"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}
