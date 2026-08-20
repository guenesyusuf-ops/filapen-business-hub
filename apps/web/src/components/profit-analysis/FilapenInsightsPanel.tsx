'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, CheckCircle2, Info, Sparkles,
  X, ThumbsUp, ThumbsDown, ChevronRight, HelpCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { profitAnalysisApi, Insight } from '@/lib/profit-analysis/api';
import { formatEur, formatPercent } from '@/lib/profit-analysis/formatters';
import { cn } from '@/lib/utils';

const SEVERITY_STYLE: Record<Insight['severity'], { color: string; icon: any; label: string }> = {
  info:     { color: 'text-slate-600 dark:text-slate-400',   icon: Info,          label: 'Info' },
  positive: { color: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp,  label: 'Positiv' },
  warning:  { color: 'text-amber-600 dark:text-amber-400',   icon: AlertTriangle, label: 'Warnung' },
  critical: { color: 'text-red-600 dark:text-red-400',       icon: AlertCircle,   label: 'Kritisch' },
};

const CHANNEL_LABEL: Record<string, string> = {
  webshop: 'Webshop', amazon: 'Amazon', tiktok: 'TikTok', wholesale: 'Großhandel', total: 'Gesamt',
};

/**
 * Filapen Insights — kompakter Dashboard-Bereich (§2).
 * Zeigt Top-N aktive Insights + Button zum "Alle Insights"-Drawer (§4).
 */
export function FilapenInsightsPanel() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [explainId, setExplainId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await profitAnalysisApi.insights.top(5);
      setItems(res.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await profitAnalysisApi.insights.refresh();
      await load();
    } finally { setRefreshing(false); }
  }

  async function markFeedback(id: string, feedback: 'helpful' | 'not_helpful') {
    await profitAnalysisApi.insights.feedback(id, feedback);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, feedback } : i));
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Filapen Insights</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 inline-flex items-center gap-1 disabled:opacity-50"
            title="Insights jetzt neu berechnen"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Aktualisieren
          </button>
          <button onClick={() => setShowDrawer(true)} className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
            Alle Insights <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Lade …</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400 italic py-3 text-center">
          Aktuell keine besonderen Auffälligkeiten. Sobald sich Werte deutlich ändern, erscheinen hier Insights.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => <InsightRow key={i.id} insight={i} onFeedback={markFeedback} onExplain={() => setExplainId(i.id)} />)}
        </ul>
      )}

      {showDrawer && <AllInsightsDrawer onClose={() => setShowDrawer(false)} />}
      {explainId && <ExplainPopover insightId={explainId} onClose={() => setExplainId(null)} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Insight-Zeile im Panel
// -----------------------------------------------------------------------------

function InsightRow({ insight, onFeedback, onExplain }: {
  insight: Insight;
  onFeedback: (id: string, f: 'helpful' | 'not_helpful') => void;
  onExplain: () => void;
}) {
  const style = SEVERITY_STYLE[insight.severity];
  const Icon = style.icon;
  const canExplain = ['roas.rolling7d.dropped', 'ads.outpacing_revenue', 'margin.critical'].some((p) => insight.insightType.startsWith(p));

  return (
    <li className="group flex items-start gap-2.5 rounded-lg p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', style.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={cn('text-sm font-semibold', style.color)}>{insight.title}</div>
          {insight.channel && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
              {CHANNEL_LABEL[insight.channel] ?? insight.channel}
            </span>
          )}
          {insight.hasAi && <Sparkles className="h-3 w-3 text-amber-500" />}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{insight.message}</div>
        <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canExplain && (
            <button onClick={onExplain} className="text-[11px] text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Warum?
            </button>
          )}
          <button
            onClick={() => onFeedback(insight.id, 'helpful')}
            className={cn('text-slate-400 hover:text-emerald-600', insight.feedback === 'helpful' && 'text-emerald-600')}
            title="Hilfreich"
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onFeedback(insight.id, 'not_helpful')}
            className={cn('text-slate-400 hover:text-red-600', insight.feedback === 'not_helpful' && 'text-red-600')}
            title="Nicht hilfreich"
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

// -----------------------------------------------------------------------------
// Alle Insights Drawer (§4)
// -----------------------------------------------------------------------------

type FilterKey = 'all' | 'positive' | 'warning' | 'critical';

function AllInsightsDrawer({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [channel, setChannel] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await profitAnalysisApi.insights.list({
        severity: filter === 'all' ? undefined : filter,
        channel: channel || undefined,
        limit: 100,
      });
      setItems(res.items);
    } finally { setLoading(false); }
  }, [filter, channel]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-[#0f1117] shadow-2xl overflow-y-auto animate-slide-up">
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f1117] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Alle Insights</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{items.length} aktive Meldungen</div>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'positive', 'warning', 'critical'] as FilterKey[]).map((k) => (
              <button key={k} onClick={() => setFilter(k)}
                className={cn('px-2.5 py-1 text-xs rounded-md',
                  filter === k ? 'bg-amber-500 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5')}>
                {k === 'all' ? 'Alle' : SEVERITY_STYLE[k as Insight['severity']].label}
              </button>
            ))}
            <select value={channel} onChange={(e) => setChannel(e.target.value)}
              className="ml-2 rounded-md border border-slate-300 dark:border-white/10 dark:bg-white/5 px-2 py-1 text-xs">
              <option value="">Alle Kanäle</option>
              <option value="webshop">Webshop</option>
              <option value="amazon">Amazon</option>
              <option value="tiktok">TikTok</option>
              <option value="wholesale">Großhandel</option>
              <option value="total">Gesamt</option>
            </select>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-8">
              Keine Insights für diesen Filter.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((i) => (
                <InsightRow key={i.id} insight={i} onFeedback={() => { /* im Drawer optional */ }} onExplain={() => { /* siehe Panel */ }} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// "Warum?" Popover (§5)
// -----------------------------------------------------------------------------

function ExplainPopover({ insightId, onClose }: { insightId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    profitAnalysisApi.insights.explain(insightId).then(setData).catch(() => setData({ error: true }));
  }, [insightId]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-slate-900 dark:text-white">Mögliche Treiber</div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {!data ? (
          <div className="text-xs text-slate-500 flex items-center gap-2 py-4"><Loader2 className="h-3 w-3 animate-spin" /> Analysiere …</div>
        ) : data.error ? (
          <div className="text-xs text-red-600">Analyse fehlgeschlagen.</div>
        ) : (
          <>
            <div className="text-xs text-slate-500 mb-3">{data.headline}</div>
            <ul className="space-y-2">
              {(data.drivers ?? []).map((d: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {d.direction === 'up'
                    ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                    : <TrendingDown className="h-4 w-4 text-red-600" />}
                  <span className="flex-1">{d.label}</span>
                  <span className={cn('tabular-nums font-semibold',
                    d.direction === 'up' ? 'text-emerald-600' : 'text-red-600')}>
                    {d.change > 0 ? '+' : ''}{formatPercent(d.change.toString())}
                  </span>
                </li>
              ))}
            </ul>
            {(!data.drivers || data.drivers.length === 0) && (
              <div className="text-xs text-slate-500 italic">Keine klaren Treiber in den letzten 14 Tagen.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
