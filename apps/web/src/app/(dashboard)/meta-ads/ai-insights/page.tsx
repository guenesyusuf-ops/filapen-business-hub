'use client';

import { useState } from 'react';
import { Sparkles, Brain, AlertTriangle, Lightbulb, FlaskConical, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaSectionLabel, MetaDivider, MetaEmptyState, META_FRAME, btnPrimary, btnGhost } from '@/components/meta-ads/MetaUI';
import { useMetaAdsList } from '@/hooks/meta-ads/useMetaAds';
import {
  useAnalyze, useAnalyses, useAcceptRecommendation, Analysis, AiStatement, AiRecommendation, Confidence, CONF_LABELS,
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
      <MetaPageHeader eyebrow="Meta Ads" title="AI Creative Intelligence"
        description="KI-Interpretation auf Basis der deterministischen Facts — strikt getrennt in Facts, Beobachtung, Interpretation, Hypothese, Empfehlung & Test. Keine Kausalität aus Korrelation. Hyros ROAS bleibt autoritativ.">
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

      {current ? <AnalysisView analysis={current} /> : (
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

function AnalysisView({ analysis }: { analysis: Analysis }) {
  const toast = useToast();
  const accept = useAcceptRecommendation(analysis.id);
  const facts = analysis.facts;
  const result = analysis.result;

  const acceptRec = async (index: number) => {
    try { const res = await accept.mutateAsync(index); toast.success(res.status === 'draft' ? 'Als Entwurf-Idee gespeichert' : 'Idee erstellt'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };

  if (analysis.status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-[11px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div><div className="font-semibold">Analyse nicht möglich</div><p className="mt-1">{analysis.error}</p><p className="mt-1 text-red-500/80">Die deterministischen Facts bleiben unverändert gültig — nur die KI-Interpretation konnte nicht erzeugt werden.</p></div>
      </div>
    );
  }

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
            <MetaSectionLabel>Empfehlungen & Tests · {result.recommendations.length}</MetaSectionLabel>
            {result.recommendations.length === 0 ? <p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine Empfehlungen.</p> : (
              <div className="flex flex-col gap-2.5">
                {result.recommendations.map((r, i) => <RecommendationCard key={i} r={r} onAccept={() => acceptRec(i)} pending={accept.isPending} />)}
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
