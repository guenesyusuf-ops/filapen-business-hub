'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Loader2, Save, X, Bell, Mail, Tag, ShieldCheck, Plus } from 'lucide-react';
import { invoicesApi, DEFAULT_CATEGORIES, type InvoiceSettings } from '@/lib/invoices';

export default function InvoiceSettingsPage() {
  const q = useQuery({
    queryKey: ['invoice-settings'],
    queryFn: () => invoicesApi.getSettings(),
  });

  const [reminderDays, setReminderDays] = useState<number[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [retentionMonths, setRetentionMonths] = useState(120);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setReminderDays(q.data.reminderDaysBefore ?? [7, 3, 0]);
      setRecipients(q.data.reminderRecipients ?? []);
      setRetentionMonths(q.data.retentionMonths ?? 120);
      setCustomCategories(q.data.customCategories ?? []);
      setDirty(false);
    }
  }, [q.data]);

  function dirtify<T extends (...args: any) => void>(fn: T): T {
    return ((...args: any) => { setDirty(true); setSuccess(false); fn(...args); }) as T;
  }

  function toggleDay(d: number) {
    setReminderDays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d).sort((a, b) => b - a);
      return [...prev, d].sort((a, b) => b - a);
    });
    setDirty(true);
  }

  function addRecipient() {
    const email = newRecipient.trim();
    if (!/.+@.+/.test(email)) return;
    if (recipients.includes(email)) return;
    setRecipients((prev) => [...prev, email]);
    setNewRecipient('');
    setDirty(true);
  }
  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((e) => e !== email));
    setDirty(true);
  }

  function addCustomCat() {
    const c = newCategory.trim();
    if (!c || customCategories.includes(c)) return;
    setCustomCategories((prev) => [...prev, c]);
    setNewCategory('');
    setDirty(true);
  }
  function removeCustomCat(c: string) {
    setCustomCategories((prev) => prev.filter((x) => x !== c));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await invoicesApi.updateSettings({
        reminderDaysBefore: reminderDays,
        reminderRecipients: recipients,
        retentionMonths,
        customCategories,
      });
      setDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: any) {
      setError(err?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  if (q.isLoading) {
    return (
      <div className="p-16 text-center text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-gray-500 to-gray-700 items-center justify-center shadow-md">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
          Rechnungs-Einstellungen
        </h1>
      </div>

      {/* Reminder Days */}
      <Section icon={<Bell className="h-3.5 w-3.5" />} title="Erinnerungen vor Fälligkeit"
        hint="Wann soll die Software dich an offene Rechnungen erinnern? Wähle mehrere Schwellen.">
        <div className="flex items-center gap-2 flex-wrap">
          {[14, 7, 3, 1, 0, -1, -3, -7].map((d) => {
            const active = reminderDays.includes(d);
            const label = d > 0 ? `${d}T vorher` : d === 0 ? 'Tag X' : `${-d}T danach`;
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-amber-300'
                }`}
              >{label}</button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2.5">
          Mails gehen jeden Morgen um 07:30 raus — pro Rechnung pro Schwelle genau einmal.
        </p>
      </Section>

      {/* Recipients */}
      <Section icon={<Mail className="h-3.5 w-3.5" />} title="Zusätzliche Empfänger"
        hint="Erinnerungen gehen automatisch an den Uploader. Hier kannst du weitere E-Mail-Adressen hinzufügen.">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="email"
            placeholder="email@firma.de"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
            className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <button
            onClick={addRecipient}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3 w-3" /> Hinzufügen
          </button>
        </div>
        {recipients.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">Keine zusätzlichen Empfänger.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {recipients.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300">
                {e}
                <button onClick={() => removeRecipient(e)} className="hover:text-red-500">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Custom Categories */}
      <Section icon={<Tag className="h-3.5 w-3.5" />} title="Eigene Kategorien"
        hint="Zusätzlich zu den Standard-Kategorien.">
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Standard:</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DEFAULT_CATEGORIES.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border" style={{ borderColor: c.color + '60', background: c.color + '10', color: c.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            placeholder="z.B. Werkzeuge"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCat(); } }}
            className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <button
            onClick={addCustomCat}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3 w-3" /> Hinzufügen
          </button>
        </div>
        {customCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customCategories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300">
                {c}
                <button onClick={() => removeCustomCat(c)} className="hover:text-red-500">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Retention */}
      <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Aufbewahrungsfrist"
        hint="Wie lange müssen Rechnungen aufbewahrt werden? (DE-GoBD: 10 Jahre = 120 Monate)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={12}
            value={retentionMonths}
            onChange={dirtify((e: any) => setRetentionMonths(Math.max(12, parseInt(e.target.value, 10) || 12)))}
            className="w-24 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">Monate ({Math.round(retentionMonths / 12)} Jahre)</span>
        </div>
      </Section>

      {/* Sticky Save */}
      <div className="sticky bottom-4 z-30 flex items-center justify-end gap-3 mt-6">
        {success && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Save className="h-3 w-3" /> Gespeichert
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          disabled={!dirty || saving}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {dirty ? 'Änderungen speichern' : 'Keine Änderungen'}
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 ml-8">{hint}</p>}
      <div className="ml-8">{children}</div>
    </div>
  );
}
