'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Trash2, FileText, Upload, Download, Send, FilePlus,
  Plus, X, AlertTriangle, Clock, Truck, Package, PackageCheck,
} from 'lucide-react';
import { salesApi, fmtDate, fmtMoney, urgencyOf, STATUS_LABELS, SalesDocumentKind } from '@/lib/sales';
import { PageHeader, btn, Badge } from '@/components/sales/SalesUI';

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerEdits, setHeaderEdits] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [shipModal, setShipModal] = useState(false);
  const [dirtyItems, setDirtyItems] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const o = await salesApi.getOrder(params.id);
      setOrder(o);
      setHeaderEdits({
        externalOrderNumber: o.externalOrderNumber ?? '',
        orderDate: o.orderDate ? o.orderDate.slice(0, 10) : '',
        requiredDeliveryDate: o.requiredDeliveryDate ? o.requiredDeliveryDate.slice(0, 10) : '',
        contactPerson: o.contactPerson ?? '',
        paymentTerms: o.paymentTerms ?? '',
        currency: o.currency ?? 'EUR',
        notes: o.notes ?? '',
      });
      setItems(o.lineItems ?? []);
      setDirtyItems(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [params.id]);

  async function saveHeader() {
    setSaving(true);
    try {
      await salesApi.updateOrder(params.id, headerEdits);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLineItems() {
    setSaving(true);
    try {
      await salesApi.replaceLineItems(params.id, items.map((l, idx) => ({
        position: idx + 1,
        title: l.title,
        supplierArticleNumber: l.supplierArticleNumber,
        ean: l.ean,
        unitsPerCarton: l.unitsPerCarton ? Number(l.unitsPerCarton) : null,
        quantity: Number(l.quantity) || 1,
        unitPriceNet: Number(l.unitPriceNet) || 0,
        lineNet: l.lineNet != null ? Number(l.lineNet) : undefined,
      })));
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleBadge(kind: 'confirmation_sent' | 'shipped' | 'invoice_sent' | 'paid') {
    const current = kind === 'confirmation_sent' ? !!order.confirmationSentAt
                  : kind === 'shipped' ? !!order.shippedAt
                  : kind === 'invoice_sent' ? !!order.invoiceSentAt
                  : !!order.paidAt;
    const next = !current;
    try {
      if (kind === 'confirmation_sent') await salesApi.toggleConfirmation(params.id, next);
      if (kind === 'shipped') await salesApi.toggleShipped(params.id, next);
      if (kind === 'invoice_sent') await salesApi.toggleInvoice(params.id, next);
      if (kind === 'paid') await salesApi.togglePaid(params.id, next);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function deleteOrder() {
    if (!confirm(`Bestellung ${order.orderNumber} wirklich löschen?`)) return;
    try {
      await salesApi.deleteOrder(params.id);
      router.push('/sales/orders');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>, kind: SalesDocumentKind) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await salesApi.uploadDocument(params.id, f, kind);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Dokument löschen?')) return;
    try {
      await salesApi.deleteDocument(params.id, docId);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  async function easybillAction(fn: () => Promise<any>, label: string) {
    setSaving(true);
    try {
      await fn();
      await load();
      alert(`${label} erfolgreich.`);
    } catch (e: any) {
      alert(`${label} fehlgeschlagen: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function updateItem(idx: number, patch: any) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    setDirtyItems(true);
  }
  function addItem() {
    setItems((prev) => [...prev, {
      title: '', supplierArticleNumber: '', ean: '', unitsPerCarton: null, quantity: 1, unitPriceNet: 0, lineNet: 0,
    }]);
    setDirtyItems(true);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirtyItems(true);
  }

  if (loading) return <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>;
  if (!order) return <div className="p-12 text-center text-sm text-gray-500">Nicht gefunden</div>;

  const urg = urgencyOf(order);
  const total = items.reduce((s, i) => s + (Number(i.lineNet ?? i.quantity * i.unitPriceNet) || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${order.orderNumber}`}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <Link href="/sales/orders" className="text-primary-600 hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Zurück
            </Link>
            <span className="text-gray-400">•</span>
            <span>{order.customer?.companyName}</span>
            <Badge color={STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]?.color}>
              {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]?.label}
            </Badge>
            {urg === 'overdue' && <Badge color="bg-red-100 text-red-700"><AlertTriangle className="inline h-3 w-3 mr-0.5" />In Verzug</Badge>}
            {urg === 'urgent' && <Badge color="bg-amber-100 text-amber-700"><Clock className="inline h-3 w-3 mr-0.5" />Dringend</Badge>}
          </span>
        }
        actions={
          <button onClick={deleteOrder} className={btn('danger')} title="Bestellung löschen">
            <Trash2 className="h-4 w-4" /> Löschen
          </button>
        }
      />

      {/* Status-Badges Toggle */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <ToggleBadge
          label="Auftragsbestätigung gesendet"
          on={!!order.confirmationSentAt}
          ts={order.confirmationSentAt}
          onClick={() => toggleBadge('confirmation_sent')}
        />
        <ToggleBadge
          label="Ware versendet"
          on={!!order.shippedAt}
          ts={order.shippedAt}
          onClick={() => toggleBadge('shipped')}
        />
        <ToggleBadge
          label="Rechnung gesendet"
          on={!!order.invoiceSentAt}
          ts={order.invoiceSentAt}
          onClick={() => toggleBadge('invoice_sent')}
        />
        <ToggleBadge
          label="Bezahlt"
          on={!!order.paidAt}
          ts={order.paidAt}
          onClick={() => toggleBadge('paid')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Linke Spalte: Kopfdaten */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Kopfdaten" actions={
            <button onClick={saveHeader} disabled={saving} className={btn('primary', 'text-xs')}>
              <Save className="h-3 w-3" /> Speichern
            </button>
          }>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldReadOnly label="Kunde" value={order.customer?.companyName} />
              <FieldReadOnly label="Kundennummer (intern)" value={order.customer?.customerNumber} />
              <Field label="Externe Bestellnummer">
                <input className={inputCls} value={headerEdits.externalOrderNumber}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, externalOrderNumber: e.target.value })} />
              </Field>
              <Field label="Bestelldatum">
                <input type="date" className={inputCls} value={headerEdits.orderDate}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, orderDate: e.target.value })} />
              </Field>
              <Field label="Liefertermin">
                <input type="date" className={inputCls} value={headerEdits.requiredDeliveryDate}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, requiredDeliveryDate: e.target.value })} />
              </Field>
              <Field label="Ansprechpartner">
                <input className={inputCls} value={headerEdits.contactPerson}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, contactPerson: e.target.value })} />
              </Field>
              <Field label="Zahlungsbedingungen">
                <input className={inputCls} value={headerEdits.paymentTerms}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, paymentTerms: e.target.value })} />
              </Field>
              <Field label="Währung">
                <input className={inputCls} value={headerEdits.currency}
                  onChange={(e) => setHeaderEdits({ ...headerEdits, currency: e.target.value })} />
              </Field>
            </div>
            <Field label="Notizen" className="mt-3">
              <textarea className={`${inputCls} min-h-[70px]`} value={headerEdits.notes}
                onChange={(e) => setHeaderEdits({ ...headerEdits, notes: e.target.value })} />
            </Field>
          </Section>

          <Section title="Positionen" actions={
            <div className="flex gap-2">
              {(order.lineItems ?? []).some((li: any) => !li.shipmentId) && (
                <button onClick={() => setShipModal(true)} className={btn('primary', 'text-xs')}>
                  <Truck className="h-3 w-3" /> Versenden
                </button>
              )}
              <button onClick={addItem} className={btn('ghost', 'text-xs')}><Plus className="h-3 w-3" /> Zeile</button>
              <button onClick={saveLineItems} disabled={!dirtyItems || saving} className={btn('primary', 'text-xs')}>
                <Save className="h-3 w-3" /> Speichern
              </button>
            </div>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1">#</th>
                    <th className="py-1">Artikel</th>
                    <th className="py-1">Art.-Nr.</th>
                    <th className="py-1">EAN</th>
                    <th className="py-1">VKE</th>
                    <th className="py-1 text-right">Menge</th>
                    <th className="py-1 text-right">Einzel-€</th>
                    <th className="py-1 text-right">Netto</th>
                    <th className="py-1">Versand</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, idx) => {
                    // Versandstatus aus der persistierten Order ziehen (nicht aus
                    // dem editierbaren `items`-State — der wird erst bei Speichern
                    // mit dem Backend synchronisiert und hat keine shipmentId-Info).
                    const persisted = (order.lineItems ?? []).find((x: any) => x.id === li.id);
                    const shipped = !!persisted?.shipmentId;
                    return (
                      <tr key={idx} className="border-t border-gray-200/60 dark:border-white/5">
                        <td className="py-1 text-xs text-gray-500">{idx + 1}</td>
                        <td className="py-1 pr-1"><input className={inputCls} value={li.title ?? ''} onChange={(e) => updateItem(idx, { title: e.target.value })} /></td>
                        <td className="py-1 pr-1"><input className={inputCls} value={li.supplierArticleNumber ?? ''} onChange={(e) => updateItem(idx, { supplierArticleNumber: e.target.value })} /></td>
                        <td className="py-1 pr-1"><input className={inputCls} value={li.ean ?? ''} onChange={(e) => updateItem(idx, { ean: e.target.value })} /></td>
                        <td className="py-1 pr-1"><input type="number" className={inputCls} value={li.unitsPerCarton ?? ''} onChange={(e) => updateItem(idx, { unitsPerCarton: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td className="py-1 pr-1"><input type="number" className={`${inputCls} text-right`} value={li.quantity ?? 1} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></td>
                        <td className="py-1 pr-1"><input type="number" step="0.0001" className={`${inputCls} text-right`} value={li.unitPriceNet ?? 0} onChange={(e) => updateItem(idx, { unitPriceNet: Number(e.target.value), lineNet: Number(e.target.value) * (Number(li.quantity) || 1) })} /></td>
                        <td className="py-1 pr-1"><input type="number" step="0.01" className={`${inputCls} text-right`} value={li.lineNet ?? 0} onChange={(e) => updateItem(idx, { lineNet: Number(e.target.value) })} /></td>
                        <td className="py-1">
                          {shipped ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 text-[10px] font-medium">
                              <PackageCheck className="h-3 w-3" /> versendet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 text-[10px] font-medium">
                              <Package className="h-3 w-3" /> offen
                            </span>
                          )}
                        </td>
                        <td className="py-1"><button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={10} className="py-4 text-center text-xs text-gray-500">Keine Positionen — klick auf „Zeile" um hinzuzufügen.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-white/10">
                    <td colSpan={7} className="py-1.5 text-right text-xs font-semibold">Gesamt Netto</td>
                    <td className="py-1.5 text-right font-semibold">{fmtMoney(total, order.currency)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          <Section title="Sendungen" actions={
            (order.lineItems ?? []).some((li: any) => !li.shipmentId) && (
              <button onClick={() => setShipModal(true)} className={btn('primary', 'text-xs')}>
                <Truck className="h-3 w-3" /> Neue Sendung
              </button>
            )
          }>
            <ShipmentsList order={order} onChanged={load} />
          </Section>
        </div>

        {/* Rechte Spalte: Dokumente + easybill */}
        <div className="space-y-4">
          <Section title="easybill">
            <EasybillPanel order={order} saving={saving} onAction={easybillAction} />
          </Section>

          <Section title="Dokumente">
            <div className="space-y-2">
              {(order.documents ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200/60 dark:border-white/5 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{d.fileName}</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{kindLabel(d.kind)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={d.url} target="_blank" rel="noopener" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5" title="Öffnen"><Download className="h-3.5 w-3.5" /></a>
                    <button onClick={() => deleteDoc(d.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Löschen"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {(!order.documents || order.documents.length === 0) && (
                <div className="text-xs text-gray-500 py-2">Noch keine Dokumente.</div>
              )}
            </div>
            <div className="mt-3 grid gap-1.5">
              <UploadButton label="Original-Bestellung" kind="original" onChange={uploadDoc} />
              <UploadButton label="Auftragsbestätigung" kind="confirmation" onChange={uploadDoc} />
              <UploadButton label="Rechnung" kind="invoice" onChange={uploadDoc} />
              <UploadButton label="Sonstiges" kind="other" onChange={uploadDoc} />
            </div>
          </Section>
        </div>
      </div>

      {shipModal && (
        <ShipmentModal
          order={order}
          onClose={() => setShipModal(false)}
          onSaved={() => { setShipModal(false); load(); }}
        />
      )}
    </div>
  );
}

// --- Subcomponents ---------------------------------------------------------

const inputCls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs text-gray-900 dark:text-gray-100';

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block text-xs ${className ?? ''}`}>
      <div className="text-gray-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

function FieldReadOnly({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="text-gray-900 dark:text-gray-100">{value ?? '—'}</div>
    </div>
  );
}

function ToggleBadge({ label, on, ts, onClick }: { label: string; on: boolean; ts: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-xs transition-all ${
        on
          ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700/40'
          : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-primary-300'
      }`}
    >
      <span className={`font-medium ${on ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
      <span className="text-[10px] text-gray-500">{on ? `seit ${fmtDate(ts)}` : 'offen'}</span>
    </button>
  );
}

function ShippingForm({ order, onSaved }: { order: any; onSaved: () => void }) {
  const [tracking, setTracking] = useState<string>((order.trackingNumbers ?? []).join(', '));
  const [note, setNote] = useState<string>(order.shippingCarrierNote ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await salesApi.updateShipping(order.id, {
        trackingNumbers: tracking.split(',').map((s) => s.trim()).filter(Boolean),
        shippingCarrierNote: note || null,
      });
      onSaved();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Sendungsnummern (Komma-getrennt)">
        <input className={inputCls} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="00340001234567890123, …" />
      </Field>
      <Field label="Carrier-Notiz">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. DHL / abgeholt am …" />
      </Field>
      <div className="sm:col-span-2 flex justify-end">
        <button onClick={save} disabled={busy} className={btn('primary', 'text-xs')}>
          <Save className="h-3 w-3" /> Versand-Info speichern
        </button>
      </div>
    </div>
  );
}

function EasybillPanel({ order, saving, onAction }: { order: any; saving: boolean; onAction: (fn: () => Promise<any>, label: string) => Promise<void> }) {
  const hasConf = !!order.easybillConfirmationId;
  const hasInv = !!order.easybillInvoiceId;
  return (
    <div className="space-y-2 text-xs">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={hasConf ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {hasConf ? '✓ AB in easybill' : 'AB noch nicht in easybill'}
          </span>
          <div className="flex gap-1">
            {!hasConf && (
              <button onClick={() => onAction(() => salesApi.createConfirmation(order.id), 'AB erstellt')}
                disabled={saving} className={btn('primary', 'text-[11px]')}>
                <FilePlus className="h-3 w-3" /> AB erstellen
              </button>
            )}
            {hasConf && (
              <>
                {order.easybillConfirmationPdfUrl && (
                  <a href={order.easybillConfirmationPdfUrl} target="_blank" rel="noopener" className={btn('ghost', 'text-[11px]')}>
                    <Download className="h-3 w-3" /> PDF
                  </a>
                )}
                <button onClick={() => onAction(() => salesApi.sendConfirmation(order.id), 'AB versendet')}
                  disabled={saving} className={btn('secondary', 'text-[11px]')}>
                  <Send className="h-3 w-3" /> Senden
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1.5 pt-2 border-t border-gray-200/60 dark:border-white/5">
        <div className="flex items-center justify-between gap-2">
          <span className={hasInv ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {hasInv ? '✓ Rechnung in easybill' : 'Rechnung noch nicht in easybill'}
          </span>
          <div className="flex gap-1">
            {!hasInv && (
              <button onClick={() => onAction(() => salesApi.createInvoice(order.id), 'Rechnung erstellt')}
                disabled={saving} className={btn('primary', 'text-[11px]')}>
                <FilePlus className="h-3 w-3" /> Rechnung
              </button>
            )}
            {hasInv && (
              <>
                {order.easybillInvoicePdfUrl && (
                  <a href={order.easybillInvoicePdfUrl} target="_blank" rel="noopener" className={btn('ghost', 'text-[11px]')}>
                    <Download className="h-3 w-3" /> PDF
                  </a>
                )}
                <button onClick={() => onAction(() => salesApi.sendInvoice(order.id), 'Rechnung versendet')}
                  disabled={saving} className={btn('secondary', 'text-[11px]')}>
                  <Send className="h-3 w-3" /> Senden
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadButton({ label, kind, onChange }: { label: string; kind: SalesDocumentKind; onChange: (e: React.ChangeEvent<HTMLInputElement>, kind: SalesDocumentKind) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-xs hover:border-primary-300 cursor-pointer">
      <Upload className="h-3 w-3" /> {label}
      <input type="file" className="hidden" onChange={(e) => onChange(e, kind)} />
    </label>
  );
}

function kindLabel(k: string) {
  if (k === 'original') return 'Original-Bestellung';
  if (k === 'confirmation') return 'Auftragsbestätigung';
  if (k === 'invoice') return 'Rechnung';
  return 'Sonstiges';
}

// ---------------------------------------------------------------------------
// Shipment Modal — beim Klick auf "Versenden" werden ALLE offenen Positionen
// automatisch ausgewählt. Für Teilsendungen einzeln abwählen. Danach Tracking-
// Nummern (kommasepariert) eintragen und speichern.
// ---------------------------------------------------------------------------
function ShipmentModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const openLines = (order.lineItems ?? []).filter((li: any) => !li.shipmentId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(openLines.map((li: any) => li.id)));
  const [tracking, setTracking] = useState('');
  const [carrierNote, setCarrierNote] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function save() {
    if (selected.size === 0) return alert('Mindestens eine Position auswählen');
    setSaving(true);
    try {
      await salesApi.createShipment(order.id, {
        lineItemIds: Array.from(selected),
        trackingNumbers: tracking.split(',').map((t) => t.trim()).filter(Boolean),
        carrierNote: carrierNote || null,
        notes: notes || null,
      });
      onSaved();
    } catch (e: any) {
      alert(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Versand erstellen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">
            {openLines.length} offene Position{openLines.length === 1 ? '' : 'en'} — alle ausgewählt. Haken entfernen für Teilsendung:
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-lg p-2">
            {openLines.map((li: any) => (
              <label key={li.id} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(li.id)}
                  onChange={() => toggle(li.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{li.title}</div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {li.supplierArticleNumber || '—'} · {li.quantity}× · {fmtMoney(li.lineNet, order.currency)}
                  </div>
                </div>
              </label>
            ))}
            {openLines.length === 0 && (
              <div className="text-xs text-gray-500 p-4 text-center">Alle Positionen sind bereits versendet.</div>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">
            <div className="text-gray-500 mb-1">Sendungsnummer(n) — mehrere mit Komma trennen</div>
            <input
              className={inputCls}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="00340001234567890123, …"
            />
          </label>
          <label className="text-xs">
            <div className="text-gray-500 mb-1">Carrier / Notiz</div>
            <input
              className={inputCls}
              value={carrierNote}
              onChange={(e) => setCarrierNote(e.target.value)}
              placeholder="z.B. DHL Express"
            />
          </label>
          <label className="text-xs">
            <div className="text-gray-500 mb-1">Zusätzliche Notiz (optional)</div>
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-gray-500">
            <strong>{selected.size}</strong> von {openLines.length} Position{openLines.length === 1 ? '' : 'en'} ausgewählt
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={btn('ghost', 'text-sm')}>Abbrechen</button>
            <button onClick={save} disabled={saving || selected.size === 0} className={btn('primary', 'text-sm')}>
              <Truck className="h-3.5 w-3.5" /> Versand anlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zeigt bestehende Sendungen einer Order — mit Tracking-Nrn, betroffenen
// Positionen und Storno-Button. Pro Sendung Collapse-Zeile.
// ---------------------------------------------------------------------------
function ShipmentsList({ order, onChanged }: { order: any; onChanged: () => void }) {
  const shipments = order.shipments ?? [];
  const lineById = new Map<string, any>();
  for (const li of order.lineItems ?? []) lineById.set(li.id, li);

  async function remove(shipmentId: string) {
    if (!confirm('Sendung stornieren? Die zugehörigen Positionen werden wieder als offen markiert.')) return;
    try {
      await salesApi.deleteShipment(order.id, shipmentId);
      onChanged();
    } catch (e: any) { alert(e.message); }
  }

  if (shipments.length === 0) {
    return (
      <div className="text-xs text-gray-500 py-2">Noch keine Sendung angelegt. Klick auf „Versenden" oben.</div>
    );
  }
  return (
    <div className="space-y-2">
      {shipments.map((s: any) => {
        const lines = (order.lineItems ?? []).filter((li: any) => li.shipmentId === s.id);
        return (
          <div key={s.id} className="rounded-lg border border-gray-200/60 dark:border-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  Sendung · {fmtDate(s.shippedAt)}
                </div>
                <div className="text-[10px] text-gray-500">
                  {lines.length} Position{lines.length === 1 ? '' : 'en'}
                  {s.carrierNote ? ` · ${s.carrierNote}` : ''}
                </div>
              </div>
              <button onClick={() => remove(s.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Sendung stornieren">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {s.trackingNumbers?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.trackingNumbers.map((t: string) => (
                  <span key={t} className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-mono">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-0.5">
              {lines.map((li: any) => (
                <div key={li.id} className="flex items-center justify-between text-[11px] text-gray-700 dark:text-gray-300">
                  <span className="truncate">{li.supplierArticleNumber || li.title}</span>
                  <span className="text-gray-500 font-mono">{li.quantity}×</span>
                </div>
              ))}
            </div>
            {s.notes && <div className="text-[10px] text-gray-500 italic">{s.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}
