'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { shippingApi, CARRIER_LABELS } from '@/lib/shipping';
import { btn, input as inputCls, label as lblCls, SectionCard } from '@/components/shipping/ShippingUI';

const FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: 'weightG', label: 'Gewicht (g)' },
  { key: 'totalPriceCents', label: 'Bestellwert (Cent)', hint: 'Gesamt in Cent' },
  { key: 'countryCode', label: 'Land (ISO-2)' },
  { key: 'productVariantId', label: 'Produkt (Variant-ID)' },
  { key: 'tags', label: 'Tag' },
  { key: 'lineCount', label: 'Anzahl Positionen' },
];

const OPS = [
  { key: 'eq', label: '=' },
  { key: 'neq', label: '≠' },
  { key: 'gt', label: '>' },
  { key: 'gte', label: '≥' },
  { key: 'lt', label: '<' },
  { key: 'lte', label: '≤' },
  { key: 'in', label: 'in' },
  { key: 'nin', label: 'nicht in' },
];

interface Props {
  initial?: any;
  onClose: () => void;
  onSaved: () => void;
}

export function RuleBuilder({ initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [priority, setPriority] = useState(initial?.priority ?? 100);
  const [active, setActive] = useState(initial?.active ?? true);
  const [conditions, setConditions] = useState<any[]>(() => {
    const raw = initial?.conditions?.rules || [];
    return raw.map((r: any) => ({ _id: Math.random().toString(36).slice(2), ...r }));
  });
  const [op, setOp] = useState<'and' | 'or'>(initial?.conditions?.op || 'and');
  const [actionType, setActionType] = useState(initial?.actionType || 'select_carrier');
  const [actionCarrier, setActionCarrier] = useState(initial?.actionValue?.carrier || 'dhl');
  const [actionMethod, setActionMethod] = useState(initial?.actionValue?.method || '');
  const [actionReason, setActionReason] = useState(initial?.actionValue?.reason || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addCondition() {
    setConditions((prev) => [...prev, { _id: Math.random().toString(36).slice(2), field: 'weightG', op: 'lte', value: 1000 }]);
  }
  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c._id !== id));
  }
  function updateCondition(id: string, patch: any) {
    setConditions((prev) => prev.map((c) => c._id === id ? { ...c, ...patch } : c));
  }

  async function save() {
    if (!name.trim()) { setErr('Name erforderlich'); return; }
    if (conditions.length === 0) { setErr('Mindestens eine Bedingung'); return; }
    setBusy(true); setErr(null);
    try {
      const payload: any = {
        name: name.trim(),
        description: description || null,
        priority,
        active,
        conditions: {
          op,
          rules: conditions.map((c) => {
            const v = ['weightG', 'totalPriceCents', 'lineCount'].includes(c.field) ? Number(c.value) : c.value;
            return { field: c.field, op: c.op, value: v };
          }),
        },
        actionType,
        actionValue: {
          type: actionType,
          ...(actionType === 'select_carrier' && { carrier: actionCarrier }),
          ...(actionType === 'select_method' && { method: actionMethod }),
          ...(actionType === 'block_shipment' && { reason: actionReason || 'Regel blockiert Versand' }),
        },
      };
      if (initial?.id) await shippingApi.updateRule(initial.id, payload);
      else await shippingApi.createRule(payload);
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{initial?.id ? 'Regel bearbeiten' : 'Neue Versandregel'}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={lblCls()}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} placeholder="z.B. 'Schwere Pakete → DHL Paket'" /></div>
            <div><label className={lblCls()}>Priorität</label><input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={inputCls()} /></div>
            <div className="col-span-3"><label className={lblCls()}>Beschreibung (optional)</label><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls()} /></div>
          </div>

          <SectionCard title="Bedingungen">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Mindestens</span>
              <select value={op} onChange={(e) => setOp(e.target.value as 'and' | 'or')} className={inputCls('w-24')}>
                <option value="and">ALLE</option>
                <option value="or">EINE</option>
              </select>
              <span className="text-xs text-gray-500">Bedingung erfüllt:</span>
            </div>
            <div className="space-y-2">
              {conditions.map((c) => (
                <div key={c._id} className="flex items-center gap-2">
                  <select value={c.field} onChange={(e) => updateCondition(c._id, { field: e.target.value })} className={inputCls('flex-1')}>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select value={c.op} onChange={(e) => updateCondition(c._id, { op: e.target.value })} className={inputCls('w-24')}>
                    {OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <input value={c.value} onChange={(e) => updateCondition(c._id, { value: e.target.value })} className={inputCls('flex-1')} placeholder="Wert" />
                  <button onClick={() => removeCondition(c._id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={addCondition} className={btn('secondary', 'mt-3 h-8 text-xs')}><Plus className="h-3 w-3" /> Bedingung</button>
          </SectionCard>

          <SectionCard title="Aktion">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lblCls()}>Typ</label>
                <select value={actionType} onChange={(e) => setActionType(e.target.value as any)} className={inputCls()}>
                  <option value="select_carrier">Carrier wählen</option>
                  <option value="select_method">Versand-Methode wählen</option>
                  <option value="block_shipment">Versand blockieren</option>
                </select>
              </div>
              {actionType === 'select_carrier' && (
                <div>
                  <label className={lblCls()}>Carrier</label>
                  <select value={actionCarrier} onChange={(e) => setActionCarrier(e.target.value)} className={inputCls()}>
                    {Object.entries(CARRIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              {actionType === 'select_method' && (
                <div>
                  <label className={lblCls()}>Methode</label>
                  <input value={actionMethod} onChange={(e) => setActionMethod(e.target.value)} className={inputCls()} placeholder="z.B. V01PAK" />
                </div>
              )}
              {actionType === 'block_shipment' && (
                <div className="col-span-2">
                  <label className={lblCls()}>Grund</label>
                  <input value={actionReason} onChange={(e) => setActionReason(e.target.value)} className={inputCls()} placeholder="z.B. 'Versand ins Ausland nicht möglich'" />
                </div>
              )}
            </div>
          </SectionCard>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Regel aktiv
          </label>

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
