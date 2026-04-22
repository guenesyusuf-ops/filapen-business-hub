'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QrCode, Printer, ExternalLink, Download, Check, Undo2, Loader2 } from 'lucide-react';
import { shippingApi, SHIPMENT_STATUS_LABELS, CARRIER_LABELS, fmtDateTime } from '@/lib/shipping';
import { PageHeader, Empty, btn, Badge } from '@/components/shipping/ShippingUI';
import { cn } from '@/lib/utils';

type Tab = 'created' | 'printed' | 'all';

interface LabelRow {
  shipmentId: string;
  labelId: string;
  trackingNumber: string | null;
  orderNumber: string | null;
  recipientName: string | null;
  carrier: string;
  format: string;
  status: string;
  createdAt: string;
  printedAt: string | null;
  printCount: number;
  labelUrl: string;
}

export default function ShippingLabelsPage() {
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('created');
  const [selected, setSelected] = useState<Set<string>>(new Set()); // shipmentIds
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await shippingApi.listShipments({ limit: '200' });
      const flat: LabelRow[] = [];
      for (const s of res.items || []) {
        for (const l of s.labels || []) {
          flat.push({
            shipmentId: s.id,
            labelId: l.id,
            trackingNumber: s.trackingNumber ?? l.trackingNumber ?? null,
            orderNumber: s.order?.orderNumber ?? null,
            recipientName: s.recipientName ?? null,
            carrier: s.carrier,
            format: l.format,
            status: s.status,
            createdAt: s.createdAt,
            printedAt: l.printedAt ?? null,
            printCount: l.printCount ?? 0,
            labelUrl: l.url,
          });
        }
      }
      // newest first
      flat.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setRows(flat);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Reset selection when tab switches
  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const filtered = useMemo(() => {
    if (tab === 'created') return rows.filter((r) => !r.printedAt);
    if (tab === 'printed') return rows.filter((r) => !!r.printedAt);
    return rows;
  }, [rows, tab]);

  const counts = useMemo(() => ({
    created: rows.filter((r) => !r.printedAt).length,
    printed: rows.filter((r) => !!r.printedAt).length,
    all: rows.length,
  }), [rows]);

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.shipmentId)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  async function handleBulkAction(action: 'print' | 'download') {
    if (selected.size === 0) return;
    const shipmentIds = Array.from(selected);
    setBusy(action);
    try {
      const blob = await shippingApi.bulkDownloadLabels(shipmentIds, true);
      const url = URL.createObjectURL(blob);
      if (action === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Give the browser a moment before revoking
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        // Print: hidden iframe → triggers native print dialog for the merged PDF
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = url;
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            // Cross-origin-ish fallback: open in new tab so user can print via the browser menu
            window.open(url, '_blank');
          }
        };
        document.body.appendChild(iframe);
        // Clean up later (after user had time to print)
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }
      setSelected(new Set());
      // Refresh so printedAt updates into "Gedruckt" tab
      load();
    } catch (e: any) {
      alert(e.message || 'Bulk-Aktion fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  }

  async function toggleSinglePrinted(row: LabelRow) {
    const makePrinted = !row.printedAt;
    try {
      await shippingApi.markLabelPrinted(row.labelId, makePrinted);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Labels" subtitle="Archiv und Druckverwaltung aller Versand-Labels" />

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-2 inline-flex gap-1">
        <TabButton active={tab === 'created'} onClick={() => setTab('created')} label="Erstellt" count={counts.created} />
        <TabButton active={tab === 'printed'} onClick={() => setTab('printed')} label="Gedruckt" count={counts.printed} />
        <TabButton active={tab === 'all'} onClick={() => setTab('all')} label="Alle" count={counts.all} />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-xl border border-primary-200 dark:border-primary-700/40 bg-primary-50 dark:bg-primary-900/20 p-3 shadow-sm">
          <div className="text-sm text-primary-900 dark:text-primary-100">
            <strong>{selected.size}</strong> Label{selected.size === 1 ? '' : 's'} ausgewählt — werden als <strong>eine PDF-Datei</strong> zusammengeführt.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('print')}
              disabled={busy !== null}
              className={btn('primary', 'h-9 px-3 py-1 text-sm')}
            >
              {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Drucken
            </button>
            <button
              onClick={() => handleBulkAction('download')}
              disabled={busy !== null}
              className={btn('secondary', 'h-9 px-3 py-1 text-sm')}
            >
              {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Downloaden
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className={btn('ghost', 'h-9 px-3 py-1 text-sm')}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<QrCode className="h-10 w-10" />}
            title={
              tab === 'created'
                ? 'Keine unerledigten Labels'
                : tab === 'printed'
                  ? 'Noch kein Label gedruckt'
                  : 'Noch keine Labels generiert'
            }
            hint={
              tab === 'created'
                ? 'Alle generierten Labels wurden bereits gedruckt. Neue Labels erstellst du unter Bestellungen.'
                : tab === 'printed'
                  ? 'Sobald du Labels druckst (oder per Bulk-Action herunterlädst), landen sie hier.'
                  : 'Gehe zu Bestellungen und erstelle deine ersten DHL-Labels.'
            }
            action={<Link href="/shipping/orders" className={btn('primary')}>Zu den Bestellungen</Link>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2.5 text-left">Tracking-Nr</th>
                <th className="px-3 py-2.5 text-left">Bestellnr.</th>
                <th className="px-3 py-2.5 text-left">Empfänger</th>
                <th className="px-3 py-2.5 text-left">Carrier</th>
                <th className="px-3 py-2.5 text-left">Format</th>
                <th className="px-3 py-2.5 text-left">Druck</th>
                <th className="px-3 py-2.5 text-left">Erstellt</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map((r) => {
                const st = SHIPMENT_STATUS_LABELS[r.status as keyof typeof SHIPMENT_STATUS_LABELS];
                const carrierLabel = CARRIER_LABELS[r.carrier as keyof typeof CARRIER_LABELS] || r.carrier;
                const isSelected = selected.has(r.shipmentId);
                return (
                  <tr
                    key={r.labelId}
                    className={cn(
                      'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]',
                      isSelected && 'bg-primary-50/50 dark:bg-primary-900/10',
                    )}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(r.shipmentId)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary-700 dark:text-primary-300">
                      {r.trackingNumber || '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">#{r.orderNumber}</td>
                    <td className="px-3 py-3 truncate max-w-[200px]">{r.recipientName}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{carrierLabel}</td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500">{r.format}</td>
                    <td className="px-3 py-3">
                      {r.printedAt ? (
                        <div className="flex flex-col">
                          <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Gedruckt
                          </Badge>
                          <span className="text-[10px] text-gray-500 mt-0.5">
                            {fmtDateTime(r.printedAt)}
                            {r.printCount > 1 ? ` · ${r.printCount}×` : ''}
                          </span>
                        </div>
                      ) : (
                        <Badge color={st?.color || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                          Offen
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <a
                          href={r.labelUrl}
                          target="_blank"
                          rel="noopener"
                          title="Öffnen"
                          className={btn('secondary', 'h-7 px-2 py-0 text-xs')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => toggleSinglePrinted(r)}
                          title={r.printedAt ? 'Als ungedruckt markieren' : 'Als gedruckt markieren'}
                          className={btn(r.printedAt ? 'ghost' : 'secondary', 'h-7 px-2 py-0 text-xs')}
                        >
                          {r.printedAt ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </button>
                        <Link href={`/shipping/shipments/${r.shipmentId}`} className={btn('ghost', 'h-7 px-2 py-0 text-xs')}>
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
        active
          ? 'bg-primary-600 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold',
          active ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400',
        )}
      >
        {count}
      </span>
    </button>
  );
}
