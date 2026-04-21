'use client';

import { ClipboardList } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShippingOrdersPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Bestellungen" subtitle="Offene + unfulfilled Orders aus verbundenen Shops" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<ClipboardList className="h-10 w-10" />}
          title="Order-Import in Vorbereitung"
          hint="S2: Filter + Select + Bulk-Aktion 'Label erstellen' auf Basis der existierenden Shopify-Orders."
        />
      </div>
    </div>
  );
}
