'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X, User, FileText, MapPin, Receipt, Truck, Package, Calculator } from 'lucide-react';
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

  // Rechnungs- + Lieferadresse (free-form, multi-line)
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);

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
      // Adressen als JSON-Wrapper { text: "..." } — die Bestehende Schema-
      // Logik akzeptiert beliebige JSON-Formen (KI-Import setzt z.B.
      // strukturierte Objekte mit street/city/zip). Unser manueller
      // Eingabepfad nutzt die einfachste Form, ein Free-Form-Text.
      const billingJson = billingAddress.trim() ? { text: billingAddress.trim() } : null;
      const shippingRaw = sameAsBilling ? billingAddress : shippingAddress;
      const shippingJson = shippingRaw.trim() ? { text: shippingRaw.trim() } : null;

      const o = await salesApi.createOrder({
        customerId,
        externalOrderNumber: externalOrderNumber || null,
        orderDate: orderDate || null,
        requiredDeliveryDate: requiredDeliveryDate || null,
        contactPerson: contactPerson || null,
        paymentTerms: paymentTerms || null,
        currency,
        notes: notes || null,
        billingAddress: billingJson,
        shippingAddress: shippingJson,
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
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title="Neue Bestellung"
        subtitle={<Link href="/sales/orders" className="text-primary-600 hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Zurück</Link>}
        actions={<button onClick={save} disabled={saving} className={btn('primary')}><Save className="h-4 w-4" /> Speichern</button>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: Kunde + Konditionen + Adressen */}
        <div className="lg:col-span-1 space-y-4">
          {/* 1 — Kunde */}
          <ColorCard title="1. Kunde" icon={<User className="h-4 w-4" />} accent="primary">
            <L label="Kunde *">
              <select className={cls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— wählen —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerNumber} — {c.companyName}</option>)}
              </select>
            </L>
            <L label="Ansprechpartner" className="mt-2">
              <input className={cls} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </L>
          </ColorCard>

          {/* 2 — Konditionen */}
          <ColorCard title="2. Konditionen" icon={<FileText className="h-4 w-4" />} accent="sky">
            <div className="grid grid-cols-2 gap-2">
              <L label="Externe Bestellnr." className="col-span-2">
                <input className={cls} value={externalOrderNumber} onChange={(e) => setExternalOrderNumber(e.target.value)} />
              </L>
              <L label="Bestelldatum"><input type="date" className={cls} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></L>
              <L label="Liefertermin"><input type="date" className={cls} value={requiredDeliveryDate} onChange={(e) => setRequiredDeliveryDate(e.target.value)} /></L>
              <L label="Zahlungsbedingungen" className="col-span-2"><input className={cls} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></L>
              <L label="Währung"><input className={cls} value={currency} onChange={(e) => setCurrency(e.target.value)} /></L>
            </div>
            <L label="Notizen" className="mt-2">
              <textarea className={`${cls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </L>
          </ColorCard>

          {/* 3 — Adressen */}
          <ColorCard title="3. Adressen" icon={<MapPin className="h-4 w-4" />} accent="violet">
            <div className="space-y-3">
              <L label={<span className="inline-flex items-center gap-1.5"><Receipt className="h-3 w-3" /> Rechnungsadresse</span>}>
                <textarea
                  rows={4}
                  className={`${cls} min-h-[80px]`}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Firma\nStrasse\nPLZ Ort\nLand"
                />
              </L>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                Lieferadresse identisch
              </label>
              {!sameAsBilling && (
                <L label={<span className="inline-flex items-center gap-1.5"><Truck className="h-3 w-3" /> Lieferadresse</span>}>
                  <textarea
                    rows={4}
                    className={`${cls} min-h-[80px]`}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Falls abweichend"
                  />
                </L>
              )}
            </div>
          </ColorCard>
        </div>

        {/* RIGHT: Positionen + Übersicht */}
        <div className="lg:col-span-2 space-y-4">
          <ColorCard
            title="4. Positionen"
            icon={<Package className="h-4 w-4" />}
            accent="emerald"
            actions={
              <button onClick={() => setItems([...items, { title: '', supplierArticleNumber: '', ean: '', unitsPerCarton: null, quantity: 1, unitPriceNet: 0, lineNet: 0 }])} className={btn('ghost', 'text-xs')}>
                <Plus className="h-3 w-3" /> Zeile
              </button>
            }
          >
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
            </table>
          </ColorCard>

          <ColorCard title="Übersicht" icon={<Calculator className="h-4 w-4" />} accent="rose">
            <div className="flex items-center justify-end gap-4 text-sm">
              <span className="text-gray-500">Gesamt Netto</span>
              <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{fmtMoney(total, currency)}</span>
            </div>
          </ColorCard>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Farbige Card — schoenes Akzent pro Bereich, an Tailwind-Theme angelehnt
// -----------------------------------------------------------------------------

type CardAccent = 'primary' | 'emerald' | 'amber' | 'violet' | 'sky' | 'rose' | 'none';

const ACCENT_STYLES: Record<CardAccent, { border: string; bg: string; iconWrap: string; iconColor: string; titleColor: string }> = {
  primary: { border: 'border-primary-200/60 dark:border-primary-500/20', bg: 'bg-gradient-to-br from-primary-50/40 to-white dark:from-primary-900/10 dark:to-white/[0.03]', iconWrap: 'bg-primary-100 dark:bg-primary-900/40', iconColor: 'text-primary-700 dark:text-primary-300', titleColor: 'text-primary-900 dark:text-primary-100' },
  emerald: { border: 'border-emerald-200/60 dark:border-emerald-500/20', bg: 'bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-900/10 dark:to-white/[0.03]', iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-700 dark:text-emerald-300', titleColor: 'text-emerald-900 dark:text-emerald-100' },
  amber: { border: 'border-amber-200/60 dark:border-amber-500/20', bg: 'bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-900/10 dark:to-white/[0.03]', iconWrap: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-700 dark:text-amber-300', titleColor: 'text-amber-900 dark:text-amber-100' },
  violet: { border: 'border-violet-200/60 dark:border-violet-500/20', bg: 'bg-gradient-to-br from-violet-50/40 to-white dark:from-violet-900/10 dark:to-white/[0.03]', iconWrap: 'bg-violet-100 dark:bg-violet-900/40', iconColor: 'text-violet-700 dark:text-violet-300', titleColor: 'text-violet-900 dark:text-violet-100' },
  sky: { border: 'border-sky-200/60 dark:border-sky-500/20', bg: 'bg-gradient-to-br from-sky-50/40 to-white dark:from-sky-900/10 dark:to-white/[0.03]', iconWrap: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-700 dark:text-sky-300', titleColor: 'text-sky-900 dark:text-sky-100' },
  rose: { border: 'border-rose-200/60 dark:border-rose-500/20', bg: 'bg-gradient-to-br from-rose-50/40 to-white dark:from-rose-900/10 dark:to-white/[0.03]', iconWrap: 'bg-rose-100 dark:bg-rose-900/40', iconColor: 'text-rose-700 dark:text-rose-300', titleColor: 'text-rose-900 dark:text-rose-100' },
  none: { border: 'border-gray-200/80 dark:border-white/8', bg: 'bg-white dark:bg-white/[0.03]', iconWrap: 'bg-gray-100 dark:bg-white/5', iconColor: 'text-gray-600 dark:text-gray-300', titleColor: 'text-gray-900 dark:text-white' },
};

function ColorCard({
  title, icon, actions, children, accent = 'none',
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  accent?: CardAccent;
}) {
  const a = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100/70 dark:border-white/8">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${a.titleColor}`}>
          {icon && (
            <span className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${a.iconWrap} ${a.iconColor}`}>
              {icon}
            </span>
          )}
          {title}
        </h3>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const cls = 'w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-xs';

function L({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <label className={`text-xs block ${className ?? ''}`}><div className="text-gray-500 mb-1">{label}</div>{children}</label>;
}
