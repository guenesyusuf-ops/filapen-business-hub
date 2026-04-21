'use client';

import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function EmailMarketingSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Einstellungen" subtitle="Sending-Domain, Consent-Modus, Tracking-Snippet" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<SettingsIcon className="h-10 w-10" />}
          title="Settings-Seite in Vorbereitung"
          hint="Phase 10: Sending-Domain (Platzhalter mail.filapen.de), DKIM/SPF/DMARC-Records als Copy-Paste, Tracking-Snippet-Code-Generator für Focal-Theme, Consent-Mode-Toggle (alle Opt-Ins vs. nur DOI), Frequency-Cap."
        />
      </div>
    </div>
  );
}
