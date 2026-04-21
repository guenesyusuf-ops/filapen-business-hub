'use client';

import { LineChart } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle="Revenue, Open-/Klickraten, Attribution" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<LineChart className="h-10 w-10" />}
          title="Analytics-Dashboard in Vorbereitung"
          hint="Phase 10: Revenue pro Kampagne/Flow, Top-Performer, Attribution-Window 5 Tage Click / 1 Tag View."
        />
      </div>
    </div>
  );
}
