'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Plus, X, Trash2, Upload, Download, Receipt,
  CheckCircle2, AlertCircle, Truck as TruckIcon, Ban, History, Plane, Package as PackageIcon,
} from 'lucide-react';
import {
  purchasesApi, fmtDate, fmtDateTime,
  STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, DOCUMENT_TYPE_LABELS, CARRIERS,
  type PurchaseOrder, type PaymentMethod, type DocumentType,
} from '@/lib/purchases';
import { Badge, btn, input, label, Money, PageHeader } from '@/components/purchases/PurchaseUI';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(false);
  const [shipmentForm, setShipmentForm] = useState(false);
  const [markReceivedFor, setMarkReceivedFor] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const reload = () => {
    purchasesApi.getOrder(id)
      .then((d) => { setOrder(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    purchasesApi.orderAudit(id).then(setAudit).catch(() => {});
  };

  useEffect(() => { reload(); }, [id]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>;
  if (!order) return null;

  const status = STATUS_LABELS[order.status];
  const ps = PAYMENT_STATUS_LABELS[order.paymentStatus];
  const totalNum = Number(order.totalAmount);
  const paidNum = Number(order.paidAmount);
  const openNum = Number(order.openAmount);
  const paidPct = totalNum > 0 ? Math.min(100, (paidNum / totalNum) * 100) : 0;

  const setOrderStatus = async (next: 'ordered' | 'received' | 'cancelled') => {
    if (next === 'cancelled' && !confirm('Bestellung wirklich stornieren?')) return;
    try {
      await purchasesApi.setOrderStatus(id, next);
      reload();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title={order.orderNumber}
        subtitle={`${order.supplier?.companyName} · angelegt von ${order.createdBy?.name || order.createdBy?.email} · ${fmtDate(order.createdAt)}`}
        actions={
          <>
            <Link href="/purchases/orders" className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Liste</Link>
            <button onClick={() => setShowAudit(!showAudit)} className={btn('secondary')}><History className="h-4 w-4" /> Verlauf</button>
          </>
        }
      />

      {/* Top row: status + actions */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge color={status.color}>{status.label}</Badge>
            <Badge color={ps.color}>{ps.label}</Badge>
            {(order.shipments || []).some(s => s.trackingNumber && !s.receivedAt) && order.status !== 'shipped' && (
              <Badge color="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">Unterwegs</Badge>
            )}
            {order.expectedDelivery && order.status !== 'received' && order.status !== 'completed' && (
              <span className="text-xs text-gray-500">Erwartet: {fmtDate(order.expectedDelivery)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.status === 'draft' && (
              <button onClick={() => setOrderStatus('ordered')} className={btn('secondary')}>
                <CheckCircle2 className="h-4 w-4" /> Als bestellt markieren
              </button>
            )}
            {order.status !== 'cancelled' && order.status !== 'completed' && (
              <button onClick={() => setOrderStatus('cancelled')} className={btn('danger')}>
                <Ban className="h-4 w-4" /> Stornieren
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main grid: left items + right payments/docs */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT — Positions + invoices */}
        <div className="lg:col-span-2 space-y-4">
          <Section title={`Positionen (${order.items?.length || 0})`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Produkt</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-right">Menge</th>
                    <th className="px-3 py-2 text-right">Einzelpreis</th>
                    <th className="px-3 py-2 text-right">USt %</th>
                    <th className="px-3 py-2 text-right">Summe brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {order.items?.map((it, i) => (
                    <tr key={it.id || i}>
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{it.productName}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{it.sku || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(it.quantity).toLocaleString('de-DE')}</td>
                      <td className="px-3 py-2 text-right tabular-nums"><Money amount={it.unitPrice} currency={order.currency} /></td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">{Number(it.vatRate || 19).toString().replace('.', ',')} %</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums"><Money amount={it.lineTotal} currency={order.currency} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr><td colSpan={6} className="px-3 py-1.5 text-right text-gray-500">Zwischensumme</td><td className="px-3 py-1.5 text-right tabular-nums"><Money amount={order.subtotal} currency={order.currency} /></td></tr>
                  <tr><td colSpan={6} className="px-3 py-1.5 text-right text-gray-500">Steuer</td><td className="px-3 py-1.5 text-right tabular-nums"><Money amount={order.taxTotal} currency={order.currency} /></td></tr>
                  {Number(order.shippingCost || 0) > 0 && <tr><td colSpan={6} className="px-3 py-1.5 text-right text-gray-500">Versand</td><td className="px-3 py-1.5 text-right tabular-nums"><Money amount={order.shippingCost} currency={order.currency} /></td></tr>}
                  {Number(order.customsCost || 0) > 0 && <tr><td colSpan={6} className="px-3 py-1.5 text-right text-gray-500">Zoll</td><td className="px-3 py-1.5 text-right tabular-nums"><Money amount={order.customsCost} currency={order.currency} /></td></tr>}
                  <tr className="border-t border-gray-200 dark:border-white/10"><td colSpan={6} className="px-3 py-2 text-right font-medium">Gesamt</td><td className="px-3 py-2 text-right text-lg font-bold tabular-nums"><Money amount={order.totalAmount} currency={order.currency} /></td></tr>
                </tfoot>
              </table>
            </div>
            {order.notes && <div className="mt-3 text-xs text-gray-500 italic">Notiz: {order.notes}</div>}
            {order.internalNotes && <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 italic">Intern: {order.internalNotes}</div>}
          </Section>

          {/* Invoices */}
          <Section
            title={`Rechnungen (${order.invoices?.length || 0})`}
            actions={<button onClick={() => setInvoiceForm(true)} className={btn('secondary')}><Plus className="h-4 w-4" /> Rechnung erfassen</button>}
          >
            {(order.invoices?.length || 0) === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400"><Receipt className="h-6 w-6 mx-auto mb-1 opacity-50" />Keine Rechnung erfasst</div>
            ) : (
              <div className="space-y-2">
                {order.invoices!.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-white/8 rounded-lg">
                    <div>
                      <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</div>
                      <div className="text-xs text-gray-400">Rechnungsdatum {fmtDate(inv.invoiceDate)} · Fällig {fmtDate(inv.dueDate)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold tabular-nums"><Money amount={inv.amount} currency={order.currency} /></div>
                      <button onClick={async () => { if (confirm('Rechnung löschen?')) { await purchasesApi.deleteInvoice(inv.id); reload(); } }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Audit log inline */}
          {showAudit && (
            <Section title="Verlauf">
              {audit.length === 0 ? <div className="text-sm text-gray-400">Keine Einträge</div> : (
                <ol className="space-y-2 text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="flex gap-3 items-start">
                      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-gray-700 dark:text-gray-300"><span className="font-medium">{a.user?.name || a.user?.email}</span> · {a.action} · <span className="text-xs text-gray-400 uppercase">{a.entityType}</span></div>
                        <div className="text-xs text-gray-400">{fmtDateTime(a.createdAt)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          )}
        </div>

        {/* RIGHT — Payment widget + documents */}
        <div className="space-y-4">
          {/* Supplier card */}
          <Section title="Lieferant">
            <div className="text-sm">
              <div className="font-medium text-gray-900 dark:text-white">{order.supplier?.companyName}</div>
              <div className="text-xs text-gray-500 mt-1">{order.supplier?.supplierNumber}</div>
              {order.supplier?.vatId && <div className="text-xs text-gray-500">USt-ID: {order.supplier.vatId}</div>}
            </div>
          </Section>

          {/* Shipments */}
          <Section
            title={`Sendungen (${order.shipments?.length || 0})`}
            actions={order.status !== 'cancelled' && <button onClick={() => setShipmentForm(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Sendung</button>}
          >
            {(order.shipments?.length || 0) === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                <PackageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
                Noch keine Sendung erfasst
              </div>
            ) : (
              <div className="space-y-2">
                {order.shipments!.map((s) => {
                  const isOnTheWay = s.trackingNumber && !s.receivedAt;
                  const isArrived = !!s.receivedAt;
                  return (
                    <div key={s.id} className="p-2.5 border border-gray-100 dark:border-white/8 rounded-lg space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {s.trackingNumber ? (
                            <div className="font-mono text-xs font-medium text-gray-900 dark:text-white truncate">{s.trackingNumber}</div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">Keine Sendungsnr.</div>
                          )}
                          <div className="text-xs text-gray-500">{s.carrier || 'Spedition unbekannt'}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isOnTheWay && <Badge color="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">Unterwegs</Badge>}
                          {isArrived && <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Angekommen</Badge>}
                          <button onClick={async () => { if (confirm('Sendung löschen?')) { await purchasesApi.deleteShipment(s.id); reload(); } }} className="p-1 text-gray-300 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      {s.shippedAt && <div className="text-xs text-gray-500">Versendet: {fmtDate(s.shippedAt)}</div>}
                      {s.receivedAt && <div className="text-xs text-green-700 dark:text-green-400">Angekommen: {fmtDate(s.receivedAt)}</div>}
                      <div className="text-xs text-gray-500">
                        {s.items.length} Position{s.items.length !== 1 ? 'en' : ''}
                        {' · '}
                        {s.items.reduce((acc, it) => acc + Number(it.quantity), 0).toLocaleString('de-DE')} Stück
                      </div>
                      {!s.receivedAt && (
                        <button
                          onClick={() => setMarkReceivedFor(s.id)}
                          className={btn('secondary', 'w-full justify-center h-7 text-xs')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Als angekommen markieren
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Payment widget */}
          <Section
            title="Zahlungen"
            actions={order.status !== 'cancelled' && <button onClick={() => setPaymentForm(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Erfassen</button>}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Gesamt</span><span className="font-semibold tabular-nums"><Money amount={order.totalAmount} currency={order.currency} /></span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Bezahlt</span><span className="text-green-700 dark:text-green-400 font-semibold tabular-nums"><Money amount={order.paidAmount} currency={order.currency} /></span></div>
                <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${ps.label === 'Überzahlt' ? 'bg-red-500' : ps.label === 'Vollständig bezahlt' ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${paidPct}%` }} />
                </div>
                <div className="flex justify-between text-sm pt-1"><span className="text-gray-500">Offen</span><span className={`font-semibold tabular-nums ${openNum > 0 ? 'text-amber-700 dark:text-amber-400' : openNum < 0 ? 'text-red-600' : 'text-gray-400'}`}><Money amount={order.openAmount} currency={order.currency} /></span></div>
              </div>

              {(order.payments?.length || 0) > 0 && (
                <div className="pt-3 border-t border-gray-100 dark:border-white/8 space-y-1.5">
                  {order.payments!.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-700 dark:text-gray-300">{fmtDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}</span>
                          <span className="tabular-nums font-medium"><Money amount={p.amount} currency={order.currency} /></span>
                        </div>
                        {p.reference && <div className="text-gray-400">Ref: {p.reference}</div>}
                        {p.note && <div className="text-gray-400 italic">{p.note}</div>}
                      </div>
                      <button onClick={async () => { if (confirm('Zahlung löschen?')) { await purchasesApi.deletePayment(p.id); reload(); } }} className="p-0.5 text-gray-300 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              {order.paymentStatus === 'overpaid' && (
                <div className="text-xs p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 flex gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> Überzahlung — bitte prüfen.
                </div>
              )}
            </div>
          </Section>

          {/* Documents */}
          <Section title={`Dokumente (${order.documents?.length || 0})`}>
            <DocumentDropzone orderId={id} onUploaded={reload} />
            {(order.documents?.length || 0) > 0 && (
              <div className="space-y-1.5 mt-3">
                {order.documents!.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 p-2 border border-gray-100 dark:border-white/8 rounded-md">
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{d.fileName}</div>
                      <div className="text-[10px] text-gray-400">{DOCUMENT_TYPE_LABELS[d.documentType]} · {fmtDate(d.uploadedAt)}</div>
                    </div>
                    <a href={d.fileUrl} target="_blank" rel="noopener" className="p-1 text-gray-400 hover:text-primary-600"><Download className="h-3.5 w-3.5" /></a>
                    <button onClick={async () => { if (confirm('Dokument löschen?')) { await purchasesApi.deleteDocument(d.id); reload(); } }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {paymentForm && <PaymentModal orderId={id} currency={order.currency} openAmount={openNum} onClose={() => setPaymentForm(false)} onSaved={() => { setPaymentForm(false); reload(); }} />}
      {invoiceForm && <InvoiceModal orderId={id} currency={order.currency} totalAmount={Number(order.totalAmount)} documents={order.documents || []} onClose={() => setInvoiceForm(false)} onSaved={() => { setInvoiceForm(false); reload(); }} />}
      {shipmentForm && (
        <ShipmentModal
          orderId={id}
          items={order.items || []}
          existingShipments={order.shipments || []}
          onClose={() => setShipmentForm(false)}
          onSaved={() => { setShipmentForm(false); reload(); }}
        />
      )}
      {markReceivedFor && (
        <MarkReceivedModal
          shipmentId={markReceivedFor}
          onClose={() => setMarkReceivedFor(null)}
          onSaved={() => { setMarkReceivedFor(null); reload(); }}
        />
      )}
    </div>
  );
}

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PaymentModal({ orderId, currency, openAmount, onClose, onSaved }: { orderId: string; currency: string; openAmount: number; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>(openAmount > 0 ? String(openAmount) : '');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null); setWarning(null);
    try {
      const res = await purchasesApi.addPayment(orderId, {
        paymentDate: date, amount: Number(amount), currency, method, reference: reference || null, note: note || null,
      });
      if (res?.warning) {
        setWarning(res.warning);
        setTimeout(onSaved, 1500);
      } else onSaved();
    } catch (e: any) {
      setErr(e.message || 'Fehler');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Zahlung erfassen</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label()}>Datum *</label><input type="date" className={input()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className={label()}>Betrag * ({currency})</label><input type="number" step="0.01" min="0.01" className={input()} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div>
            <label className={label()}>Zahlungsart</label>
            <select className={input()} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className={label()}>Referenz / Transaktionsnr.</label><input className={input()} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <div><label className={label()}>Notiz</label><textarea rows={2} className={input()} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {warning && <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">{warning}</div>}
          {err && <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy || !amount} className={btn('primary')}>{busy ? '…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({ orderId, currency, totalAmount, documents, onClose, onSaved }: { orderId: string; currency: string; totalAmount: number; documents: any[]; onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState(String(totalAmount));
  const [documentId, setDocumentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await purchasesApi.addInvoice(orderId, {
        invoiceNumber: number, invoiceDate: date, dueDate: dueDate || null,
        amount: Number(amount), currency, documentId: documentId || null,
      });
      onSaved();
    } catch (e: any) { setErr(e.message || 'Fehler'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Rechnung erfassen</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className={label()}>Rechnungsnummer *</label><input className={input()} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="RE-12345" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label()}>Rechnungsdatum *</label><input type="date" className={input()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className={label()}>Fälligkeitsdatum</label><input type="date" className={input()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div><label className={label()}>Betrag * ({currency})</label><input type="number" step="0.01" className={input()} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          {documents.length > 0 && (
            <div>
              <label className={label()}>Verknüpftes Dokument</label>
              <select className={input()} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                <option value="">Keine Verknüpfung</option>
                {documents.filter(d => d.documentType === 'invoice' || d.documentType === 'other').map(d => <option key={d.id} value={d.id}>{d.fileName}</option>)}
              </select>
            </div>
          )}
          {err && <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy || !number || !amount} className={btn('primary')}>{busy ? '…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function DocumentDropzone({ orderId, onUploaded }: { orderId: string; onUploaded: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<DocumentType>('invoice');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await purchasesApi.uploadDocument(orderId, f, type);
      }
      onUploaded();
    } catch (e: any) {
      alert(e.message || 'Upload fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <select className={input()} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
        {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${drag ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-white/10 hover:border-primary-300'}`}
      >
        <Upload className="h-5 w-5 mx-auto text-gray-400 mb-1" />
        <span className="text-gray-500">{busy ? 'Lädt …' : 'Dateien hierher ziehen oder klicken'}</span>
        <div className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG (max 25 MB)</div>
        <input ref={inputRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(e) => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}

function ShipmentModal({
  orderId, items, existingShipments, onClose, onSaved,
}: {
  orderId: string;
  items: Array<{ id?: string; productName: string; sku?: string | null; quantity: number | string }>;
  existingShipments: Array<{ items: Array<{ purchaseOrderItemId: string; quantity: string }> }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // Restmengen pro Position berechnen
  const remaining: Record<string, number> = {};
  for (const it of items) {
    if (!it.id) continue;
    remaining[it.id] = Number(it.quantity);
  }
  for (const s of existingShipments) {
    for (const si of s.items) {
      remaining[si.purchaseOrderItemId] = (remaining[si.purchaseOrderItemId] ?? 0) - Number(si.quantity);
    }
  }

  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [shippedAt, setShippedAt] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const q: Record<string, string> = {};
    for (const it of items) {
      if (!it.id) continue;
      q[it.id] = String(Math.max(0, remaining[it.id] || 0));
    }
    return q;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const itemsPayload = items
        .filter(it => it.id && Number(quantities[it.id!] || 0) > 0)
        .map(it => ({
          purchaseOrderItemId: it.id!,
          quantity: Number(quantities[it.id!]),
        }));
      if (itemsPayload.length === 0) {
        setErr('Gib für mindestens eine Position eine Menge > 0 an');
        setBusy(false);
        return;
      }
      await purchasesApi.addShipment(orderId, {
        trackingNumber: trackingNumber.trim() || null,
        carrier: carrier || null,
        shippedAt: shippedAt || null,
        notes: notes.trim() || null,
        items: itemsPayload,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Fehler');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sendung erfassen</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label()}>Sendungsnummer</label>
              <input className={input()} value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="z.B. 1Z999AA10123456784" />
            </div>
            <div>
              <label className={label()}>Speditionsfirma</label>
              <select className={input()} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                <option value="">Bitte wählen …</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label()}>Versanddatum (optional)</label>
              <input type="date" className={input()} value={shippedAt} onChange={(e) => setShippedAt(e.target.value)} />
            </div>
            <div>
              <label className={label()}>Notiz</label>
              <input className={input()} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Teilsendung 1/2" />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Inhalt der Sendung</div>
            <div className="text-xs text-gray-500 mb-3">Gib pro Position die Menge in dieser Sendung an. Vorbelegt mit der Restmenge.</div>
            <div className="border border-gray-100 dark:border-white/8 rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Produkt</th>
                    <th className="px-3 py-2 text-right">Bestellt</th>
                    <th className="px-3 py-2 text-right">Offen</th>
                    <th className="px-3 py-2 text-right">Diese Sendung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((it) => {
                    if (!it.id) return null;
                    const rem = remaining[it.id] ?? 0;
                    return (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <div className="text-gray-900 dark:text-white">{it.productName}</div>
                          {it.sku && <div className="text-xs text-gray-400 font-mono">{it.sku}</div>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">{Number(it.quantity).toLocaleString('de-DE')}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          <span className={rem > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}>{rem.toLocaleString('de-DE')}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max={rem}
                            className={input('w-24 text-right inline-block')}
                            value={quantities[it.id] || ''}
                            onChange={(e) => setQuantities(q => ({ ...q, [it.id!]: e.target.value }))}
                            disabled={rem <= 0}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {err && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy} className={btn('primary')}>{busy ? 'Speichert …' : 'Sendung erfassen'}</button>
        </div>
      </div>
    </div>
  );
}

function MarkReceivedModal({
  shipmentId, onClose, onSaved,
}: {
  shipmentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [receivedAt, setReceivedAt] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await purchasesApi.markShipmentReceived(shipmentId, receivedAt);
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Fehler');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Angekommen markieren</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className={label()}>Ankunftsdatum *</label>
          <input type="date" className={input()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          <p className="text-xs text-gray-500">Kannst du auch rückwirkend eintragen — z.B. laut Lieferschein.</p>
          {err && <div className="text-sm text-red-600 dark:text-red-400">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={submit} disabled={busy || !receivedAt} className={btn('primary')}>{busy ? '…' : 'Bestätigen'}</button>
        </div>
      </div>
    </div>
  );
}
