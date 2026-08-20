'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, User as UserIcon, ExternalLink } from 'lucide-react';
import { profitAnalysisApi, AuditEntry } from '@/lib/profit-analysis/api';

const ACTION_LABELS: Record<string, string> = {
  'sales.patch': 'Umsatz geändert',
  'ads.patch': 'Werbekosten geändert',
  'shipping.patch': 'Versand geändert',
  'product_sale.patch': 'Produktverkauf geändert',
  'wholesale.create': 'Großhandelsauftrag angelegt',
  'wholesale.update': 'Großhandelsauftrag geändert',
  'wholesale.delete': 'Großhandelsauftrag gelöscht',
  'overhead_template.create': 'Gemeinkosten-Vorlage angelegt',
  'overhead_entry.create': 'Gemeinkosten-Position angelegt',
  'target.set': 'Ziel gesetzt',
  'target.delete': 'Ziel gelöscht',
  'month.close': 'Monat abgeschlossen',
  'month.reopen': 'Monat wieder geöffnet',
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await profitAnalysisApi.audit.list({
        action: actionFilter || undefined,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) { setError(e?.message ?? 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [actionFilter]);

  const uniqueActions = Array.from(new Set(items.map((i) => i.action)));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Audit Log</h2>
          <p className="text-sm text-slate-500 mt-0.5">Änderungshistorie aller finanziellen Datenpunkte im Modul.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-1.5 text-sm">
          <option value="">Alle Aktionen</option>
          {uniqueActions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
        <div className="text-xs text-slate-500 self-center">Insgesamt {total} Einträge</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
          <div className="text-sm text-slate-500">Noch keine Audit-Einträge. Sobald Werte im Modul geändert werden, erscheinen sie hier.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <ol className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {ACTION_LABELS[e.action] ?? e.action}
                    <span className="text-slate-500 font-normal ml-2 text-xs">· {e.entityId}</span>
                  </div>
                  {e.changes && (
                    <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                      {JSON.stringify(e.changes)}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <UserIcon className="h-3 w-3" /> {e.userName ?? 'Unbekannt'}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                    {new Date(e.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
