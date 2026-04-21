'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { emailApi, CONSENT_LABELS, fmtDate, type Contact, type MarketingConsent } from '@/lib/email-marketing';
import { Badge, PageHeader, Empty, btn, input, label, Money } from '@/components/email-marketing/EmailMarketingUI';

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [consent, setConsent] = useState<string>('');
  const [offset, setOffset] = useState(0);

  useEffect(() => { setOffset(0); }, [search, consent]);

  const params = useMemo(() => ({
    search: search || undefined,
    consent: consent || undefined,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }), [search, consent, offset]);

  useEffect(() => {
    setLoading(true);
    emailApi.listContacts(params)
      .then((d) => { setItems(d.items); setTotal(d.total); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <PageHeader title="Kontakte" subtitle={`${total} Kontakt${total !== 1 ? 'e' : ''}`} />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name oder Email …" className={input('pl-9')} />
          </div>
          <select value={consent} onChange={(e) => setConsent(e.target.value)} className={input('w-auto')}>
            <option value="">Alle Consent-Stati</option>
            {Object.entries(CONSENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : items.length === 0 ? (
          <Empty
            icon={<Users2 className="h-10 w-10" />}
            title="Keine Kontakte"
            hint="Kontakte werden automatisch aus Shopify synchronisiert. Wenn hier nichts steht, muss der Shopify-Shop neu verbunden werden (dann wird die Kunden-Historie mitgezogen)."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left">Email</th>
                    <th className="px-3 py-2.5 text-left">Name</th>
                    <th className="px-3 py-2.5 text-left">Land</th>
                    <th className="px-3 py-2.5">Consent</th>
                    <th className="px-3 py-2.5 text-right">Bestellungen</th>
                    <th className="px-3 py-2.5 text-right">Gesamt-Umsatz</th>
                    <th className="px-3 py-2.5 text-left">Letzte Bestellung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((c) => {
                    const cl = CONSENT_LABELS[c.marketingConsent];
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/email-marketing/contacts/${c.id}`)}
                        className="hover:bg-gray-50/80 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white truncate max-w-[280px]">{c.email}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                          {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500 uppercase">{c.country || '—'}</td>
                        <td className="px-3 py-3"><Badge color={cl.color}>{cl.label}</Badge></td>
                        <td className="px-3 py-3 text-right tabular-nums">{c.ordersCount}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap"><Money amount={c.totalSpent} /></td>
                        <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(c.lastOrderAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500">
                <div>Seite {currentPage} von {totalPages} · {total} gesamt</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                  </button>
                  <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} className={btn('secondary', 'h-8 px-2 py-1 text-xs disabled:opacity-40')}>
                    Weiter <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
