/**
 * Meta Ads — Phase 6: AI Creative Intelligence (reine, transport-unabhängige Logik).
 *
 * Grundprinzip: Die deterministischen Daten sind die EINZIGE Wahrheitsquelle.
 * Das LLM bekommt bereits berechnete Facts und darf KEINE Messwerte erfinden.
 * Strikte Trennung: Facts (deterministisch) · Observation · Interpretation ·
 * Hypothesis · Recommendation · Suggested Test · Confidence. Keine Kausalaussagen
 * aus Korrelation. Hyros ROAS ist autoritativ. Wenig Daten -> niedrige Confidence.
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface AiFact { label: string; value: string }
export interface AiContextComponent { code: string; type: string; name: string; keyMetric?: string | null; keyDelta?: string | null }
export interface AiRetentionStep { segment: string; retentionPct: number; dropPct: number }
export interface AiSignal { opportunityType: string; label: string; detail: string }

/** Eine Ad im Produkt-Level-Vergleich (deterministisch, alle Ads derselben Product Group). */
export interface AiAdRow {
  name: string;
  hookRatePct: number | null;
  hookClass: 'strong' | 'iteration' | 'weak' | null;
  hookDeltaPp: number | null; // vs. Produkt-Baseline (Gruppen-Hook)
  holdRatePct: number | null;
  retention50to75: number | null;
  outboundCtr: number | null;
  spend: number | null;
  uniqueSales: number | null;
  calculatedRoas: number | null;
  biggestDrop: string | null;
  confidence: ConfidenceLevel;
}

export interface AiAnalysisContext {
  scopeType: 'ad' | 'product_group';
  productGroupName?: string | null;
  adName?: string | null;
  periodLabel: string;
  confidenceLevel: ConfidenceLevel;
  confidenceReasons: string[];
  facts: AiFact[];
  baselines: AiFact[];
  retention?: AiRetentionStep[];
  biggestDrop?: { segment: string; fromSeconds?: number | null; toSeconds?: number | null; dropPct: number } | null;
  signals: AiSignal[];
  components: AiContextComponent[];
  /** Produkt-Level: alle Ads der Gruppe einzeln zum Vergleich (Hauptmodus). */
  ads?: AiAdRow[];
  /** Interne Hook-Schwellen (Prozent) für absolute Regeln im Prompt. */
  hookTargets?: { strongPct: number; iterationPct: number };
  dataVolumeLow: boolean;
}

export interface AiRecommendation {
  title: string;
  action: string;
  suggestedTest: string;
  confidence: ConfidenceLevel;
  componentHint?: string | null;
}
export interface AiStatement { text: string; confidence: ConfidenceLevel }
export interface AiAnalysisResult {
  summary: string;
  observations: AiStatement[];
  interpretations: AiStatement[];
  hypotheses: AiStatement[];
  recommendations: AiRecommendation[];
  overallConfidence: ConfidenceLevel;
}

const CONF: ConfidenceLevel[] = ['low', 'medium', 'high'];
function clampConfidence(v: any, fallback: ConfidenceLevel = 'low'): ConfidenceLevel {
  return typeof v === 'string' && (CONF as string[]).includes(v) ? (v as ConfidenceLevel) : fallback;
}

