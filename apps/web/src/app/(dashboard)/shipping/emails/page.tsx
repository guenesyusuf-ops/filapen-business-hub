'use client';

import { MailPlus } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShippingEmailsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Automatische Emails" subtitle="Pro Sendungsstatus den Kunden automatisch benachrichtigen" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<MailPlus className="h-10 w-10" />}
          title="Email-Automations in Vorbereitung"
          hint="S7: Pro Status (abholbereit, zugestellt, Zustellung fehlgeschlagen …) ein Toggle + Template-Referenz aus dem Email-Marketing-Modul. Logs pro Sendung."
        />
      </div>
    </div>
  );
}
