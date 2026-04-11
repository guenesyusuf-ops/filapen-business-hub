'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuthHeaders } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface PendingUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPROVAL_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  const labels: Record<string, string> = {
    active: 'Approved',
    rejected: 'Rejected',
    pending: 'Pending',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[status] || styles.pending)}>
      {labels[status] || status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Role Selector Dropdown
// ---------------------------------------------------------------------------

function RoleSelector({
  selectedRole,
  onSelect,
}: {
  selectedRole: Role;
  onSelect: (role: Role) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = APPROVAL_ROLE_OPTIONS.find((r) => r.value === selectedRole);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
      >
        {selected?.label || 'Viewer'}
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg bg-white dark:bg-[var(--card-bg)] shadow-lg border border-gray-200 dark:border-white/10 py-1">
            {APPROVAL_ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs transition-colors',
                  selectedRole === opt.value
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-[var(--card-bg)] shadow-2xl p-6 animate-scale-in border border-gray-200 dark:border-white/8">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-all active:scale-[0.98]',
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast Notification
// ---------------------------------------------------------------------------

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-sm font-medium animate-slide-up',
      type === 'success'
        ? 'bg-emerald-600 text-white'
        : 'bg-red-600 text-white',
    )}>
      {type === 'success' ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [reviewedUsers, setReviewedUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>({});
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    user: PendingUser;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [pendingRes, reviewedRes] = await Promise.all([
        fetch('/api/admin/pending-users', { headers }),
        fetch('/api/admin/reviewed-users', { headers }),
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingUsers(data);
      }
      if (reviewedRes.ok) {
        const data = await reviewedRes.json();
        setReviewedUsers(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(
    async (user: PendingUser) => {
      setActionLoading(user.id);
      try {
        const headers = {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        };
        const role = selectedRoles[user.id] || 'viewer';
        const res = await fetch(`/api/admin/approve-user/${user.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ role }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to approve user');
        }

        const updated = await res.json();
        setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
        setReviewedUsers((prev) => [updated, ...prev]);
        setToast({ message: `${user.name || user.email} has been approved`, type: 'success' });
      } catch (err: any) {
        setToast({ message: err.message || 'Failed to approve user', type: 'error' });
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    },
    [selectedRoles],
  );

  const handleReject = useCallback(async (user: PendingUser) => {
    setActionLoading(user.id);
    try {
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`/api/admin/reject-user/${user.id}`, {
        method: 'PUT',
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to reject user');
      }

      const updated = await res.json();
      setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
      setReviewedUsers((prev) => [updated, ...prev]);
      setToast({ message: `${user.name || user.email} has been rejected`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to reject user', type: 'error' });
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">User Approvals</h1>
              {pendingUsers.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-xs font-bold text-white">
                  {pendingUsers.length}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Review and approve user registration requests
            </p>
          </div>
        </div>
      </div>

      {/* Pending Users */}
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border dark:border-white/8 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Pending Approvals ({pendingUsers.length})
          </span>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No pending approvals</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              New registration requests will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/8">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Registered</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Assign Role</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.name || 'No name'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <RoleSelector
                        selectedRole={selectedRoles[user.id] || 'viewer'}
                        onSelect={(role) =>
                          setSelectedRoles((prev) => ({ ...prev, [user.id]: role }))
                        }
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setConfirmAction({ type: 'approve', user })}
                          disabled={actionLoading === user.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'reject', user })}
                          disabled={actionLoading === user.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently Reviewed Users */}
      {reviewedUsers.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border dark:border-white/8">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Recently Reviewed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/8">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
                </tr>
              </thead>
              <tbody>
                {reviewedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                          user.status === 'active'
                            ? 'bg-gradient-to-br from-emerald-300 to-emerald-500'
                            : 'bg-gradient-to-br from-red-300 to-red-500',
                        )}>
                          <span className="text-[10px] font-bold text-white">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.name || 'No name'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      {statusBadge(user.status)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400 capitalize">
                      {user.role === 'member' ? 'Analyst' : user.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'approve' ? 'Approve User' : 'Reject User'}
          message={
            confirmAction.type === 'approve'
              ? `Are you sure you want to approve ${confirmAction.user.name || confirmAction.user.email}? They will get immediate access as ${
                  (selectedRoles[confirmAction.user.id] || 'viewer') === 'member' ? 'Analyst' : (selectedRoles[confirmAction.user.id] || 'Viewer')
                }.`
              : `Are you sure you want to reject ${confirmAction.user.name || confirmAction.user.email}? They will not be able to access the platform.`
          }
          confirmLabel={confirmAction.type === 'approve' ? 'Approve' : 'Reject'}
          confirmVariant={confirmAction.type === 'approve' ? 'primary' : 'danger'}
          onConfirm={() => {
            if (confirmAction.type === 'approve') {
              handleApprove(confirmAction.user);
            } else {
              handleReject(confirmAction.user);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
