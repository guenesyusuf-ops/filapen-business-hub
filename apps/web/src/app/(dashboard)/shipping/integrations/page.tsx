'use client';

import { useEffect, useState } from 'react';
import { Plug, Truck, Plus, Pencil, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { shippingApi, CARRIER_LABELS, type ShippingCarrier } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, label as labelCls, Badge, SectionCard } from '@/components/shipping/ShippingUI';

export default function ShippingIntegrationsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; account?: any } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([shippingApi.listCarrierAccounts(), shippingApi.listCarriers()])
      .then(([a, c]) => { setAccounts(a); setCarriers(c); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onDelete = async (a: any) => {
    if (!confirm(`"${a.accountName}" löschen?`)) return;
    await shippingApi.deleteCarrierAccount(a.id);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Integrationen"
        subtitle="Carrier-Konten verwalten. DHL API kann später ohne Code-Änderung aktiviert werden."
        actions={<button onClick={() => setModal({ mode: 'create' })} className={btn('primary')}><Plus className="h-4 w-4" /> Konto hinzufügen</button>}
      />

      <SectionCard title="Marktplätze" description="Order-Import-Quellen">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'Shopify', status: 'Aktiv', desc: 'Orders, Products, Customers synchronisiert. Webhooks aktiv.', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
            { name: 'Amazon', status: 'Read-only', desc: 'Dashboard-Daten vorhanden, Fulfillment in Vorbereitung.', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
            { name: 'Kaufland', status: 'Placeholder', desc: 'Integration folgt nach DHL-Produktivstart.', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
            { name: 'TikTok Shop', status: 'Placeholder', desc: 'Integration folgt nach DHL-Produktivstart.', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
          ].map((c) => (
            <div key={c.name} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                <Badge color={c.color}>{c.status}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Carrier-Konten" description="Versand-Accounts (DHL, UPS, DPD, Hermes, GLS, Manuell)">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Lädt …</div>
        ) : accounts.length === 0 ? (
          <Empty
            icon={<Plug className="h-10 w-10" />}
            title="Noch kein Carrier-Konto"
            hint="Lege mindestens ein Konto an (z.B. DHL). Credentials können leer bleiben — Stub-Modus erstellt dann manuelle Labels, die du später mit echter Tracking-Nummer erweiterst."
            action={<button onClick={() => setModal({ mode: 'create' })} className={btn('primary')}><Plus className="h-4 w-4" /> Konto hinzufügen</button>}
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-white/8 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{a.accountName}</div>
                    <div className="text-xs text-gray-500">{CARRIER_LABELS[a.carrier as ShippingCarrier]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.isDefault && <Badge color="bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">Standard</Badge>}
                  {a.apiReady ? (
                    <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle2 className="h-3 w-3 inline mr-1" /> API aktiv</Badge>
                  ) : (
                    <Badge color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><AlertCircle className="h-3 w-3 inline mr-1" /> Stub-Modus</Badge>
                  )}
                  <button onClick={() => setModal({ mode: 'edit', account: a })} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onDelete(a)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {modal && (
        <CarrierAccountModal
          carriers={carriers}
          mode={modal.mode}
          account={modal.account}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function CarrierAccountModal({ carriers, mode, account, onClose, onSaved }: {
  carriers: any[]; mode: 'create' | 'edit'; account?: any; onClose: () => void; onSaved: () => void;
}) {
  const [carrier, setCarrier] = useState(account?.carrier || 'dhl');
  const [accountName, setAccountName] = useState(account?.accountName || '');
  const [isDefault, setIsDefault] = useState(account?.isDefault || false);
  const [notes, setNotes] = useState(account?.notes || '');

  // Credentials (DHL specific + generic)
  const [billingNumber, setBillingNumber] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Sender
  const [senderName, setSenderName] = useState(account?.senderData?.name || '');
  const [senderStreet, setSenderStreet] = useState(account?.senderData?.address?.street || '');
  const [senderZip, setSenderZip] = useState(account?.senderData?.address?.zip || '');
  const [senderCity, setSenderCity] = useState(account?.senderData?.address?.city || '');
  const [senderCountry, setSenderCountry] = useState(account?.senderData?.address?.country || 'DE');
  const [senderEmail, setSenderEmail] = useState(account?.senderData?.email || '');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!accountName.trim()) { setErr('Kontoname fehlt'); return; }
    setBusy(true); setErr(null);
    try {
      const credentials: any = {};
      if (carrier === 'dhl') {
        if (billingNumber) credentials.billingNumber = billingNumber.trim();
        if (apiKey) credentials.apiKey = apiKey.trim();
        if (username) credentials.username = username.trim();
        if (password) credentials.password = password;
      }
      const senderData = senderStreet && senderCity && senderZip ? {
        name: senderName || 'Filapen',
        email: senderEmail || undefined,
        address: {
          street: senderStreet.trim(),
          zip: senderZip.trim(),
          city: senderCity.trim(),
          country: (senderCountry || 'DE').toUpperCase().slice(0, 2),
        },
      } : undefined;
      const body = {
        carrier,
        accountName: accountName.trim(),
        isDefault,
        notes: notes || null,
        credentials: Object.keys(credentials).length ? credentials : undefined,
        senderData,
      };
      if (mode === 'create') await shippingApi.createCarrierAccount(body);
      else await shippingApi.updateCarrierAccount(account.id, body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{mode === 'create' ? 'Neues Carrier-Konto' : 'Konto bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls()}>Carrier</label>
              <select disabled={mode === 'edit'} value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls()}>
                {carriers.map((c) => <option key={c.key} value={c.key}>{c.humanName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls()}>Kontoname</label>
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputCls()} placeholder="z.B. DHL Hauptkonto" />
            </div>
          </div>

          {carrier === 'dhl' && (
            <SectionCard title="DHL Business API">
              <p className="text-xs text-gray-500 mb-3">
                Sobald du DHL API-Zugang beantragt hast, trage die Daten hier ein. Ohne: das System funktioniert im Stub-Modus.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls()}>EKP-Nr / Billing-Nr</label><input value={billingNumber} onChange={(e) => setBillingNumber(e.target.value)} className={inputCls()} placeholder="1234567890" /></div>
                <div><label className={labelCls()}>API-Key</label><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls()} /></div>
                <div><label className={labelCls()}>Username</label><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls()} /></div>
                <div><label className={labelCls()}>Passwort</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} placeholder={mode === 'edit' ? '(unverändert lassen = nicht ändern)' : ''} /></div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Absender-Adresse (für Labels)">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls()}>Firma/Name</label><input value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputCls()} /></div>
              <div className="col-span-2"><label className={labelCls()}>Straße + Hausnummer</label><input value={senderStreet} onChange={(e) => setSenderStreet(e.target.value)} className={inputCls()} /></div>
              <div><label className={labelCls()}>PLZ</label><input value={senderZip} onChange={(e) => setSenderZip(e.target.value)} className={inputCls()} /></div>
              <div><label className={labelCls()}>Ort</label><input value={senderCity} onChange={(e) => setSenderCity(e.target.value)} className={inputCls()} /></div>
              <div><label className={labelCls()}>Land (ISO-2)</label><input maxLength={2} value={senderCountry} onChange={(e) => setSenderCountry(e.target.value.toUpperCase())} className={inputCls('uppercase')} /></div>
              <div><label className={labelCls()}>Email</label><input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className={inputCls()} /></div>
            </div>
          </SectionCard>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Als Standard-Konto für {CARRIER_LABELS[carrier as ShippingCarrier]} setzen
          </label>

          <div>
            <label className={labelCls()}>Notizen</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
          </div>

          {err && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className={btn('ghost')}>Abbrechen</button>
          <button onClick={save} disabled={busy} className={btn('primary')}>{busy ? '…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}
