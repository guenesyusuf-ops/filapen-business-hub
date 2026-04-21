'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, TestTube2, Eye } from 'lucide-react';
import { emailApi, CAMPAIGN_STATUS_LABELS, fmtDateTime, type EmailCampaign } from '@/lib/email-marketing';
import { PageHeader, btn, Badge, input as inputCls, label as labelCls, KpiCard, SectionCard } from '@/components/email-marketing/EmailMarketingUI';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);

  const reload = () => {
    emailApi.getCampaign(id)
      .then(setC)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [id]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>;
  if (!c) return null;

  const st = CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS];
  const isSendable = c.status === 'draft' || c.status === 'scheduled';

  const testSend = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    try {
      await emailApi.testSendCampaign(id, testEmail.trim());
      alert(`Test gesendet an ${testEmail}`);
    } catch (e: any) { alert(e.message); }
    finally { setTesting(false); }
  };

  const sendNow = async () => {
    if (!confirm(`Kampagne "${c.name}" jetzt an ${c.segment?.memberCount || '?'} Kontakt(e) senden?`)) return;
    setSending(true);
    try {
      await emailApi.sendCampaign(id);
      reload();
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title={c.name}
        subtitle={`Template: ${c.template?.name || '—'} · Segment: ${c.segment?.name || '—'}`}
        actions={
          <>
            <Link href="/email-marketing/campaigns" className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Liste</Link>
            {isSendable && (
              <button onClick={sendNow} disabled={sending} className={btn('primary')}><Send className="h-4 w-4" /> {sending ? 'Startet …' : 'Jetzt senden'}</button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3">
        <Badge color={st.color}>{st.label}</Badge>
        {c.scheduledAt && <span className="text-sm text-gray-500">Geplant: {fmtDateTime(c.scheduledAt)}</span>}
        {c.sentAt && <span className="text-sm text-gray-500">Versendet: {fmtDateTime(c.sentAt)}</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Versendet" value={c.sentCount} accent="blue" />
        <KpiCard label="Zugestellt" value={c.deliveredCount} accent="green" />
        <KpiCard label="Geöffnet" value={`${c.uniqueOpenCount || c.openCount} / ${c.sentCount}`} sublabel={c.sentCount > 0 ? `${Math.round((c.openCount / c.sentCount) * 100)}%` : '–'} accent="indigo" />
        <KpiCard label="Geklickt" value={`${c.uniqueClickCount || c.clickCount} / ${c.sentCount}`} sublabel={c.sentCount > 0 ? `${Math.round((c.clickCount / c.sentCount) * 100)}%` : '–'} accent="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Details">
          <dl className="text-sm space-y-2">
            <Row label="Absender">{c.fromName} &lt;{c.fromEmail}&gt;</Row>
            <Row label="Reply-To">{c.replyTo || '—'}</Row>
            <Row label="Consent-Modus">{c.consentMode}</Row>
            <Row label="Empfänger geplant">{c.segment?.memberCount?.toLocaleString('de-DE') || '?'}</Row>
            <Row label="Bounced">{c.bounceCount}</Row>
            <Row label="Abgemeldet">{c.unsubscribeCount}</Row>
          </dl>
        </SectionCard>

        <SectionCard title="Test-Versand">
          <p className="text-xs text-gray-500 mb-3">
            Schicke eine Vorschau an eine Test-Email. Der Empfänger wird temporär als Kontakt angelegt (falls noch nicht vorhanden).
          </p>
          <div className="flex gap-2">
            <input className={inputCls('flex-1')} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@deine-firma.de" />
            <button onClick={testSend} disabled={testing || !testEmail} className={btn('secondary')}><TestTube2 className="h-4 w-4" /> {testing ? '…' : 'Senden'}</button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 dark:text-white text-right">{children}</dd>
    </div>
  );
}
