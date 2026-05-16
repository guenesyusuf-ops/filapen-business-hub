'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Settings2, Building2, History } from 'lucide-react';
import { salesApi, fmtMoney } from '@/lib/sales';
import { PageHeader, btn } from '@/components/sales/SalesUI';
import { CustomerProductPrices } from './CustomerProductPrices';

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
        easybillCustomerNumber: c.easybillCustomerNumber ?? '',
        contactPerson: c.contactPerson ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        paymentTerms: c.paymentTerms ?? '',
        notes: c.notes ?? '',
        minOrderQuantity: c.minOrderQuantity != null ? String(c.minOrderQuantity) : '',
        minOrderValue: c.minOrderValue != null ? String(c.minOrderValue) : '',
        discountPercent: c.discountPercent != null ? String(c.discountPercent) : '',
        shippingTerms: c.shippingTerms ?? '',
      });
      setOrders(o.items);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [params.id]);

  async function save() {
    setSaving(true);
    try {
      await salesApi.updateCustomer(params.id, {
        ...edits,
        minOrderQuantity: edits.minOrderQuantity.trim() ? Number(edits.minOrderQuantity) : null,
        minOrderValue: edits.minOrderValue.trim() ? Number(edits.minOrderValue) : null,
        discountPercent: edits.discountPercent.trim() ? Number(edits.discountPercent) : null,
      });
      await load();
    }
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

      {/* Stammdaten */}
      <ColorCard title="Stammdaten" icon={<Building2 className="h-3.5 w-3.5" />} accent="primary">
        <div className="grid gap-2 sm:grid-cols-2">
          <L label="Firmenname"><input className={cls} value={edits.companyName} onChange={(e) => setEdits({ ...edits, companyName: e.target.value })} /></L>
          <L label="Externe Kundennummer"><input className={cls} value={edits.externalCustomerNumber} onChange={(e) => setEdits({ ...edits, externalCustomerNumber: e.target.value })} /></L>
          <L label="easybill-Kundennummer (z.B. 10191)"><input className={cls} value={edits.easybillCustomerNumber} onChange={(e) => setEdits({ ...edits, easybillCustomerNumber: e.target.value })} placeholder="leer lassen für Neuanlage" /></L>
          <L label="Ansprechpartner"><input className={cls} value={edits.contactPerson} onChange={(e) => setEdits({ ...edits, contactPerson: e.target.value })} /></L>
          <L label="E-Mail"><input className={cls} value={edits.email} onChange={(e) => setEdits({ ...edits, email: e.target.value })} /></L>
          <L label="Telefon"><input className={cls} value={edits.phone} onChange={(e) => setEdits({ ...edits, phone: e.target.value })} /></L>
          <L label="Notizen" className="sm:col-span-2"><textarea className={`${cls} min-h-[60px]`} value={edits.notes} onChange={(e) => setEdits({ ...edits, notes: e.target.value })} /></L>
        </div>
      </ColorCard>

      {/* Konditionen */}
      <ColorCard title="Konditionen" icon={<Settings2 className="h-3.5 w-3.5" />} accent="emerald">
        <div className="grid gap-2 sm:grid-cols-2">
          <L label="Zahlungsziel">
            <input className={cls} value={edits.paymentTerms} onChange={(e) => setEdits({ ...edits, paymentTerms: e.target.value })} placeholder="z.B. Netto 30 Tage" />
          </L>
          <L label="Mindestbestellmenge (Stueck)">
            <input type="number" min="0" step="1" className={cls} value={edits.minOrderQuantity} onChange={(e) => setEdits({ ...edits, minOrderQuantity: e.target.value })} placeholder="z.B. 12" />
          </L>
          <L label="Mindestbestellwert (€)">
            <input type="number" min="0" step="0.01" className={cls} value={edits.minOrderValue} onChange={(e) => setEdits({ ...edits, minOrderValue: e.target.value })} placeholder="z.B. 250" />
          </L>
          <L label="Rabatt (%)">
            <input type="number" min="0" max="100" step="0.1" className={cls} value={edits.discountPercent} onChange={(e) => setEdits({ ...edits, discountPercent: e.target.value })} placeholder="z.B. 5" />
          </L>
          <L label="Lieferbedingungen" className="sm:col-span-2">
            <input className={cls} value={edits.shippingTerms} onChange={(e) => setEdits({ ...edits, shippingTerms: e.target.value })} placeholder="z.B. frei Haus DE, EXW Werk Pforzheim …" />
          </L>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          Aenderungen werden beim Klick auf "Speichern" oben uebernommen.
        </p>
      </ColorCard>

      {/* Produkt-Sonderpreise — eigener API-Call, eigene Save-Logik */}
      <CustomerProductPrices customerId={params.id} />

      {/* Bestell-Historie */}
      <ColorCard title={`Bestell-Historie (${orders.length})`} icon={<History className="h-3.5 w-3.5" />} accent="sky">
        {orders.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">Noch keine Bestellungen für diesen Kunden.</div>
        ) : (
          <div className="table-scroll overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
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
          </div>
        )}
      </ColorCard>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Akzent-Card (gleicher Stil wie Order-Detail-Sections)
