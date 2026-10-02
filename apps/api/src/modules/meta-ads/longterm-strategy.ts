/**
 * Long-Term Review — Strategie-Engine (rein & deterministisch).
 *
 * Herzstück: aus historischen Performance-Daten EINER Produktgruppe werden
 * - Historical Controls (starke Conversion/Scale-Struktur),
 * - Segment-Winner (wer gewinnt welchen Abschnitt),
 * - Conversion-Winner & Salvage (schwacher Hook + starke Conversion),
 * - und daraus KONKRETE Recombination-Tests (CONTROL + ONE CHANGE)
 * abgeleitet. Zahlen/Entscheidungen hier; das LLM erklärt/priorisiert nur.
 *
 * Grundsätze: keine Kausalität (alles Test-Hypothesen), keine Blackbox-Scores
 * (nachvollziehbare reasons), späte Segmente über Start-Viewer relativiert,
 * Spend allein ist KEIN Winner-Signal, nur dasselbe Produkt (kein Cross-Product).
 */
import { HOOK_RULES } from './creative-rules';
import { SegmentKey, SegmentResult } from './longterm-segments';

export type Evidence = 'low' | 'medium' | 'high';
export type LtHookClass = 'strong' | 'iteration' | 'weak' | 'promising' | null;

export type LtRecommendationType =
  | 'REPLACE_OPENING' | 'REPLACE_3_TO_25' | 'REPLACE_25_TO_50' | 'REPLACE_50_TO_75'
  | 'REPLACE_75_TO_95' | 'REPLACE_ENDING' | 'MULTI_SEGMENT_EXPLORATION' | 'RETEST_LOW_CONFIDENCE';

const SEG_TO_TYPE: Record<SegmentKey, LtRecommendationType> = {
  opening: 'REPLACE_OPENING', early: 'REPLACE_3_TO_25', mid_a: 'REPLACE_25_TO_50',
  mid_b: 'REPLACE_50_TO_75', late: 'REPLACE_75_TO_95', ending: 'REPLACE_ENDING',
};
const SEG_PCT: Record<SegmentKey, { from: number; to: number }> = {
  opening: { from: 0, to: 3 }, early: { from: 0, to: 25 }, mid_a: { from: 25, to: 50 },
  mid_b: { from: 50, to: 75 }, late: { from: 75, to: 95 }, ending: { from: 95, to: 100 },
};

/** Nachvollziehbare Schwellen (keine Blackbox). */
export const LT_THRESHOLDS = {
  hookMinImpressions: 3000,
  controlMinPurchases: 20,
  controlMinSpend: 1000,
  conversionWinnerMinPurchases: 20,
  segmentDeltaPp: 8,            // „materiell schwächer" für einen Replace-Vorschlag
  impr: { high: 30000, medium: 8000 },
  purch: { high: 50, medium: 10 },
} as const;

export interface LtAd {
  adId: string;            // stabile Kennung (Snapshot-ID)
  metaAdId: string | null;
  name: string;
  matchedAdId: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  purchases: number | null;
  websitePurchases: number | null;
  metaRoas: number | null;
  costPerPurchase: number | null;
  conversionValue: number | null;
  hookRatePct: number | null;
  holdRatePct: number | null;
  outboundCtr: number | null;
  ctrAll: number | null;
  avgWatchTime: number | null;
  videoLengthSeconds: number | null;
  segments: SegmentResult[];
}

export interface LtFact { adId: string; adName: string; metric: string; value: number | null }

export function impressionEvidence(impr: number | null): Evidence {
  const v = impr ?? 0;
  if (v >= LT_THRESHOLDS.impr.high) return 'high';
  if (v >= LT_THRESHOLDS.impr.medium) return 'medium';
  return 'low';
}
export function conversionEvidence(purchases: number | null): Evidence {
  const v = purchases ?? 0;
  if (v >= LT_THRESHOLDS.purch.high) return 'high';
  if (v >= LT_THRESHOLDS.purch.medium) return 'medium';
  return 'low';
}
/** Hook-Klasse nach den bestehenden Regeln, über Impressions-Evidenz relativiert. */
export function classifyLtHook(hookRatePct: number | null, impr: number | null): LtHookClass {
  if (hookRatePct == null) return null;
  const ev = impressionEvidence(impr);
  if (ev === 'low') return 'promising'; // starke Rate bei dünner Datenlage ist nicht „strong"
  if (hookRatePct >= HOOK_RULES.strongPct) return 'strong';
  if (hookRatePct >= HOOK_RULES.iterationPct) return 'iteration';
  return 'weak';
}

