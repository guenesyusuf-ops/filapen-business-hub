'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, Plus, Trash2, Pencil, ArrowUpDown, Ban } from 'lucide-react';
import { shippingApi, CARRIER_LABELS } from '@/lib/shipping';
import { PageHeader, Empty, btn, Badge } from '@/components/shipping/ShippingUI';
import { RuleBuilder } from '@/components/shipping/RuleBuilder';

function RuleActionBadge({ actionType, action }: { actionType: string; action: any }) {
  if (actionType === 'select_carrier') {
    const carrierLabel = CARRIER_LABELS[action?.carrier as keyof typeof CARRIER_LABELS] || action?.carrier;
    return <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Carrier: {carrierLabel}</Badge>;
  }
  if (actionType === 'select_method') {
    return <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Methode: {action?.method}</Badge>;
  }
  if (actionType === 'block_shipment') {
    return (
      <Badge color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <Ban className="h-3 w-3 inline mr-1" /> Blockiert
      </Badge>
    );
  }
  return null;
}

export default function ShippingRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ rule?: any } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    shippingApi.listRules()
      .then(setRules)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDelete = useCallback(async (r: any) => {
    if (!confirm('Regel "' + r.name + '" löschen?')) return;
    await shippingApi.deleteRule(r.id);
    load();
  }, [load]);

  const toggleActive = useCallback(async (r: any) => {
    await shippingApi.updateRule(r.id, { active: !r.active });
    load();
  }, [load]);

  const openCreate = useCallback(() => setModal({}), []);
  const closeModal = useCallback(() => setModal(null), []);
  const onSaved = useCallback(() => { setModal(null); load(); }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Versandregeln"
        subtitle="Auto-wählen Carrier, Methode oder Paket anhand Regeln. Werden in Priorität-Reihenfolge ausgewertet."
        actions={<button onClick={openCreate} className={btn('primary')}><Plus className="h-4 w-4" /> Neue Regel</button>}
      />

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<Zap className="h-10 w-10" />}
            title="Noch keine Regeln"
            hint="Beispiel: Gewicht größer 5000g, dann DHL Paket. Oder Land = CH, dann Versand blockieren."
            action={<button onClick={openCreate} className={btn('primary')}><Plus className="h-4 w-4" /> Neue Regel</button>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left"><ArrowUpDown className="h-3 w-3 inline" /> Priorität</th>
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left">Bedingungen</th>
                <th className="px-3 py-2.5 text-left">Aktion</th>
                <th className="px-3 py-2.5 text-center">Aktiv</th>
                <th className="px-3 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rules.map(function (r) {
                const conds = r.conditions?.rules || [];
                const opLabel = r.conditions?.op === 'or' ? 'EINE' : 'ALLE';
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono text-xs">{r.priority}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{r.name}</div>
                      {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                      <div className="text-[10px] uppercase text-gray-400 mb-1">{opLabel} von {conds.length}</div>
                      {conds.slice(0, 3).map(function (c: any, i: number) {
                        return <div key={i} className="font-mono text-xs">{c.field} {c.op} {JSON.stringify(c.value)}</div>;
                      })}
                      {conds.length > 3 && <div className="text-gray-400">+{conds.length - 3} weitere</div>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <RuleActionBadge actionType={r.actionType} action={r.actionValue} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input type="checkbox" checked={r.active} onChange={() => toggleActive(r)} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setModal({ rule: r })} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => onDelete(r)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <RuleBuilder initial={modal.rule} onClose={closeModal} onSaved={onSaved} />}
    </div>
  );
}
