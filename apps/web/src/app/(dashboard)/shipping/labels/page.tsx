'use client';

import { QrCode } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShippingLabelsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Labels" subtitle="Erstellte Versand-Labels inkl. Druckstatus" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<QrCode className="h-10 w-10" />}
          title="Label-Archiv in Vorbereitung"
          hint="S4: Liste aller generierten Labels (PDF + ZPL), Single-/Bulk-Print mit konfigurierbarem Format (100×150 mm als Default)."
        />
      </div>
    </div>
  );
}
