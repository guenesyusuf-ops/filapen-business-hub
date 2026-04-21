'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Send, MailOpen, MousePointer, CheckCircle2 } from 'lucide-react';
import { emailApi, CAMPAIGN_STATUS_LABELS, FLOW_STATUS_LABELS, fmtDateTime } from '@/lib/email-marketing';
import { PageHeader, KpiCard, Badge, SectionCard } from '@/components/email-marketing/EmailMarketingUI';

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      emailApi.listCampaigns(),
      emailApi.listFlows(),
      emailApi.dashboard(),
    ]).then(([c, f, d]) => {
      setCampaigns(c);
      setFlows(f);
      setDashboard(d);
    }).finally(() => setLoading(false));
  }, []);

  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + (c.sentCount || 0),
    opened: acc.opened + (c.openCount || 0),
    clicked: acc.clicked + (c.clickCount || 0),
    delivered: acc.delivered + (c.deliveredCount || 0),
  }), { sent: 0, opened: 0, clicked: 0, delivered: 0 });

  const openRate = totals.sent > 0 ? Math.round((totals.opened / totals.sent) * 100) : 0;
  const clickRate = totals.sent > 0 ? Math.round((totals.clicked / totals.sent) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Aggregierte Performance deiner Emails" />

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Versendet (alle Zeit)" value={totals.sent} accent="blue" icon={<Send className="h-5 w-5" />} />
            <KpiCard label="Zugestellt" value={totals.delivered} accent="green" icon={<CheckCircle2 className="h-5 w-5" />} />
            <KpiCard label="Öffnungsrate" value={`${openRate}%`} sublabel={`${totals.opened} geöffnet`} accent="indigo" icon={<MailOpen className="h-5 w-5" />} />
            <KpiCard label="Klickrate" value={`${clickRate}%`} sublabel={`${totals.clicked} geklickt`} accent="purple" icon={<MousePointer className="h-5 w-5" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <SectionCard title="Kampagnen-Performance" description={`${campaigns.length} Kampagnen`}>
              {campaigns.length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">Noch keine Kampagnen.</div>
              ) : (
                <div className="space-y-2">
                  {campaigns.slice(0, 10).map((c) => {
                    const st = CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS];
                    const open = c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100) : 0;
                    const click = c.sentCount > 0 ? Math.round((c.clickCount / c.sentCount) * 100) : 0;
                    return (
                      <Link key={c.id} href={`/email-marketing/campaigns/${c.id}`} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                          <div className="text-xs text-gray-400">{fmtDateTime(c.sentAt)} · <Badge color={st.color}>{st.label}</Badge></div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap text-right">
                          <div>{c.sentCount} versendet</div>
                          <div>{open}% open · {click}% click</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Automations" description={`${flows.length} Flows`}>
              {flows.length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">Noch keine Flows aktiviert.</div>
              ) : (
                <div className="space-y-2">
                  {flows.map((f) => {
                    const st = FLOW_STATUS_LABELS[f.status as keyof typeof FLOW_STATUS_LABELS];
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</div>
                          <div className="text-xs text-gray-400"><Badge color={st.color}>{st.label}</Badge></div>
                        </div>
                        <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                          <div>{f.enrolledCount} enrolled</div>
                          <div>{f.completedCount} abgeschlossen</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
            <strong>Hinweis:</strong> Revenue-Attribution (welche Orders aus Emails kamen) wird in einer späteren Phase nachgerüstet.
            Dafür brauchen wir UTM-Parameter in allen Links + Order-Rückverfolgung.
          </div>
        </>
      )}
    </div>
  );
}
