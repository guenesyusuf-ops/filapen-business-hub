'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { emailApi } from '@/lib/email-marketing';
import { btn, input, label as lbl } from '@/components/purchases/PurchaseUI';

const CONTACT_FIELDS: Array<{ value: string; label: string; kind: 'text' | 'number' | 'date' | 'array' | 'enum' }> = [
  { value: 'email', label: 'Email', kind: 'text' },
  { value: 'firstName', label: 'Vorname', kind: 'text' },
  { value: 'lastName', label: 'Nachname', kind: 'text' },
  { value: 'country', label: 'Land', kind: 'text' },
  { value: 'city', label: 'Stadt', kind: 'text' },
  { value: 'tags', label: 'Tags', kind: 'array' },
  { value: 'marketingConsent', label: 'Consent-Status', kind: 'enum' },
  { value: 'totalSpent', label: 'Gesamt-Umsatz', kind: 'number' },
  { value: 'ordersCount', label: 'Anzahl Bestellungen', kind: 'number' },
  { value: 'avgOrderValue', label: 'Ø Warenkorb', kind: 'number' },
  { value: 'firstOrderAt', label: 'Erste Bestellung', kind: 'date' },
  { value: 'lastOrderAt', label: 'Letzte Bestellung', kind: 'date' },
  { value: 'lastSeenAt', label: 'Zuletzt gesehen', kind: 'date' },
  { value: 'createdAt', label: 'Als Kontakt angelegt', kind: 'date' },
];

const EVENT_TYPES = [
  { value: 'order_placed', label: 'Bestellung aufgegeben' },
  { value: 'checkout_started', label: 'Checkout begonnen' },
  { value: 'viewed_product', label: 'Produkt angesehen' },
  { value: 'added_to_cart', label: 'In den Warenkorb gelegt' },
  { value: 'email_opened', label: 'Email geöffnet' },
  { value: 'email_clicked', label: 'Email geklickt' },
  { value: 'customer_created', label: 'Kunde erstellt' },
];

const OPS_BY_KIND: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: 'eq', label: 'ist' }, { value: 'neq', label: 'ist nicht' },
    { value: 'contains', label: 'enthält' }, { value: 'starts_with', label: 'beginnt mit' },
    { value: 'is_set', label: 'ist gesetzt' }, { value: 'is_not_set', label: 'ist leer' },
  ],
  number: [
    { value: 'eq', label: '=' }, { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
  ],
  date: [
    { value: 'within_days', label: 'in den letzten N Tagen' },
    { value: 'before_days', label: 'vor mehr als N Tagen' },
    { value: 'is_set', label: 'ist gesetzt' }, { value: 'is_not_set', label: 'ist leer' },
  ],
  array: [
    { value: 'includes', label: 'enthält' },
    { value: 'excludes', label: 'enthält nicht' },
  ],
  enum: [
    { value: 'eq', label: 'ist' }, { value: 'neq', label: 'ist nicht' },
    { value: 'in', label: 'ist einer von' },
  ],
};

type RuleType = 'property' | 'event';
interface PropertyRuleForm { _id: string; type: 'property'; field: string; op: string; value: string; }
interface EventRuleForm { _id: string; type: 'event'; event: string; op: string; count: number; withinDays: number; }
type RuleForm = PropertyRuleForm | EventRuleForm;

interface Props {
  initial?: { name: string; description?: string | null; rules: any };
  onCancel: () => void;
  onSaved: (seg: any) => void;
  existingId?: string;
}

