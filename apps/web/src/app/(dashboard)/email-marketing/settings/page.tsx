'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Copy, RefreshCw, Globe, Mail, ShieldCheck, Check } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { emailApi, type EmailSettings } from '@/lib/email-marketing';
import { PageHeader, btn, input as inputCls, label as labelCls, SectionCard, Badge } from '@/components/email-marketing/EmailMarketingUI';

export default function EmailMarketingSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [sendingDomain, setSendingDomain] = useState('');
  const [consentMode, setConsentMode] = useState('subscribed');
  const [doiEnabled, setDoiEnabled] = useState(true);
  const [maxPerDay, setMaxPerDay] = useState(3);
  const [footerHtml, setFooterHtml] = useState('');

  const reload = () => {
    emailApi.getSettings()
      .then((s) => {
        setSettings(s);
        setFromName(s.fromName || '');
        setFromEmail(s.fromEmail || '');
        setReplyTo(s.replyTo || '');
        setSendingDomain(s.sendingDomain || '');
        setConsentMode(s.defaultConsentMode || 'subscribed');
        setDoiEnabled(s.doubleOptInEnabled);
        setMaxPerDay(s.maxEmailsPerContactPerDay);
        setFooterHtml(s.footerHtml || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const updated = await emailApi.updateSettings({
        fromName: fromName || null,
        fromEmail: fromEmail || null,
        replyTo: replyTo || null,
        sendingDomain: sendingDomain || null,
        defaultConsentMode: consentMode as any,
        doubleOptInEnabled: doiEnabled,
        maxEmailsPerContactPerDay: maxPerDay,
        footerHtml: footerHtml || null,
      } as any);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const rotateKey = async () => {
    if (!confirm('Tracking-Key rotieren? Das existierende Snippet funktioniert danach nicht mehr — du musst das neue in dein Theme einfügen.')) return;
    try {
      const updated = await emailApi.rotateTrackingKey();
      setSettings(updated);
    } catch (e: any) { alert(e.message); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;

  const snippetUrl = settings?.publicTrackingKey
    ? `${API_URL}/api/track/snippet.js?key=${settings.publicTrackingKey}`
    : '';
  const snippetTag = snippetUrl
    ? `<script async src="${snippetUrl}"></script>`
    : '';

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title="Einstellungen"
        subtitle="Sending-Domain, Consent, Tracking-Snippet"
        actions={
          <button onClick={save} disabled={busy} className={btn('primary')}>
            {saved ? <><Check className="h-4 w-4" /> Gespeichert</> : busy ? 'Speichert …' : 'Speichern'}
          </button>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <SectionCard
        title="Sending-Identität"
        description="Wie du im Posteingang deiner Kunden erscheinst"
      >
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls()}>Absender-Name</label><input className={inputCls()} value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="z.B. Filapen" /></div>
          <div><label className={labelCls()}>Absender-Email</label><input className={inputCls()} value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="marketing@mail.filapen.de" /></div>
          <div><label className={labelCls()}>Reply-To (optional)</label><input className={inputCls()} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="hallo@filapen.de" /></div>
          <div><label className={labelCls()}>Sending-Domain</label><input className={inputCls()} value={sendingDomain} onChange={(e) => setSendingDomain(e.target.value)} placeholder="mail.filapen.de" /></div>
        </div>
        {!settings?.domainVerified && (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            <strong>Domain noch nicht verifiziert.</strong> DKIM/SPF/DMARC-Records müssen bei United Domains gesetzt werden.
            Anleitung folgt, sobald Resend Pro aktiviert ist — dann bekommst du die Record-Werte aus dem Resend-Dashboard.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Consent & Frequency" description="Wer bekommt welche Emails wie oft">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls()}>Default Consent-Modus</label>
            <select className={inputCls()} value={consentMode} onChange={(e) => setConsentMode(e.target.value)}>
              <option value="subscribed">Angemeldet (Single-Opt-In)</option>
              <option value="confirmed">Nur Doppel-Opt-In</option>
              <option value="all_opted_in">Alle nicht-abgemeldeten</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Bestimmt, wer per Default in Kampagnen eingeschlossen wird.</p>
          </div>
          <div>
            <label className={labelCls()}>Max. Emails pro Kontakt pro Tag</label>
            <input type="number" min="0" className={inputCls()} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
            <p className="text-xs text-gray-500 mt-1">0 = kein Limit. Empfohlen: 3.</p>
          </div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={doiEnabled} onChange={(e) => setDoiEnabled(e.target.checked)} />
              Doppel-Opt-In aktiviert (neue Abonnenten müssen per Klick bestätigen)
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tracking-Snippet" description="Einbau in dein Shopify-Theme für viewed_product, added_to_cart, started_checkout">
        {!settings?.publicTrackingKey ? (
          <div className="text-sm text-gray-500">Kein Key gesetzt. Speichere die Settings einmal, um einen zu generieren.</div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls()}>Tracking-Key</label>
                <button onClick={rotateKey} className={btn('ghost', 'h-7 px-2 py-1 text-xs')}>
                  <RefreshCw className="h-3 w-3" /> Rotieren
                </button>
              </div>
              <div className="flex gap-2">
                <input className={inputCls('font-mono')} value={settings.publicTrackingKey} readOnly />
                <button onClick={() => copyToClipboard(settings.publicTrackingKey!)} className={btn('secondary')}><Copy className="h-4 w-4" /></button>
              </div>
            </div>

            <div>
              <label className={labelCls()}>So baust du das Tracking ein (Shopify Focal-Theme)</label>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Shopify Admin → Onlineshop → Themes → Focal → Aktionen → <em>Code bearbeiten</em></li>
                <li>Öffne <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10">layout/theme.liquid</code></li>
                <li>Füge den folgenden Script-Tag direkt <strong>vor dem schließenden <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10">&lt;/body&gt;</code>-Tag</strong> ein</li>
                <li>Speichern — ab sofort werden Product-Views und Cart-Adds automatisch getrackt</li>
              </ol>
            </div>

            <div>
              <label className={labelCls()}>Snippet</label>
              <div className="relative">
                <pre className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  {snippetTag}
                </pre>
                <button onClick={() => copyToClipboard(snippetTag)} className={btn('secondary', 'absolute top-2 right-2 h-7 px-2 py-0 text-xs')}>
                  <Copy className="h-3 w-3" /> Kopieren
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              <strong>Optional in Templates:</strong> für präzisere Customer-Identifikation kannst du nach Newsletter-Signup aufrufen:{' '}
              <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10">window.filapen.identify(email, {'{ firstName }'})</code>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Unsubscribe-Footer" description="HTML-Footer der unten in jeder Email erscheint (inkl. Unsubscribe-Link)">
        <textarea rows={4} className={inputCls()} value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} placeholder="<p>Du erhältst diese Email als Kunde von {{shop_name}}. <a href='{{unsubscribe_url}}'>Abmelden</a></p>" />
        <p className="text-xs text-gray-500 mt-1">Leer lassen für Default-Footer (automatisch generiert).</p>
      </SectionCard>
    </div>
  );
}