export const AI_SYSTEM_PROMPT = [
  'Du bist ein erfahrener Performance-Creative-Analyst für Meta Ads.',
  'Du analysierst AUSSCHLIESSLICH die dir übergebenen deterministischen Daten („Facts").',
  '',
  'HARTE REGELN (nicht verhandelbar):',
  '1. Die Facts sind die EINZIGE Wahrheitsquelle. Verwende Zahlen NUR aus den Facts. Erfinde NIEMALS Messwerte, Prozente, ROAS, Umsätze oder andere Kennzahlen, die nicht in den Facts stehen.',
  '2. Trenne strikt und ausschließlich in diese Ebenen: observation (was die Facts direkt zeigen), interpretation (mögliche Bedeutung), hypothesis (testbare Annahme), recommendation (konkrete Handlung), suggestedTest (wie man es prüft), confidence.',
  '3. KEINE Kausalaussagen aus Korrelation. Formuliere als Assoziation: „Ads mit X zeigen Y", nicht „X verursacht Y".',
  '4. Hyros ROAS ist der autoritative ROAS. Der berechnete ROAS ist nur ein Vergleichswert und nie gleichwertig zu nennen.',
  '5. Ist die Datenmenge gering oder die Confidence niedrig, formuliere ausdrücklich vorsichtig und setze confidence auf "low".',
  '6. Beziehe dich nur auf die gegebenen Ads, Components und Signale. Erfinde keine weiteren.',
  '7. Du analysierst eine EINZELNE Produktgruppe. Vergleiche — wenn mehrere Ads vorliegen — die Ads UNTEREINANDER (nie produktübergreifend): Welche Ad hat den stärksten Hook, welche die beste Mid-Retention, welche hält bis zum Ende? Leite daraus produktspezifische Learnings ab.',
  '8. Wende die internen Hook-Regeln an: Strong Hook >= 30 %, Iteration Zone 20–30 %, darunter Weak Hook — IMMER kombiniert mit dem Abstand zur Produkt-Baseline (z. B. "+7pp über Baseline, aber noch unter dem 30 %-Strong-Ziel"). Verhalte dich wie ein E-Commerce Creative Strategist, nicht wie ein Zahlen-Nacherzähler.',
  '9. Antworte NUR mit gültigem JSON nach dem vorgegebenen Schema. Kein Text davor oder danach, keine Markdown-Code-Fences.',
  '',
  'JSON-Schema:',
  '{',
  '  "summary": string,',
  '  "observations": [{ "text": string, "confidence": "low"|"medium"|"high" }],',
  '  "interpretations": [{ "text": string, "confidence": "low"|"medium"|"high" }],',
  '  "hypotheses": [{ "text": string, "confidence": "low"|"medium"|"high" }],',
  '  "recommendations": [{ "title": string, "action": string, "suggestedTest": string, "confidence": "low"|"medium"|"high", "componentHint": string|null }],',
  '  "overallConfidence": "low"|"medium"|"high"',
  '}',
].join('\n');

function factLines(facts: AiFact[]): string {
  return facts.length ? facts.map((f) => `- ${f.label}: ${f.value}`).join('\n') : '- (keine)';
}

export function buildAnalysisUserPrompt(ctx: AiAnalysisContext): string {
  const lines: string[] = [];
  lines.push(`Analyse-Scope: ${ctx.scopeType === 'ad' ? 'Einzelne Ad' : 'Produktgruppe'}`);
  if (ctx.productGroupName) lines.push(`Produktgruppe: ${ctx.productGroupName}`);
  if (ctx.adName) lines.push(`Ad: ${ctx.adName}`);
  lines.push(`Zeitraum: ${ctx.periodLabel}`);
  lines.push(`Confidence (deterministisch ermittelt): ${ctx.confidenceLevel} — ${ctx.confidenceReasons.join('; ') || 'keine Angabe'}`);
  if (ctx.dataVolumeLow) lines.push('ACHTUNG: geringe Datenmenge — bitte besonders vorsichtig formulieren und niedrige Confidence verwenden.');
  lines.push('');
  lines.push('FACTS (deterministisch, autoritativ — nur diese Zahlen verwenden):');
  lines.push(factLines(ctx.facts));
  lines.push('');
  lines.push('BASELINES (Produktgruppe/Format, zum Vergleich):');
  lines.push(factLines(ctx.baselines));
  if (ctx.retention && ctx.retention.length) {
    lines.push('');
    lines.push('RETENTION (je Segment: Retention% / Drop%):');
    lines.push(ctx.retention.map((r) => `- ${r.segment}: ${r.retentionPct}% (Drop ${r.dropPct}%)`).join('\n'));
  }
  if (ctx.biggestDrop) {
    const d = ctx.biggestDrop;
    lines.push('');
    lines.push(`GRÖSSTER RETENTION-VERLUST: ${d.segment} (-${d.dropPct}%)${d.fromSeconds != null ? `, ca. Sek. ${d.fromSeconds}-${d.toSeconds ?? '?'}` : ''}`);
  }
  if (ctx.signals.length) {
    lines.push('');
    lines.push('DETERMINISTISCHE OPPORTUNITY-SIGNALE:');
    lines.push(ctx.signals.map((s) => `- ${s.label} (${s.opportunityType}): ${s.detail}`).join('\n'));
  }
  if (ctx.components.length) {
    lines.push('');
    lines.push('VERFÜGBARE COMPONENTS (Bausteine, Performance ist Assoziation über verwendende Ads):');
    lines.push(ctx.components.map((c) => `- [${c.type}] ${c.code} ${c.name}${c.keyMetric ? ` · ${c.keyMetric}${c.keyDelta ? ` (${c.keyDelta})` : ''}` : ''}`).join('\n'));
  }
  if (ctx.hookTargets) {
    lines.push('');
    lines.push(`INTERNE HOOK-REGELN (absolut, Prozent): Strong Hook >= ${ctx.hookTargets.strongPct} %, Iteration Zone ${ctx.hookTargets.iterationPct}–${ctx.hookTargets.strongPct} %, darunter Weak Hook. Bewerte IMMER beides: absolute Regel UND Abstand zur Produkt-Baseline (z. B. "über Baseline, aber unter 30 %-Ziel").`);
  }
  if (ctx.ads && ctx.ads.length) {
    lines.push('');
    lines.push('ADS IM PRODUKT (einzeln, zum direkten Vergleich — alle derselben Produktgruppe):');
    lines.push(ctx.ads.map((a) => {
      const parts = [
        `Hook ${a.hookRatePct != null ? a.hookRatePct + '%' : '—'}${a.hookClass ? ` [${a.hookClass}]` : ''}${a.hookDeltaPp != null ? ` (${a.hookDeltaPp > 0 ? '+' : ''}${a.hookDeltaPp}pp vs Produkt-Baseline)` : ''}`,
        `Hold ${a.holdRatePct != null ? a.holdRatePct + '%' : '—'}`,
        `50→75 ${a.retention50to75 != null ? a.retention50to75 + '%' : '—'}`,
        `Ausg.CTR ${a.outboundCtr != null ? a.outboundCtr + '%' : '—'}`,
        `Spend ${a.spend != null ? a.spend.toFixed(2) + '€' : '—'}`,
        `Unique ${a.uniqueSales ?? '—'}`,
        `ber.ROAS ${a.calculatedRoas != null ? a.calculatedRoas + '×' : '—'}`,
        `Confidence ${a.confidence}`,
      ];
      if (a.biggestDrop) parts.push(`größter Drop ${a.biggestDrop}`);
      return `- ${a.name}: ${parts.join(' · ')}`;
    }).join('\n'));
  }
  lines.push('');
  lines.push('Liefere jetzt die strukturierte Analyse als JSON nach Schema. Nutze ausschließlich die obigen Facts für alle Zahlen.');
  return lines.join('\n');
}

