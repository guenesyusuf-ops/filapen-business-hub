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
  '7. Antworte NUR mit gültigem JSON nach dem vorgegebenen Schema. Kein Text davor oder danach, keine Markdown-Code-Fences.',
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
