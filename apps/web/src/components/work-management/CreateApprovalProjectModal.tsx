'use client';

import { useState } from 'react';
import { X, ShieldCheck, Plus, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresence, type PresenceUser } from '@/hooks/useHome';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [selectedApprovers, setSelectedApprovers] = useState<PresenceUser[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: users = [], isLoading: loadingUsers } = usePresence();

  if (!open) return null;

  function addApprover(user: PresenceUser) {
    if (selectedApprovers.find((a) => a.id === user.id)) return;
    setSelectedApprovers((prev) => [...prev, user]);
    setShowPicker(false);
  }

  function removeApprover(id: string) {
    setSelectedApprovers((prev) => prev.filter((a) => a.id !== id));
  }

  function moveApprover(index: number, direction: -1 | 1) {
    const next = [...selectedApprovers];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedApprovers(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedApprovers.length === 0) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      approverIds: selectedApprovers.map((a) => a.id),
    });
  }

  const availableUsers = users.filter((u) => !selectedApprovers.find((a) => a.id === u.id));

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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Approver chain */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Genehmiger-Kette <span className="text-xs font-normal text-gray-400">(Reihenfolge = Ablaufreihenfolge)</span>
            </label>

            {/* Visual chain */}
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3 mb-2 space-y-1.5">
              {/* Creator (always first) */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 dark:bg-white/[0.03] text-xs text-gray-500">
                <span className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold">1</span>
                <span className="font-medium">Ersteller (du)</span>
                <span className="ml-auto text-gray-400 italic">Entwurf</span>
              </div>

              {/* Approvers */}
              {selectedApprovers.map((user, i) => (
                <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/10 text-xs">
                  <span className="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">{i + 2}</span>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => moveApprover(i, -1)} className="text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled={i === 0}>
                      <GripVertical className="h-3 w-3 rotate-180" />
                    </button>
                    <button type="button" onClick={() => moveApprover(i, 1)} className="text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled={i === selectedApprovers.length - 1}>
                      <GripVertical className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => removeApprover(user.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ))}

              {/* Approved (always last) */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/10 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">✓</span>
                <span className="font-medium">Genehmigt</span>
              </div>
            </div>

            {/* Add approver */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="h-3 w-3" />
                Genehmiger hinzufuegen
              </button>

              {showPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                  <div className="absolute z-20 mt-1 w-64 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-lg py-1">
                    {availableUsers.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">Keine weiteren Mitarbeiter</div>
                    )}
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addApprover(u)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-700 dark:text-gray-300">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!name.trim() || selectedApprovers.length === 0 || loading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Erstelle...' : 'Abnahme-Projekt erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
