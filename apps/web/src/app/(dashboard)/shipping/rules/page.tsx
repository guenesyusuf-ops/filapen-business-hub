'use client';

import { Zap } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/shipping/ShippingUI';

export default function ShippingRulesPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Versandregeln" subtitle="Automatische Carrier- und Paket-Auswahl nach Regeln" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Zap className="h-10 w-10" />}
          title="Regel-Builder in Vorbereitung"
          hint="S5: Bedingungen (Gewicht/Land/Bestellwert/Produkt) → Aktion (Carrier / Methode / Paket wählen, oder blockieren). Priorität + Live-Preview."
        />
      </div>
    </div>
  );
}
