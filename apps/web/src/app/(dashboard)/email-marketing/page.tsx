'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users2, CheckCircle2, Send, Workflow, ArrowRight } from 'lucide-react';
import { emailApi } from '@/lib/email-marketing';
import { KpiCard, PageHeader, btn, SectionCard } from '@/components/email-marketing/EmailMarketingUI';

export default function EmailMarketingDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    emailApi.dashboard()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts: any = (data && data.counts) ? data.counts : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Marketing"
        subtitle="Kontakte, Segmente, Kampagnen und Automations für deinen Shopify-Shop"
        actions={
          <Link href="/email-marketing/settings" className={btn('secondary')}>
            Einstellungen
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          Dashboard konnte nicht geladen werden: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Kontakte"
          value={loading ? '…' : counts.contacts ?? 0}
          sublabel="aus Shopify synchronisiert"
          accent="blue"
          icon={<Users2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Aktive Abonnenten"
          value={loading ? '…' : counts.subscribed ?? 0}
          sublabel="mit Marketing-Consent"
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Kampagnen"
          value={loading ? '…' : counts.campaigns ?? 0}
          sublabel="Draft + versendet"
          accent="indigo"
          icon={<Send className="h-5 w-5" />}
        />
        <KpiCard
          label="Automations"
          value={loading ? '…' : counts.flows ?? 0}
          sublabel="Flows (aktiv/Draft)"
          accent="purple"
          icon={<Workflow className="h-5 w-5" />}
        />
      </div>

      <SectionCard
        title="Onboarding"
        description="Schritte um Email-Marketing für deinen Shop startklar zu machen"
      >
        <ol className="space-y-3 text-sm">
          <OnboardStep num={1} title="Sending-Domain in Einstellungen hinterlegen" href="/email-marketing/settings" note="Subdomain + DKIM/SPF/DMARC. Platzhalter gesetzt — DNS-Setup folgt in P10." />
          <OnboardStep num={2} title="Shopify-Kontakte importieren" href="/email-marketing/contacts" note="Wird in P3 automatisch aus bestehender Shopify-Integration gezogen." />
          <OnboardStep num={3} title="Tracking-Snippet in Focal-Theme einbauen" href="/email-marketing/settings" note="Fürs Erfassen von viewed_product / added_to_cart / started_checkout." />
          <OnboardStep num={4} title="Erstes Segment anlegen" href="/email-marketing/segments" note="z.B. Alle Kunden die in den letzten 30 Tagen gekauft haben." />
          <OnboardStep num={5} title="Erste Kampagne senden" href="/email-marketing/campaigns" note="Template wählen, Segment wählen, abschicken." />
        </ol>
      </SectionCard>
    </div>
  );
}

function OnboardStep({ num, title, note, href }: { num: number; title: string; note: string; href: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">
        {num}
      </span>
      <div className="flex-1 min-w-0">
        <Link href={href} className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1">
          {title} <ArrowRight className="h-3 w-3" />
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{note}</p>
      </div>
    </li>
  );
}
