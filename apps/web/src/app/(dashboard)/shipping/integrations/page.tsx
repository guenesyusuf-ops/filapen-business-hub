'use client';

import { Plug, Truck } from 'lucide-react';
import { PageHeader, Empty, SoonBadge, SectionCard } from '@/components/shipping/ShippingUI';

export default function ShippingIntegrationsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Integrationen" subtitle="Carrier-Konten und Marktplätze" actions={<SoonBadge />} />

      <SectionCard title="Geplante Integrationen">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'DHL', status: 'API beantragt', desc: 'Primärer Carrier. Manueller Fallback bis API aktiv.', soon: true },
            { name: 'UPS', status: 'Later', desc: 'Nach DHL-Produktivstart.', soon: false },
            { name: 'DPD / Hermes / GLS', status: 'Later', desc: 'Nach DHL-Produktivstart.', soon: false },
            { name: 'Amazon (SP-API)', status: 'Read-only vorhanden', desc: 'Fulfillment-API kommt in S8.', soon: true },
            { name: 'Kaufland', status: 'Placeholder', desc: 'Integration in S8 als Stub.', soon: false },
            { name: 'TikTok Shop', status: 'Placeholder', desc: 'Integration in S8 als Stub.', soon: false },
          ].map((c) => (
            <div key={c.name} className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5 text-primary-600" />
                <span className="font-semibold text-sm">{c.name}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.desc}</p>
              <div className="mt-3 text-xs font-medium text-primary-700 dark:text-primary-300">{c.status}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Plug className="h-10 w-10" />}
          title="Carrier-Konten-Verwaltung in Vorbereitung"
          hint="S3: CRUD für CarrierAccount (DHL als Primärer). Credentials AES-256-verschlüsselt. Adapter-Interface so designed, dass Auth-Daten ohne Code-Änderung einfügbar sind."
        />
      </div>
    </div>
  );
}
