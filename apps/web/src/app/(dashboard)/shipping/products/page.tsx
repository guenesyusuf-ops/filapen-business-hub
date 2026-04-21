'use client';

import { Boxes } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShippingProductsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Produkte & Versanddaten" subtitle="Gewichte, Maße, Zoll-Codes pro Produkt" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Boxes className="h-10 w-10" />}
          title="Versanddaten-Editor in Vorbereitung"
          hint="S2: Erweitert bestehende Shopify-Produkte um ShippingProductProfile (Gewicht in g, LxBxH in mm, HS-Code, Herkunftsland, Sendungsausschluss)."
        />
      </div>
    </div>
  );
}