export function buildAnalysisMessages(ctx: AiAnalysisContext): { system: string; user: string } {
  return { system: AI_SYSTEM_PROMPT, user: buildAnalysisUserPrompt(ctx) };
}

/** Extrahiert das erste JSON-Objekt aus einer Modellantwort (toleriert Code-Fences/Prosa). */
export function extractJson(text: string): string {
  if (!text) throw new Error('Leere Modellantwort');
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Kein JSON-Objekt in der Modellantwort gefunden');
  return t.slice(start, end + 1);
}

function normStatements(arr: any): AiStatement[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => ({ text: typeof s?.text === 'string' ? s.text.trim() : (typeof s === 'string' ? s.trim() : ''), confidence: clampConfidence(s?.confidence) }))
    .filter((s) => s.text.length > 0);
}

/** Parst + normalisiert die Modellantwort in ein sicheres Ergebnis. Wirft bei unbrauchbarem JSON. */
export function parseAnalysisResult(text: string): AiAnalysisResult {
  const raw = JSON.parse(extractJson(text));
  const recommendations: AiRecommendation[] = Array.isArray(raw.recommendations)
    ? raw.recommendations
        .map((r: any) => ({
          title: typeof r?.title === 'string' ? r.title.trim() : '',
          action: typeof r?.action === 'string' ? r.action.trim() : '',
          suggestedTest: typeof r?.suggestedTest === 'string' ? r.suggestedTest.trim() : '',
          confidence: clampConfidence(r?.confidence),
          componentHint: typeof r?.componentHint === 'string' && r.componentHint.trim() ? r.componentHint.trim() : null,
        }))
        .filter((r: AiRecommendation) => r.title || r.action)
    : [];
  return {
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    observations: normStatements(raw.observations),
    interpretations: normStatements(raw.interpretations),
    hypotheses: normStatements(raw.hypotheses),
    recommendations,
    overallConfidence: clampConfidence(raw.overallConfidence),
  };
}

/**
 * Validiert eine geparste Analyse serverseitig. Eine Antwort gilt NUR als
 * erfolgreich, wenn alle Ebenen vorhanden sind und jede Empfehlung einen
 * Suggested Test hat. Wirft bei Verstoß (-> Aufrufer setzt status=error).
 */
export interface ProviderResolution { provider: 'openai' | 'anthropic' | null; model: string | null; error: string | null }

/**
 * Explizite Providerwahl — rein & testbar. Kein stiller Fallback: im Produktivbetrieb
 * muss der Provider explizit gesetzt sein; der zugehörige Key muss vorhanden sein.
 */