const EVID_RANK: Record<Evidence, number> = { low: 0, medium: 1, high: 2 };
const minEvidence = (a: Evidence, b: Evidence): Evidence => (EVID_RANK[a] <= EVID_RANK[b] ? a : b);

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
export function percentile(nums: number[], p: number): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx];
}
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

// --------------------------------------------------------------------------- outputs

export interface HistoricalControl {
  adId: string; metaAdId: string | null; name: string;
  spend: number | null; impressions: number | null; purchases: number | null;
  metaRoas: number | null; hookRate: number | null; confidence: Evidence;
  reasons: string[]; weaknesses: string[];
}
export interface SegmentWinner {
  segment: SegmentKey; segmentLabel: string; adId: string; adName: string;
  retention: number | null; drop: number | null; startViewers: number; endViewers: number;
  confidence: Evidence; relativeRank: number; baselineDelta: number | null;
  startSecond: number | null; endSecond: number | null;
}
export interface ConversionWinner { adId: string; name: string; purchases: number | null; metaRoas: number | null; spend: number | null; hookRate: number | null; hookClass: LtHookClass; confidence: Evidence }
export interface SalvageOpportunity { adId: string; name: string; hookRate: number | null; purchases: number | null; metaRoas: number | null; reason: string }
export interface WeakAd { adId: string; name: string; reasons: string[] }
export interface MatrixRow {
  adId: string; name: string; hookRate: number | null;
  segmentRetention: Partial<Record<SegmentKey, number | null>>;
  outboundCtr: number | null; purchases: number | null; spend: number | null; metaRoas: number | null; confidence: Evidence;
}
export interface RecombinationCandidate {
  id: string; recommendationType: LtRecommendationType; priority: 'high' | 'medium' | 'low'; confidence: Evidence;
  baseAdId: string; baseAdName: string;
  sourceAdId: string | null; sourceAdName: string | null;
  changeSegment: SegmentKey | null; changeSegmentLabel: string | null;
  keepSegments: SegmentKey[];
  sourceSegment: SegmentKey | null;
  sourceStartPercent: number | null; sourceEndPercent: number | null;
  approximateStartSecond: number | null; approximateEndSecond: number | null;
  facts: LtFact[];
  reason: string;
}
export interface Distribution {
  hookRate: { median: number | null; p90: number | null };
  outboundCtr: { median: number | null; p90: number | null };
  purchases: { median: number | null; p90: number | null };
  costPerPurchase: { median: number | null; p90: number | null };
  segmentRetentionMedian: Partial<Record<SegmentKey, number | null>>;
}
export interface LtStrategy {
  historicalControls: HistoricalControl[];
  segmentWinners: SegmentWinner[];                 // bester je Segment
  segmentRankings: Partial<Record<SegmentKey, SegmentWinner[]>>;
  conversionWinners: ConversionWinner[];
  salvageOpportunities: SalvageOpportunity[];
  weakAds: WeakAd[];
  matrix: MatrixRow[];
  distribution: Distribution;
  recombinationCandidates: RecombinationCandidate[];
}

const fact = (a: LtAd, metric: string, value: number | null): LtFact => ({ adId: a.adId, adName: a.name, metric, value });
const segOf = (a: LtAd, key: SegmentKey) => a.segments.find((s) => s.key === key) ?? null;

