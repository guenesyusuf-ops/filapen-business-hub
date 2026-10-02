/**
 * Zentrale, versionierte INTERNE Creative Rules für das Meta-Ads-Modul.
 *
 * Das sind bewusst unsere internen Geschäftsregeln (keine universellen
 * wissenschaftlichen Wahrheiten). EINE Wahrheitsquelle — nicht über mehrere
 * Services verstreut. Einheit: Hook/Hold/CTR/Retention als PROZENT-Zahl
 * (z. B. 30 = 30 %), konsistent zu AggregatedMetrics (meta-ads-calc).
 */

export const CREATIVE_RULES_VERSION = 'v1';

/** Absolute Hook-Schwellen (in Prozent). */
export const HOOK_RULES = {
  /** >= 30 % → Strong Hook */
  strongPct: 30,
  /** >= 20 % und < 30 % → Iteration Zone */
  iterationPct: 20,
} as const;

export type HookClass = 'strong' | 'iteration' | 'weak';

/** Rate robust auf Prozent normalisieren (akzeptiert auch Bruchwerte <= 1). */
function toPercent(rate: number): number {
  return rate > 0 && rate <= 1 ? rate * 100 : rate;
}

/** Absolute Hook-Klasse nach internen Regeln. null, wenn kein Messwert. */
export function classifyHook(rate: number | null | undefined): HookClass | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  const pct = toPercent(rate);
  if (pct >= HOOK_RULES.strongPct) return 'strong';
  if (pct >= HOOK_RULES.iterationPct) return 'iteration';
  return 'weak';
}

export const HOOK_CLASS_LABEL: Record<HookClass, string> = {
  strong: 'Strong Hook',
  iteration: 'Iteration Zone',
  weak: 'Weak Hook',
};

export interface HookVerdict {
  hookClass: HookClass | null;
  ratePct: number | null;
  /** Produkt-Baseline in Prozent (oder null). */
  baselinePct: number | null;
  /** Differenz zur Baseline in Prozentpunkten (gerundet, oder null). */
  deltaPp: number | null;
  aboveBaseline: boolean | null;
  /** Liegt der Wert unter unserem Strong-Hook-Ziel (30 %)? */
  belowStrongTarget: boolean | null;
}

/**
 * Kombiniert ABSOLUTE Regel UND Produkt-Baseline (#6). Liefert maschinenlesbare
 * Fakten — keine Prosa. Die Formulierung ("deutlich über Baseline, aber unter
 * Strong-Ziel") erzeugt die UI/der LLM aus diesen Feldern.
 */
export function hookVerdict(rate: number | null | undefined, baseline: number | null | undefined): HookVerdict {
  const ratePct = rate == null || !Number.isFinite(rate) ? null : round1(toPercent(rate));
  const baselinePct = baseline == null || !Number.isFinite(baseline) ? null : round1(toPercent(baseline));
  const deltaPp = ratePct != null && baselinePct != null ? round1(ratePct - baselinePct) : null;
  return {
    hookClass: classifyHook(rate),
    ratePct,
    baselinePct,
    deltaPp,
    aboveBaseline: deltaPp == null ? null : deltaPp > 0,
    belowStrongTarget: ratePct == null ? null : ratePct < HOOK_RULES.strongPct,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