export function resolveProvider(opts: {
  forced?: string; isProd: boolean; hasOpenaiKey: boolean; hasAnthropicKey: boolean; openaiModel: string; anthropicModel: string;
}): ProviderResolution {
  const forced = (opts.forced || '').toLowerCase();
  let provider: 'openai' | 'anthropic';
  if (forced === 'openai' || forced === 'anthropic') {
    provider = forced;
  } else if (opts.isProd) {
    return { provider: null, model: null, error: 'CONTENT_AI_PROVIDER muss im Produktivbetrieb explizit auf "anthropic" oder "openai" gesetzt sein (keine implizite Providerwahl).' };
  } else {
    provider = opts.hasOpenaiKey ? 'openai' : 'anthropic';
  }
  const model = provider === 'openai' ? opts.openaiModel : opts.anthropicModel;
  const hasKey = provider === 'openai' ? opts.hasOpenaiKey : opts.hasAnthropicKey;
  if (!hasKey) return { provider, model, error: `Kein API-Key für Provider "${provider}" konfiguriert.` };
  return { provider, model, error: null };
}

export function assertValidResult(r: AiAnalysisResult): void {
  const missing: string[] = [];
  if (!r.observations.length) missing.push('Observation');
  if (!r.interpretations.length) missing.push('Interpretation');
  if (!r.hypotheses.length) missing.push('Hypothesis');
  if (!r.recommendations.length) missing.push('Recommendation');
  if (r.recommendations.length && r.recommendations.some((rec) => !rec.suggestedTest)) missing.push('Suggested Test (je Empfehlung)');
  if (!(['low', 'medium', 'high'] as string[]).includes(r.overallConfidence)) missing.push('gültige Confidence');
  if (missing.length) throw new Error(`Unvollständige KI-Antwort — fehlt: ${missing.join(', ')}`);
}

// ===========================================================================
// Increment A: Meta-Ads Creative Intelligence — Config, Responses API, Schema
// ===========================================================================

export const AI_PROMPT_VERSION = 'v1';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface MetaAiConfig {
  provider: 'openai' | null;
  model: string | null;
  reasoningEffort: ReasoningEffort;
  error: string | null;
}

/**
 * Explizite Meta-Ads-AI-Konfiguration — getrennt vom Content-Generator,
 * KEIN stiller Fallback auf ein schwächeres Modell. Modell-ID wird VERBATIM
 * verwendet (kein Alias-Remap), damit im Audit eindeutig feststeht, was lief.
 */
export function resolveMetaAiConfig(opts: {
  provider?: string; model?: string; reasoningEffort?: string; hasOpenaiKey: boolean;
}): MetaAiConfig {
  const provider = (opts.provider || '').toLowerCase();
  const effortRaw = (opts.reasoningEffort || 'high').toLowerCase();
  const reasoningEffort: ReasoningEffort = (['low', 'medium', 'high'] as string[]).includes(effortRaw) ? (effortRaw as ReasoningEffort) : 'high';
  if (provider !== 'openai') {
    return { provider: null, model: null, reasoningEffort, error: 'META_ADS_AI_PROVIDER muss explizit "openai" sein (keine implizite/alternative Providerwahl).' };
  }
  const model = (opts.model || '').trim();
  if (!model) {
    return { provider: 'openai', model: null, reasoningEffort, error: 'META_ADS_AI_MODEL ist nicht gesetzt — kein Fallback auf ein schwächeres Modell.' };
  }
  if (!opts.hasOpenaiKey) {
    return { provider: 'openai', model, reasoningEffort, error: 'OPENAI_API_KEY ist nicht konfiguriert.' };
  }
  return { provider: 'openai', model, reasoningEffort, error: null };
}

const STATEMENT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['text', 'confidence'],
  properties: { text: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } },
};
const RECOMMENDATION_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'action', 'suggestedTest', 'confidence', 'componentHint'],
  properties: {
    title: { type: 'string' }, action: { type: 'string' }, suggestedTest: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    componentHint: { type: ['string', 'null'] },
  },
};

/** Strict JSON Schema für Structured Outputs (Responses API). Increment H erweitert das Schema. */
export const CREATIVE_ANALYSIS_SCHEMA = {
  name: 'creative_analysis',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['summary', 'observations', 'interpretations', 'hypotheses', 'recommendations', 'overallConfidence'],
    properties: {
      summary: { type: 'string' },
      observations: { type: 'array', items: STATEMENT_SCHEMA },
      interpretations: { type: 'array', items: STATEMENT_SCHEMA },
      hypotheses: { type: 'array', items: STATEMENT_SCHEMA },
      recommendations: { type: 'array', items: RECOMMENDATION_SCHEMA },
      overallConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
  },
} as const;

