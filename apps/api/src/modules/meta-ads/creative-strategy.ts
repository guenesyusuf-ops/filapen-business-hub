/**
 * Creative Strategy Engine (Increment H/I) — rein & deterministisch.
 *
 * Erzeugt aus den deterministischen Product-Level-Facts konkrete
 * PRODUKTIONS-KANDIDATEN ("What to Produce Next"): Hook ersetzen, Body behalten,
 * Proof testen, Winner iterieren, Kombination bauen, Low-Confidence erneut testen.
 *
 * Grundprinzip (nicht verhandelbar):
 *  - Zahlen, actionType, KEEP/CHANGE und Fact-Referenzen kommen AUSSCHLIESSLICH
 *    aus dieser Engine. Das LLM erklärt/priorisiert nur (why/observation/…).
 *  - Keine System-triviale Empfehlung ("Ads getrennt auswerten", "Hook Rates
 *    vergleichen") — jeder Kandidat ist eine CREATIVE-Aktion.
 *  - Keine Kausalität: Metriken sind Assoziationen.
 *  - Low Confidence / zu wenig Daten -> niemals aggressive Produktion.
 */
import { HOOK_RULES } from './creative-rules';
import { COMPONENT_DELTA } from './component-intelligence';

export type StrategyActionType =
  | 'NEW_HOOK_VARIANTS'
  | 'REPLACE_HOOK'
  | 'KEEP_HOOK_REPLACE_BODY'
  | 'REPLACE_BODY'
  | 'REPLACE_PROOF'
  | 'REPLACE_CTA'
  | 'BUILD_COMPONENT_COMBINATION'
  | 'ITERATE_WINNING_HOOK'
  | 'ITERATE_WINNING_BODY'
  | 'TEST_AWARENESS_STAGE'
  | 'RETEST_LOW_CONFIDENCE'
  | 'INSUFFICIENT_DATA';

export const ACTION_TYPE_LABEL: Record<StrategyActionType, string> = {
  NEW_HOOK_VARIANTS: 'Neue Hooks produzieren',
  REPLACE_HOOK: 'Hook ersetzen',
  KEEP_HOOK_REPLACE_BODY: 'Hook behalten · Body ersetzen',
  REPLACE_BODY: 'Body ersetzen',
  REPLACE_PROOF: 'Proof neu testen',
  REPLACE_CTA: 'CTA ersetzen',
  BUILD_COMPONENT_COMBINATION: 'Winner-Komponenten kombinieren',
  ITERATE_WINNING_HOOK: 'Winning Hook iterieren',
  ITERATE_WINNING_BODY: 'Winning Body iterieren',
  TEST_AWARENESS_STAGE: 'Awareness-Stage vertiefen',
  RETEST_LOW_CONFIDENCE: 'Mit geringer Confidence erneut testen',
  INSUFFICIENT_DATA: 'Noch nicht genug Daten',
};

export type ConfLevel = 'low' | 'medium' | 'high';
export type BodySignal = 'strong' | 'weak' | 'neutral';
export type DropPosition = 'early' | 'mid' | 'late';
export type FactUnit = 'pct' | 'pp' | 'x' | 'eur' | 'count';

export interface StratFact {
  entityType: 'ad' | 'component' | 'product_group';
  entityId: string | null;
  entityLabel: string;
  metric: string;
  value: number | null;
  baseline: number | null;
  deltaPp: number | null;
  unit: FactUnit;
}

export interface StrategyComponentRef { code: string; type: string; name: string; sourceAdName?: string | null }

export interface StrategyAd {
  adId: string;
  name: string;
  hookClass: 'strong' | 'iteration' | 'weak' | null;
  hookRatePct: number | null;
  hookBaselinePct: number | null;
  hookDeltaPp: number | null;
  retention50to75: number | null;
  bodyBaselinePct: number | null;
  bodyDeltaPp: number | null;
  confidence: ConfLevel;
  impressions: number;
  biggestDrop: { position: DropPosition; segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null } | null;
  overlapComponent: StrategyComponentRef | null;
  components: { hook?: StrategyComponentRef | null; body?: StrategyComponentRef | null; proof?: StrategyComponentRef | null; cta?: StrategyComponentRef | null };
}

export interface StrategyCombination {
  componentIds: string[];
  label: 'recommended' | 'promising';
  confidence: ConfLevel;
  slots: { bucket: string; code: string; name: string; sourceAdName: string | null }[];
}

export interface StrategyInput {
  ads: StrategyAd[];
  combination: StrategyCombination | null;
  minImpressions: number; // Datenschwelle für belastbare Creative-Entscheidung
}