// -----------------------------------------------------------------------------
type Accent = 'primary' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose' | 'none';
const ACCENT: Record<Accent, { border: string; bg: string; iconWrap: string; iconColor: string; titleColor: string }> = {
  primary: { border: 'border-primary-200/60 dark:border-primary-500/20', bg: 'bg-gradient-to-br from-primary-50/40 to-white dark:from-primary-900/10 dark:to-white/[0.03]', iconWrap: 'bg-primary-100 dark:bg-primary-900/40', iconColor: 'text-primary-700 dark:text-primary-300', titleColor: 'text-primary-900 dark:text-primary-100' },
  emerald: { border: 'border-emerald-200/60 dark:border-emerald-500/20', bg: 'bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-900/10 dark:to-white/[0.03]', iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-700 dark:text-emerald-300', titleColor: 'text-emerald-900 dark:text-emerald-100' },
  amber: { border: 'border-amber-200/60 dark:border-amber-500/20', bg: 'bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-900/10 dark:to-white/[0.03]', iconWrap: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-700 dark:text-amber-300', titleColor: 'text-amber-900 dark:text-amber-100' },
  sky: { border: 'border-sky-200/60 dark:border-sky-500/20', bg: 'bg-gradient-to-br from-sky-50/40 to-white dark:from-sky-900/10 dark:to-white/[0.03]', iconWrap: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-700 dark:text-sky-300', titleColor: 'text-sky-900 dark:text-sky-100' },
  violet: { border: 'border-violet-200/60 dark:border-violet-500/20', bg: 'bg-gradient-to-br from-violet-50/40 to-white dark:from-violet-900/10 dark:to-white/[0.03]', iconWrap: 'bg-violet-100 dark:bg-violet-900/40', iconColor: 'text-violet-700 dark:text-violet-300', titleColor: 'text-violet-900 dark:text-violet-100' },
  rose: { border: 'border-rose-200/60 dark:border-rose-500/20', bg: 'bg-gradient-to-br from-rose-50/40 to-white dark:from-rose-900/10 dark:to-white/[0.03]', iconWrap: 'bg-rose-100 dark:bg-rose-900/40', iconColor: 'text-rose-700 dark:text-rose-300', titleColor: 'text-rose-900 dark:text-rose-100' },
  none: { border: 'border-gray-200/80 dark:border-white/8', bg: 'bg-white dark:bg-white/[0.03]', iconWrap: 'bg-gray-100 dark:bg-white/5', iconColor: 'text-gray-600 dark:text-gray-300', titleColor: 'text-gray-900 dark:text-white' },
};

function ColorCard({
  title, icon, accent = 'none', children,
}: { title: string; icon?: React.ReactNode; accent?: Accent; children: React.ReactNode }) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} p-4 shadow-sm`}>
      <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${a.titleColor}`}>
        {icon && (
          <span className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${a.iconWrap} ${a.iconColor}`}>
            {icon}
          </span>
        )}
        {title}
      </h3>
      {children}
    </div>
  );
}

const cls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs';
function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`text-xs block ${className ?? ''}`}><div className="text-gray-500 mb-1">{label}</div>{children}</label>;
}