const CONF_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
/** #40: recommendationConfidence darf dataConfidence nie übersteigen. */
export function clampRecommendationConfidence(ai: ConfidenceLevel, data: ConfidenceLevel): ConfidenceLevel {
  return CONF_RANK[ai] <= CONF_RANK[data] ? ai : data;
}

// ===========================================================================
// Increment H/I: Creative Strategy — neues handlungsorientiertes Result-Schema
// ===========================================================================
//
// Architektur: Server leitet DETERMINISTISCH ab (Zahlen, actionType, KEEP/CHANGE,
// Fact-Refs, Kombination, Attention-Probleme). Das LLM liefert NUR das Narrativ
// (executiveSummary, Findings-Text, why/observation/…) und wird je Kandidat über
// den `key` gejoint. LLM-Zahlen werden ignoriert. Prompt-Version steigt auf v2.

import type {
  StratFact, StrategyActionType, ProductionCandidate, ConfLevel,
} from './creative-strategy';

export const AI_STRATEGY_PROMPT_VERSION = 'v2';

export interface StrategyFinding { title: string; detail: string; confidence: ConfidenceLevel }
export interface WinningPattern { pattern: string; detail: string; confidence: ConfidenceLevel }
export interface NextTest { title: string; variable: string; detail: string }
export interface StrategyRecNarrative {
  key: string; title: string;
  observation: string; interpretation: string; hypothesis: string; why: string;
  expectedLearning: string; suggestedTest: string;
  recommendationConfidence: ConfidenceLevel;
}
export interface StrategyNarrative {
  executiveSummary: string;
  creativeHealthNote: string;
  winningPatterns: WinningPattern[];
  hookFindings: StrategyFinding[];
  bodyFindings: StrategyFinding[];
  retentionFindings: StrategyFinding[];
  attentionFindings: StrategyFinding[];
  dropFindings: StrategyFinding[];
  componentFindings: StrategyFinding[];
  salvageOpportunities: StrategyFinding[];
  awarenessFindings: StrategyFinding[];
  nextTests: NextTest[];
  recommendations: StrategyRecNarrative[];
  overallConfidence: ConfidenceLevel;
}

/** Finale, gespeicherte & im UI gerenderte Production Recommendation (Kandidat + Narrativ). */
export interface ProductionRecommendation extends Omit<ProductionCandidate, 'facts' | 'key'> {
  id: string;
  actionLabel: string;
  facts: StratFact[];
  observation: string; interpretation: string; hypothesis: string; why: string;
  expectedLearning: string; suggestedTest: string;
  recommendationConfidence: ConfidenceLevel;
}
export interface AdComparison {
  adId: string; name: string;
  hookRatePct: number | null; hookClass: 'strong' | 'iteration' | 'weak' | null; hookDeltaPp: number | null;
  retention50to75: number | null; bodyDeltaPp: number | null; bodySignal: 'strong' | 'weak' | 'neutral';
  biggestDrop: { segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null } | null;
  confidence: ConfidenceLevel;
}
export interface CombinationBlock {
  componentIds: string[]; label: 'recommended' | 'promising'; confidence: ConfidenceLevel;
  slots: { bucket: string; code: string; name: string; sourceAdName: string | null; keyMetric: number | null; keyDelta: number | null }[];
  reason: string;
}
export interface AttentionProblem {
  adId: string; adName: string; segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null;
  overlapComponent: { code: string; type: string; name: string } | null; recommendation: string;
}
export interface CreativeHealth {
  adsAnalyzed: number; spend: string; uniqueSales: number; confidence: ConfidenceLevel;
  baselineHookRatePct: number | null; baselineRetention50to75Pct: number | null;
}
export interface CreativeStrategyResult {
  version: 'v2';
  executiveSummary: string;
  creativeHealth: CreativeHealth;
  creativeHealthNote: string;
  adsCompared: AdComparison[];
  winningPatterns: WinningPattern[];
  hookFindings: StrategyFinding[];
  bodyFindings: StrategyFinding[];
  retentionFindings: StrategyFinding[];
  attentionFindings: StrategyFinding[];
  dropFindings: StrategyFinding[];
  componentFindings: StrategyFinding[];
  salvageOpportunities: StrategyFinding[];
  awarenessFindings: StrategyFinding[];
  nextTests: NextTest[];
  productionRecommendations: ProductionRecommendation[];
  componentCombination: CombinationBlock | null;
  attentionProblems: AttentionProblem[];
  overallConfidence: ConfidenceLevel;
}

