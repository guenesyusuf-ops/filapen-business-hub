'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, FileIcon, Folder, Trash2, Upload, Search, Loader2, Users } from 'lucide-react';
import { sendApi, fmtSize } from '@/lib/filapen-send';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export function SendModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/team`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list: TeamMember[] = Array.isArray(data?.members) ? data.members : Array.isArray(data) ? data : [];
        setMembers(list.filter((m) => m.id !== currentUser?.id));
      })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = search.trim()
    ? members.filter((m) => {
        const q = search.toLowerCase();
        const name = (m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`).toLowerCase();
        return name.includes(q) || m.email.toLowerCase().includes(q);
      })
    : members;

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function addFiles(newFiles: FileList | File[] | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (selected.size === 0) { setError('Mindestens einen Empfaenger auswaehlen'); return; }
    if (files.length === 0) { setError('Mindestens eine Datei auswaehlen'); return; }
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      await sendApi.upload(Array.from(selected), files, {
        message: message.trim() || undefined,
        onProgress: (p) => setProgress(p.percent),
      });
      onSent();
    } catch (e: any) {
      setError(e.message || 'Upload fehlgeschlagen');
      setUploading(false);
    }
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Send className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Filapen Send · Neue Sendung</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Empfaenger */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Empfaenger ({selected.size} ausgewaehlt)
            </h3>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Team-Mitglied suchen…"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <div className="border border-gray-200 dark:border-white/10 rounded-xl max-h-[200px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">Keine Treffer</div>
              ) : (
                filtered.map((m) => {
                  const name = m.name || [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email.split('@')[0];
                  const isSel = selected.has(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleMember(m.id)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{m.email}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          {/* Dateien */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              Dateien ({files.length}) · {fmtSize(totalSize)}
            </h3>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={cn(
                'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                dragOver ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-white/10',
              )}
            >
              <Upload className="h-7 w-7 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Dateien hier reinziehen oder
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/40 dark:hover:bg-primary-900/60 text-primary-800 dark:text-primary-200 px-3 py-1.5 text-xs font-medium"
                >
                  <FileIcon className="h-3.5 w-3.5" /> Dateien waehlen
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs font-medium"
                >
                  <Folder className="h-3.5 w-3.5" /> Ordner waehlen
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Max 500 MB pro Datei, 50 Dateien gesamt</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-expect-error Browser-API fuer Folder-Upload */
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="mt-3 max-h-[180px] overflow-y-auto border border-gray-100 dark:border-white/8 rounded-lg divide-y divide-gray-100 dark:divide-white/5">
                {files.map((f, i) => {
                  const path = (f as any).webkitRelativePath || f.name;
                  const isInFolder = path !== f.name;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                      {isInFolder ? <Folder className="h-3.5 w-3.5 text-amber-500" /> : <FileIcon className="h-3.5 w-3.5 text-gray-400" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{path}</div>
                        <div className="text-[10px] text-gray-400">{fmtSize(f.size)}</div>
                      </div>
                      <button onClick={() => removeFile(i)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Message */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Nachricht (optional)</h3>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm"
              placeholder="z.B. Hier die Vorlagen fuer naechste Woche …"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>Hochladen …</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} disabled={uploading} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={uploading || files.length === 0 || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {uploading ? 'Sendet …' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  );
}
