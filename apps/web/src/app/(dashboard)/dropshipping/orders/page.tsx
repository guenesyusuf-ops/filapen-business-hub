'use client';

import { useCallback, useEffect, useState } from 'react';
import { PackageOpen } from 'lucide-react';
import { PageHeader, DataTable, StatusPill, EmptyState, type Column } from '@/components/ds';
import { dropshippingApi, DsOrder, DsOrderStatus, DS_STATUS_LABELS } from '@/lib/dropshipping';

const STATUS_TONE: Record<DsOrderStatus, 'ok' | 'warn' | 'crit' | 'info' | 'neutral'> = {
  new: 'info',
  shipped_cn: 'warn',
  in_de: 'info',
  delivered: 'ok',
  on_hold: 'crit',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'shipped_cn', label: 'Versandt (CN)' },
  { key: 'in_de', label: 'In Deutschland' },
  { key: 'delivered', label: 'Zugestellt' },
  { key: 'on_hold', label: 'Problem' },
];

export default function DropshippingOrdersPage() {
  const [orders, setOrders] = useState<DsOrder[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      setError(null);
      setOrders(await dropshippingApi.listOrders(s || undefined));
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [load, status]);

  const columns: Column<DsOrder>[] = [
    { key: 'order', header: 'Bestellung', width: '110px', render: (o) => <span className="font-semibold text-[var(--text-primary)]">#{o.orderNumber}</span> },
    { key: 'date', header: 'Datum', width: '110px', render: (o) => new Date(o.placedAt).toLocaleDateString('de-DE') },
    { key: 'customer', header: 'Kunde', render: (o) => (
      <div className="flex flex-col">
        <span className="text-[var(--text-primary)]">{o.customerName ?? '—'}</span>
        {o.countryCode && <span className="text-[12px] text-[var(--text-secondary)]">{o.countryCode}</span>}
      </div>
    ) },
    { key: 'items', header: 'Dropship-Artikel', render: (o) => (
      <div className="flex flex-col gap-0.5">
        {o.items.map((it) => (
          <span key={it.id} className="text-[13px] text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">{it.quantity}×</span> {it.sku ?? it.title}
          </span>
        ))}
      </div>
    ) },
    { key: 'status', header: 'Status', width: '150px', render: (o) => <StatusPill tone={STATUS_TONE[o.status]}>{DS_STATUS_LABELS[o.status]}</StatusPill> },
    { key: 'cn', header: 'CN-Tracking', render: (o) => o.cnTracking ?? <span className="text-[var(--text-tertiary)]">—</span> },
    { key: 'de', header: 'DE-Tracking', render: (o) => o.deTracking ?? <span className="text-[var(--text-tertiary)]">—</span> },
    { key: 'carrier', header: 'Spedition', render: (o) => o.carrier ?? <span className="text-[var(--text-tertiary)]">—</span> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader eyebrow="Dropshipping" title="Bestellungen" subtitle="Alle Bestellungen mit Dropship-Artikeln. Der Workflow (Versand, Tracking) wird vom Partner im Portal gepflegt." />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              status === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={loading ? [] : orders}
        rowKey={(o) => o.id}
        minWidth={920}
        empty={
          <EmptyState
            icon={<PackageOpen size={28} />}
            title={loading ? 'Lädt…' : 'Keine Bestellungen'}
            description={loading ? undefined : 'Sobald Bestellungen mit ausgewählten Dropship-SKUs eingehen, erscheinen sie hier. Prüfe die SKU-Auswahl und starte einen Sync.'}
          />
        }
      />
    </div>
  );
}