export const AI_STRATEGY_SYSTEM_PROMPT = [
  'Du bist ein erfahrener E-Commerce Creative Strategist für Meta Ads (Direct Response).',
  'Dein Output steuert, WAS als Nächstes produziert wird — nicht eine lange Textanalyse.',
  '',
  'HARTE REGELN (nicht verhandelbar):',
  '1. Die deterministischen Daten sind die EINZIGE Wahrheitsquelle. Erfinde KEINE Zahlen, Prozente, ROAS, Umsätze, Deltas oder IDs. Alle Zahlen stehen bereits in den Daten.',
  '2. Du bekommst fertige PRODUKTIONS-KANDIDATEN mit festem `key`, actionType, KEEP/CHANGE und Facts. Du darfst NUR das Narrativ liefern (observation, interpretation, hypothesis, why, expectedLearning, suggestedTest) und je Kandidat über denselben `key` antworten. Ändere NIEMALS actionType, Zahlen oder KEEP/CHANGE. Erfinde KEINE neuen keys.',
  '3. Empfehle NIEMALS etwas, das das System selbst tut: nicht "Ads getrennt auswerten", "Hook Rates vergleichen", "Retention prüfen". Jede Aussage ist eine CREATIVE-Aktion (Hook ersetzen, Body behalten, Proof testen, Kombination bauen, Varianten produzieren, Stage vertiefen).',
  '4. KEINE Kausalität aus Korrelation. Formuliere als Assoziation ("Ads mit X zeigen Y", nicht "X verursacht Y").',
  '5. Wende die Hook-Regeln an: Strong >= 30 %, Iteration 20–30 %, darunter Weak — IMMER kombiniert mit dem Abstand zur Produkt-Baseline (z. B. "+8pp über Baseline, aber unter dem 30 %-Ziel").',
  '6. Ist die Datenlage gering, formuliere vorsichtig und setze niedrige Confidence. Erfinde bei dünner Datenlage KEINE aggressive Empfehlung.',
  '7. Winning Patterns NUR, wenn mehrere Ads ein belastbares Muster zeigen — sonst leer lassen.',
  '8. Antworte NUR mit gültigem JSON nach Schema. Kein Text davor/danach, keine Code-Fences.',
].join('\n');

const FINDING_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'detail', 'confidence'],
  properties: { title: { type: 'string' }, detail: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } },
};
const PATTERN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pattern', 'detail', 'confidence'],
  properties: { pattern: { type: 'string' }, detail: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } },
};
const NEXT_TEST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'variable', 'detail'],
  properties: { title: { type: 'string' }, variable: { type: 'string' }, detail: { type: 'string' } },
};
const REC_NARRATIVE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['key', 'title', 'observation', 'interpretation', 'hypothesis', 'why', 'expectedLearning', 'suggestedTest', 'recommendationConfidence'],
  properties: {
    key: { type: 'string' }, title: { type: 'string' },
    observation: { type: 'string' }, interpretation: { type: 'string' }, hypothesis: { type: 'string' },
    why: { type: 'string' }, expectedLearning: { type: 'string' }, suggestedTest: { type: 'string' },
    recommendationConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

/** Strict JSON Schema (Responses API) für das Strategie-Narrativ. Nur Text-Ebenen — Zahlen liefert der Server. */
export const CREATIVE_STRATEGY_SCHEMA = {
  name: 'creative_strategy',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: [
      'executiveSummary', 'creativeHealthNote', 'winningPatterns',
      'hookFindings', 'bodyFindings', 'retentionFindings', 'attentionFindings', 'dropFindings',
      'componentFindings', 'salvageOpportunities', 'awarenessFindings', 'nextTests', 'recommendations', 'overallConfidence',
    ],
    properties: {
      executiveSummary: { type: 'string' },
      creativeHealthNote: { type: 'string' },
      winningPatterns: { type: 'array', items: PATTERN_SCHEMA },
      hookFindings: { type: 'array', items: FINDING_SCHEMA },
      bodyFindings: { type: 'array', items: FINDING_SCHEMA },
      retentionFindings: { type: 'array', items: FINDING_SCHEMA },
      attentionFindings: { type: 'array', items: FINDING_SCHEMA },
      dropFindings: { type: 'array', items: FINDING_SCHEMA },
      componentFindings: { type: 'array', items: FINDING_SCHEMA },
      salvageOpportunities: { type: 'array', items: FINDING_SCHEMA },
      awarenessFindings: { type: 'array', items: FINDING_SCHEMA },
      nextTests: { type: 'array', items: NEXT_TEST_SCHEMA },
      recommendations: { type: 'array', items: REC_NARRATIVE_SCHEMA },
      overallConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
  },
} as const;

function findings(arr: any): StrategyFinding[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({ title: String(f?.title ?? '').trim(), detail: String(f?.detail ?? '').trim(), confidence: clampConfidence(f?.confidence) }))
    .filter((f) => f.title || f.detail);
}

