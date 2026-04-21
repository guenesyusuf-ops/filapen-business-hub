'use client';

import { useEffect, useState } from 'react';
import { Plus, Target, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { emailApi, fmtDateTime, type Segment } from '@/lib/email-marketing';
import { PageHeader, Empty, btn } from '@/components/email-marketing/EmailMarketingUI';
import { SegmentBuilder } from '@/components/email-marketing/SegmentBuilder';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  const load = () => {
    setLoading(true);
    emailApi.listSegments().then(setSegments).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onDelete = async (s: Segment) => {
    if (!confirm(`Segment "${s.name}" löschen?`)) return;
    await emailApi.deleteSegment(s.id);
    load();
  };

  const onRefresh = async (s: Segment) => {
    try {
      await emailApi.refreshSegment(s.id);
      load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Segmente"
        subtitle="Regel-basierte Zielgruppen"
        actions={
          <button onClick={() => setCreating(true)} className={btn('primary')}>
            <Plus className="h-4 w-4" /> Neues Segment
          </button>
        }
      />

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : segments.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<Target className="h-10 w-10" />}
            title="Noch keine Segmente"
            hint="Erstelle dein erstes Segment — z.B. 'Kunden mit > 200€ Umsatz in den letzten 30 Tagen'."
            action={<button onClick={() => setCreating(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Neues Segment</button>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left">Beschreibung</th>
                <th className="px-3 py-2.5 text-right">Mitglieder</th>
                <th className="px-3 py-2.5 text-left">Zuletzt aktualisiert</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {segments.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[300px]">{s.description || '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{s.memberCount.toLocaleString('de-DE')}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(s.lastRefreshedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => onRefresh(s)} title="Neu berechnen" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><RefreshCw className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditing(s)} title="Bearbeiten" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => onDelete(s)} title="Löschen" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SegmentBuilder
          initial={editing ? { name: editing.name, description: editing.description, rules: editing.rules } : undefined}
          existingId={editing?.id}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
