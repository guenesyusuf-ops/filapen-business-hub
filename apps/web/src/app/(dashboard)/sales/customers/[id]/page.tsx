'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { salesApi, fmtMoney } from '@/lib/sales';
import { PageHeader, btn } from '@/components/sales/SalesUI';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<any>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([
        salesApi.getCustomer(params.id),
        salesApi.listOrders({ customerId: params.id, limit: '50' }),
      ]);
      setCustomer(c);
      setEdits({
        companyName: c.companyName,
        externalCustomerNumber: c.externalCustomerNumber ?? '',
        contactPerson: c.contactPerson ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        paymentTerms: c.paymentTerms ?? '',
        notes: c.notes ?? '',
      });
      setOrders(o.items);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [params.id]);

  async function save() {
    setSaving(true);
    try { await salesApi.updateCustomer(params.id, edits); await load(); }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`${customer.companyName} löschen? (Geht nur wenn keine Bestellungen existieren.)`)) return;
    try { await salesApi.deleteCustomer(params.id); router.push('/sales/customers'); }
    catch (e: any) { alert(e.message); }
  }

  if (loading) return <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>;
  if (!customer) return <div className="p-12 text-center text-sm text-gray-500">Nicht gefunden</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={customer.companyName}
        subtitle={<>
          <Link href="/sales/customers" className="text-primary-600 hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Zurück</Link>
          <span className="ml-2 text-xs text-gray-500 font-mono">{customer.customerNumber}</span>
        </>}
        actions={<>
          <button onClick={save} disabled={saving} className={btn('primary', 'text-sm')}><Save className="h-3.5 w-3.5" /> Speichern</button>
          <button onClick={remove} className={btn('danger', 'text-sm ml-2')}><Trash2 className="h-3.5 w-3.5" /> Löschen</button>
        </>}
      />

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <L label="Firmenname"><input className={cls} value={edits.companyName} onChange={(e) => setEdits({ ...edits, companyName: e.target.value })} /></L>
          <L label="Externe Kundennummer"><input className={cls} value={edits.externalCustomerNumber} onChange={(e) => setEdits({ ...edits, externalCustomerNumber: e.target.value })} /></L>
          <L label="Ansprechpartner"><input className={cls} value={edits.contactPerson} onChange={(e) => setEdits({ ...edits, contactPerson: e.target.value })} /></L>
          <L label="E-Mail"><input className={cls} value={edits.email} onChange={(e) => setEdits({ ...edits, email: e.target.value })} /></L>
          <L label="Telefon"><input className={cls} value={edits.phone} onChange={(e) => setEdits({ ...edits, phone: e.target.value })} /></L>
          <L label="Zahlungsbedingungen"><input className={cls} value={edits.paymentTerms} onChange={(e) => setEdits({ ...edits, paymentTerms: e.target.value })} /></L>
          <L label="Notizen" className="sm:col-span-2"><textarea className={`${cls} min-h-[60px]`} value={edits.notes} onChange={(e) => setEdits({ ...edits, notes: e.target.value })} /></L>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold mb-3">Bestell-Historie ({orders.length})</h3>
        {orders.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">Noch keine Bestellungen für diesen Kunden.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-gray-500">
              <tr><th className="py-1">Bestellnr.</th><th className="py-1">Datum</th><th className="py-1">Status</th><th className="py-1 text-right">Betrag</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-gray-200/60 dark:border-white/5">
                  <td className="py-1 font-mono"><Link href={`/sales/orders/${o.id}`} className="text-primary-600 hover:underline">{o.orderNumber}</Link></td>
                  <td className="py-1">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="py-1">{o.status}</td>
                  <td className="py-1 text-right">{fmtMoney(o.totalNet, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const cls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs';
function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`text-xs ${className ?? ''}`}><div className="text-gray-500 mb-1">{label}</div>{children}</label>;
}