export function parseStrategyNarrative(text: string): StrategyNarrative {
  const raw = JSON.parse(extractJson(text));
  return {
    executiveSummary: String(raw.executiveSummary ?? '').trim(),
    creativeHealthNote: String(raw.creativeHealthNote ?? '').trim(),
    winningPatterns: Array.isArray(raw.winningPatterns)
      ? raw.winningPatterns.map((p: any) => ({ pattern: String(p?.pattern ?? '').trim(), detail: String(p?.detail ?? '').trim(), confidence: clampConfidence(p?.confidence) })).filter((p: WinningPattern) => p.pattern)
      : [],
    hookFindings: findings(raw.hookFindings),
    bodyFindings: findings(raw.bodyFindings),
    retentionFindings: findings(raw.retentionFindings),
    attentionFindings: findings(raw.attentionFindings),
    dropFindings: findings(raw.dropFindings),
    componentFindings: findings(raw.componentFindings),
    salvageOpportunities: findings(raw.salvageOpportunities),
    awarenessFindings: findings(raw.awarenessFindings),
    nextTests: Array.isArray(raw.nextTests)
      ? raw.nextTests.map((t: any) => ({ title: String(t?.title ?? '').trim(), variable: String(t?.variable ?? '').trim(), detail: String(t?.detail ?? '').trim() })).filter((t: NextTest) => t.title)
      : [],
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.map((r: any) => ({
          key: String(r?.key ?? '').trim(), title: String(r?.title ?? '').trim(),
          observation: String(r?.observation ?? '').trim(), interpretation: String(r?.interpretation ?? '').trim(),
          hypothesis: String(r?.hypothesis ?? '').trim(), why: String(r?.why ?? '').trim(),
          expectedLearning: String(r?.expectedLearning ?? '').trim(), suggestedTest: String(r?.suggestedTest ?? '').trim(),
          recommendationConfidence: clampConfidence(r?.recommendationConfidence),
        })).filter((r: StrategyRecNarrative) => r.key)
      : [],
    overallConfidence: clampConfidence(raw.overallConfidence),
  };
}

export function assertValidNarrative(n: StrategyNarrative): void {
  if (!n.executiveSummary) throw new Error('Unvollständige KI-Antwort — executiveSummary fehlt');
  if (!(['low', 'medium', 'high'] as string[]).includes(n.overallConfidence)) throw new Error('Unvollständige KI-Antwort — gültige Confidence fehlt');
}

