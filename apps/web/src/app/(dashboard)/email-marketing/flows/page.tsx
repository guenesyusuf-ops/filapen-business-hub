'use client';

import { Workflow } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function FlowsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Automations (Flows)" subtitle="Trigger-basierte Email-Serien" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Workflow className="h-10 w-10" />}
          title="Flow-Engine in Vorbereitung"
          hint="Phase 7: Welcome · Abandoned Cart · Browse Abandonment · Post-Purchase · Review-Request · Win-back. Flow-Builder mit Wait/Condition/Send-Email-Steps."
        />
      </div>
    </div>
  );
}