export interface ProductionCandidate {
  key: string;
  actionType: StrategyActionType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  affectedAds: { id: string; name: string }[];
  affectedComponents: { code: string; type: string; name: string }[];
  keepComponents: string[];
  changeComponents: string[];
  suggestedComponents: string[];
  testVariable: string | null;
  variantCount: number | null;
  facts: StratFact[];
  dataConfidence: ConfLevel;
}

export function classifyBody(deltaPp: number | null): BodySignal {
  if (deltaPp == null) return 'neutral';
  if (deltaPp >= COMPONENT_DELTA.strongPp) return 'strong';
  if (deltaPp <= COMPONENT_DELTA.weakPp) return 'weak';
  return 'neutral';
}

function hookFact(a: StrategyAd): StratFact {
  return { entityType: 'ad', entityId: a.adId, entityLabel: a.name, metric: 'hookRate', value: a.hookRatePct, baseline: a.hookBaselinePct, deltaPp: a.hookDeltaPp, unit: 'pct' };
}
function bodyFact(a: StrategyAd): StratFact {
  return { entityType: 'ad', entityId: a.adId, entityLabel: a.name, metric: 'retention50to75', value: a.retention50to75, baseline: a.bodyBaselinePct, deltaPp: a.bodyDeltaPp, unit: 'pct' };
}
function dropFact(a: StrategyAd): StratFact {
  return { entityType: 'ad', entityId: a.adId, entityLabel: a.name, metric: 'retentionDrop', value: a.biggestDrop?.dropPct ?? null, baseline: null, deltaPp: null, unit: 'pct' };
}
function compRefs(cs: (StrategyComponentRef | null | undefined)[]): { code: string; type: string; name: string }[] {
  return cs.filter(Boolean).map((c) => ({ code: c!.code, type: c!.type, name: c!.name }));
}
function codeOrBucket(c: StrategyComponentRef | null | undefined, bucket: string): string {
  return c?.code ?? bucket;
}

/**
 * Leitet deterministisch die nächsten Creative-Produktionen ab.
 * Reihenfolge der Prioritäten: Winner iterieren > Salvage (Hook/Body/Proof) >
 * Kombination > Low-Confidence-Retest. Dieselbe Ad kann mehrere Kandidaten
 * erzeugen (z. B. Body ändern UND Proof testen), aber je actionType nur einmal.
 */
