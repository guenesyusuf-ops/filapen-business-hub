'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QrCode, Printer, ExternalLink, Download, Check, Undo2, Loader2, Trash2 } from 'lucide-react';
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
  // Selection is per label-ID (not shipment-ID) so multiple labels of the same
  // shipment can be picked individually.
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  // How many labels look like old stubs (HTML or tracking starts with STUB) — used
  // to conditionally show the cleanup button.
  const stubCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.labelUrl?.toLowerCase().endsWith('.html') ||
          (r.trackingNumber ?? '').startsWith('STUB'),
      ).length,
    [rows],
  );

  async function cleanupStubs() {
    if (!confirm(`${stubCount} Stub-Label(s) aus der Test-Phase (HTML statt echtes PDF) endgültig löschen?\n\nDie zugehörigen Sendungen werden mit entfernt. Echte DHL-Labels bleiben unberührt.`)) return;
    try {
      const res = await shippingApi.cleanupStubLabels();
      alert(`${res.deletedShipments} Sendung(en) und ${res.deletedLabels} Label(s) gelöscht.`);
      load();
    } catch (e: any) {
      alert(`Aufräumen fehlgeschlagen: ${e.message}`);
    }
  }

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.labelId)));
  };
  const toggle = (labelId: string) => {
    const next = new Set(selected);
    if (next.has(labelId)) next.delete(labelId); else next.add(labelId);
    setSelected(next);
  };

  async function handleBulkAction(action: 'print' | 'download') {
    if (selected.size === 0) return;
    const labelIds = Array.from(selected);
    // Ask up-front whether delivery notes should be included. We do this BEFORE
    // kicking off requests so the two PDFs (labels + Lieferscheine) land back in
    // the same user gesture, which most browsers allow to trigger two downloads
    // or two window.open() calls without popup blocking.
    const withDeliveryNotes = window.confirm(
      `Auch Lieferscheine für ${labelIds.length} Sendung${labelIds.length === 1 ? '' : 'en'} ${action === 'print' ? 'drucken' : 'herunterladen'}?\n\nDu bekommst dann zwei getrennte PDFs:\n  1. Labels (wie bisher)\n  2. Lieferscheine (gleiche Reihenfolge, 1 Seite pro Sendung)`,
    );
    setBusy(action);
    try {
      const { blob, labelCount, skippedCount, skippedReasons } = await shippingApi.bulkDownloadLabels(labelIds, true);
      const url = URL.createObjectURL(blob);
      if (skippedCount > 0) {
        // Non-blocking notice: PDF is still delivered with the labels that worked
        const reasons = skippedReasons || 'Format nicht druckbar';
        alert(
          `${labelCount} von ${labelIds.length} Label${labelIds.length === 1 ? '' : 's'} in PDF zusammengefügt.\n\n${skippedCount} übersprungen: ${reasons}`,
        );
      }

      // Fetch delivery notes in parallel to labels-already-downloaded — if the
      // user confirmed above. We await this AFTER the labels PDF was triggered
      // so the label download never gets blocked by a delivery-note error.
      let deliveryBlob: Blob | null = null;
      if (withDeliveryNotes) {
        try {
          const dn = await shippingApi.bulkDownloadDeliveryNotes(labelIds);
          deliveryBlob = dn.blob;
        } catch (e: any) {
          // Non-blocking — user already has the labels. Surface the error but
          // don't throw; the labels flow below must still run.
          alert(`Lieferscheine konnten nicht erzeugt werden: ${e.message}`);
        }
      }

      if (action === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        if (deliveryBlob) {
          const durl = URL.createObjectURL(deliveryBlob);
          const da = document.createElement('a');
          da.href = durl;
          da.download = `lieferscheine-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
          document.body.appendChild(da);
          da.click();
          da.remove();
          setTimeout(() => URL.revokeObjectURL(durl), 2000);
        }
      } else {
        // Print: Neues Fenster mit dem PDF — Browser zeigt nativen PDF-Viewer,
        // User kann direkt den Print-Button nutzen (in allen Browsern oben im Viewer
        // sichtbar). Automatischer print()-Trigger via setTimeout, damit der Viewer
        // Zeit zum Rendern hat. Fallback: User druckt manuell mit Cmd+P.
        const w = window.open(url, '_blank');
        if (!w) {
          // Popup-Blocker → Direkt-Download als Fallback damit der User zumindest
          // die Datei hat
          const a = document.createElement('a');
          a.href = url;
          a.download = `labels-print-${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          alert('Popup wurde blockiert. Die Label-PDF wurde stattdessen heruntergeladen — bitte manuell drucken.');
        } else {
          // Nach 1.5s sollte der PDF-Viewer geladen sein → print() auslösen
          const tryPrint = () => {
            try {
              w.focus();
              w.print();
            } catch {
              // Silently ignore; user can print manually via Cmd+P
            }
          };
          setTimeout(tryPrint, 1500);
        }
        // Blob-URL erst nach Sicht-Öffnung freigeben, damit der PDF-Viewer sie laden kann
        setTimeout(() => URL.revokeObjectURL(url), 60_000);

        // Delivery notes als zweites Druck-Fenster — in derselben User-Gesten-
        // Kette, daher lässt der Popup-Blocker es in der Regel zu. Fallback auf
        // Download, falls doch geblockt.
        if (deliveryBlob) {
          const durl = URL.createObjectURL(deliveryBlob);
          const dw = window.open(durl, '_blank');
          if (!dw) {
            const da = document.createElement('a');
            da.href = durl;
            da.download = `lieferscheine-print-${Date.now()}.pdf`;
            document.body.appendChild(da);
            da.click();
            da.remove();
            alert('Popup für Lieferscheine wurde blockiert. Die Lieferschein-PDF wurde stattdessen heruntergeladen.');
          } else {
            setTimeout(() => {
              try { dw.focus(); dw.print(); } catch {}
            }, 1500);
          }
          setTimeout(() => URL.revokeObjectURL(durl), 60_000);
        }
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
    const nowIso = new Date().toISOString();
    const originalPrintedAt = row.printedAt;
    const originalCount = row.printCount;
    // Optimistic UI update — fühlt sich sofort an, egal wie langsam der Server
    setRows((prev) =>
      prev.map((r) =>
        r.labelId === row.labelId
          ? {
              ...r,
              printedAt: makePrinted ? (r.printedAt ?? nowIso) : null,
              printCount: makePrinted ? r.printCount + 1 : r.printCount,
            }
          : r,
      ),
    );
    try {
      await shippingApi.markLabelPrinted(row.labelId, makePrinted);
    } catch (e: any) {
      // Rollback bei Fehler — und User klar informieren
      setRows((prev) =>
        prev.map((r) =>
          r.labelId === row.labelId
            ? { ...r, printedAt: originalPrintedAt, printCount: originalCount }
            : r,
        ),
      );
      alert(
        `Druck-Markierung fehlgeschlagen: ${e.message}\n\nFalls die DB-Migration noch nicht gelaufen ist, bitte in Supabase ausführen:\n\nALTER TABLE order_shipment_labels\n  ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,\n  ADD COLUMN IF NOT EXISTS print_count INT NOT NULL DEFAULT 0;`,
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Labels" subtitle="Archiv und Druckverwaltung aller Versand-Labels" />

      {/* Tabs + Stub-Cleanup */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-2 inline-flex gap-1">
          <TabButton active={tab === 'created'} onClick={() => setTab('created')} label="Erstellt" count={counts.created} />
          <TabButton active={tab === 'printed'} onClick={() => setTab('printed')} label="Gedruckt" count={counts.printed} />
          <TabButton active={tab === 'all'} onClick={() => setTab('all')} label="Alle" count={counts.all} />
        </div>
        {stubCount > 0 && (
          <button
            onClick={cleanupStubs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
            title="Stub-Labels aus der Test-Phase löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {stubCount} Stub-Label{stubCount === 1 ? '' : 's'} aufräumen
          </button>
        )}
      </div>

      {/* Bulk action bar — stacks vertically on mobile so buttons stay reachable */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-xl border border-primary-200 dark:border-primary-700/40 bg-primary-50 dark:bg-primary-900/20 p-3 shadow-sm">
          <div className="text-xs sm:text-sm text-primary-900 dark:text-primary-100">
            <strong>{selected.size}</strong> Label{selected.size === 1 ? '' : 's'} ausgewählt — wird als <strong>eine PDF-Datei</strong> zusammengeführt.
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleBulkAction('print')}
              disabled={busy !== null}
              className={btn('primary', 'flex-1 sm:flex-none text-sm')}
            >
              {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Drucken
            </button>
            <button
              onClick={() => handleBulkAction('download')}
              disabled={busy !== null}
              className={btn('secondary', 'flex-1 sm:flex-none text-sm')}
            >
              {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Downloaden
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className={btn('ghost', 'text-sm')}
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
          <div className="table-scroll">
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
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Bestellnr.</th>
                <th className="px-3 py-2.5 text-left">Empfänger</th>
                <th className="px-3 py-2.5 text-left hidden lg:table-cell">Carrier</th>
                <th className="px-3 py-2.5 text-left hidden xl:table-cell">Format</th>
                <th className="px-3 py-2.5 text-left">Druck</th>
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Erstellt</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map((r) => {
                const st = SHIPMENT_STATUS_LABELS[r.status as keyof typeof SHIPMENT_STATUS_LABELS];
                const carrierLabel = CARRIER_LABELS[r.carrier as keyof typeof CARRIER_LABELS] || r.carrier;
                const isSelected = selected.has(r.labelId);
                return (
                  <tr
                    key={r.labelId}
                    className={cn(
                      'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]',
                      isSelected && 'bg-primary-50/50 dark:bg-primary-900/10',
                    )}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(r.labelId)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary-700 dark:text-primary-300">
                      {r.trackingNumber || '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs hidden md:table-cell">#{r.orderNumber}</td>
                    <td className="px-3 py-3 truncate max-w-[120px] sm:max-w-[200px]">
                      {r.recipientName}
                      {/* Mobile-only: show order# + carrier under name */}
                      <div className="md:hidden text-[10px] text-gray-500 mt-0.5 truncate">
                        #{r.orderNumber} · {carrierLabel}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300 hidden lg:table-cell">{carrierLabel}</td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500 hidden xl:table-cell">{r.format}</td>
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
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap hidden md:table-cell">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <a
                          href={r.labelUrl}
                          target="_blank"
                          rel="noopener"
                          title="Öffnen"
                          className={btn('secondary', 'h-8 sm:h-7 px-2 py-0 text-xs min-h-0')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => toggleSinglePrinted(r)}
                          title={r.printedAt ? 'Als ungedruckt markieren' : 'Als gedruckt markieren'}
                          className={btn(r.printedAt ? 'ghost' : 'secondary', 'h-8 sm:h-7 px-2 py-0 text-xs min-h-0')}
                        >
                          {r.printedAt ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </button>
                        <Link href={`/shipping/shipments/${r.shipmentId}`} className={btn('ghost', 'h-8 sm:h-7 px-2 py-0 text-xs min-h-0 hidden sm:inline-flex')}>
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
