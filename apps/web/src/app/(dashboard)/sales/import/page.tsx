'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Sparkles, Save, AlertCircle, Plus, X } from 'lucide-react';
import { salesApi, fmtMoney } from '@/lib/sales';
import { PageHeader, btn } from '@/components/sales/SalesUI';

type ImportResult = Awaited<ReturnType<typeof salesApi.importOrder>>;

export default function SalesImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable preview state
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<any>({});
  const [ex, setEx] = useState<any>({ lineItems: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    salesApi.listCustomers({ limit: '500' }).then((r) => setCustomers(r.items));
  }, []);

  async function onFile(f: File | null) {
    if (!f) return;
    setFile(f);
    setImporting(true);
    try {
      const r = await salesApi.importOrder(f);
      setResult(r);
      setEx(r.extracted);
      if (r.matchedCustomerId) {
        setCustomerId(r.matchedCustomerId);
        setCreateNewCustomer(false);
      } else {
        setCreateNewCustomer(true);
        setNewCustomerData({
          companyName: r.extracted?.customer?.companyName ?? '',
          contactPerson: r.extracted?.contactPerson ?? '',
          email: r.extracted?.customer?.email ?? '',
          phone: r.extracted?.customer?.phone ?? '',
          shippingAddress: r.extracted?.shippingAddress,
          billingAddress: r.extracted?.billingAddress,
          paymentTerms: r.extracted?.paymentTerms ?? '',
        });
      }
    } catch (err: any) {
      alert(`Import fehlgeschlagen: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  async function confirm() {
    if (!result) return;
    if (!customerId && !createNewCustomer) return alert('Kunde wählen oder neu anlegen');
    setSaving(true);
    try {
      const order = await salesApi.confirmImport({
        customerId: createNewCustomer ? null : customerId,
        newCustomer: createNewCustomer ? newCustomerData : null,
        extracted: ex,
        confidence: result.confidence,
        sourceDocumentId: result.sourceDocumentId,
      });
      router.push(`/sales/orders/${order.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally { setSaving(false); }
  }

  function updateItem(idx: number, patch: any) {
    setEx({ ...ex, lineItems: ex.lineItems.map((it: any, i: number) => i === idx ? { ...it, ...patch } : it) });
  }

  const confColor = !result ? '' : result.confidence >= 0.85 ? 'text-green-600' : result.confidence >= 0.7 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bestellung importieren"
        subtitle={<Link href="/sales/orders" className="text-primary-600 hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Zurück</Link>}
        actions={result && (
          <button onClick={confirm} disabled={saving} className={btn('primary')}>
            <Save className="h-4 w-4" /> Bestellung anlegen
          </button>
        )}
      />

      {!result && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-white dark:bg-white/[0.03] p-12 text-center"
        >
          <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <div className="text-sm font-medium mb-1">PDF, Bild oder .txt/.eml hier ablegen</div>
          <div className="text-xs text-gray-500 mb-4">Wir lesen die Bestellung automatisch aus (Claude Vision) und zeigen dir eine editierbare Vorschau.</div>
          <input ref={fileInputRef} type="file" accept=".pdf,image/*,.txt,.eml" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileInputRef.current?.click()} className={btn('primary')}>
            <Upload className="h-4 w-4" /> Datei wählen
          </button>
          {file && importing && (
            <div className="mt-4 text-xs text-gray-600 inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Analysiere {file.name} …
            </div>
          )}
        </div>
      )}

      {result && (
        <>
          {/* Confidence + Restart */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
            <div className="text-xs">
              <span className="text-gray-500 mr-2">KI-Zuversicht:</span>
              <span className={`font-semibold ${confColor}`}>{Math.round(result.confidence * 100)}%</span>
              {result.confidence < 0.85 && (
                <span className="ml-2 text-amber-600"><AlertCircle className="inline h-3 w-3 mr-0.5" />Bitte alles prüfen</span>
              )}
            </div>
            <button onClick={() => { setResult(null); setFile(null); setEx({ lineItems: [] }); }} className={btn('ghost', 'text-xs')}>
              Andere Datei wählen
            </button>
          </div>

          {/* Kunden-Zuordnung */}
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold mb-3">Kunde</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" checked={!createNewCustomer} onChange={() => setCreateNewCustomer(false)} />
                Bestehenden Kunden wählen
              </label>
              {!createNewCustomer && (
                <select className={cls + ' ml-6 max-w-md'} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— wählen —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerNumber} — {c.companyName}{result.matchedCustomerId === c.id ? ' ✓ (Auto-Match)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" checked={createNewCustomer} onChange={() => setCreateNewCustomer(true)} />
                Neuen Kunden anlegen
              </label>
              {createNewCustomer && (
                <div className="ml-6 grid gap-2 sm:grid-cols-2 max-w-2xl">
                  <L label="Firmenname *"><input className={cls} value={newCustomerData.companyName ?? ''} onChange={(e) => setNewCustomerData({ ...newCustomerData, companyName: e.target.value })} /></L>
                  <L label="Ansprechpartner"><input className={cls} value={newCustomerData.contactPerson ?? ''} onChange={(e) => setNewCustomerData({ ...newCustomerData, contactPerson: e.target.value })} /></L>
                  <L label="E-Mail"><input className={cls} value={newCustomerData.email ?? ''} onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })} /></L>
                  <L label="Telefon"><input className={cls} value={newCustomerData.phone ?? ''} onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} /></L>
                </div>
              )}
            </div>
          </div>

          {/* Kopfdaten */}
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold mb-3">Kopfdaten</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <L label="Externe Bestellnummer"><input className={cls} value={ex.externalOrderNumber ?? ''} onChange={(e) => setEx({ ...ex, externalOrderNumber: e.target.value })} /></L>
              <L label="Bestelldatum"><input type="date" className={cls} value={ex.orderDate ?? ''} onChange={(e) => setEx({ ...ex, orderDate: e.target.value })} /></L>
              <L label="Liefertermin"><input type="date" className={cls} value={ex.requiredDeliveryDate ?? ''} onChange={(e) => setEx({ ...ex, requiredDeliveryDate: e.target.value })} /></L>
              <L label="Ansprechpartner"><input className={cls} value={ex.contactPerson ?? ''} onChange={(e) => setEx({ ...ex, contactPerson: e.target.value })} /></L>
              <L label="Zahlungsbedingungen"><input className={cls} value={ex.paymentTerms ?? ''} onChange={(e) => setEx({ ...ex, paymentTerms: e.target.value })} /></L>
              <L label="Währung"><input className={cls} value={ex.currency ?? 'EUR'} onChange={(e) => setEx({ ...ex, currency: e.target.value })} /></L>
            </div>
          </div>

          {/* Positionen */}
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Positionen ({ex.lineItems?.length ?? 0})</h3>
              <button onClick={() => setEx({ ...ex, lineItems: [...(ex.lineItems ?? []), { title: '', quantity: 1, unitPriceNet: 0 }] })} className={btn('ghost', 'text-xs')}>
                <Plus className="h-3 w-3" /> Zeile
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="py-1">Artikel</th>
                    <th className="py-1">Art.-Nr.</th>
                    <th className="py-1">EAN</th>
                    <th className="py-1">VKE</th>
                    <th className="py-1 text-right">Menge</th>
                    <th className="py-1 text-right">Einzel-€</th>
                    <th className="py-1 text-right">Netto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(ex.lineItems ?? []).map((li: any, idx: number) => {
                    const match = result.matchedLineItems.find((m) => m.index === idx);
                    return (
                      <tr key={idx} className="border-t border-gray-200/60 dark:border-white/5">
                        <td className="py-1 pr-1">
                          <input className={cls} value={li.title ?? ''} onChange={(e) => updateItem(idx, { title: e.target.value })} />
                          {match && <div className="text-[10px] text-green-600 mt-0.5">✓ Match: {match.sku}</div>}
                        </td>
                        <td className="py-1 pr-1"><input className={cls} value={li.supplierArticleNumber ?? ''} onChange={(e) => updateItem(idx, { supplierArticleNumber: e.target.value })} /></td>
                        <td className="py-1 pr-1"><input className={cls} value={li.ean ?? ''} onChange={(e) => updateItem(idx, { ean: e.target.value })} /></td>
                        <td className="py-1 pr-1"><input type="number" className={cls} value={li.unitsPerCarton ?? ''} onChange={(e) => updateItem(idx, { unitsPerCarton: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td className="py-1 pr-1"><input type="number" className={`${cls} text-right`} value={li.quantity ?? 1} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></td>
                        <td className="py-1 pr-1"><input type="number" step="0.0001" className={`${cls} text-right`} value={li.unitPriceNet ?? 0} onChange={(e) => updateItem(idx, { unitPriceNet: Number(e.target.value) })} /></td>
                        <td className="py-1 pr-1"><input type="number" step="0.01" className={`${cls} text-right`} value={li.lineNet ?? (li.quantity * li.unitPriceNet)} onChange={(e) => updateItem(idx, { lineNet: Number(e.target.value) })} /></td>
                        <td className="py-1"><button onClick={() => setEx({ ...ex, lineItems: ex.lineItems.filter((_: any, i: number) => i !== idx) })} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-white/10">
                    <td colSpan={6} className="py-1.5 text-right font-semibold">Gesamt Netto</td>
                    <td className="py-1.5 text-right font-semibold">
                      {fmtMoney(
                        (ex.lineItems ?? []).reduce((s: number, l: any) => s + (Number(l.lineNet ?? (l.quantity * l.unitPriceNet)) || 0), 0),
                        ex.currency ?? 'EUR',
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const cls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs';
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs"><div className="text-gray-500 mb-1">{label}</div>{children}</label>;
}
