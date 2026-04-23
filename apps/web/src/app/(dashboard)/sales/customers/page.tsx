'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users2 } from 'lucide-react';
import { salesApi } from '@/lib/sales';
import { PageHeader, Empty, btn } from '@/components/sales/SalesUI';

export default function SalesCustomersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await salesApi.listCustomers({ search: search || undefined, limit: '200' });
      setItems(res.items);
      setTotal(res.total);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="B2B-Kunden"
        subtitle={`${total} Kunden`}
        actions={
          <button onClick={() => setModalOpen(true)} className={btn('primary')}>
            <Plus className="h-4 w-4" /> Neuer Kunde
          </button>
        }
      />

      <div className="flex gap-2 rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="Firmenname, E-Mail oder Kundennummer"
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-sm"
        />
        <button onClick={load} className={btn('ghost', 'text-sm')}>Suchen</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : items.length === 0 ? (
        <Empty icon={<Users2 className="h-10 w-10" />} title="Keine Kunden" hint="Lege einen neuen Kunden an oder importiere eine Bestellung, dann wird der Kunde automatisch erkannt." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/80 dark:border-white/8 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Kundennr.</th>
                <th className="px-4 py-2">Firma</th>
                <th className="px-4 py-2">Ansprechpartner</th>
                <th className="px-4 py-2">E-Mail</th>
                <th className="px-4 py-2">Telefon</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-gray-200/60 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/sales/customers/${c.id}`} className="text-primary-600 hover:underline">{c.customerNumber}</Link>
                  </td>
                  <td className="px-4 py-2">{c.companyName}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.contactPerson ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.email ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <CustomerModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}

function CustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    companyName: '', externalCustomerNumber: '', easybillCustomerNumber: '',
    contactPerson: '', email: '', phone: '',
    paymentTerms: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.companyName.trim()) return alert('Firmenname erforderlich');
    setSaving(true);
    try {
      await salesApi.createCustomer(form);
      onSaved();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3">Neuer B2B-Kunde</h3>
        <div className="grid gap-2 text-sm">
          <Input label="Firmenname *" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
          <Input label="Externe Kundennummer (wie der Kunde uns kennt)" value={form.externalCustomerNumber} onChange={(v) => setForm({ ...form, externalCustomerNumber: v })} />
          <Input label="easybill-Kundennummer (z.B. 10191) — optional, verhindert doppelte Anlage" value={form.easybillCustomerNumber} onChange={(v) => setForm({ ...form, easybillCustomerNumber: v })} />
          <Input label="Ansprechpartner" value={form.contactPerson} onChange={(v) => setForm({ ...form, contactPerson: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="E-Mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <Input label="Zahlungsbedingungen" value={form.paymentTerms} onChange={(v) => setForm({ ...form, paymentTerms: v })} />
          <label className="text-xs">
            <div className="text-gray-500 mb-1">Notizen</div>
            <textarea className="w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-sm min-h-[60px]"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className={btn('ghost', 'text-sm')}>Abbrechen</button>
          <button onClick={save} disabled={saving} className={btn('primary', 'text-sm')}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      <input className="w-full rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1 text-sm"
        value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
