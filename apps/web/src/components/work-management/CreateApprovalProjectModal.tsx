'use client';

import { useState } from 'react';
import { X, ShieldCheck, Plus, ChevronUp, ChevronDown, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamUsers, type TeamUser } from '@/hooks/work-management/useWmApproval';
import { useAuthStore } from '@/stores/auth';

const PROJECT_COLORS = [
  '#8b5cf6', '#6366f1', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; color: string; approverIds: string[] }) => void;
  loading?: boolean;
}

export function CreateApprovalProjectModal({ open, onClose, onSubmit, loading }: Props) {
  const { user: currentUser } = useAuthStore();
  const { data: allUsers = [], isLoading: loadingUsers } = useTeamUsers();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  if (!open) return null;

  // Exclude current user from the approver list — they are the creator
  const availableUsers = allUsers.filter(
    (u) => u.id !== currentUser?.id && !selectedIds.includes(u.id),
  );
  const selectedUsers = selectedIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter(Boolean) as TeamUser[];

  function addApprover(userId: string) {
    setSelectedIds((prev) => [...prev, userId]);
    setShowPicker(false);
  }

  function removeApprover(userId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== userId));
  }

  function moveApprover(index: number, direction: -1 | 1) {
    const next = [...selectedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedIds(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedIds.length === 0) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      approverIds: selectedIds,
    });
  }

  const canSubmit = name.trim().length > 0 && selectedIds.length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-white/10 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Neues Abnahme-Projekt</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Projektname</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Verpackungsdesign Q2"
              autoFocus
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Worum geht es?"
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all', color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Approver chain */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Genehmiger-Kette
              <span className="text-xs font-normal text-gray-400 ml-1">(Reihenfolge = Ablaufreihenfolge)</span>
            </label>

            <div className="rounded-lg border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5 mb-3">
              {/* Step 1: Creator */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03]">
                <span className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white">1</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {currentUser?.name || currentUser?.email?.split('@')[0] || 'Du'} <span className="text-xs text-gray-400">(Ersteller)</span>
                </span>
              </div>

              {/* Approvers */}
              {selectedUsers.map((user, i) => (
                <div key={user.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">{i + 2}</span>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name || ''} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300">
                      {(user.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => moveApprover(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveApprover(i, 1)} disabled={i === selectedUsers.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeApprover(user.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Final: Approved */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/10">
                <span className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">✓</span>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Genehmigt</span>
              </div>
            </div>

            {/* Add approver picker */}
            <div className="relative">
              {loadingUsers ? (
                <div className="text-xs text-gray-400">Lade Mitarbeiter...</div>
              ) : availableUsers.length === 0 && selectedIds.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Keine Mitarbeiter gefunden. Bitte erst Team-Mitglieder unter Einstellungen einladen.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Genehmiger hinzufügen
                  {availableUsers.length > 0 && (
                    <span className="text-xs text-gray-400 font-normal">({availableUsers.length} verfügbar)</span>
                  )}
                </button>
              )}

              {showPicker && availableUsers.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                  <div className="absolute z-20 mt-1 w-72 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-xl py-1">
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addApprover(u.id)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name || ''} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <span className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{u.name}</p>
                          <p className="text-[10px] text-gray-400">{u.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'px-5 py-2.5 text-sm font-semibold rounded-lg transition-all',
                canSubmit
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.98]'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Erstelle...
                </span>
              ) : (
                'Abnahme-Projekt erstellen'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
