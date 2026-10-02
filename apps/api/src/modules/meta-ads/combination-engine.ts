/**
 * Cross-Ad Combination Engine (Increment E) — rein & deterministisch.
 *
 * Wählt innerhalb EINER Produktgruppe die stärksten validierten Bausteine
 * (Hook + Body + optional CTA/Proof) aus verschiedenen Ads und schlägt sie als
 * Kombination vor. Die AI erklärt/priorisiert später — SIE erfindet NICHT, welcher
 * Baustein gewinnt. Keine Cross-Product-Kombis (Aufrufer übergibt nur EINE Gruppe).
 * Keine willkürlichen Vorschläge: nur strong/promising Bausteine mit genug Daten.
 */

export type CompBucket = 'hook' | 'body' | 'proof' | 'cta' | 'other';
export type CompSignal = 'strong' | 'iteration' | 'weak' | 'promising' | 'insufficient_data';
type ConfLevel = 'low' | 'medium' | 'high';

export interface CombiComponent {
  id: string;
  code: string;
  name: string;
  type: string;            // roher Component-Typ
  keyMetric: number | null;
  keyDelta: number | null;
  signal: CompSignal;
  confidence: ConfLevel;
  adCount: number;
  sourceAdName: string | null;
}

export interface CombiSlot {
  bucket: CompBucket;
  componentId: string;
  code: string;
  name: string;
  sourceAdName: string | null;
  keyMetric: number | null;
  keyDelta: number | null;
  signal: CompSignal;
  reason: string;
}

export interface CombinationResult {
  componentIds: string[];
  slots: CombiSlot[];
  confidence: ConfLevel;
  /** 'recommended' = alle Slots strong + ausreichende Confidence; 'promising' = enthält promising/low. */
  label: 'recommended' | 'promising';
  reason: string;
}

export function bucketOf(type: string): CompBucket {
  if (type === 'hook' || type === 'visual_opening') return 'hook';
  if (type === 'cta' || type === 'offer_section') return 'cta';
  if (type === 'proof' || type === 'testimonial') return 'proof';
  if (['body', 'problem_section', 'solution_section', 'product_demo'].includes(type)) return 'body';
  return 'other';
}

const SIGNAL_RANK: Record<string, number> = { strong: 2, promising: 1 };
const CONF_RANK: Record<ConfLevel, number> = { low: 0, medium: 1, high: 2 };

const BUCKET_LABEL: Record<CompBucket, string> = { hook: 'stärkster Hook', body: 'stärkste Mid-Retention (Body)', proof: 'stärkster Proof', cta: 'stärkste CTA-Assoziation', other: 'Baustein' };

/** Bester Baustein eines Buckets: nur strong/promising, sortiert nach Signal, dann Metrik, dann Ad-Anzahl. */
function pickBest(components: CombiComponent[], bucket: CompBucket): CombiComponent | null {
  const candidates = components
    .filter((c) => bucketOf(c.type) === bucket && (c.signal === 'strong' || c.signal === 'promising'))
    .sort((a, b) =>
      (SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal])
      || ((b.keyMetric ?? -Infinity) - (a.keyMetric ?? -Infinity))
      || (b.adCount - a.adCount));
  return candidates[0] ?? null;
}

function slot(bucket: CompBucket, c: CombiComponent): CombiSlot {
  const metricTxt = c.keyMetric != null ? `${c.keyMetric}${bucket === 'hook' ? '% Hook Rate' : bucket === 'cta' ? '% Ausg. CTR' : '% Retention'}${c.keyDelta != null ? ` (${c.keyDelta > 0 ? '+' : ''}${c.keyDelta}pp vs Produkt-Baseline)` : ''}` : '—';
  return {
    bucket, componentId: c.id, code: c.code, name: c.name, sourceAdName: c.sourceAdName,
    keyMetric: c.keyMetric, keyDelta: c.keyDelta, signal: c.signal,
    reason: `${BUCKET_LABEL[bucket]}: ${c.code}${c.sourceAdName ? ` aus ${c.sourceAdName}` : ''} — ${metricTxt}${c.signal === 'promising' ? ' · noch geringe Confidence' : ''}`,
  };
}

/**
 * Baut die empfohlene Kombination. Nur wenn mindestens Hook UND Body vorhanden sind
 * (sonst keine willkürliche Empfehlung → null). CTA/Proof optional ergänzt.
 */
export function recommendCombination(components: CombiComponent[]): CombinationResult | null {
  const hook = pickBest(components, 'hook');
  const body = pickBest(components, 'body');
  if (!hook || !body) return null; // keine willkürliche Kombination

  const slots: CombiSlot[] = [slot('hook', hook), slot('body', body)];
  const cta = pickBest(components, 'cta');
  if (cta) slots.push(slot('cta', cta));
  const proof = pickBest(components, 'proof');
  if (proof) slots.push(slot('proof', proof));

  const chosen = [hook, body, ...(cta ? [cta] : []), ...(proof ? [proof] : [])];
  // Gesamt-Confidence = schwächste der gewählten; „promising", wenn irgendein Slot promising/low.
  const minConf = chosen.reduce<ConfLevel>((acc, c) => (CONF_RANK[c.confidence] < CONF_RANK[acc] ? c.confidence : acc), 'high');
  const anyPromising = chosen.some((c) => c.signal === 'promising') || minConf === 'low';
  const label: 'recommended' | 'promising' = anyPromising ? 'promising' : 'recommended';

  const sources = Array.from(new Set(chosen.map((c) => c.sourceAdName).filter(Boolean)));
  const reason = `${label === 'recommended' ? 'Empfohlene' : 'Vielversprechende'} Kombination der jeweils stärksten validierten Bausteine dieser Produktgruppe${sources.length > 1 ? ` (aus ${sources.join(', ')})` : ''}. Testvariable: Baustein-Kombination — Offer/Angle/Visual-Stil konstant halten.`;

  return { componentIds: chosen.map((c) => c.id), slots, confidence: minConf, label, reason };
}
