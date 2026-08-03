'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Search, Plus, Copy, Eye, EyeOff, ExternalLink, Users, Shield,
  Trash2, Pencil, X, ChevronDown, Sparkles, AlertTriangle, RefreshCw, Check, UserMinus,
} from 'lucide-react';
import {
  passwordsApi, faviconFor, generatePassword,
  type PasswordCategory, type PasswordEntryListItem,
} from '@/lib/passwords';

interface TeamUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
}

// --------------------------------------------------------------------------
// Helper — Zwischenablage mit Auto-Clear nach 30s
// --------------------------------------------------------------------------
async function copyWithAutoClear(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  setTimeout(() => {
    // Best-effort: nur ueberschreiben wenn User noch den gleichen Wert drin hat
    navigator.clipboard.readText()
      .then((current) => {
        if (current === text) navigator.clipboard.writeText('').catch(() => {});
      })
      .catch(() => {
        // Read-Berechtigung fehlt (Safari etc.) — dann Text still ueberschreiben
        navigator.clipboard.writeText('').catch(() => {});
      });
  }, 30_000);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function strengthColor(score: number | null): string {
  if (score == null) return 'bg-gray-300';
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function strengthLabel(score: number | null): string {
  if (score == null) return 'unbekannt';
  if (score >= 80) return 'stark';
  if (score >= 60) return 'gut';
  if (score >= 40) return 'schwach';
  return 'sehr schwach';
}

// --------------------------------------------------------------------------
// Landing
// --------------------------------------------------------------------------
export default function PasswordsPage() {
  const [entries, setEntries] = useState<PasswordEntryListItem[]>([]);
  const [categories, setCategories] = useState<PasswordCategory[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState<PasswordEntryListItem | null>(null);
  const [showCatMgmt, setShowCatMgmt] = useState(false);
  const [showBulkShare, setShowBulkShare] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([passwordsApi.list(), passwordsApi.listCategories(), passwordsApi.team()])
      .then(([e, c, t]) => {
        if (!active) return;
        setEntries(e);
        setCategories(c);
        setTeam(t);
      })
      .catch(() => {
        if (!active) return;
        setEntries([]);
        setCategories([]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (activeCategory && e.category?.id !== activeCategory) return false;
      if (activeCategory === '__none__' && e.category) return false;
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        (e.username ?? '').toLowerCase().includes(term) ||
        (e.url ?? '').toLowerCase().includes(term) ||
        (e.category?.name ?? '').toLowerCase().includes(term)
      );
    });
  }, [entries, search, activeCategory]);

  // Kategorie-Zaehler
  const catCounts = useMemo(() => {
    const map = new Map<string, number>();
    let uncategorized = 0;
    for (const e of entries) {
      if (e.category?.id) map.set(e.category.id, (map.get(e.category.id) ?? 0) + 1);
      else uncategorized++;
    }
    return { map, uncategorized };
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 items-center justify-center shadow-md flex-shrink-0">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Passwort-Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Zentrale Passwörter, verschlüsselt gespeichert. Wer sieht was — du entscheidest pro Eintrag.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCatMgmt(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-200 px-3 py-2 text-sm font-medium"
          >
            <Shield className="h-4 w-4" /> Kategorien
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" /> Neu
          </button>
        </div>
      </div>

      {/* Suche */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titel, Nutzername, URL, Kategorie suchen …"
          autoFocus
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {/* 2-Spalten: Kategorien-Sidebar + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Kategorien */}
        <aside className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 px-2 py-1.5">
            Kategorien
          </div>
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-sm ${
              activeCategory === null
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <span>Alle</span>
            <span className="text-xs text-gray-400">{entries.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-sm gap-2 ${
                activeCategory === c.id
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="text-xs text-gray-400">{catCounts.map.get(c.id) ?? 0}</span>
            </button>
          ))}
          {catCounts.uncategorized > 0 && (
            <button
              onClick={() => setActiveCategory('__none__')}
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-sm ${
                activeCategory === '__none__'
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <span>Ohne Kategorie</span>
              <span className="text-xs text-gray-400">{catCounts.uncategorized}</span>
            </button>
          )}
        </aside>

        {/* Grid */}
        <div>
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
          ) : null}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2.5">
              <div className="text-sm text-indigo-900 dark:text-indigo-200 font-medium">
                {selectedIds.size} ausgewählt
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkShare(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm font-medium"
                >
                  <Users className="h-4 w-4" /> Freigeben
                </button>
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1.5 rounded-lg text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-1.5 text-sm"
                >
                  Auswahl aufheben
                </button>
              </div>
            </div>
          )}
          {loading ? null : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-10 text-center">
              <KeyRound className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {search || activeCategory
                  ? 'Keine Einträge gefunden.'
                  : 'Noch keine Passwörter — klick auf „Neu" um deinen ersten Eintrag anzulegen.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  selected={selectedIds.has(entry.id)}
                  onOpen={() => setShowEdit(entry)}
                  onToggleSelect={() => toggleSelect(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <EntryEditor
          mode="create"
          categories={categories}
          team={team}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); reload(); }}
        />
      )}
      {showEdit && (
        <EntryEditor
          mode="edit"
          entry={showEdit}
          categories={categories}
          team={team}
          onClose={() => setShowEdit(null)}
          onSaved={() => { setShowEdit(null); reload(); }}
        />
      )}
      {showCatMgmt && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCatMgmt(false)}
          onChange={() => reload()}
        />
      )}
      {showBulkShare && (
        <BulkShareModal
          entryIds={Array.from(selectedIds)}
          team={team}
          onClose={() => setShowBulkShare(false)}
          onDone={() => { setShowBulkShare(false); clearSelection(); reload(); }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Kachel — Grid-Element pro Passwort
// --------------------------------------------------------------------------
function EntryCard({
  entry,
  selected,
  onOpen,
  onToggleSelect,
}: {
  entry: PasswordEntryListItem;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
}) {
  const favicon = entry.faviconUrl || faviconFor(entry.url);
  const catColor = entry.category?.color || '#94a3b8';

  return (
    <div
      className={`group text-left rounded-2xl border ${
        selected
          ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/30'
          : 'border-gray-200 dark:border-white/8'
      } bg-white dark:bg-white/[0.03] hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md transition-all p-4 relative overflow-hidden`}
    >
      {/* Farbcode-Streifen oben */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: catColor }} />
      {/* Checkbox oben rechts fuer Bulk-Auswahl */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-2 right-2 h-5 w-5 rounded flex items-center justify-center border ${
          selected
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'bg-white dark:bg-white/[0.06] border-gray-300 dark:border-white/20 text-transparent hover:border-indigo-400'
        }`}
        aria-label="Auswaehlen"
      >
        {selected && <Check className="h-3 w-3" />}
      </button>
      <button onClick={onOpen} type="button" className="w-full text-left">
      <div className="flex items-start gap-3 mt-1">
        <div className="h-10 w-10 rounded-xl bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {favicon ? (
            <img src={favicon} alt="" className="h-6 w-6" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <KeyRound className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.username || '—'}</div>
          <div className="flex items-center gap-2 mt-2">
            {entry.category && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                {entry.category.name}
              </span>
            )}
            <span className={`h-1.5 w-1.5 rounded-full ${strengthColor(entry.passwordStrength)}`} />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{strengthLabel(entry.passwordStrength)}</span>
            {entry.hasTotp && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">2FA</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {entry.sharedWith.length + 1}
        </span>
        <span>{fmtDate(entry.updatedAt)}</span>
      </div>
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Editor (Create + Edit) — modal mit Reveal, Copy, Sharing
// --------------------------------------------------------------------------
function EntryEditor({
  mode,
  entry,
  categories,
  team,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  entry?: PasswordEntryListItem;
  categories: PasswordCategory[];
  team: TeamUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [url, setUrl] = useState(entry?.url ?? '');
  const [username, setUsername] = useState(entry?.username ?? '');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(mode === 'create');
  const [notes, setNotes] = useState('');
  const [totpSeed, setTotpSeed] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(entry?.category?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sharedUserIds, setSharedUserIds] = useState<Set<string>>(
    new Set((entry?.sharedWith ?? []).map((u) => u.id)),
  );

  const toggleShare = (uid: string) => {
    setSharedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const reveal = async () => {
    if (!entry) return;
    try {
      const r = await passwordsApi.reveal(entry.id);
      setPassword(r.password);
      setNotes(r.notes ?? '');
      setTotpSeed(r.totpSeed ?? '');
      setRevealed(true);
      setPasswordVisible(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const copy = async (text: string) => {
    if (!text) return;
    await copyWithAutoClear(text);
  };

  const save = async () => {
    if (!title.trim()) { setErr('Titel erforderlich'); return; }
    if (mode === 'create' && !password) { setErr('Passwort erforderlich'); return; }
    setBusy(true); setErr(null);
    try {
      if (mode === 'create') {
        await passwordsApi.create({
          title: title.trim(),
          url: url.trim() || null,
          username: username.trim() || null,
          password,
          notes: notes || null,
          totpSeed: totpSeed || null,
          categoryId,
          sharedWithUserIds: Array.from(sharedUserIds),
        });
      } else if (entry) {
        const patch: any = {
          title: title.trim(),
          url: url.trim() || null,
          username: username.trim() || null,
          categoryId,
        };
        if (revealed) {
          patch.notes = notes || null;
          patch.totpSeed = totpSeed || null;
          if (password) patch.password = password;
        }
        await passwordsApi.update(entry.id, patch);
        // Sharing separat aktualisieren (Diff-basiert)
        await passwordsApi.setAccess(entry.id, Array.from(sharedUserIds));
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!entry) return;
    if (!confirm(`Eintrag "${entry.title}" wirklich löschen?`)) return;
    setBusy(true);
    try {
      await passwordsApi.remove(entry.id);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const strengthScore = useMemo(() => {
    if (!password) return null;
    // Client-seitig grobe Bewertung (identisch mit Backend)
    let s = 0;
    if (password.length >= 8) s += 20;
    if (password.length >= 12) s += 15;
    if (password.length >= 16) s += 10;
    if (/[a-z]/.test(password)) s += 10;
    if (/[A-Z]/.test(password)) s += 10;
    if (/[0-9]/.test(password)) s += 10;
    if (/[^A-Za-z0-9]/.test(password)) s += 15;
    const u = new Set(password).size;
    if (password.length && u / password.length > 0.6) s += 10;
    return Math.min(100, s);
  }, [password]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8 sticky top-0 bg-white dark:bg-[#0f1117]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Neuer Eintrag' : entry?.title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {err && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-800 dark:text-red-300">
              {err}
            </div>
          )}

          <Field label="Titel">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Instagram Filapen"
              className={inputCls()}
            />
          </Field>

          <Field label="URL (optional)">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls()}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Benutzername / E-Mail">
              <div className="relative">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls('pr-9')}
                />
                {username && (
                  <button
                    type="button"
                    onClick={() => copy(username)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                    title="Kopieren (Zwischenablage nach 30s gelöscht)"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                )}
              </div>
            </Field>
            <Field label="Kategorie">
              <select
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className={inputCls()}
              >
                <option value="">— keine —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Passwort">
            <div className="space-y-2">
              {mode === 'edit' && !revealed ? (
                <button
                  type="button"
                  onClick={reveal}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-200 px-3 py-2.5 text-sm font-medium"
                >
                  <Eye className="h-4 w-4" /> Passwort anzeigen
                </button>
              ) : (
                <div className="relative">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'edit' ? '(unverändert lassen)' : 'Passwort eingeben oder generieren'}
                    className={inputCls('pr-24 font-mono')}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((v) => !v)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(password)}
                      disabled={!password}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-40"
                      title="Kopieren (Zwischenablage nach 30s gelöscht)"
                    >
                      <Copy className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassword(generatePassword(20))}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                      title="Passwort generieren"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    </button>
                  </div>
                </div>
              )}
              {password && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor(strengthScore)}`} style={{ width: `${strengthScore ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{strengthLabel(strengthScore)}</span>
                </div>
              )}
            </div>
          </Field>

          {(revealed || mode === 'create') && (
            <>
              <Field label="2FA-Seed (TOTP, optional)">
                <input
                  value={totpSeed}
                  onChange={(e) => setTotpSeed(e.target.value)}
                  placeholder="Base32-Seed z.B. JBSWY3DPEHPK3PXP"
                  className={inputCls('font-mono')}
                />
              </Field>
              <Field label="Notizen (optional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={inputCls()}
                />
              </Field>
            </>
          )}

          {/* Sharing */}
          <div className="pt-2 border-t border-gray-100 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">Freigegeben für</div>
              {sharedUserIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSharedUserIds(new Set())}
                  className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                >
                  Alle entfernen
                </button>
              )}
            </div>
            {team.length === 0 ? (
              <p className="text-xs text-gray-500">Keine anderen Team-Mitglieder gefunden.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/8 divide-y divide-gray-100 dark:divide-white/8">
                {team.map((u) => {
                  const checked = sharedUserIds.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleShare(u.id)}
                        className="rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name || u.email}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                      </div>
                      {u.role === 'owner' || u.role === 'admin' ? (
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{u.role === 'owner' ? 'Owner' : 'Admin'}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              Owner + Admins sehen ohnehin alle Einträge. Freigabe hier nur für Mitarbeiter nötig.
            </p>
          </div>

          {mode === 'edit' && entry && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/8 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <div>Erstellt von {entry.createdBy.name || entry.createdBy.email}</div>
              <div>Passwort zuletzt geändert: {fmtDate(entry.passwordUpdatedAt)}</div>
              <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Sichtbar für {entry.sharedWith.length + 1} Person(en)</div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/8 flex items-center justify-between gap-2 sticky bottom-0 bg-white dark:bg-[#0f1117]">
          {mode === 'edit' ? (
            <button onClick={del} disabled={busy} className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1">
              <Trash2 className="h-4 w-4" /> Löschen
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]">
              Abbrechen
            </button>
            <button onClick={save} disabled={busy} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1">
              {busy && <RefreshCw className="h-3 w-3 animate-spin" />} Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Kategorie-Manager
// --------------------------------------------------------------------------
function CategoryManager({
  categories,
  onClose,
  onChange,
}: {
  categories: PasswordCategory[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [items, setItems] = useState(categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setItems(categories); }, [categories]);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await passwordsApi.createCategory({ name: newName.trim(), color: newColor });
      setNewName('');
      onChange();
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Kategorie löschen? Einträge behalten den Zugriff, verlieren nur die Kategorie-Zuordnung.')) return;
    setBusy(true);
    try {
      await passwordsApi.deleteCategory(id);
      onChange();
    } finally { setBusy(false); }
  };

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#64748b'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kategorien verwalten</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-white/8">
                <span className="h-4 w-4 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="flex-1 text-sm text-gray-900 dark:text-white">{c.name}</span>
                <button onClick={() => remove(c.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-gray-100 dark:border-white/8">
            <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">Neu anlegen</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (z.B. Social Media)"
              className={inputCls()}
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-6 w-6 rounded-full ${newColor === c ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-[#0f1117]' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <button
              onClick={create}
              disabled={busy || !newName.trim()}
              className="mt-3 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              Kategorie anlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Helper-Komponenten
// --------------------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function inputCls(extra?: string) {
  return `w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${extra ?? ''}`;
}

// --------------------------------------------------------------------------
// Bulk-Share — mehrere Passwoerter gleichzeitig an mehrere User freigeben
// (Team-Onboarding-Sets: "Marketing-Set fuer neue Mitarbeiter")
// --------------------------------------------------------------------------
function BulkShareModal({
  entryIds,
  team,
  onClose,
  onDone,
}: {
  entryIds: string[];
  team: TeamUser[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ granted: number; entries: number; users: number } | null>(null);

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) { setErr('Keine User ausgewählt'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await passwordsApi.bulkGrant({
        entryIds,
        userIds: Array.from(selected),
      });
      setResult(r);
      setTimeout(() => onDone(), 1200);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {entryIds.length} Einträge freigeben
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {result ? (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              ✓ {result.granted} neue Freigaben erzeugt ({result.entries} Einträge × {result.users} Nutzer)
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Wähle die Team-Mitglieder aus, die alle {entryIds.length} Einträge sehen sollen. Bestehende Freigaben bleiben erhalten.
              </p>
              {err && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-800 dark:text-red-300">{err}</div>
              )}
              {team.length === 0 ? (
                <p className="text-sm text-gray-500">Keine Team-Mitglieder verfügbar.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/8 divide-y divide-gray-100 dark:divide-white/8">
                  {team.map((u) => {
                    const checked = selected.has(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} className="rounded" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name || u.email}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        {!result && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/8 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]">
              Abbrechen
            </button>
            <button
              onClick={submit}
              disabled={busy || selected.size === 0}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1"
            >
              {busy && <RefreshCw className="h-3 w-3 animate-spin" />}
              Freigeben
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
