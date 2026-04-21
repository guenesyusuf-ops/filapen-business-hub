'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Workflow, Play, Pause, Trash2, Archive, ShoppingCart, UserPlus, CheckSquare } from 'lucide-react';
import { emailApi, FLOW_STATUS_LABELS, TRIGGER_LABELS, fmtDateTime, type Flow } from '@/lib/email-marketing';
import { PageHeader, Empty, btn, Badge, SectionCard } from '@/components/email-marketing/EmailMarketingUI';

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([emailApi.listFlows(), emailApi.flowCatalog()])
      .then(([f, c]) => { setFlows(f); setCatalog(c); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const install = async (kind: string) => {
    setInstalling(kind);
    try {
      await emailApi.installFlow(kind);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setInstalling(null); }
  };

  const setStatus = async (f: Flow, status: any) => {
    try { await emailApi.setFlowStatus(f.id, status); load(); }
    catch (e: any) { alert(e.message); }
  };

  const onDelete = async (f: Flow) => {
    if (!confirm(`Flow "${f.name}" löschen? Alle Enrollments werden mit gelöscht.`)) return;
    try { await emailApi.deleteFlow(f.id); load(); }
    catch (e: any) { alert(e.message); }
  };

  const iconFor = (trigger: string) => {
    if (trigger === 'customer_created') return <UserPlus className="h-5 w-5" />;
    if (trigger === 'checkout_started') return <ShoppingCart className="h-5 w-5" />;
    if (trigger === 'order_placed') return <CheckSquare className="h-5 w-5" />;
    return <Workflow className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Automations" subtitle="Trigger-basierte Email-Serien" />

      {/* Pre-built catalog */}
      {flows.length === 0 && catalog.length > 0 && (
        <SectionCard title="Schnellstart — vorgefertigte Flows" description="Mit einem Klick installieren und anpassen">
          <div className="grid md:grid-cols-3 gap-3">
            {catalog.map((c) => (
              <div key={c.kind} className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                    {iconFor(c.triggerType)}
                  </div>
                  <div className="font-semibold text-sm">{c.name}</div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[40px]">{c.description}</p>
                <div className="text-xs text-gray-400 mt-1">{c.emailCount} Email{c.emailCount !== 1 ? 's' : ''}</div>
                <button
                  onClick={() => install(c.kind)}
                  disabled={installing === c.kind}
                  className={btn('primary', 'w-full justify-center mt-3 text-xs')}
                >
                  {installing === c.kind ? 'Installiert …' : 'Installieren'}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : flows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<Workflow className="h-10 w-10" />}
            title="Noch keine Automations"
            hint="Installiere einen der Schnellstart-Flows oben oder erstelle einen eigenen."
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left">Trigger</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Schritte</th>
                <th className="px-3 py-2.5 text-right">Enrolled</th>
                <th className="px-3 py-2.5 text-right">Completed</th>
                <th className="px-3 py-2.5 text-left">Aktiviert</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {flows.map((f) => {
                const st = FLOW_STATUS_LABELS[f.status];
                return (
                  <tr key={f.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.04]">
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{f.name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{TRIGGER_LABELS[f.triggerType]}</td>
                    <td className="px-3 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums">{f._count?.steps || 0}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.enrolledCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.completedCount}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(f.activatedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {f.status === 'draft' || f.status === 'paused' ? (
                          <button onClick={() => setStatus(f, 'active')} title="Aktivieren" className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"><Play className="h-3.5 w-3.5" /></button>
                        ) : f.status === 'active' ? (
                          <button onClick={() => setStatus(f, 'paused')} title="Pausieren" className="p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600"><Pause className="h-3.5 w-3.5" /></button>
                        ) : null}
                        {f.status !== 'archived' && (
                          <button onClick={() => setStatus(f, 'archived')} title="Archivieren" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><Archive className="h-3.5 w-3.5" /></button>
                        )}
                        <button onClick={() => onDelete(f)} title="Löschen" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
