'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, Plus, Trash2, Mail, Target, Users2 } from 'lucide-react';
import { emailApi, CAMPAIGN_STATUS_LABELS, fmtDateTime, type EmailCampaign, type Segment, type EmailTemplate } from '@/lib/email-marketing';
import { PageHeader, Empty, btn, Badge, input as inputCls, label as labelCls } from '@/components/email-marketing/EmailMarketingUI';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    emailApi.listCampaigns().then(setCampaigns).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onDelete = async (c: EmailCampaign) => {
    if (!confirm(`Kampagne "${c.name}" löschen?`)) return;
    try { await emailApi.deleteCampaign(c.id); load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kampagnen"
        subtitle="Einmalige Email-Sends an Segmente"
        actions={<button onClick={() => setCreating(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Neue Kampagne</button>}
      />

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<Send className="h-10 w-10" />}
            title="Noch keine Kampagnen"
            hint="Erstelle deine erste Kampagne: Wähle ein Template und ein Segment, dann senden."
            action={<button onClick={() => setCreating(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Neue Kampagne</button>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <div className="table-scroll">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Template</th>
                <th className="px-3 py-2.5 text-left hidden lg:table-cell">Segment</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right hidden sm:table-cell">Versendet</th>
                <th className="px-3 py-2.5 text-right hidden lg:table-cell">Geöffnet</th>
                <th className="px-3 py-2.5 text-right hidden xl:table-cell">Geklickt</th>
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Gesendet am</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {campaigns.map((c) => {
                const st = CAMPAIGN_STATUS_LABELS[c.status];
                return (
                  <tr key={c.id} onClick={() => router.push(`/email-marketing/campaigns/${c.id}`)} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.04] cursor-pointer">
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      <div className="truncate max-w-[180px] sm:max-w-none">{c.name}</div>
                      {/* Mobile sub-line: template + sent count + date */}
                      <div className="md:hidden text-[10px] text-gray-500 mt-0.5 truncate">
                        {c.template?.name || '—'} · {c.sentCount}x gesendet · {fmtDateTime(c.sentAt || c.scheduledAt)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{c.template?.name || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden lg:table-cell">{c.segment?.name || '—'} {c.segment?.memberCount ? `(${c.segment.memberCount})` : ''}</td>
                    <td className="px-3 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">{c.sentCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums hidden lg:table-cell">{c.openCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums hidden xl:table-cell">{c.clickCount}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{fmtDateTime(c.sentAt || c.scheduledAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); onDelete(c); }} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {creating && <CreateCampaignModal onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); router.push(`/email-marketing/campaigns/${c.id}`); }} />}
    </div>
  );
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [consentMode, setConsentMode] = useState('subscribed');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    emailApi.listTemplates().then(setTemplates);
    emailApi.listSegments().then(setSegments);
  }, []);

  const submit = async () => {
    if (!name || !templateId || !segmentId) { setErr('Alle Pflichtfelder ausfüllen'); return; }
    setBusy(true); setErr(null);
    try {
      const c = await emailApi.createCampaign({ name, templateId, segmentId, scheduledAt: scheduledAt || null, consentMode });
      onCreated(c);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Neue Kampagne</h3>
          <button onClick={onClose} className={btn('ghost', 'h-8 px-2 py-1 text-xs')}>Abbrechen</button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className={labelCls()}>Name *</label><input className={inputCls()} value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Frühlings-Sale 2026" /></div>
          <div>
            <label className={labelCls()}>Template *</label>
            <select className={inputCls()} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— wähle Template —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {templates.length === 0 && <p className="text-xs text-amber-600 mt-1">Lege erst ein Template an.</p>}
          </div>
          <div>
            <label className={labelCls()}>Segment *</label>
            <select className={inputCls()} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">— wähle Segment —</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.memberCount.toLocaleString('de-DE')} Kontakte)</option>)}
            </select>
            {segments.length === 0 && <p className="text-xs text-amber-600 mt-1">Lege erst ein Segment an.</p>}
          </div>
          <div>
            <label className={labelCls()}>Consent-Modus</label>
            <select className={inputCls()} value={consentMode} onChange={(e) => setConsentMode(e.target.value)}>
              <option value="subscribed">Nur Angemeldete (Single-Opt-In ausreichend)</option>
              <option value="confirmed">Nur Doppel-Opt-In</option>
              <option value="all_opted_in">Alle nicht-abgemeldeten (inkl. nie-angemeldet)</option>
            </select>
          </div>
          <div>
            <label className={labelCls()}>Geplantes Sende-Datum (optional)</label>
            <input type="datetime-local" className={inputCls()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Leer lassen, um später manuell zu versenden.</p>
          </div>
          {err && <div className="text-sm text-red-600 dark:text-red-400">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy} className={btn('primary')}>{busy ? 'Erstellt …' : 'Anlegen'}</button>
        </div>
      </div>
    </div>
  );
}
