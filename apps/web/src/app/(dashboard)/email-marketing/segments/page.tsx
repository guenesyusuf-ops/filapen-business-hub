'use client';

import { Target } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function SegmentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Segmente" subtitle="Regel-basierte Zielgruppen" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Target className="h-10 w-10" />}
          title="Segment-Engine in Vorbereitung"
          hint="Phase 6: Builder mit allen Filter-Typen (Produkt gekauft, Umsatz-Grenzen, Zeitfenster, Standort, Engagement, Tags, Custom Properties)."
        />
      </div>
    </div>
  );
}