export function deriveProductionCandidates(input: StrategyInput): ProductionCandidate[] {
  const out: ProductionCandidate[] = [];
  const min = input.minImpressions;

  for (const a of input.ads) {
    const lowData = a.confidence === 'low' || a.impressions < min;
    if (lowData) {
      out.push({
        key: `retest:${a.adId}`,
        actionType: a.impressions < min ? 'INSUFFICIENT_DATA' : 'RETEST_LOW_CONFIDENCE',
        priority: 'low',
        title: a.impressions < min ? `${a.name} — noch nicht genug Daten` : `${a.name} — mit mehr Daten erneut prüfen`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: [],
        keepComponents: [], changeComponents: [], suggestedComponents: [],
        testVariable: null, variantCount: null,
        facts: [{ entityType: 'ad', entityId: a.adId, entityLabel: a.name, metric: 'impressions', value: a.impressions, baseline: null, deltaPp: null, unit: 'count' }],
        dataConfidence: a.confidence,
      });
      continue; // keine aggressive Produktion bei dünner Datenlage
    }

    const hook = a.hookClass;
    const body = classifyBody(a.bodyDeltaPp);
    const hookC = a.components.hook ?? null;
    const bodyC = a.components.body ?? null;

    // C — Strong Hook + Strong Body -> Winner kontrolliert iterieren
    if (hook === 'strong' && body === 'strong') {
      out.push({
        key: `iterate-hook:${a.adId}`,
        actionType: 'ITERATE_WINNING_HOOK',
        priority: 'high',
        title: `${a.name} — Winner iterieren (kontrollierte Varianten)`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: compRefs([hookC, bodyC]),
        keepComponents: [codeOrBucket(hookC, 'Hook'), codeOrBucket(bodyC, 'Body')],
        changeComponents: [],
        suggestedComponents: [],
        testVariable: 'eine Variable je Variante (z. B. Hook-Opening), Rest konstant',
        variantCount: 2,
        facts: [hookFact(a), bodyFact(a)],
        dataConfidence: a.confidence,
      });
    }
    // A — Weak Hook + Strong Body -> Body behalten, neue Hooks
    else if ((hook === 'weak') && body === 'strong') {
      out.push({
        key: `replace-hook:${a.adId}`,
        actionType: 'REPLACE_HOOK',
        priority: 'high',
        title: `${a.name} — Body behalten, neue Hooks produzieren`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: compRefs([hookC, bodyC]),
        keepComponents: [codeOrBucket(bodyC, 'Body'), 'CTA', 'Offer', 'Angle'],
        changeComponents: [codeOrBucket(hookC, 'Hook')],
        suggestedComponents: [],
        testVariable: 'Hook (Rest konstant)',
        variantCount: 4,
        facts: [hookFact(a), bodyFact(a)],
        dataConfidence: a.confidence,
      });
    }
    // B — Strong/Iteration Hook + Weak Body -> Hook behalten, Body ändern
    else if ((hook === 'strong' || hook === 'iteration') && body === 'weak') {
      out.push({
        key: `replace-body:${a.adId}`,
        actionType: 'KEEP_HOOK_REPLACE_BODY',
        priority: 'high',
        title: `${a.name} — Hook behalten, Body ersetzen`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: compRefs([hookC, bodyC]),
        keepComponents: [codeOrBucket(hookC, 'Hook'), 'CTA', 'Offer'],
        changeComponents: [codeOrBucket(bodyC, 'Body')],
        suggestedComponents: [],
        testVariable: 'Body/Mittelteil (Hook konstant)',
        variantCount: 3,
        facts: [hookFact(a), bodyFact(a)],
        dataConfidence: a.confidence,
      });
    }
    // Weak Hook ohne starken Body -> neue Hook-Varianten (nicht ganze Ad verwerfen)
    else if (hook === 'weak') {
      out.push({
        key: `new-hooks:${a.adId}`,
        actionType: 'NEW_HOOK_VARIANTS',
        priority: 'medium',
        title: `${a.name} — neue Hook-Varianten testen`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: compRefs([hookC]),
        keepComponents: ['Offer', 'Angle'],
        changeComponents: [codeOrBucket(hookC, 'Hook')],
        suggestedComponents: [],
        testVariable: 'Hook',
        variantCount: 4,
        facts: [hookFact(a)],
        dataConfidence: a.confidence,
      });
    }

    // D — Mid/Late Drop mit Proof-Overlap -> Proof neu testen
    const ov = a.overlapComponent;
    if (a.biggestDrop && (a.biggestDrop.position === 'mid' || a.biggestDrop.position === 'late') && ov && (ov.type === 'proof' || ov.type === 'testimonial')) {
      out.push({
        key: `replace-proof:${a.adId}`,
        actionType: 'REPLACE_PROOF',
        priority: 'medium',
        title: `${a.name} — Proof-Section neu testen`,
        affectedAds: [{ id: a.adId, name: a.name }],
        affectedComponents: compRefs([ov]),
        keepComponents: [codeOrBucket(hookC, 'Hook'), codeOrBucket(bodyC, 'Body'), 'CTA', 'Offer'],
        changeComponents: [ov.code],
        suggestedComponents: [],
        testVariable: 'Proof-Section (Rest konstant)',
        variantCount: 2,
        facts: [dropFact(a)],
        dataConfidence: a.confidence,
      });
    }
  }

  // E/G — Cross-Ad: stärksten Hook und stärksten Body aus (ggf. verschiedenen) Ads kombinieren
  if (input.combination && input.combination.slots.length >= 2) {
    const c = input.combination;
    const facts: StratFact[] = c.slots.map((s) => ({ entityType: 'component', entityId: null, entityLabel: `${s.code}${s.sourceAdName ? ` · ${s.sourceAdName}` : ''}`, metric: 'componentSignal', value: null, baseline: null, deltaPp: null, unit: 'pct' }));
    out.push({
      key: 'combination',
      actionType: 'BUILD_COMPONENT_COMBINATION',
      priority: c.label === 'recommended' ? 'high' : 'medium',
      title: c.label === 'recommended' ? 'Winner-Komponenten kombinieren' : 'Vielversprechende Komponenten kombinieren (als Test)',
      affectedAds: [],
      affectedComponents: c.slots.map((s) => ({ code: s.code, type: s.bucket, name: s.name })),
      keepComponents: [],
      changeComponents: [],
      suggestedComponents: c.slots.map((s) => s.code),
      testVariable: 'Baustein-Kombination (Offer/Angle/Visual-Stil konstant)',
      variantCount: 1,
      facts,
      dataConfidence: c.confidence,
    });
  }

  return out;
}

/** Erkennt, ob mindestens zwei Ads mit gegensätzlichen Stärken existieren (Cross-Ad-Signal). */
export function hasOpposingStrengths(ads: StrategyAd[]): boolean {
  const strongHookWeakBody = ads.some((a) => a.hookClass === 'strong' && classifyBody(a.bodyDeltaPp) === 'weak');
  const weakHookStrongBody = ads.some((a) => a.hookClass === 'weak' && classifyBody(a.bodyDeltaPp) === 'strong');
  return strongHookWeakBody && weakHookStrongBody;
}

export { HOOK_RULES };
