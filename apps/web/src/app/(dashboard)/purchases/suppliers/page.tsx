'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Truck, Mail, Phone, Trash2, Pencil, X } from 'lucide-react';
import { purchasesApi, type Supplier, fmtMoney } from '@/lib/purchases';
import { Badge, btn, input, label, PageHeader, Empty } from '@/components/purchases/PurchaseUI';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');

  const load = () => {
    setLoading(true);
    purchasesApi.listSuppliers({ search: search || undefined, status: statusFilter || undefined })
      .then(setSuppliers)
      .finally(() => setLoading(false));
  };

  useEffect(load, [search, statusFilter]);

  const onDelete = async (s: Supplier) => {
    if (!confirm(`Lieferant ${s.companyName} wirklich löschen?`)) return;
    try {
      await purchasesApi.deleteSupplier(s.id);
      load();
    } catch (e: any) {
      alert(e.message || 'Konnte nicht gelöscht werden');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lieferanten"
        subtitle={`${suppliers.length} ${statusFilter === 'inactive' ? 'inaktive' : ''}`}
        actions={
          <button onClick={() => setCreating(true)} className={btn('primary')}>
            <Plus className="h-4 w-4" /> Neuer Lieferant
          </button>
        }
      />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Firma, Ansprechpartner, E-Mail …" className={input('pl-9')} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={input('w-auto')}>
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : suppliers.length === 0 ? (
          <Empty
            icon={<Truck className="h-10 w-10" />}
            title="Noch keine Lieferanten"
            hint="Lege deinen ersten Lieferanten an, um Bestellungen zu erfassen."
            action={<button onClick={() => setCreating(true)} className={btn('primary')}><Plus className="h-4 w-4" /> Neuer Lieferant</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-left">Lieferantennr.</th>
                  <th className="px-3 py-2.5 text-left">Firma</th>
                  <th className="px-3 py-2.5 text-left">Ansprechpartner</th>
                  <th className="px-3 py-2.5 text-left">Kontakt</th>
                  <th className="px-3 py-2.5 text-left">Land</th>
                  <th className="px-3 py-2.5 text-right">Bestellungen</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{s.supplierNumber}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{s.companyName}</div>
                      {s.vatId && <div className="text-xs text-gray-400">{s.vatId}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.contactName}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><Mail className="h-3 w-3 text-gray-400" />{s.email}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="h-3 w-3 text-gray-400" />{s.phone}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 uppercase">{s.country || '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{s._count?.purchaseOrders ?? 0}</td>
                    <td className="px-3 py-3">
                      <Badge color={s.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}>
                        {s.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setEditing(s)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => onDelete(s)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <SupplierModal
          supplier={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Supplier>>(supplier || {
    companyName: '', contactName: '', email: '', phone: '',
    defaultCurrency: 'EUR', country: 'DE', paymentTermDays: 30, status: 'active',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof Supplier, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (supplier) await purchasesApi.updateSupplier(supplier.id, form);
      else await purchasesApi.createSupplier(form);
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {supplier ? `Lieferant bearbeiten: ${supplier.companyName}` : 'Neuer Lieferant'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <Section title="Kontakt">
            <Field label="Firmenname *"><input className={input()} value={form.companyName || ''} onChange={(e) => set('companyName', e.target.value)} required /></Field>
            <Field label="Ansprechpartner *"><input className={input()} value={form.contactName || ''} onChange={(e) => set('contactName', e.target.value)} required /></Field>
            <Field label="E-Mail *"><input type="email" className={input()} value={form.email || ''} onChange={(e) => set('email', e.target.value)} required /></Field>
            <Field label="Telefon *"><input className={input()} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} required /></Field>
          </Section>
          <Section title="Adresse">
            <Field label="Straße / Hausnummer" colSpan={2}><input className={input()} value={form.street || ''} onChange={(e) => set('street', e.target.value)} /></Field>
            <Field label="PLZ"><input className={input()} value={form.zipCode || ''} onChange={(e) => set('zipCode', e.target.value)} /></Field>
            <Field label="Ort"><input className={input()} value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="Land (ISO 2)"><input maxLength={2} className={input('uppercase')} value={form.country || ''} onChange={(e) => set('country', e.target.value.toUpperCase())} /></Field>
          </Section>
          <Section title="Steuer & Zahlung">
            <Field label="USt-ID"><input className={input()} value={form.vatId || ''} onChange={(e) => set('vatId', e.target.value)} placeholder="DE123456789" /></Field>
            <Field label="Steuernummer"><input className={input()} value={form.taxNumber || ''} onChange={(e) => set('taxNumber', e.target.value)} /></Field>
            <Field label="Standardwährung">
              <select className={input()} value={form.defaultCurrency || 'EUR'} onChange={(e) => set('defaultCurrency', e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Zahlungsziel (Tage)"><input type="number" min={0} className={input()} value={form.paymentTermDays ?? 30} onChange={(e) => set('paymentTermDays', Number(e.target.value))} /></Field>
          </Section>
          <Section title="Bankverbindung">
            <Field label="IBAN" colSpan={2}><input className={input()} value={form.iban || ''} onChange={(e) => set('iban', e.target.value)} /></Field>
            <Field label="BIC"><input className={input()} value={form.bic || ''} onChange={(e) => set('bic', e.target.value)} /></Field>
            <Field label="Bank"><input className={input()} value={form.bankName || ''} onChange={(e) => set('bankName', e.target.value)} /></Field>
          </Section>
          <Section title="Sonstiges">
            <Field label="Status">
              <select className={input()} value={form.status || 'active'} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </Field>
            <Field label="Notizen" colSpan={4}>
              <textarea rows={2} className={input()} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </Section>
          {err && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{err}</div>}
        </form>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button type="button" onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button type="button" disabled={busy} onClick={submit} className={btn('primary')}>{busy ? 'Speichert …' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function Field({ label: lbl, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : colSpan === 4 ? 'col-span-2 md:col-span-4' : ''}>
      <label className={label()}>{lbl}</label>
      {children}
    </div>
  );
}