export function analyzeLongTerm(ads: LtAd[]): LtStrategy {
  const withData = ads.filter((a) => (a.impressions ?? 0) > 0);

  // --- Historical Controls / Conversion Winners ---
  const controls: HistoricalControl[] = [];
  const conversionWinners: ConversionWinner[] = [];
  for (const a of withData) {
    const convEv = conversionEvidence(a.purchases);
    const hookClass = classifyLtHook(a.hookRatePct, a.impressions);
    if ((a.purchases ?? 0) >= LT_THRESHOLDS.conversionWinnerMinPurchases) {
      conversionWinners.push({ adId: a.adId, name: a.name, purchases: a.purchases, metaRoas: a.metaRoas, spend: a.spend, hookRate: r1(a.hookRatePct), hookClass, confidence: convEv });
    }
    const isControl = (a.purchases ?? 0) >= LT_THRESHOLDS.controlMinPurchases
      && (a.spend ?? 0) >= LT_THRESHOLDS.controlMinSpend
      && convEv !== 'low'
      && (a.metaRoas == null || a.metaRoas >= 1);
    if (isControl) {
      const reasons = [
        `${Math.round(a.spend ?? 0)} € Spend`,
        `${a.purchases} Käufe`,
        a.impressions != null ? `${a.impressions.toLocaleString('de-DE')} Impressionen` : null,
        a.metaRoas != null ? `Meta ROAS ${a.metaRoas}×` : null,
      ].filter(Boolean) as string[];
      const weaknesses: string[] = [];
      if (hookClass === 'weak') weaknesses.push(`schwacher Hook (${r1(a.hookRatePct)} %)`);
      const worst = [...a.segments].filter((s) => s.confidence !== 'low' && s.drop != null).sort((x, y) => (y.drop! - x.drop!))[0];
      if (worst) weaknesses.push(`größter Drop ${worst.position} (−${worst.drop} %)`);
      controls.push({ adId: a.adId, metaAdId: a.metaAdId, name: a.name, spend: a.spend, impressions: a.impressions, purchases: a.purchases, metaRoas: a.metaRoas, hookRate: r1(a.hookRatePct), confidence: convEv, reasons, weaknesses });
    }
  }
  controls.sort((x, y) => (y.purchases ?? 0) - (x.purchases ?? 0));
  conversionWinners.sort((x, y) => (y.purchases ?? 0) - (x.purchases ?? 0));

  // --- Segment Winners (relativ innerhalb der Gruppe, Confidence-gated) ---
  const SEG_KEYS: SegmentKey[] = ['opening', 'early', 'mid_a', 'mid_b', 'late', 'ending'];
  const segmentRankings: Partial<Record<SegmentKey, SegmentWinner[]>> = {};
  const segmentWinners: SegmentWinner[] = [];
  const segRetMedian: Partial<Record<SegmentKey, number | null>> = {};
  for (const key of SEG_KEYS) {
    const rows = withData
      .map((a) => ({ a, s: segOf(a, key) }))
      .filter((x): x is { a: LtAd; s: SegmentResult } => !!x.s && x.s.retention != null);
    const med = median(rows.map((x) => x.s.retention!));
    segRetMedian[key] = r1(med);
    const eligible = rows.filter((x) => x.s.confidence !== 'low'); // #11/#12 späte Mini-Populationen raus
    eligible.sort((x, y) => (y.s.retention! - x.s.retention!));
    const ranked: SegmentWinner[] = eligible.map((x, i) => ({
      segment: key, segmentLabel: x.s.label, adId: x.a.adId, adName: x.a.name,
      retention: x.s.retention, drop: x.s.drop, startViewers: x.s.startViewers, endViewers: x.s.endViewers,
      confidence: x.s.confidence as Evidence, relativeRank: i + 1,
      baselineDelta: med != null && x.s.retention != null ? r1(x.s.retention - med) : null,
      startSecond: x.s.startSecond, endSecond: x.s.endSecond,
    }));
    if (ranked.length) { segmentRankings[key] = ranked; segmentWinners.push(ranked[0]); }
  }

  // --- Salvage: schwacher Hook + starke Conversion ---
  const controlIds = new Set(controls.map((c) => c.adId));
  const salvageOpportunities: SalvageOpportunity[] = withData
    .filter((a) => classifyLtHook(a.hookRatePct, a.impressions) === 'weak' && (a.purchases ?? 0) >= LT_THRESHOLDS.conversionWinnerMinPurchases)
    .map((a) => ({ adId: a.adId, name: a.name, hookRate: r1(a.hookRatePct), purchases: a.purchases, metaRoas: a.metaRoas, reason: 'Schwacher Einstieg, aber starke historische Conversion-Signale — Struktur als Control behalten, Opening austauschen.' }));

  // --- Weak ads (genug Daten, überall schwach, keine Conversion) ---
  const weakAds: WeakAd[] = withData
    .filter((a) => impressionEvidence(a.impressions) !== 'low' && classifyLtHook(a.hookRatePct, a.impressions) === 'weak' && (a.purchases ?? 0) < LT_THRESHOLDS.conversionWinnerMinPurchases)
    .map((a) => ({ adId: a.adId, name: a.name, reasons: [`Hook ${r1(a.hookRatePct)} % (weak)`, `${a.purchases ?? 0} Käufe`] }));

  // --- Matrix ---
  const matrix: MatrixRow[] = withData.map((a) => {
    const segmentRetention: Partial<Record<SegmentKey, number | null>> = {};
    for (const key of SEG_KEYS) { const s = segOf(a, key); if (s) segmentRetention[key] = s.retention; }
    return { adId: a.adId, name: a.name, hookRate: r1(a.hookRatePct), segmentRetention, outboundCtr: r1(a.outboundCtr), purchases: a.purchases, spend: a.spend, metaRoas: a.metaRoas, confidence: impressionEvidence(a.impressions) };
  });

  // --- Distribution (#65) ---
  const distribution: Distribution = {
    hookRate: { median: r1(median(withData.map((a) => a.hookRatePct).filter((n): n is number => n != null))), p90: r1(percentile(withData.map((a) => a.hookRatePct).filter((n): n is number => n != null), 90)) },
    outboundCtr: { median: r1(median(withData.map((a) => a.outboundCtr).filter((n): n is number => n != null))), p90: r1(percentile(withData.map((a) => a.outboundCtr).filter((n): n is number => n != null), 90)) },
    purchases: { median: r1(median(withData.map((a) => a.purchases).filter((n): n is number => n != null))), p90: r1(percentile(withData.map((a) => a.purchases).filter((n): n is number => n != null), 90)) },
    costPerPurchase: { median: r1(median(withData.map((a) => a.costPerPurchase).filter((n): n is number => n != null))), p90: r1(percentile(withData.map((a) => a.costPerPurchase).filter((n): n is number => n != null), 90)) },
    segmentRetentionMedian: segRetMedian,
  };

  // --- Recombination candidates (CONTROL + ONE CHANGE) ---
  const recombinationCandidates: RecombinationCandidate[] = [];
  const openingWinner = segmentRankings.opening?.[0] ?? null;
  const hookWinnerAd = openingWinner ? withData.find((a) => a.adId === openingWinner.adId) ?? null : bestHookAd(withData);

  // Basis-Kandidaten: Controls (bevorzugt), sonst Conversion-Winner.
  const baseAds = controls.length ? controls.map((c) => withData.find((a) => a.adId === c.adId)!).filter(Boolean)
    : conversionWinners.slice(0, 2).map((c) => withData.find((a) => a.adId === c.adId)!).filter(Boolean);

  for (const base of baseAds) {
    // 1) Weak-Hook-Control -> Opening ersetzen (höchste Priorität, #21)
    const baseHook = classifyLtHook(base.hookRatePct, base.impressions);
    if ((baseHook === 'weak' || baseHook === 'iteration') && hookWinnerAd && hookWinnerAd.adId !== base.adId) {
      const srcSeg = segOf(hookWinnerAd, 'opening');
      recombinationCandidates.push(mkCandidate('REPLACE_OPENING', 'opening', base, hookWinnerAd, srcSeg, 'high',
        [fact(base, 'purchases', base.purchases), fact(base, 'spend', base.spend), fact(base, 'hookRate', r1(base.hookRatePct)), fact(hookWinnerAd, 'hookRate', r1(hookWinnerAd.hookRatePct))],
        `${base.name} zeigt starke historische Conversion/Scale-Signale bei schwächerem Einstieg; ${hookWinnerAd.name} zeigt die stärkste validierte Hook-Performance der Gruppe.`));
    }
    // 2) Schwächstes Mid/Late-Segment der Base gegen den Segment-Winner tauschen (#22/#23)
    for (const key of ['mid_a', 'mid_b', 'late', 'early', 'ending'] as SegmentKey[]) {
      const baseSeg = segOf(base, key);
      const winner = segmentRankings[key]?.[0];
      if (!baseSeg || baseSeg.retention == null || !winner || winner.adId === base.adId) continue;
      if (winner.confidence === 'low') continue; // #55-F
      const delta = (winner.retention ?? 0) - baseSeg.retention;
      const belowMedian = segRetMedian[key] != null && baseSeg.retention < (segRetMedian[key] as number);
      if (delta < LT_THRESHOLDS.segmentDeltaPp || !belowMedian) continue;
      const src = withData.find((a) => a.adId === winner.adId)!;
      const srcSeg = segOf(src, key);
      recombinationCandidates.push(mkCandidate(SEG_TO_TYPE[key], key, base, src, srcSeg, minEvidence(conversionEvidence(base.purchases), winner.confidence),
        [fact(base, `retention_${key}`, baseSeg.retention), fact(src, `retention_${key}`, winner.retention), fact(base, 'purchases', base.purchases)],
        `${base.name} ist im ${baseSeg.position}-Abschnitt relativ schwach (${baseSeg.retention} %); ${src.name} hält dort deutlich stärker (${winner.retention} %).`));
    }
  }

  // Dedupe (base+segment) + sort by priority.
  const seen = new Set<string>();
  const deduped = recombinationCandidates.filter((c) => { const k = `${c.baseAdId}|${c.recommendationType}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const prioRank = { high: 0, medium: 1, low: 2 };
  deduped.sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);

  // 3) Exploratory multi-segment (#25) — nur bei >=3 Ads mit Daten und genug Segment-Winnern.
  if (withData.length >= 3 && segmentWinners.length >= 3) {
    const base = baseAds[0];
    if (base) {
      const facts = segmentWinners.filter((w) => w.confidence !== 'low').slice(0, 6).map((w) => ({ adId: w.adId, adName: w.adName, metric: `retention_${w.segment}`, value: w.retention }));
      deduped.push({
        id: 'multi', recommendationType: 'MULTI_SEGMENT_EXPLORATION', priority: 'low', confidence: 'low',
        baseAdId: base.adId, baseAdName: base.name, sourceAdId: null, sourceAdName: null,
        changeSegment: null, changeSegmentLabel: null, keepSegments: [], sourceSegment: null,
        sourceStartPercent: null, sourceEndPercent: null, approximateStartSecond: null, approximateEndSecond: null,
        facts, reason: 'Exploratory: Best-of-Segment aus mehreren Ads kombinieren. Diese Kombination wurde so noch nie getestet — als Exploration behandeln, nicht als Winner.',
      });
    }
  }

  // 4) Retest low-confidence ads (keine aggressive Empfehlung, #54)
  for (const a of withData) {
    if (impressionEvidence(a.impressions) === 'low' && (a.purchases ?? 0) < LT_THRESHOLDS.conversionWinnerMinPurchases) {
      deduped.push({
        id: `retest:${a.adId}`, recommendationType: 'RETEST_LOW_CONFIDENCE', priority: 'low', confidence: 'low',
        baseAdId: a.adId, baseAdName: a.name, sourceAdId: null, sourceAdName: null,
        changeSegment: null, changeSegmentLabel: null, keepSegments: [], sourceSegment: null,
        sourceStartPercent: null, sourceEndPercent: null, approximateStartSecond: null, approximateEndSecond: null,
        facts: [fact(a, 'impressions', a.impressions), fact(a, 'purchases', a.purchases)],
        reason: 'Zu dünne Datenlage für eine belastbare Creative-Entscheidung — weiter Daten sammeln, dann erneut bewerten.',
      });
    }
  }

  return { historicalControls: controls, segmentWinners, segmentRankings, conversionWinners, salvageOpportunities, weakAds, matrix, distribution, recombinationCandidates: deduped };
}

function bestHookAd(ads: LtAd[]): LtAd | null {
  const eligible = ads.filter((a) => a.hookRatePct != null && impressionEvidence(a.impressions) !== 'low');
  eligible.sort((x, y) => (y.hookRatePct! - x.hookRatePct!));
  return eligible[0] ?? null;
}

function mkCandidate(type: LtRecommendationType, seg: SegmentKey, base: LtAd, src: LtAd, srcSeg: SegmentResult | null, confidence: Evidence, facts: LtFact[], reason: string): RecombinationCandidate {
  const keep = (['opening', 'early', 'mid_a', 'mid_b', 'late', 'ending'] as SegmentKey[]).filter((k) => k !== seg);
  const priority: 'high' | 'medium' | 'low' = type === 'REPLACE_OPENING' ? 'high' : confidence === 'high' ? 'high' : confidence === 'medium' ? 'medium' : 'low';
  return {
    id: `${type}:${base.adId}->${src.adId}`, recommendationType: type, priority, confidence,
    baseAdId: base.adId, baseAdName: base.name, sourceAdId: src.adId, sourceAdName: src.name,
    changeSegment: seg, changeSegmentLabel: srcSeg?.label ?? seg, keepSegments: keep, sourceSegment: seg,
    sourceStartPercent: SEG_PCT[seg].from, sourceEndPercent: SEG_PCT[seg].to,
    approximateStartSecond: srcSeg?.startSecond ?? null, approximateEndSecond: srcSeg?.endSecond ?? null,
    facts, reason,
  };
}
