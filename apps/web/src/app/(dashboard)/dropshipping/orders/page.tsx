'use client';

import { useCallback, useEffect, useState } from 'react';
import { PackageOpen, Download, Plus, Boxes, RefreshCw } from 'lucide-react';
import { PageHeader, Button, Input, DataTable, StatusPill, EmptyState, type Column } from '@/components/ds';
import { dropshippingApi, DsOrder, DsOrderStatus, DS_STATUS_LABELS } from '@/lib/dropshipping';

const STATUS_TONE: Record<DsOrderStatus, 'ok' | 'warn' | 'crit' | 'info' | 'neutral'> = {
  new: 'info', shipped_cn: 'warn', in_de: 'info', delivered: 'ok', on_hold: 'crit',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'shipped_cn', label: 'Versandt (CN)' },
  { key: 'in_de', label: 'In Deutschland' },
  { key: 'delivered', label: 'Zugestellt' },
  { key: 'on_hold', label: 'Problem' },
];

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <div className="w-7 h-7 rounded bg-[var(--bg-secondary)] shrink-0 grid place-items-center text-[var(--text-tertiary)]"><Boxes size={13} /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-7 h-7 rounded object-cover shrink-0 border border-[var(--border-color)]" />;
}

export default function DropshippingOrdersPage() {
  const [orders, setOrders] = useState<DsOrder[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importNo, setImportNo] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

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

  const doImport = async () => {
    if (!importNo.trim()) return;
    setImporting(true);
    setError(null);
    setInfo(null);
    try {
      const r = await dropshippingApi.importOrder(importNo.trim());
      setInfo(`Bestellung importiert (${r.itemCount} Dropship-Artikel).`);
      setImportNo('');
      await load(status);
    } catch (e: any) {
      setError(e.message ?? 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  };

  const doRetry = async (id: string) => {
    setRetrying(id);
    setError(null); setInfo(null);
    try {
      const r = await dropshippingApi.retryFulfillment(id);
      if (r.ok) setInfo('Rückschreibung nach Shopify erfolgreich.');
      else setError(`Shopify-Rückschreibung fehlgeschlagen: ${r.error ?? 'unbekannt'}`);
      await load(status);
    } catch (e: any) {
      setError(e.message ?? 'Fehlgeschlagen');
    } finally {
      setRetrying(null);
    }
  };

  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await dropshippingApi.exportCsv(status || undefined);
    } catch (e: any) {
      setError(e.message ?? 'Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<DsOrder>[] = [
    { key: 'order', header: 'Bestellung', width: '100px', render: (o) => <span className="font-semibold text-[var(--text-primary)]">#{o.orderNumber}</span> },
    { key: 'date', header: 'Datum', width: '100px', render: (o) => new Date(o.placedAt).toLocaleDateString('de-DE') },
    { key: 'customer', header: 'Kunde', render: (o) => (
      <div className="flex flex-col">
        <span className="text-[var(--text-primary)]">{o.customerName ?? '—'}</span>
        {o.countryCode && <span className="text-[12px] text-[var(--text-secondary)]">{o.countryCode}</span>}
      </div>
    ) },
    { key: 'items', header: 'Dropship-Artikel', render: (o) => (
      <div className="flex flex-col gap-1">
        {o.items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <Thumb url={it.imageUrl} alt={it.sku ?? it.title} />
            <span className="text-[13px] text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{it.quantity}×</span> {it.sku ?? it.title}
            </span>
          </div>
        ))}
      </div>
    ) },
    { key: 'status', header: 'Status', width: '150px', render: (o) => <StatusPill tone={STATUS_TONE[o.status]}>{DS_STATUS_LABELS[o.status]}</StatusPill> },
    { key: 'cn', header: 'CN-Tracking', render: (o) => o.cnTracking ?? <span className="text-[var(--text-tertiary)]">—</span> },
    { key: 'de', header: 'DE-Tracking', render: (o) => o.deTracking ?? <span className="text-[var(--text-tertiary)]">—</span> },
    { key: 'carrier', header: 'Spedition', render: (o) => o.carrier ?? <span className="text-[var(--text-tertiary)]">—</span> },
    { key: 'shopify', header: 'Shopify', width: '150px', render: (o) => {
      if (o.shopifyFulfilledAt) return <StatusPill tone="ok" dot={false}>versendet</StatusPill>;
      if (o.status === 'in_de' || o.status === 'delivered') {
        return (
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} loading={retrying === o.id} onClick={() => doRetry(o.id)}>
            Rückschreiben
          </Button>
        );
      }
      return <span className="text-[var(--text-tertiary)]">—</span>;
    } },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader
        eyebrow="Dropshipping"
        title="Bestellungen"
        subtitle="Alle Bestellungen mit Dropship-Artikeln. Workflow (Versand, Tracking) pflegt der Partner im Portal."
        actions={
          <Button variant="secondary" leftIcon={<Download size={16} />} loading={exporting} onClick={doExport}>
            CSV-Export
          </Button>
        }
      />

      {/* Manueller Import */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--text-primary)]">Bestellung manuell laden</label>
          <Input
            value={importNo}
            onChange={(e) => setImportNo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doImport(); }}
            placeholder="Bestellnummer, z. B. 1234"
            className="w-56"
          />
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} loading={importing} onClick={doImport}>Laden</Button>
        <span className="text-[12.5px] text-[var(--text-secondary)] ml-1">Ignoriert die Regeln (Override). Zeigt dem Partner nur Dropship-Produkte.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              status === f.key ? 'bg-primary-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {info && (
        <div className="rounded-xl border border-[rgb(var(--color-success))]/30 bg-[rgb(var(--color-success))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-success))]">{info}</div>
      )}
      {error && (
        <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">{error}</div>
      )}

      <DataTable
        columns={columns}
        rows={loading ? [] : orders}
        rowKey={(o) => o.id}
        minWidth={1120}
        empty={
          <EmptyState
            icon={<PackageOpen size={28} />}
            title={loading ? 'Lädt…' : 'Keine Bestellungen'}
            description={loading ? undefined : 'Sobald Bestellungen zu einer Regel passen, erscheinen sie hier. Prüfe die Regeln und starte einen Sync — oder lade eine Bestellung manuell.'}
          />
        }
      />
    </div>
  );
}
