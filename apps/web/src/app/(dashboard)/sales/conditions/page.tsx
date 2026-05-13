'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Settings2, Loader2, Users } from 'lucide-react';
import { salesApi } from '@/lib/sales';
import { PageHeader } from '@/components/sales/SalesUI';
import { CustomerConditionsDrawer } from './CustomerConditionsDrawer';

/**
 * Konditionen-Modul (Verkauf): Liste aller B2B-Kunden mit Indikator, ob
 * bereits Sonderkonditionen hinterlegt sind. Klick → Drawer mit allen
 * Details (globale Konditionen + Produkt-Sonderpreise).
 */
export default function SalesConditionsPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    salesApi.listCustomers({ limit: '500' })
      .then((r) => setCustomers(r.items || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.customerNumber || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  function hasConditions(c: any) {
    return !!(
      c.paymentTerms ||
      c.minOrderQuantity != null ||
      c.minOrderValue != null ||
      c.discountPercent != null ||
      c.shippingTerms
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Konditionen"
        subtitle="B2B-Sonderkonditionen pro Kunde — Preise, Mindestbestellmenge, Zahlungsziel"
      />

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              placeholder="Kunde, Kundennummer, E-Mail …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Keine Kunden gefunden.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(c.companyName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {c.companyName || '—'}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {c.customerNumber}
                    {c.contactPerson ? ` · ${c.contactPerson}` : ''}
                    {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                {hasConditions(c) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    <Settings2 className="h-2.5 w-2.5" /> Konditionen
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">— Keine —</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <CustomerConditionsDrawer
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={() => {
            // Aktualisiere die Listen-Indikatoren neu — re-fetch Kunden
            salesApi.listCustomers({ limit: '500' }).then((r) => setCustomers(r.items || []));
          }}
        />
      )}
    </div>
  );
}
