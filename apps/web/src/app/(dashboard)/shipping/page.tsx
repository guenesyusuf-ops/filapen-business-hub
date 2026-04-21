'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, PackageCheck, QrCode, CheckCircle2, Truck } from 'lucide-react';
import { shippingApi } from '@/lib/shipping';
import { KpiCard, PageHeader, btn, SectionCard } from '@/components/shipping/ShippingUI';

export default function ShippingDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shippingApi.dashboard()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts: any = (data && data.counts) ? data.counts : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Versand"
        subtitle="Bestellungen importieren, Labels drucken, Sendungen verfolgen"
        actions={
          <Link href="/shipping/orders" className={btn('primary')}>
            Bestellungen ansehen
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          Dashboard konnte nicht geladen werden: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Offene Bestellungen"
          value={loading ? '…' : counts.openOrders ?? 0}
          sublabel="ohne Label"
          accent="amber"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <KpiCard
          label="Aktive Sendungen"
          value={loading ? '…' : counts.activeShipments ?? 0}
          sublabel="unterwegs + abholbereit"
          accent="blue"
          icon={<Truck className="h-5 w-5" />}
        />
        <KpiCard
          label="Labels heute"
          value={loading ? '…' : counts.labelsToday ?? 0}
          accent="indigo"
          icon={<QrCode className="h-5 w-5" />}
        />
        <KpiCard
          label="Zugestellt im Monat"
          value={loading ? '…' : counts.deliveredThisMonth ?? 0}
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Carrier-Konten"
          value={loading ? '…' : counts.carriers ?? 0}
          sublabel="aktive Verbindungen"
          accent="purple"
          icon={<PackageCheck className="h-5 w-5" />}
        />
      </div>

      <SectionCard title="Go-Live Checkliste" description="Was vor dem ersten Label erledigt sein muss">
        <ol className="space-y-2 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">1</span>
            <div>
              <Link href="/shipping/integrations" className="font-medium text-gray-900 dark:text-white hover:text-primary-700">Carrier-Konto einrichten (DHL API kommt später)</Link>
              <p className="text-xs text-gray-500">Bis DHL-API aktiv ist: Manuelles Erfassen der Tracking-Nummer möglich.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">2</span>
            <div>
              <Link href="/shipping/products" className="font-medium text-gray-900 dark:text-white hover:text-primary-700">Versanddaten pro Produkt pflegen</Link>
              <p className="text-xs text-gray-500">Gewicht + Abmessungen fürs Auto-Berechnen der Versandkosten.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">3</span>
            <div>
              <Link href="/shipping/rules" className="font-medium text-gray-900 dark:text-white hover:text-primary-700">Versandregeln definieren</Link>
              <p className="text-xs text-gray-500">z.B. „bis 1kg → Paket S", „EU → DHL Express".</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">4</span>
            <div>
              <Link href="/shipping/emails" className="font-medium text-gray-900 dark:text-white hover:text-primary-700">Automatische Emails konfigurieren</Link>
              <p className="text-xs text-gray-500">Kunden-Benachrichtigungen bei „abholbereit", „zugestellt" etc.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">5</span>
            <div>
              <Link href="/shipping/orders" className="font-medium text-gray-900 dark:text-white hover:text-primary-700">Bestellungen öffnen und Labels drucken</Link>
            </div>
          </li>
        </ol>
      </SectionCard>
    </div>
  );
}