export function SegmentBuilder({ initial, onCancel, onSaved, existingId }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [op, setOp] = useState<'and' | 'or'>(initial?.rules?.op || 'and');
  const [rules, setRules] = useState<RuleForm[]>(() => deserializeRules(initial?.rules?.rules || []));

  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    try {
      setPreviewing(true);
      const serialized = { op, rules: serializeRules(rules) };
      const r = await emailApi.previewSegment(serialized);
      setPreview(r);
    } catch (e: any) {
      setErr(e.message || 'Preview fehlgeschlagen');
    } finally {
      setPreviewing(false);
    }
  }, [op, rules]);

  useEffect(() => {
    const t = setTimeout(runPreview, 500);
    return () => clearTimeout(t);
  }, [runPreview]);

  const addPropertyRule = () => setRules((r) => [...r, {
    _id: Math.random().toString(36).slice(2), type: 'property',
    field: 'totalSpent', op: 'gte', value: '100',
  }]);

  const addEventRule = () => setRules((r) => [...r, {
    _id: Math.random().toString(36).slice(2), type: 'event',
    event: 'order_placed', op: 'at_least', count: 1, withinDays: 30,
  }]);

  const removeRule = (id: string) => setRules((r) => r.filter((x) => x._id !== id));
  const updateRule = (id: string, patch: any) => setRules((r) => r.map((x) => x._id === id ? { ...x, ...patch } : x));

  const save = async () => {
    if (!name.trim()) { setErr('Name erforderlich'); return; }
    if (rules.length === 0) { setErr('Mindestens eine Regel erforderlich'); return; }
    setBusy(true); setErr(null);
    try {
      const data = { name, description: description || null, rules: { op, rules: serializeRules(rules) } };
      const seg = existingId
        ? await emailApi.updateSegment(existingId, data)
        : await emailApi.createSegment(data);
      onSaved(seg);
    } catch (e: any) {
      setErr(e.message || 'Speichern fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {existingId ? 'Segment bearbeiten' : 'Neues Segment'}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl()}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={input()} placeholder="z.B. VIP-Kunden" /></div>
            <div><label className={lbl()}>Beschreibung</label><input value={description} onChange={(e) => setDescription(e.target.value)} className={input()} /></div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bedingung</span>
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 p-0.5 bg-gray-50 dark:bg-white/5">
                <button onClick={() => setOp('and')} className={`px-3 py-1 text-xs rounded ${op === 'and' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm' : 'text-gray-500'}`}>UND</button>
                <button onClick={() => setOp('or')} className={`px-3 py-1 text-xs rounded ${op === 'or' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm' : 'text-gray-500'}`}>ODER</button>
              </div>
              <span className="text-xs text-gray-400">alle Regeln müssen erfüllt sein</span>
            </div>

            <div className="space-y-2">
              {rules.map((r) => (
                <RuleRow key={r._id} rule={r} onChange={(p) => updateRule(r._id, p)} onRemove={() => removeRule(r._id)} />
              ))}
              {rules.length === 0 && <div className="text-sm text-gray-400 italic">Keine Regeln — füge mindestens eine hinzu.</div>}
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={addPropertyRule} className={btn('secondary', 'h-8 text-xs')}>
                <Plus className="h-3 w-3" /> Kontakt-Eigenschaft
              </button>
              <button onClick={addEventRule} className={btn('secondary', 'h-8 text-xs')}>
                <Plus className="h-3 w-3" /> Verhalten (Event)
              </button>
            </div>
          </div>

          {/* Live-Preview */}
          <div className="rounded-lg border border-primary-100 dark:border-primary-900/40 bg-primary-50/50 dark:bg-primary-900/10 p-3">
            <div className="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300 font-semibold mb-1">Live-Vorschau</div>
            {previewing ? (
              <div className="text-sm text-gray-500">Wird berechnet …</div>
            ) : preview ? (
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{preview.count} Kontakt{preview.count !== 1 ? 'e' : ''}</div>
                {preview.sample.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    Beispiele: {preview.sample.slice(0, 3).map((s: any) => s.email).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Regeln hinzufügen für Live-Count</div>
            )}
          </div>

          {err && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onCancel} className={btn('ghost')}>Abbrechen</button>
          <button onClick={save} disabled={busy} className={btn('primary')}>{busy ? 'Speichert …' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({ rule, onChange, onRemove }: { rule: RuleForm; onChange: (patch: any) => void; onRemove: () => void }) {
  if (rule.type === 'property') {
    const field = CONTACT_FIELDS.find((f) => f.value === rule.field);
    const kind = field?.kind || 'text';
    const ops = OPS_BY_KIND[kind] || OPS_BY_KIND.text;
    const showValueInput = rule.op !== 'is_set' && rule.op !== 'is_not_set';
    return (
      <div className="grid grid-cols-12 gap-2 items-start p-2 border border-gray-100 dark:border-white/8 rounded-lg">
        <div className="col-span-1 text-xs text-gray-400 pt-2.5 uppercase">Kontakt</div>
        <select value={rule.field} onChange={(e) => onChange({ field: e.target.value })} className={input('col-span-4')}>
          {CONTACT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={rule.op} onChange={(e) => onChange({ op: e.target.value })} className={input('col-span-3')}>
          {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {showValueInput && (
          <input
            value={rule.value}
            onChange={(e) => onChange({ value: e.target.value })}
            className={input('col-span-3')}
            placeholder={kind === 'number' ? '100' : kind === 'date' ? 'Tage' : 'Wert'}
            type={kind === 'number' || kind === 'date' ? 'number' : 'text'}
          />
        )}
        <button onClick={onRemove} className={`col-span-1 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ${showValueInput ? '' : 'col-start-12'}`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-start p-2 border border-gray-100 dark:border-white/8 rounded-lg">
      <div className="col-span-1 text-xs text-gray-400 pt-2.5 uppercase">Event</div>
      <select value={rule.event} onChange={(e) => onChange({ event: e.target.value })} className={input('col-span-4')}>
        {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
      <select value={rule.op} onChange={(e) => onChange({ op: e.target.value })} className={input('col-span-2')}>
        <option value="at_least">mind.</option>
        <option value="at_most">höchst.</option>
        <option value="exactly">genau</option>
        <option value="zero">nie</option>
      </select>
      {rule.op !== 'zero' && (
        <input type="number" min="0" value={rule.count} onChange={(e) => onChange({ count: Number(e.target.value) })} className={input('col-span-1')} />
      )}
      <div className="col-span-2 text-xs text-gray-500 pt-2">in letzten</div>
      <input type="number" min="0" value={rule.withinDays} onChange={(e) => onChange({ withinDays: Number(e.target.value) })} className={input('col-span-1')} title="Tage" />
      <button onClick={onRemove} className="col-span-1 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function serializeRules(rules: RuleForm[]): any[] {
  return rules.map((r) => {
    if (r.type === 'property') {
      const field = CONTACT_FIELDS.find((f) => f.value === r.field);
      const kind = field?.kind || 'text';
      let value: any = r.value;
      if (kind === 'number') value = Number(r.value || 0);
      if (kind === 'array') value = r.value.trim();
      return { type: 'property', field: r.field, op: r.op, value };
    }
    return { type: 'event', event: r.event, op: r.op, count: r.count, withinDays: r.withinDays };
  });
}

function deserializeRules(raw: any[]): RuleForm[] {
  return (raw || []).map((r) => {
    const _id = Math.random().toString(36).slice(2);
    if (r.type === 'property') {
      return { _id, type: 'property', field: r.field, op: r.op, value: String(r.value ?? '') } as PropertyRuleForm;
    }
    if (r.type === 'event') {
      return { _id, type: 'event', event: r.event, op: r.op, count: r.count ?? 1, withinDays: r.withinDays ?? 30 } as EventRuleForm;
    }
    // Group (nested) not supported in MVP — flatten
    return { _id, type: 'property', field: 'email', op: 'is_set', value: '' } as PropertyRuleForm;
  });
}
