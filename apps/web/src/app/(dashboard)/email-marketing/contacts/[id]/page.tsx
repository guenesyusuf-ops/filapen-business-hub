'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, RefreshCw, User2 } from 'lucide-react';
import { emailApi, CONSENT_LABELS, fmtDate, fmtDateTime, type MarketingConsent } from '@/lib/email-marketing';
import { Badge, PageHeader, btn, Money, SectionCard } from '@/components/email-marketing/EmailMarketingUI';

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    emailApi.getContact(id)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [id]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>;
  if (!data) return null;

  const { contact, events, messages } = data;
  const cl = CONSENT_LABELS[contact.marketingConsent as MarketingConsent];

  const updateConsent = async (next: MarketingConsent) => {
    try {
      await emailApi.updateContactConsent(id, next);
      reload();
    } catch (e: any) { alert(e.message); }
  };

  const resyncStats = async () => {
    try {
      await emailApi.resyncContactStats(id);
      reload();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title={contact.email}
        subtitle={`Kontakt seit ${fmtDate(contact.createdAt)}`}
        actions={
          <Link href="/email-marketing/contacts" className={btn('ghost')}>
            <ArrowLeft className="h-4 w-4" /> Liste
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: profile details */}
        <div className="space-y-4">
          <SectionCard title="Profil">
            <div className="space-y-2 text-sm">
              <Field icon={<User2 className="h-3.5 w-3.5" />} label="Name" value={[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'} />
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact.email} />
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Telefon" value={contact.phone || '—'} />
              <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ort" value={[contact.city, contact.country].filter(Boolean).join(', ') || '—'} />
            </div>
            {contact.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {contact.tags.map((t: string) => <Badge key={t} color="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{t}</Badge>)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Consent">
            <div className="mb-3"><Badge color={cl.color}>{cl.label}</Badge></div>
            {contact.consentedAt && <div className="text-xs text-gray-500">Angemeldet: {fmtDateTime(contact.consentedAt)}</div>}
            {contact.unsubscribedAt && <div className="text-xs text-red-600 dark:text-red-400">Abgemeldet: {fmtDateTime(contact.unsubscribedAt)}</div>}
            <div className="flex gap-2 mt-3">
              {contact.marketingConsent !== 'unsubscribed' ? (
                <button onClick={() => updateConsent('unsubscribed')} className={btn('danger')}>Abmelden</button>
              ) : (
                <button onClick={() => updateConsent('subscribed')} className={btn('secondary')}>Wieder anmelden</button>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Kaufhistorie" actions={
            <button onClick={resyncStats} className={btn('ghost', 'h-7 px-2 py-1 text-xs')}>
              <RefreshCw className="h-3 w-3" /> Neu berechnen
            </button>
          }>
            <dl className="space-y-1.5 text-sm">
              <Row label="Bestellungen"><span className="tabular-nums font-medium">{contact.ordersCount}</span></Row>
              <Row label="Gesamt-Umsatz"><Money amount={contact.totalSpent} /></Row>
              <Row label="Ø Warenkorb"><Money amount={contact.avgOrderValue} /></Row>
              <Row label="Erste Bestellung">{fmtDate(contact.firstOrderAt)}</Row>
              <Row label="Letzte Bestellung">{fmtDate(contact.lastOrderAt)}</Row>
              <Row label="Zuletzt gesehen">{contact.lastSeenAt ? fmtDateTime(contact.lastSeenAt) : '—'}</Row>
            </dl>
          </SectionCard>
        </div>

        {/* Middle/right: events + messages */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title={`Event-Timeline (${events?.length || 0})`}>
            {!events?.length ? (
              <div className="text-sm text-gray-400 text-center py-8">Keine Events bisher erfasst.</div>
            ) : (
              <ol className="space-y-2">
                {events.slice(0, 50).map((e: any) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 dark:text-white font-medium">{formatEventType(e.type)}</div>
                      <div className="text-xs text-gray-400">{fmtDateTime(e.occurredAt)} · {e.source}</div>
                      {e.payload && Object.keys(e.payload).length > 0 && (
                        <div className="text-xs text-gray-500 mt-1 truncate font-mono">{JSON.stringify(e.payload).slice(0, 200)}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title={`Versendete Emails (${messages?.length || 0})`}>
            {!messages?.length ? (
              <div className="text-sm text-gray-400 text-center py-8">Noch keine Emails an diesen Kontakt gesendet.</div>
            ) : (
              <div className="space-y-2">
                {messages.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-white/8 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.subject}</div>
                      <div className="text-xs text-gray-400">{fmtDateTime(m.sentAt || m.createdAt)} · Status: {m.status}</div>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                      {m.openCount > 0 && <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Geöffnet ({m.openCount})</Badge>}
                      {m.clickCount > 0 && <Badge color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Geklickt ({m.clickCount})</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm text-gray-900 dark:text-white truncate">{value}</div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    customer_created: 'Kunde erstellt',
    customer_deleted: 'Kunde gelöscht',
    order_placed: 'Bestellung aufgegeben',
    checkout_started: 'Checkout begonnen',
    viewed_product: 'Produkt angesehen',
    added_to_cart: 'In den Warenkorb',
    viewed_category: 'Kategorie angesehen',
    email_sent: 'Email versendet',
    email_opened: 'Email geöffnet',
    email_clicked: 'Email geklickt',
    unsubscribed: 'Abgemeldet',
  };
  return map[type] || type;
}
