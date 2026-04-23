'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { salesApi, fmtMoney } from '@/lib/sales';
import { PageHeader, btn } from '@/components/sales/SalesUI';

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([
    { title: '', supplierArticleNumber: '', ean: '', unitsPerCarton: null, quantity: 1, unitPriceNet: 0, lineNet: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    salesApi.listCustomers({ limit: '500' }).then((r) => setCustomers(r.items));
  }, []);

  const total = items.reduce((s, i) => s + (Number(i.lineNet ?? i.quantity * i.unitPriceNet) || 0), 0);

  function updateItem(idx: number, patch: any) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function save() {
    if (!customerId) return alert('Bitte Kunde wählen (oder unter Kunden neu anlegen)');
    setSaving(true);
    try {
      const o = await salesApi.createOrder({
        customerId,
        externalOrderNumber: externalOrderNumber || null,
        orderDate: orderDate || null,
        requiredDeliveryDate: requiredDeliveryDate || null,
        contactPerson: contactPerson || null,
        paymentTerms: paymentTerms || null,
        currency,
        notes: notes || null,
        lineItems: items.map((i, idx) => ({
          position: idx + 1,
          title: i.title || 'Artikel',
          supplierArticleNumber: i.supplierArticleNumber || null,
          ean: i.ean || null,
          unitsPerCarton: i.unitsPerCarton ? Number(i.unitsPerCarton) : null,
          quantity: Number(i.quantity) || 1,
          unitPriceNet: Number(i.unitPriceNet) || 0,
          lineNet: Number(i.lineNet) || (Number(i.quantity) * Number(i.unitPriceNet)),
        })),
      });
      router.push(`/sales/orders/${o.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Neue Bestellung"
        subtitle={<Link href="/sales/orders" className="text-primary-600 hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Zurück</Link>}
        actions={<button onClick={save} disabled={saving} className={btn('primary')}><Save className="h-4 w-4" /> Speichern</button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
        <label className="text-xs sm:col-span-2">
          <div className="text-gray-500 mb-1">Kunde *</div>
          <select className={cls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— wählen —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.customerNumber} — {c.companyName}</option>)}
          </select>
        </label>
        <L label="Externe Bestellnummer"><input className={cls} value={externalOrderNumber} onChange={(e) => setExternalOrderNumber(e.target.value)} /></L>
        <L label="Bestelldatum"><input type="date" className={cls} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></L>
        <L label="Liefertermin"><input type="date" className={cls} value={requiredDeliveryDate} onChange={(e) => setRequiredDeliveryDate(e.target.value)} /></L>
        <L label="Ansprechpartner"><input className={cls} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></L>
        <L label="Zahlungsbedingungen"><input className={cls} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></L>
        <L label="Währung"><input className={cls} value={currency} onChange={(e) => setCurrency(e.target.value)} /></L>
        <L label="Notizen" className="sm:col-span-2"><textarea className={`${cls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} /></L>
      </div>

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Positionen</h3>
          <button onClick={() => setItems([...items, { title: '', supplierArticleNumber: '', ean: '', unitsPerCarton: null, quantity: 1, unitPriceNet: 0, lineNet: 0 }])} className={btn('ghost', 'text-xs')}>
            <Plus className="h-3 w-3" /> Zeile
          </button>
        </div>
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
            {items.map((it, idx) => (
              <tr key={idx} className="border-t border-gray-200/60 dark:border-white/5">
                <td className="py-1 pr-1"><input className={cls} value={it.title} onChange={(e) => updateItem(idx, { title: e.target.value })} /></td>
                <td className="py-1 pr-1"><input className={cls} value={it.supplierArticleNumber ?? ''} onChange={(e) => updateItem(idx, { supplierArticleNumber: e.target.value })} /></td>
                <td className="py-1 pr-1"><input className={cls} value={it.ean ?? ''} onChange={(e) => updateItem(idx, { ean: e.target.value })} /></td>
                <td className="py-1 pr-1"><input type="number" className={cls} value={it.unitsPerCarton ?? ''} onChange={(e) => updateItem(idx, { unitsPerCarton: e.target.value ? Number(e.target.value) : null })} /></td>
                <td className="py-1 pr-1"><input type="number" className={`${cls} text-right`} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></td>
                <td className="py-1 pr-1"><input type="number" step="0.0001" className={`${cls} text-right`} value={it.unitPriceNet} onChange={(e) => updateItem(idx, { unitPriceNet: Number(e.target.value), lineNet: Number(e.target.value) * (Number(it.quantity) || 1) })} /></td>
                <td className="py-1 pr-1"><input type="number" step="0.01" className={`${cls} text-right`} value={it.lineNet} onChange={(e) => updateItem(idx, { lineNet: Number(e.target.value) })} /></td>
                <td className="py-1"><button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 dark:border-white/10">
              <td colSpan={6} className="py-1.5 text-right text-xs font-semibold">Gesamt Netto</td>
              <td className="py-1.5 text-right font-semibold">{fmtMoney(total, currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const cls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs';
function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`text-xs ${className ?? ''}`}><div className="text-gray-500 mb-1">{label}</div>{children}</label>;
}
