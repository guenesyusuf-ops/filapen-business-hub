'use client';

import { useState, Component, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Brain, AlertTriangle, Lightbulb, FlaskConical, ChevronRight, ChevronDown, Loader2, Blocks, Check, Wand2, Target, TrendingUp, Activity, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaSectionLabel, MetaDivider, MetaEmptyState, META_FRAME, btnPrimary, btnGhost } from '@/components/meta-ads/MetaUI';
import { useMetaAdsList, useProductAttention } from '@/hooks/meta-ads/useMetaAds';
import { AttentionBar } from '@/components/meta-ads/AttentionMap';
import {
  useAnalyze, useAnalyses, useAcceptRecommendation, useCreateRecipeFromAnalysis, Analysis, AiStatement, AiRecommendation, AiAnalysisResult,
  Confidence, CONF_LABELS, isStrategy, CreativeStrategyResult, ProductionRecommendation, AdComparison, AttentionProblem, CombinationBlock,
  StrategyFinding,
} from '@/hooks/meta-ads/useAiInsights';

function ConfTag({ c }: { c: Confidence }) {
  const tone = c === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
    : c === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
    : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50';
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{CONF_LABELS[c]} Confidence</span>;
}

export default function AiInsightsPage() {
  const toast = useToast();
  const [scope, setScope] = useState<'product_group' | 'ad'>('product_group');
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last30' });
  const [adId, setAdId] = useState<string>('');
  const [current, setCurrent] = useState<Analysis | null>(null);

  const adList = useMetaAdsList({ productGroupId: controls.productGroupId, range: controls.range, page: 1, pageSize: 100 });
  const analyze = useAnalyze();
  const history = useAnalyses({});

  const run = async () => {
    if (scope === 'ad' && !adId) { toast.error('Bitte eine Ad wählen'); return; }
    if (scope === 'product_group' && !controls.productGroupId) { toast.error('Bitte eine Produktgruppe wählen — die Analyse läuft pro Produkt, nicht produktübergreifend.'); return; }
    try {
      const res = await analyze.mutateAsync({
        scopeType: scope, productGroupId: controls.productGroupId, adId: scope === 'ad' ? adId : undefined,
        range: controls.range, start: controls.start, end: controls.end,
      });
      setCurrent(res);
      if (res.status === 'error') toast.error(res.error || 'Analyse fehlgeschlagen');
      else toast.success('Analyse erstellt');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Analyse fehlgeschlagen'); }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads" title="Product Creative Intelligence"
        description="Was funktioniert, was nicht — und was produzieren wir als Nächstes? Zahlen & Entscheidungen deterministisch aus den Facts, das Modell liefert nur die Erklärung. Keine Kausalität. Hyros ROAS bleibt autoritativ.">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
            {(['product_group', 'ad'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={cn('rounded-[7px] px-3 py-1 text-[12.5px] font-medium transition', scope === s ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>{s === 'product_group' ? 'Produktgruppe' : 'Einzelne Ad'}</button>
            ))}
          </div>
          <MetaControls value={controls} onChange={setControls} />
          {scope === 'ad' && (
            <select value={adId} onChange={(e) => setAdId(e.target.value)} className="h-[34px] min-w-0 max-w-[220px] rounded-[9px] border border-gray-200 bg-white px-2.5 text-[13px] text-gray-900 outline-none focus:border-accent-meta dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white">
              <option value="">Ad wählen…</option>
              {(adList.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button onClick={run} disabled={analyze.isPending} className={btnPrimary}>
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analyse starten
          </button>
        </div>
      </MetaPageHeader>

      <div className="rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-[12.5px] text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
        Empfehlungen werden als <b>Entwurf-Ideen</b> gespeichert (niemals automatisch als Aufgabe oder Produktion). Zahlen stammen ausschließlich aus den deterministischen Facts.
      </div>

      {scope === 'product_group' && controls.productGroupId && (
        <AttentionOverview productGroupId={controls.productGroupId} range={controls.range} start={controls.start} end={controls.end} />
      )}

      {current ? <AnalysisErrorBoundary><AnalysisView analysis={current} /></AnalysisErrorBoundary> : (
        <div className={META_FRAME}>
          <MetaEmptyState icon={Brain} title="Noch keine Analyse" description="Wähle Scope & Zeitraum und starte eine KI-Analyse auf Basis der vorhandenen Messwerte." />
        </div>
      )}

      <MetaDivider />
      <section className="flex flex-col gap-3">
        <MetaSectionLabel>Frühere Analysen</MetaSectionLabel>
        {history.data?.items?.length ? (
          <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
            {history.data.items.map((a) => (
              <button key={a.id} onClick={() => setCurrent(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
                <Brain className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800 dark:text-white/85">
                  {a.scopeType === 'ad' ? (a.adName ?? 'Ad') : (a.productGroupName ?? 'Alle Produktgruppen')} · {a.rangeLabel}
                </span>
                {a.status === 'error' ? <span className="text-[11px] text-red-500">Fehler</span> : a.confidence && <ConfTag c={a.confidence} />}
                <span className="text-[11px] text-gray-400 dark:text-white/40">{a.createdAt?.slice(0, 10)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            ))}
          </div>
        ) : <p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keine Analysen.</p>}
      </section>
    </div>
  );
}

/** Fängt Render-Fehler ab (z. B. UI/API-Versionsversatz nach Deploy) statt die ganze App weiß werden zu lassen. */
class AnalysisErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* bewusst still — Boundary zeigt Hinweis */ }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex items-start gap-3 rounded-[11px] border border-amber-200 bg-amber-50 p-5 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><div className="font-semibold">Ansicht konnte nicht dargestellt werden</div><p className="mt-1">Vermutlich wurde gerade eine neue Version veröffentlicht. Bitte die Seite neu laden (Cmd/Strg + Shift + R). Die Analyse selbst ist gespeichert.</p></div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  if (analysis.status === 'error') return <AnalysisError analysis={analysis} />;
  if (isStrategy(analysis.result)) return <StrategyView analysis={analysis} result={analysis.result} />;
  return <LegacyAnalysisView analysis={analysis} />;
}

function AnalysisError({ analysis }: { analysis: Analysis }) {
  return (
    <div className="flex items-start gap-3 rounded-[11px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div><div className="font-semibold">Analyse nicht möglich</div><p className="mt-1">{analysis.error}</p><p className="mt-1 text-red-500/80">Die deterministischen Facts bleiben unverändert gültig — nur die KI-Interpretation konnte nicht erzeugt werden.</p></div>
    </div>
  );
}

function LegacyAnalysisView({ analysis }: { analysis: Analysis }) {
  const toast = useToast();
  const accept = useAcceptRecommendation(analysis.id);
  const facts = analysis.facts;
  const result = analysis.result as AiAnalysisResult | null;

  const acceptRec = async (index: number) => {
    try { const res = await accept.mutateAsync(index); toast.success(res.status === 'draft' ? 'Als Entwurf-Idee gespeichert' : 'Idee erstellt'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{facts?.scopeType === 'ad' ? (analysis.adName ?? 'Ad') : (analysis.productGroupName ?? 'Alle Produktgruppen')}</span>
        <span className="text-[12px] text-gray-400 dark:text-white/40">· {analysis.rangeLabel} · {analysis.model}</span>
        {result && <ConfTag c={result.overallConfidence} />}
      </div>

      {/* FACTS — deterministisch, autoritativ (aus Snapshot, nicht vom Modell) */}
      {facts && (
        <div className={cn(META_FRAME, 'p-4')}>
          <MetaSectionLabel>Facts · deterministisch</MetaSectionLabel>
          {facts.dataVolumeLow && <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Geringe Datenmenge — Aussagen mit Vorsicht.</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {facts.facts.map((f) => (
              <div key={f.label} className="flex flex-col"><dt className="text-[11px] text-gray-400 dark:text-white/40">{f.label}</dt><dd className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-white">{f.value}</dd></div>
            ))}
          </dl>
          {facts.baselines.length > 0 && (
            <><div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Baselines</div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {facts.baselines.map((f) => <div key={f.label} className="flex flex-col"><dt className="text-[11px] text-gray-400 dark:text-white/40">{f.label}</dt><dd className="text-[12.5px] tabular-nums text-gray-700 dark:text-white/75">{f.value}</dd></div>)}
            </dl></>
          )}
          {facts.signals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {facts.signals.map((s, i) => <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" title={s.detail}>{s.label}</span>)}
            </div>
          )}
        </div>
      )}

      {result && (
        <>
          {result.summary && <p className="rounded-lg bg-gray-50 px-4 py-3 text-[13.5px] leading-relaxed text-gray-800 dark:bg-white/5 dark:text-white/85">{result.summary}</p>}
          <StatementBlock title="Beobachtungen" items={result.observations} />
          <StatementBlock title="Interpretationen" items={result.interpretations} muted />
          <StatementBlock title="Hypothesen" items={result.hypotheses} muted />

          <section className="flex flex-col gap-3">
            <MetaSectionLabel>Empfehlungen & Tests · {(result.recommendations ?? []).length}</MetaSectionLabel>
            {(result.recommendations ?? []).length === 0 ? <p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine Empfehlungen.</p> : (
              <div className="flex flex-col gap-2.5">
                {(result.recommendations ?? []).map((r, i) => <RecommendationCard key={i} r={r} onAccept={() => acceptRec(i)} pending={accept.isPending} />)}
              </div>
            )}
          </section>

          <p className="text-[11.5px] leading-relaxed text-gray-400 dark:text-white/40">
            KI-Interpretation auf Basis der oben gelisteten Facts. Zusammenhänge sind Assoziationen, keine Kausalität. Hyros ROAS ist die autoritative ROAS-Quelle. Empfehlungen werden als Entwurf-Ideen gespeichert und niemals automatisch produziert.
          </p>
        </>
      )}
    </div>
  );
}

function StatementBlock({ title, items, muted }: { title: string; items: AiStatement[]; muted?: boolean }) {
  if (!items?.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <MetaSectionLabel>{title}</MetaSectionLabel>
      <ul className="flex flex-col gap-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
            <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', muted ? 'bg-gray-300 dark:bg-white/20' : 'bg-accent-meta')} />
            <span className={muted ? 'text-gray-600 dark:text-white/60' : 'text-gray-800 dark:text-white/85'}>{s.text}</span>
            <span className="ml-auto shrink-0"><ConfTag c={s.confidence} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecommendationCard({ r, onAccept, pending }: { r: AiRecommendation; onAccept: () => void; pending: boolean }) {
  return (
    <div className={cn(META_FRAME, 'flex flex-col gap-2 p-4')}>
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-meta" />
        <span className="flex-1 text-[14px] font-semibold text-gray-900 dark:text-white">{r.title}</span>
        <ConfTag c={r.confidence} />
      </div>
      {r.action && <p className="text-[13px] leading-relaxed text-gray-700 dark:text-white/75">{r.action}</p>}
      {r.suggestedTest && (
        <p className="flex items-start gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[12.5px] text-gray-600 dark:bg-white/5 dark:text-white/60">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" /><span><b>Test:</b> {r.suggestedTest}</span>
        </p>
      )}
      <div className="flex items-center justify-between">
        {r.componentHint ? <span className="font-mono text-[11px] text-gray-400 dark:text-white/40">Baustein: {r.componentHint}</span> : <span />}
        <button onClick={onAccept} disabled={pending} className={btnGhost}><Lightbulb className="h-4 w-4" /> Als Idee übernehmen (Entwurf)</button>
      </div>
    </div>
  );
}

function AttentionOverview({ productGroupId, range, start, end }: { productGroupId?: string; range?: any; start?: string; end?: string }) {
  const { data, isLoading } = useProductAttention({ productGroupId, range, start, end });
  if (isLoading) return <div className={cn(META_FRAME, 'h-28 animate-pulse bg-gray-50 dark:bg-white/5')} />;
  const ads = data?.ads ?? [];
  if (!ads.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <MetaSectionLabel>Attention-Übersicht (interpoliert)</MetaSectionLabel>
      <p className="text-[11px] text-gray-400 dark:text-white/40">Aufmerksamkeitsverläufe der Video-Ads dieses Produkts — interpoliert aus Meta-Checkpoints (3s/25/50/75/95/100 %), ungefähre Zeiten. Kontext für die Analyse, kein Ersatz für die Facts.</p>
      <div className={cn(META_FRAME, 'flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05]')}>
        {ads.map((a) => (
          <div key={a.adId} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{a.name}</span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-gray-400 dark:text-white/40">Hook {a.hookRate != null ? `${Math.round(a.hookRate)}%` : '—'}</span>
            </div>
            <AttentionBar segments={a.segments} vl={a.videoLengthSeconds} />
            {a.biggestDrop && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">Größter Drop: {a.biggestDrop.segment} · −{Math.round(a.biggestDrop.dropPct)} %{a.biggestDrop.fromSeconds != null ? ` · ca. ${a.biggestDrop.fromSeconds}–${a.biggestDrop.toSeconds}s` : ''}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Increment H/I — Product Creative Intelligence (handlungsorientiert, v2)
// =============================================================================

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const UNIT_SUFFIX: Record<string, string> = { pct: '%', pp: 'pp', x: '×', eur: '', count: '' };
function fmtFact(f: { metric: string; value: number | null; baseline: number | null; deltaPp: number | null; unit: string }): string {
  const u = UNIT_SUFFIX[f.unit] ?? '';
  const v = f.value != null ? `${f.value}${u}` : '—';
  const parts = [v];
  if (f.baseline != null) parts.push(`Baseline ${f.baseline}${u}`);
  if (f.deltaPp != null) parts.push(`${f.deltaPp > 0 ? '+' : ''}${f.deltaPp}pp`);
  return parts.join(' · ');
}
const METRIC_LABELS: Record<string, string> = {
  hookRate: 'Hook Rate', retention50to75: '50→75 Retention', retentionDrop: 'Größter Drop', outboundCtr: 'Ausg. CTR',
  calculatedRoas: 'ber. ROAS', impressions: 'Impressionen', componentSignal: 'Baustein',
};

function StrategyView({ analysis, result }: { analysis: Analysis; result: CreativeStrategyResult }) {
  const toast = useToast();
  const router = useRouter();
  const accept = useAcceptRecommendation(analysis.id);
  const makeRecipe = useCreateRecipeFromAnalysis(analysis.id);
  const [saved, setSaved] = useState<Record<string, string>>({}); // recId -> ideaId
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const save = async (r: ProductionRecommendation) => {
    try {
      const res = await accept.mutateAsync({ recommendationId: r.id });
      setSaved((s) => ({ ...s, [r.id]: res.ideaId }));
      toast.success(res.alreadyExisted ? 'Bereits als Entwurf vorhanden' : 'Als Entwurf-Idee gespeichert');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };
  const createRecipe = async () => {
    try { const res = await makeRecipe.mutateAsync(); setRecipeId(res.recipeId); toast.success(res.alreadyExisted ? 'Recipe existiert bereits' : 'Recipe gespeichert'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Recipe fehlgeschlagen'); }
  };

  const recs = [...result.productionRecommendations].sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]));
  const h = result.creativeHealth;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-accent-meta" />
        <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{analysis.productGroupName ?? 'Produkt'}</span>
        <span className="text-[12px] text-gray-400 dark:text-white/40">· {analysis.rangeLabel} · {analysis.model}</span>
        <ConfTag c={result.overallConfidence} />
      </div>

      {result.executiveSummary && <p className="rounded-[10px] bg-gray-50 px-4 py-3 text-[13.5px] leading-relaxed text-gray-800 dark:bg-white/5 dark:text-white/85">{result.executiveSummary}</p>}

      {/* Creative Health — kompakt */}
      <section className="flex flex-col gap-2">
        <MetaSectionLabel>Creative Health</MetaSectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Ads', String(h.adsAnalyzed)], ['Spend', h.spend], ['Unique Sales', String(h.uniqueSales)],
            ['Baseline Hook', h.baselineHookRatePct != null ? `${h.baselineHookRatePct}%` : '—'],
            ['Baseline 50→75', h.baselineRetention50to75Pct != null ? `${h.baselineRetention50to75Pct}%` : '—'],
            ['Confidence', CONF_LABELS[h.confidence] ?? h.confidence],
          ].map(([l, v]) => (
            <div key={l} className={cn(META_FRAME, 'flex flex-col gap-0.5 px-3 py-2.5')}>
              <span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{v}</span>
              <span className="text-[11px] text-gray-400 dark:text-white/40">{l}</span>
            </div>
          ))}
        </div>
        {result.creativeHealthNote && <p className="text-[12.5px] text-gray-500 dark:text-white/55">{result.creativeHealthNote}</p>}
      </section>

      {/* WHAT TO PRODUCE NEXT — Hauptblock */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4.5 w-4.5 text-accent-meta" />
          <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">What to Produce Next</h2>
          <span className="text-[12px] text-gray-400 dark:text-white/40">· {recs.length}</span>
        </div>
        {recs.length === 0 ? (
          <div className={cn(META_FRAME, 'px-4 py-5 text-center text-[13px] text-gray-500 dark:text-white/55')}>
            Noch keine belastbare Creative-Entscheidung — zu wenig Daten in diesem Zeitraum. Weiter Daten sammeln.
          </div>
        ) : recs.map((r, i) => (
          <ProduceNextCard key={r.id} n={i + 1} r={r} saved={saved[r.id]} onSave={() => save(r)} pending={accept.isPending}
            onRecipe={r.actionType === 'BUILD_COMPONENT_COMBINATION' ? createRecipe : undefined} recipeId={recipeId} recipePending={makeRecipe.isPending} />
        ))}
      </section>

      {/* Winning Patterns */}
      {result.winningPatterns.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Winning Patterns</MetaSectionLabel>
          <div className="flex flex-col gap-2">
            {result.winningPatterns.map((p, i) => (
              <div key={i} className={cn(META_FRAME, 'flex items-start gap-2.5 px-4 py-3')}>
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <div className="flex-1"><div className="text-[13.5px] font-semibold text-gray-900 dark:text-white">{p.pattern}</div>{p.detail && <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-white/60">{p.detail}</p>}</div>
                <ConfTag c={p.confidence} />
              </div>
            ))}
          </div>
        </section>
      )}

      <FindingSection title="Strong Hooks" items={result.hookFindings} />
      <FindingSection title="Strong Bodies" items={result.bodyFindings} />

      {/* Recommended Combination (authoritative, Increment E) */}
      {result.componentCombination && (
        <CombinationCard combo={result.componentCombination} onRecipe={createRecipe} recipeId={recipeId} pending={makeRecipe.isPending} />
      )}

      {/* Attention Problems (Increment G) */}
      {result.attentionProblems.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Attention-Probleme</MetaSectionLabel>
          <p className="text-[11px] text-gray-400 dark:text-white/40">Interpoliert aus Meta-Checkpoints — ungefähre Zeiten, keine Kausalität.</p>
          <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
            {result.attentionProblems.map((p) => <AttentionProblemRow key={p.adId + p.segment} p={p} onOpen={() => router.push(`/meta-ads/ads/${p.adId}`)} />)}
          </div>
        </section>
      )}

      <FindingSection title="Salvage Opportunities" items={result.salvageOpportunities} />
      <FindingSection title="Awareness Insights" items={result.awarenessFindings} />

      {/* Ads compared — Per-Ad Facts */}
      {result.adsCompared.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Ads im Vergleich · {result.adsCompared.length}</MetaSectionLabel>
          <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
            {result.adsCompared.map((a) => <AdCompareRow key={a.adId} a={a} onOpen={() => router.push(`/meta-ads/ads/${a.adId}`)} />)}
          </div>
        </section>
      )}

      {/* Next Tests */}
      {result.nextTests.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Nächste Tests</MetaSectionLabel>
          <div className="flex flex-col gap-2">
            {result.nextTests.map((t, i) => (
              <div key={i} className={cn(META_FRAME, 'flex items-start gap-2.5 px-4 py-3')}>
                <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="flex-1"><div className="text-[13px] font-semibold text-gray-900 dark:text-white">{t.title}</div>{t.variable && <div className="mt-0.5 text-[11.5px] text-accent-meta">Variable: {t.variable}</div>}{t.detail && <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-white/60">{t.detail}</p>}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Analyse-Details — zusammenklappbar (Findings) */}
      <section className="flex flex-col gap-2">
        <button onClick={() => setShowDetails((v) => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white">
          {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Analyse-Details
        </button>
        {showDetails && (
          <div className="flex flex-col gap-4 rounded-[11px] border border-gray-100 bg-gray-50/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.015]">
            <FindingSection title="Retention-Findings" items={result.retentionFindings} flat />
            <FindingSection title="Attention-Findings" items={result.attentionFindings} flat />
            <FindingSection title="Drop-Findings" items={result.dropFindings} flat />
            <FindingSection title="Component-Findings" items={result.componentFindings} flat />
            <div className="text-[11px] text-gray-400 dark:text-white/40">
              Modell {analysis.model} · Prompt {('promptVersion' in (analysis as any)) ? (analysis as any).promptVersion : 'v2'} · Data-Confidence {CONF_LABELS[h.confidence] ?? h.confidence}.
              Zahlen stammen ausschließlich aus den deterministischen Facts; das LLM liefert nur die Erklärung. Assoziation, keine Kausalität. Hyros ROAS bleibt autoritativ.
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-[12px]">
        <Link href="/meta-ads/creative-lab" className="inline-flex items-center gap-1 text-accent-meta hover:underline"><ArrowRight className="h-3.5 w-3.5" /> zurück zum Creative Lab</Link>
      </div>
    </div>
  );
}

function ProduceNextCard({ n, r, saved, onSave, pending, onRecipe, recipeId, recipePending }: {
  n: number; r: ProductionRecommendation; saved?: string; onSave: () => void; pending: boolean;
  onRecipe?: () => void; recipeId?: string | null; recipePending?: boolean;
}) {
  const prioTone = r.priority === 'high' ? 'bg-accent-meta/10 text-accent-meta' : r.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50';
  return (
    <div className={cn(META_FRAME, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-meta/10 text-[13px] font-bold text-accent-meta">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-gray-900 dark:text-white">{r.title}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide', prioTone)}>{r.actionLabel}</span>
          </div>
          {r.affectedAds.length > 0 && <div className="mt-0.5 text-[11.5px] text-gray-400 dark:text-white/40">{r.affectedAds.map((a) => a.name).join(', ')}</div>}
        </div>
        <ConfTag c={r.recommendationConfidence} />
      </div>

      {r.why && <p className="text-[13px] leading-relaxed text-gray-700 dark:text-white/75"><b>Warum:</b> {r.why}</p>}

      {/* Facts (deterministisch) */}
      {r.facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.facts.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-white/10 dark:text-white/70">
              <span className="font-medium">{METRIC_LABELS[f.metric] ?? f.metric}</span>
              <span className="tabular-nums">{fmtFact(f)}</span>
            </span>
          ))}
        </div>
      )}

      {/* KEEP / CHANGE / USE */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {r.keepComponents.length > 0 && <KeepChange label="KEEP" items={r.keepComponents} tone="keep" />}
        {r.changeComponents.length > 0 && <KeepChange label="CHANGE" items={r.changeComponents} tone="change" />}
        {r.suggestedComponents.length > 0 && <KeepChange label="USE" items={r.suggestedComponents} tone="use" />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-gray-500 dark:text-white/50">
        {r.variantCount != null && <span>Produce: <b className="text-gray-800 dark:text-white/80">{r.variantCount} {r.variantCount === 1 ? 'Variante' : 'Varianten'}</b></span>}
        {r.testVariable && <span>Testvariable: {r.testVariable}</span>}
        {r.expectedLearning && <span className="text-gray-400 dark:text-white/40">Learning: {r.expectedLearning}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700 dark:text-green-400"><Check className="h-4 w-4" /> Als Entwurf gespeichert</span>
        ) : (
          <button onClick={onSave} disabled={pending} className={btnGhost}><Lightbulb className="h-4 w-4" /> Als Idee speichern</button>
        )}
        {saved && <Link href={`/meta-ads/ideas?focus=${saved}`} className="inline-flex items-center gap-1 text-[12.5px] text-accent-meta hover:underline">Entwurf öffnen <ArrowRight className="h-3.5 w-3.5" /></Link>}
        {onRecipe && (recipeId
          ? <Link href="/meta-ads/creative-lab" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700 dark:text-green-400"><Check className="h-4 w-4" /> Recipe gespeichert</Link>
          : <button onClick={onRecipe} disabled={recipePending} className={btnGhost}><Blocks className="h-4 w-4" /> Recipe erstellen</button>)}
      </div>
    </div>
  );
}

function KeepChange({ label, items, tone }: { label: string; items: string[]; tone: 'keep' | 'change' | 'use' }) {
  const t = tone === 'keep' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
    : tone === 'change' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
    : 'border-accent-meta/30 bg-accent-meta/[0.06] text-accent-meta';
  return (
    <div className={cn('rounded-[9px] border px-3 py-2', t)}>
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((it, i) => <span key={i} className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[10.5px] dark:bg-black/20">{it}</span>)}
      </div>
    </div>
  );
}

function CombinationCard({ combo, onRecipe, recipeId, pending }: { combo: CombinationBlock; onRecipe: () => void; recipeId: string | null; pending: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <MetaSectionLabel>Empfohlene Kombination (Cross-Ad){combo.label === 'promising' ? ' · Promising' : ''}</MetaSectionLabel>
      <div className={cn(META_FRAME, 'flex flex-col gap-3 p-4')}>
        <div className="flex flex-wrap items-center gap-2">
          {combo.slots.map((s, i) => (
            <div key={s.code} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 dark:text-white/30">+</span>}
              <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-white/[0.1]">
                <div className="font-mono text-[10.5px] uppercase tracking-wide text-gray-400 dark:text-white/40">{s.code} · {s.bucket}</div>
                <div className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{s.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-white/50">{s.sourceAdName ? `aus ${s.sourceAdName}` : '—'}{s.keyMetric != null ? ` · ${s.keyMetric}%` : ''}{s.keyDelta != null ? ` (${s.keyDelta > 0 ? '+' : ''}${s.keyDelta}pp)` : ''}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-white/60">{combo.reason}</p>
        {recipeId
          ? <Link href="/meta-ads/creative-lab" className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-green-700 dark:text-green-400"><Check className="h-4 w-4" /> Recipe gespeichert — im Creative Lab öffnen</Link>
          : <button onClick={onRecipe} disabled={pending} className={cn(btnPrimary, 'self-start')}><Blocks className="h-4 w-4" /> Recipe erstellen</button>}
      </div>
    </section>
  );
}

function AttentionProblemRow({ p, onOpen }: { p: AttentionProblem; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{p.adName}</span>
        <span className="shrink-0 text-[11.5px] font-medium text-red-600 dark:text-red-400">−{p.dropPct}% · {p.segment}{p.fromSeconds != null ? ` · ca. ${p.fromSeconds}–${p.toSeconds}s` : ''}</span>
      </div>
      {p.overlapComponent && <span className="text-[11.5px] text-gray-500 dark:text-white/50">Overlap: {p.overlapComponent.code} · {p.overlapComponent.type}</span>}
      <span className="text-[12px] text-amber-700 dark:text-amber-400">{p.recommendation}</span>
    </button>
  );
}

function AdCompareRow({ a, onOpen }: { a: AdComparison; onOpen: () => void }) {
  const hookTone = a.hookClass === 'strong' ? 'text-green-700 dark:text-green-400' : a.hookClass === 'weak' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400';
  const bodyTone = a.bodySignal === 'strong' ? 'text-green-700 dark:text-green-400' : a.bodySignal === 'weak' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-white/50';
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
      <Activity className="h-4 w-4 shrink-0 text-gray-300 dark:text-white/30" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-900 dark:text-white">{a.name}</span>
      <div className="hidden shrink-0 items-center gap-5 text-right text-[12px] tabular-nums sm:flex">
        <span className={cn('flex flex-col', hookTone)}><span className="font-semibold">{a.hookRatePct != null ? `${a.hookRatePct}%` : '—'}{a.hookDeltaPp != null ? ` (${a.hookDeltaPp > 0 ? '+' : ''}${a.hookDeltaPp})` : ''}</span><span className="text-[10px] text-gray-400 dark:text-white/40">Hook{a.hookClass ? ` ${a.hookClass}` : ''}</span></span>
        <span className={cn('flex flex-col', bodyTone)}><span className="font-semibold">{a.retention50to75 != null ? `${a.retention50to75}%` : '—'}{a.bodyDeltaPp != null ? ` (${a.bodyDeltaPp > 0 ? '+' : ''}${a.bodyDeltaPp})` : ''}</span><span className="text-[10px] text-gray-400 dark:text-white/40">50→75</span></span>
        <span className="flex flex-col text-gray-500 dark:text-white/50"><span className="font-semibold">{a.biggestDrop ? `−${a.biggestDrop.dropPct}%` : '—'}</span><span className="text-[10px] text-gray-400 dark:text-white/40">{a.biggestDrop ? a.biggestDrop.segment : 'Drop'}</span></span>
      </div>
      <ConfTag c={a.confidence} />
    </button>
  );
}

function FindingSection({ title, items, flat }: { title: string; items: StrategyFinding[]; flat?: boolean }) {
  if (!items?.length) return null;
  return (
    <section className="flex flex-col gap-2">
      {flat ? <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">{title}</div> : <MetaSectionLabel>{title}</MetaSectionLabel>}
      <div className="flex flex-col gap-2">
        {items.map((f, i) => (
          <div key={i} className={flat ? 'flex items-start gap-2' : cn(META_FRAME, 'flex items-start gap-2.5 px-4 py-3')}>
            {!flat && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-meta" />}
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-gray-900 dark:text-white">{f.title}</div>
              {f.detail && <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-white/60">{f.detail}</p>}
            </div>
            {!flat && <ConfTag c={f.confidence} />}
          </div>
        ))}
      </div>
    </section>
  );
}
