'use client';

import { Send } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function CampaignsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Kampagnen" subtitle="Einmalige Broadcast-Sends an Segmente" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Send className="h-10 w-10" />}
          title="Kampagnen-Builder in Vorbereitung"
          hint="Phase 9: Segment wählen, Template wählen, Zeitpunkt festlegen, Test-Send, versenden."
        />
      </div>
    </div>
  );
}
