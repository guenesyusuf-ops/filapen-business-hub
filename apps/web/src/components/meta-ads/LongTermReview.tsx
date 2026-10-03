'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, Loader2, FileText, Check, Lightbulb, ArrowRight, Film, TrendingUp, AlertTriangle, History, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { ProductGroupSelect } from '@/components/meta-ads/ProductGroupSelect';
import { MetaSectionLabel, MetaEmptyState, META_FRAME, btnPrimary, btnGhost } from '@/components/meta-ads/MetaUI';
import {
  useLtPreview, useLtRun, useLtReviews, useLtReview, useLtAccept,
  LtPreview, LtResult, LtReview, LtNextTest, HistoricalControl, SegmentWinner, MatrixRow, StoryboardTile,
  SEGMENT_LABELS, SEGMENT_ORDER, SegmentKey,
} from '@/hooks/meta-ads/useLongTerm';

const CONF_LABEL: Record<string, string> = { low: 'Gering', medium: 'Mittel', high: 'Hoch' };

export function LongTermReview() {
  const toast = useToast();
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LtPreview | null>(null);
  const [review, setReview] = useState<LtReview | null>(null);
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewM = useLtPreview();
  const runM = useLtRun();
  const reviews = useLtReviews(groupId);
  const openedReview = useLtReview(openReviewId);

  const activeResult: LtReview | null = openReviewId ? (openedReview.data ?? null) : review;

  const doPreview = async () => {
    if (!groupId) { toast.error('Bitte eine Produktgruppe wählen'); return; }
    if (!file) { toast.error('Bitte eine Datei wählen'); return; }
    try { const pv = await previewM.mutateAsync({ file, productGroupId: groupId }); setPreview(pv); setReview(null); setOpenReviewId(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Vorschau fehlgeschlagen'); }
  };
  const doRun = async () => {
    if (!groupId || !file) return;
    try { const r = await runM.mutateAsync({ file, productGroupId: groupId }); setReview(r); setOpenReviewId(null); if (r.status === 'error') toast.error(r.error || 'Analyse fehlgeschlagen'); else toast.success('Langzeitbewertung erstellt'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Analyse fehlgeschlagen'); }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-[12.5px] text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
        Lade einen aggregierten Meta-Export über mehrere Monate hoch. Filapen vergleicht die historischen Ads deines Produkts, erkennt starke Creative-Abschnitte und schlägt datenbasierte Recombination-Tests vor. Tageswerte bleiben unberührt.
      </div>

      {/* Upload-Zeile — bewusst OHNE overflow-hidden (META_FRAME), sonst klippt die Karte das Produkt-Dropdown. */}
      <div className="flex flex-col gap-3 rounded-[11px] border border-gray-200/80 bg-white p-4 dark:border-white/[0.08] dark:bg-[var(--card-bg)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/40">Produktgruppe</span>
            <div className="w-[240px] max-w-full"><ProductGroupSelect mode="filter" value={groupId} onChange={setGroupId} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/40">Historischer Export (CSV/XLSX)</span>
            <button onClick={() => inputRef.current?.click()} className={cn(btnGhost, 'h-[38px]')}>
              <FileText className="h-4 w-4" /> {file ? file.name.slice(0, 32) : 'Datei wählen'}
            </button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
          </div>
          <button onClick={doPreview} disabled={previewM.isPending || !groupId || !file} className={cn(btnGhost, 'h-[38px]')}>
            {previewM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Vorschau
          </button>
          <button onClick={doRun} disabled={runM.isPending || !groupId || !file} className={cn(btnPrimary, 'h-[38px]')}>
            {runM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Analyse starten
          </button>
        </div>

        {runM.isPending && (
          <p className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Langzeitanalyse läuft — die KI wertet alle Ads deines Produkts aus. Das kann 1–3 Minuten dauern; bitte den Tab offen lassen.
          </p>
        )}
        {preview && <PreviewPanel pv={preview} />}
      </div>

      {activeResult && activeResult.status === 'error' && (
        <div className="flex items-start gap-3 rounded-[11px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><div className="font-semibold">Analyse nicht möglich</div><p className="mt-1">{activeResult.error}</p><p className="mt-1 text-red-500/80">Die deterministischen Fakten (Controls, Segment-Winner) bleiben gültig — nur die KI-Erklärung konnte nicht erzeugt werden.</p></div>
        </div>
      )}
      {activeResult && activeResult.status !== 'error' && activeResult.result && <ResultView review={activeResult} result={activeResult.result} />}

      {/* Review-History */}
      <section className="flex flex-col gap-3">
        <MetaSectionLabel>Historische Reviews</MetaSectionLabel>
        {reviews.data?.items?.length ? (
          <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
            {reviews.data.items.map((r) => (
              <button key={r.id} onClick={() => { setOpenReviewId(r.id); setReview(null); setPreview(null); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
                <History className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800 dark:text-white/85">{r.periodStart} – {r.periodEnd} · {r.adCount ?? '—'} Ads · {r.productGroupName ?? 'Produkt'}</span>
                {r.status === 'error' ? <span className="text-[11px] text-red-500">Fehler</span> : r.confidence && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-white/10 dark:text-white/50">{CONF_LABEL[r.confidence]}</span>}
                <span className="text-[11px] text-gray-400 dark:text-white/40">{r.createdAt?.slice(0, 10)}</span>
              </button>
            ))}
          </div>
        ) : <p className="text-[12.5px] text-gray-400 dark:text-white/40">Noch keine Langzeitbewertungen.</p>}
      </section>
    </div>
  );
}

function PreviewPanel({ pv }: { pv: LtPreview }) {
  const s = pv.summary;
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={cn('rounded-full px-2 py-0.5 font-medium', pv.detectedType === 'historical' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400')}>
          {pv.detectedType === 'historical' ? 'Aggregierter Historical Export erkannt' : 'Sieht wie ein Tages-Export aus — prüfen'}
        </span>
        <span className="text-gray-500 dark:text-white/50">{pv.periodStart} – {pv.periodEnd}{pv.spanDays != null ? ` · ${pv.spanDays} Tage` : ''} · {pv.uniqueAds} Ads</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-gray-600 dark:text-white/60">
        <span>{s.total} Zeilen</span><span className="font-medium text-green-700 dark:text-green-400">{s.ready + s.unmatched} auswertbar</span>
        <span>{s.matchedExisting} in Filapen gematcht</span><span>{s.unmatched} neu (nicht in Filapen)</span>
        {s.otherProduct > 0 && <span className="text-amber-700 dark:text-amber-400">{s.otherProduct} anderes Produkt (ausgeschlossen)</span>}
        {s.invalid > 0 && <span className="text-red-600 dark:text-red-400">{s.invalid} ungültig</span>}
        <span>· {s.withSpend} Spend · {s.withPurchases} Käufe · {s.withCheckpoints} Checkpoints · {s.withHookHold} Hook/Hold</span>
      </div>
      {s.otherProduct > 0 && (
        <p className="text-[11.5px] text-amber-700 dark:text-amber-400">
          {s.otherProduct} Ad(s) gehören laut Filapen zu einem anderen Produkt und werden NICHT mitgemischt. Prüfe die Produktgruppe, falls das falsch ist.
        </p>
      )}
    </div>
  );
}

function ResultView({ review, result: r }: { review: LtReview; result: LtResult }) {
  const toast = useToast();
  const accept = useLtAccept(review.id);
  const [saved, setSaved] = useState<Record<string, string>>({});

  const save = async (rec: LtNextTest) => {
    try { const res = await accept.mutateAsync(rec.id); setSaved((x) => ({ ...x, [rec.id]: res.ideaId })); toast.success(res.alreadyExisted ? 'Bereits als Entwurf vorhanden' : 'Als Entwurf-Idee gespeichert'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };
  const h = r.historicalHealth;
  const batch = [...r.nextProductionBatch].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-accent-meta" />
        <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{review.productGroupName ?? 'Produkt'}</span>
        <span className="text-[12px] text-gray-400 dark:text-white/40">· {h.periodStart} – {h.periodEnd} · {review.model}</span>
      </div>
      {r.executiveSummary && <p className="rounded-[10px] bg-gray-50 px-4 py-3 text-[13.5px] leading-relaxed text-gray-800 dark:bg-white/5 dark:text-white/85">{r.executiveSummary}</p>}

      {/* Historical Health */}
      <section className="flex flex-col gap-2">
        <MetaSectionLabel>Historical Health</MetaSectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Ads', String(h.adsAnalyzed)], ['Spend', h.spend], ['Impressionen', h.impressions.toLocaleString('de-DE')], ['Käufe', String(h.purchases)], ['Zeitraum', `${(h.periodStart ?? '').slice(5)}–${(h.periodEnd ?? '').slice(5)}`], ['Confidence', CONF_LABEL[h.confidence] ?? h.confidence]].map(([l, v]) => (
            <div key={l} className={cn(META_FRAME, 'flex flex-col gap-0.5 px-3 py-2.5')}><span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{v}</span><span className="text-[11px] text-gray-400 dark:text-white/40">{l}</span></div>
          ))}
        </div>
        {r.historicalHealthNote && <p className="text-[12.5px] text-gray-500 dark:text-white/55">{r.historicalHealthNote}</p>}
      </section>

      {/* WHAT TO BUILD NEXT */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent-meta" /><h2 className="text-[16px] font-bold text-gray-900 dark:text-white">What to Build Next</h2><span className="text-[12px] text-gray-400 dark:text-white/40">· {batch.length}</span></div>
        {batch.length === 0 ? <p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine belastbaren Recombination-Tests — zu wenig Datenlage.</p> : batch.map((rec, i) => <TestCard key={rec.id} n={i + 1} rec={rec} saved={saved[rec.id]} onSave={() => save(rec)} pending={accept.isPending} />)}
      </section>

      {/* Historical Controls */}
      {r.historicalControls.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Historical Controls</MetaSectionLabel>
          <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
            {r.historicalControls.map((c) => <ControlRow key={c.adId} c={c} />)}
          </div>
        </section>
      )}

      {/* Segment Performance Heatmap */}
      {r.segmentMatrix.length > 0 && (
        <section className="flex flex-col gap-2">
          <MetaSectionLabel>Segment Performance Heatmap</MetaSectionLabel>
          <p className="text-[11px] text-gray-400 dark:text-white/40">Relativ innerhalb dieses Produkts (keine externe Benchmark). Dunkler = stärker. Retention pro Abschnitt = end/start.</p>
          <Heatmap matrix={r.segmentMatrix} />
        </section>
      )}

      {/* Segment winners */}
      <WinnerGrid result={r} />

      {/* Conversion winners + Salvage */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {r.conversionWinners.length > 0 && (
          <section className="flex flex-col gap-2"><MetaSectionLabel>Conversion-Winner</MetaSectionLabel>
            <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
              {r.conversionWinners.slice(0, 6).map((c) => <div key={c.adId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]"><span className="truncate text-gray-800 dark:text-white/85">{c.name}</span><span className="shrink-0 tabular-nums text-gray-500 dark:text-white/50">{c.purchases} Käufe · ROAS {c.metaRoas ?? '—'}× · Hook {c.hookRate ?? '—'}%</span></div>)}
            </div>
          </section>
        )}
        {r.salvageOpportunities.length > 0 && (
          <section className="flex flex-col gap-2"><MetaSectionLabel>Salvage Opportunities</MetaSectionLabel>
            <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
              {r.salvageOpportunities.map((c) => <div key={c.adId} className="flex flex-col gap-0.5 px-4 py-2.5 text-[12.5px]"><span className="truncate font-medium text-gray-800 dark:text-white/85">{c.name}</span><span className="text-[11.5px] text-amber-700 dark:text-amber-400">Hook {c.hookRate ?? '—'}% schwach · {c.purchases} Käufe — Struktur behalten, Opening tauschen</span></div>)}
            </div>
          </section>
        )}
      </div>

      {r.attentionFindings.length > 0 && (
        <section className="flex flex-col gap-2"><MetaSectionLabel>Attention-Findings</MetaSectionLabel>
          <div className="flex flex-col gap-2">{r.attentionFindings.map((f, i) => <div key={i} className={cn(META_FRAME, 'px-4 py-3')}><div className="text-[13px] font-semibold text-gray-900 dark:text-white">{f.title}</div>{f.detail && <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-white/60">{f.detail}</p>}</div>)}</div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-white/40">
        Alle Empfehlungen sind Test-Hypothesen, keine garantierten Winner. Zahlen stammen ausschließlich aus den historischen Daten; das Modell liefert nur die Erklärung. Meta ROAS ist Meta ROAS (nicht Hyros). Keine Kausalität.
      </p>
    </div>
  );
}

function TestCard({ n, rec, saved, onSave, pending }: { n: number; rec: LtNextTest; saved?: string; onSave: () => void; pending: boolean }) {
  const prio = rec.priority === 'high' ? 'bg-accent-meta/10 text-accent-meta' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50';
  const isReplace = rec.recommendationType.startsWith('REPLACE_');
  return (
    <div className={cn(META_FRAME, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-meta/10 text-[13px] font-bold text-accent-meta">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[14.5px] font-semibold text-gray-900 dark:text-white">{rec.title}</span><span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide', prio)}>{rec.priority}</span></div>
        </div>
      </div>
      {rec.why && <p className="text-[13px] leading-relaxed text-gray-700 dark:text-white/75"><b>Warum:</b> {rec.why}</p>}
      {isReplace && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Box label="BASE / CONTROL" tone="keep">{rec.baseAdName}</Box>
          <Box label={`CHANGE · ${rec.changeLabel}${rec.approximateStartSecond != null ? ` (ca. ${rec.approximateStartSecond}–${rec.approximateEndSecond}s)` : ''}`} tone="change">{rec.sourceStartPercent != null ? `${rec.sourceStartPercent}–${rec.sourceEndPercent}%-Abschnitt` : rec.changeLabel}</Box>
          <Box label="SOURCE" tone="use">{rec.sourceAdName ?? '—'}</Box>
        </div>
      )}
      {rec.keepLabels.length > 0 && <div className="text-[11.5px] text-gray-500 dark:text-white/50">KEEP: {rec.keepLabels.join(' · ')}</div>}
      {rec.facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rec.facts.map((f, i) => <span key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] tabular-nums text-gray-700 dark:bg-white/10 dark:text-white/70">{f.adName.slice(0, 18)} · {f.metric} {f.value ?? '—'}</span>)}
        </div>
      )}
      {rec.expectedLearning && <p className="text-[11.5px] text-gray-400 dark:text-white/40">Learning: {rec.expectedLearning}</p>}
      {rec.storyboard && rec.storyboard.length > 0 && <Storyboard tiles={rec.storyboard} />}
      <div className="flex flex-wrap items-center gap-2">
        {saved ? <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700 dark:text-green-400"><Check className="h-4 w-4" /> Als Entwurf gespeichert</span>
          : <button onClick={onSave} disabled={pending} className={btnGhost}><Lightbulb className="h-4 w-4" /> Als Idee speichern</button>}
        {saved && <Link href={`/meta-ads/ideas?focus=${saved}`} className="inline-flex items-center gap-1 text-[12.5px] text-accent-meta hover:underline">Entwurf öffnen <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
    </div>
  );
}

// Visueller Bauplan der Idee — Kachel-/Timeline-Ansicht wie im Schnittprogramm.
function Storyboard({ tiles }: { tiles: StoryboardTile[] }) {
  const tone = (t: StoryboardTile) =>
    t.role === 'source' ? 'border-accent-meta/50 bg-accent-meta/[0.08] text-accent-meta'
      : t.role === 'winner' ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-300'
        : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-white/75';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Bauplan · Reihenfolge der Segmente</div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-1 sm:overflow-x-auto">
        {tiles.map((t) => (
          <div key={t.order} title={`${t.segmentLabel} · ${t.position} · ${t.sourceAdName}`}
            className={cn('flex min-w-0 shrink-0 flex-col gap-0.5 rounded-[9px] border px-2.5 py-2 sm:min-w-[120px]', tone(t))}
            style={{ flexGrow: t.durationPercent, flexBasis: 0 }}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold">{t.order}. {t.segmentLabel}</span>
              {t.isChange && <span className="rounded bg-accent-meta px-1 text-[8.5px] font-bold uppercase text-white">neu</span>}
            </div>
            <span className="truncate text-[11.5px] font-medium">{t.sourceAdName}</span>
            <span className="text-[10px] opacity-70">{t.position} · ~{t.durationPercent}%</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-gray-400 dark:text-white/40">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-gray-300 bg-gray-50 dark:bg-white/10" /> aus Control (behalten)</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent-meta/60" /> ausgetauscht</span>
        <span>· Zeitanteile positional/ungefähr, keine echten Sekunden</span>
      </div>
    </div>
  );
}

function Box({ label, tone, children }: { label: string; tone: 'keep' | 'change' | 'use'; children: React.ReactNode }) {
  const t = tone === 'keep' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
    : tone === 'change' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
    : 'border-accent-meta/30 bg-accent-meta/[0.06] text-accent-meta';
  return <div className={cn('rounded-[9px] border px-3 py-2', t)}><div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div><div className="mt-0.5 truncate text-[12.5px] font-medium">{children}</div></div>;
}

function ControlRow({ c }: { c: HistoricalControl }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3"><span className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{c.name}</span><span className="shrink-0 text-[11px] text-gray-400 dark:text-white/40">Confidence {CONF_LABEL[c.confidence]}</span></div>
      <div className="text-[11.5px] text-gray-600 dark:text-white/60">{c.reasons.join(' · ')}</div>
      {c.weaknesses.length > 0 && <div className="text-[11.5px] text-amber-700 dark:text-amber-400">Schwächen: {c.weaknesses.join(' · ')}</div>}
    </div>
  );
}

function WinnerGrid({ result: r }: { result: LtResult }) {
  const blocks: [string, SegmentWinner[]][] = [
    ['Best Openings', r.topOpenings], ['Strong Early', r.strongEarlySections], ['Strong Mid', r.strongMidSections], ['Strong Late', r.strongLateSections], ['Strong Endings', r.strongEndings],
  ];
  const nonEmpty = blocks.filter(([, v]) => v.length);
  if (!nonEmpty.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <MetaSectionLabel>Segment-Winner</MetaSectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nonEmpty.map(([title, winners]) => (
          <div key={title} className={cn(META_FRAME, 'flex flex-col gap-1.5 p-3')}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">{title}</div>
            {winners.slice(0, 3).map((w) => (
              <div key={w.segment + w.adId} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-gray-800 dark:text-white/85">{w.relativeRank}. {w.adName}</span>
                <span className="shrink-0 tabular-nums text-gray-500 dark:text-white/50">{w.retention}%{w.baselineDelta != null ? ` (${w.baselineDelta > 0 ? '+' : ''}${w.baselineDelta})` : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Heatmap({ matrix }: { matrix: MatrixRow[] }) {
  const cols: { key: string; label: string; get: (m: MatrixRow) => number | null }[] = [
    ...SEGMENT_ORDER.map((k) => ({ key: k, label: SEGMENT_LABELS[k], get: (m: MatrixRow) => m.segmentRetention[k as SegmentKey] ?? null })),
    { key: 'ctr', label: 'CTR', get: (m: MatrixRow) => m.outboundCtr },
    { key: 'purch', label: 'Käufe', get: (m: MatrixRow) => m.purchases },
  ];
  const ranges = cols.map((c) => { const vals = matrix.map((m) => c.get(m)).filter((v): v is number => v != null); return { min: Math.min(...vals), max: Math.max(...vals) }; });
  const cell = (v: number | null, idx: number) => {
    if (v == null) return { bg: 'transparent', txt: 'text-gray-300 dark:text-white/20', label: '—' };
    const { min, max } = ranges[idx]; const t = max > min ? (v - min) / (max - min) : 0.5;
    const op = 0.12 + t * 0.6;
    return { bg: `rgba(99,102,241,${op})`, txt: t > 0.6 ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/70', label: cols[idx].key === 'purch' ? String(v) : `${v}${cols[idx].key === 'ctr' ? '' : '%'}` };
  };
  return (
    <div className={cn(META_FRAME, 'overflow-x-auto')}>
      <table className="w-full border-collapse text-[11.5px]">
        <thead><tr className="border-b border-gray-100 dark:border-white/[0.06]">
          <th className="px-3 py-2 text-left font-medium text-gray-400 dark:text-white/40">Ad</th>
          <th className="px-2 py-2 text-right font-medium text-gray-400 dark:text-white/40">Hook%</th>
          {cols.map((c) => <th key={c.key} className="px-2 py-2 text-center font-medium text-gray-400 dark:text-white/40 whitespace-nowrap">{c.label}</th>)}
        </tr></thead>
        <tbody>
          {matrix.map((m) => (
            <tr key={m.adId} className="border-b border-gray-50 last:border-0 dark:border-white/[0.03]">
              <td className="max-w-[180px] truncate px-3 py-1.5 text-gray-800 dark:text-white/85" title={m.name}>{m.name}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-white/50">{m.hookRate ?? '—'}</td>
              {cols.map((c, idx) => { const info = cell(c.get(m), idx); return <td key={c.key} className={cn('px-2 py-1.5 text-center tabular-nums', info.txt)} style={{ background: info.bg }}>{info.label}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
