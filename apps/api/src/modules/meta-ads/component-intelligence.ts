/**
 * Component Intelligence (Increment D) — reine, deterministische Klassifikation
 * einzelner Creative-Bausteine. Die AI erklärt/priorisiert später; SIE erfindet
 * NICHT, welches Component „gewinnt". Signale sind Assoziationen, keine Kausalität.
 */
import { HOOK_RULES } from './creative-rules';

export type ComponentSignal = 'strong' | 'iteration' | 'weak' | 'promising' | 'insufficient_data';

export const COMPONENT_SIGNAL_LABEL: Record<ComponentSignal, string> = {
  strong: 'Strong',
  iteration: 'Iteration',
  weak: 'Weak',
  promising: 'Promising',
  insufficient_data: 'Zu wenig Daten',
};

/** Deltas (Prozentpunkte) für nicht-Hook-Bausteine relativ zur Produkt-Baseline. */
export const COMPONENT_DELTA = { strongPp: 8, weakPp: -8 } as const;
/** Mindest-Datenlage, damit ein Signal überhaupt ausgesagt wird. */
export const COMPONENT_MIN = { impressions: 1000, adCount: 1 } as const;

export interface ComponentSignalInput {
  type: string;
  keyMetricPct: number | null;   // Hook→Hook Rate, Body/Proof→Mid-Retention, CTA→Ausg. CTR
  baselinePct: number | null;    // Produkt-Baseline derselben Metrik
  confidence: 'low' | 'medium' | 'high';
  adCount: number;
  impressions: number;
}

/** Welche aggregierte Kennzahl ist für diesen Component-Typ maßgeblich? */
export function keyMetricForType(type: string, agg: { hookRate: number | null; holdRate: number | null; retention50to75: number | null; retention75to95: number | null; outboundCtr: number | null }): number | null {
  switch (type) {
    case 'hook':
    case 'visual_opening':
      return agg.hookRate;
    case 'cta':
    case 'offer_section':
      return agg.outboundCtr;
    case 'proof':
    case 'testimonial':
      return agg.retention75to95 ?? agg.retention50to75;
    case 'body':
    case 'problem_section':
    case 'solution_section':
    case 'product_demo':
    default:
      return agg.retention50to75 ?? agg.holdRate;
  }
}

/** Deterministisches Signal eines Components. */
export function classifyComponentSignal(i: ComponentSignalInput): ComponentSignal {
  if (i.keyMetricPct == null || i.adCount < COMPONENT_MIN.adCount || i.impressions < COMPONENT_MIN.impressions) {
    return 'insufficient_data';
  }
  let base: 'strong' | 'iteration' | 'weak';
  if (i.type === 'hook' || i.type === 'visual_opening') {
    // Absolute Hook-Regeln.
    base = i.keyMetricPct >= HOOK_RULES.strongPct ? 'strong' : i.keyMetricPct >= HOOK_RULES.iterationPct ? 'iteration' : 'weak';
  } else {
    // Relativ zur Produkt-Baseline (Prozentpunkte).
    const d = i.baselinePct != null ? i.keyMetricPct - i.baselinePct : null;
    base = d == null ? 'iteration' : d >= COMPONENT_DELTA.strongPp ? 'strong' : d <= COMPONENT_DELTA.weakPp ? 'weak' : 'iteration';
  }
  // Confidence-Gate: starke Metrik + geringe Confidence = „Promising", nie „Winner/Strong".
  if (i.confidence === 'low') return base === 'strong' ? 'promising' : base;
  return base;
}
