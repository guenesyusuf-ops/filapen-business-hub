'use client';

import { PackageCheck } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShipmentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sendungen" subtitle="Zentrale Übersicht über alle Pakete inkl. Tracking-Status" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<PackageCheck className="h-10 w-10" />}
          title="Sendungs-Übersicht in Vorbereitung"
          hint="S4 + S6: Liste mit Status-Verlauf (Label erstellt → Übergeben → Unterwegs → Zugestellt), Filter, Tracking-Link, manueller Status-Override."
        />
      </div>
    </div>
  );
}
