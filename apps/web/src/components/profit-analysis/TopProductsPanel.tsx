'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Loader2, ShoppingBag, Package2, Music2 } from 'lucide-react';
import { profitAnalysisApi, TopProductsResult } from '@/lib/profit-analysis/api';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

/**
 * Meist verkaufte Artikel im Zeitraum.
 * Zeigt vollständige Rangliste (bis 50) + Aufschlüsselung je Kanal.
 */
export function TopProductsPanel({ from, to, rangeLabel }: {
  from: string; to: string; rangeLabel: string;
}) {
  const [data, setData] = useState<TopProductsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await profitAnalysisApi.topProducts.forRange(from, to, 50);
      setData(res);
    } catch {
      setData(null);
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const items = data?.items ?? [];
  const shown = showAll ? items : items.slice(0, 10);
  const maxQty = items[0]?.totalQty ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Package className="h-4 w-4 text-amber-500" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Meist verkaufte Artikel</div>
          <InfoTooltip description="Alle Produktverkäufe im gewählten Zeitraum, absteigend nach Menge. Aggregiert aus Shopify, Amazon und TikTok. Großhandel ist separat." />
        </div>
        {data && data.productCount > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {rangeLabel} · {data.productCount} versch. Artikel
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
          <Loader2 className="h-3 w-3 animate-spin" /> Lade …
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400 italic py-4 text-center">
          Keine Produktverkäufe im gewählten Zeitraum.
        </div>
      ) : (
        <>
          <ol className="space-y-1.5">
            {shown.map((it, idx) => {
              const barPct = maxQty > 0 ? (it.totalQty / maxQty) * 100 : 0;
              return (
                <li key={it.productId} className="group flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <div className="w-6 text-xs font-bold text-slate-400 tabular-nums text-right">{idx + 1}</div>
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate">{it.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="h-1.5 flex-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden max-w-[240px]">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: barPct + '%' }} />
                      </div>
                      <div className="flex gap-1 text-[10px] font-mono">
                        {it.perChannel.shopify > 0 && (
                          <span title="Shopify" className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <ShoppingBag className="h-2.5 w-2.5" />{it.perChannel.shopify}
                          </span>
                        )}
                        {it.perChannel.amazon > 0 && (
                          <span title="Amazon" className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                            <Package2 className="h-2.5 w-2.5" />{it.perChannel.amazon}
                          </span>
                        )}
                        {it.perChannel.tiktok > 0 && (
                          <span title="TikTok" className="inline-flex items-center gap-0.5 text-pink-600 dark:text-pink-400">
                            <Music2 className="h-2.5 w-2.5" />{it.perChannel.tiktok}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {it.totalQty} Stk.
                  </div>
                </li>
              );
            })}
          </ol>

          {items.length > 10 && (
            <button onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium">
              {showAll ? 'Nur Top 10 zeigen' : `Alle ${items.length} Artikel zeigen`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