/** Baut den Strategen-User-Prompt aus dem deterministischen Kontext + den fertigen Kandidaten. */
export function buildStrategyUserPrompt(args: {
  productGroupName: string | null; periodLabel: string; confidence: ConfidenceLevel; confidenceReasons: string[]; dataVolumeLow: boolean;
  health: CreativeHealth; adsCompared: AdComparison[];
  strongHooks: { code: string; name: string; metricPct: number | null; deltaPp: number | null; sourceAdName: string | null }[];
  strongBodies: { code: string; name: string; metricPct: number | null; deltaPp: number | null; sourceAdName: string | null }[];
  combination: CombinationBlock | null;
  attentionProblems: AttentionProblem[];
  candidates: ProductionCandidate[];
  hookTargets: { strongPct: number; iterationPct: number };
}): string {
  const L: string[] = [];
  L.push(`Produktgruppe: ${args.productGroupName ?? '—'}`);
  L.push(`Zeitraum: ${args.periodLabel}`);
  L.push(`Confidence (deterministisch): ${args.confidence} — ${args.confidenceReasons.join('; ') || '—'}`);
  if (args.dataVolumeLow) L.push('ACHTUNG: geringe Datenmenge — vorsichtig formulieren, niedrige Confidence, keine aggressive Produktion.');
  L.push('');
  L.push(`CREATIVE HEALTH: ${args.health.adsAnalyzed} Ads · Spend ${args.health.spend} · ${args.health.uniqueSales} Unique Sales · Baseline Hook ${args.health.baselineHookRatePct ?? '—'} % · Baseline 50→75 ${args.health.baselineRetention50to75Pct ?? '—'} %`);
  L.push(`HOOK-REGELN: Strong >= ${args.hookTargets.strongPct} %, Iteration ${args.hookTargets.iterationPct}–${args.hookTargets.strongPct} %, darunter Weak. Immer zusätzlich Abstand zur Produkt-Baseline nennen.`);
  L.push('');
  L.push('ADS IM VERGLEICH (deterministisch, alle derselben Produktgruppe):');
  L.push(args.adsCompared.map((a) => `- ${a.name}: Hook ${a.hookRatePct ?? '—'}%${a.hookClass ? ` [${a.hookClass}]` : ''}${a.hookDeltaPp != null ? ` (${a.hookDeltaPp > 0 ? '+' : ''}${a.hookDeltaPp}pp vs Baseline)` : ''} · 50→75 ${a.retention50to75 ?? '—'}%${a.bodyDeltaPp != null ? ` (${a.bodyDeltaPp > 0 ? '+' : ''}${a.bodyDeltaPp}pp) [${a.bodySignal}]` : ''}${a.biggestDrop ? ` · größter Drop ${a.biggestDrop.segment} -${a.biggestDrop.dropPct}%${a.biggestDrop.fromSeconds != null ? ` (ca. ${a.biggestDrop.fromSeconds}-${a.biggestDrop.toSeconds}s)` : ''}` : ''} · Confidence ${a.confidence}`).join('\n') || '- (keine)');
  if (args.strongHooks.length) { L.push(''); L.push('STARKE HOOKS (Bausteine):'); L.push(args.strongHooks.map((c) => `- ${c.code} ${c.name}${c.metricPct != null ? ` · ${c.metricPct}%` : ''}${c.deltaPp != null ? ` (${c.deltaPp > 0 ? '+' : ''}${c.deltaPp}pp)` : ''}${c.sourceAdName ? ` · aus ${c.sourceAdName}` : ''}`).join('\n')); }
  if (args.strongBodies.length) { L.push(''); L.push('STARKE BODIES (Bausteine):'); L.push(args.strongBodies.map((c) => `- ${c.code} ${c.name}${c.metricPct != null ? ` · ${c.metricPct}%` : ''}${c.deltaPp != null ? ` (${c.deltaPp > 0 ? '+' : ''}${c.deltaPp}pp)` : ''}${c.sourceAdName ? ` · aus ${c.sourceAdName}` : ''}`).join('\n')); }
  if (args.combination) { L.push(''); L.push(`EMPFOHLENE KOMBINATION (${args.combination.label}): ${args.combination.slots.map((s) => `${s.bucket}=${s.code}${s.sourceAdName ? `(${s.sourceAdName})` : ''}`).join(' + ')}`); }
  if (args.attentionProblems.length) { L.push(''); L.push('ATTENTION-PROBLEME (interpoliert aus Checkpoints):'); L.push(args.attentionProblems.map((p) => `- ${p.adName}: Drop ${p.segment} -${p.dropPct}%${p.fromSeconds != null ? ` (ca. ${p.fromSeconds}-${p.toSeconds}s)` : ''}${p.overlapComponent ? ` · Overlap ${p.overlapComponent.code} (${p.overlapComponent.type})` : ''}`).join('\n')); }
  L.push('');
  L.push('PRODUKTIONS-KANDIDATEN (DETERMINISTISCH — du lieferst NUR Narrativ je `key`, ändere NICHTS an Zahlen/actionType/KEEP/CHANGE):');
  L.push(args.candidates.map((c) => {
    const keep = c.keepComponents.length ? ` KEEP[${c.keepComponents.join(', ')}]` : '';
    const change = c.changeComponents.length ? ` CHANGE[${c.changeComponents.join(', ')}]` : '';
    const sug = c.suggestedComponents.length ? ` USE[${c.suggestedComponents.join(', ')}]` : '';
    const facts = c.facts.map((f) => `${f.metric}=${f.value ?? '—'}${f.baseline != null ? `/base ${f.baseline}` : ''}${f.deltaPp != null ? `/Δ${f.deltaPp}pp` : ''}`).join(', ');
    return `- key=${c.key} · ${c.actionType} · ${c.title}${keep}${change}${sug}${c.variantCount != null ? ` · ${c.variantCount} Varianten` : ''} · facts{${facts}} · dataConfidence ${c.dataConfidence}`;
  }).join('\n') || '- (keine belastbaren Kandidaten — gib keine Produktions-Empfehlung aus)');
  L.push('');
  L.push('Liefere jetzt das JSON-Narrativ nach Schema. Für JEDEN Kandidaten-`key` einen recommendations-Eintrag. Zahlen ausschließlich aus den obigen Daten.');
  return L.join('\n');
}
