/**
 * Deterministische Creative-Signale & Drop↔Component-Overlap (Phase 4).
 * KEINE KI. Alles relativ zur übergebenen Baseline (Produktgruppe).
 * Formulierungen bewusst als Assoziation, nie als Kausalität.
 */

export type OpportunityType =
  | 'FULL_WINNER' | 'HOOK_WINNER' | 'BODY_WINNER' | 'STRONG_RETENTION'
  | 'WEAK_HOOK' | 'MID_VIDEO_DROP' | 'LATE_DROP' | 'TRAFFIC_PROBLEM'
  | 'SALVAGE_BODY' | 'SALVAGE_HOOK' | 'NEEDS_ITERATION' | 'PROMISING' | 'LOW_CONFIDENCE';

export interface SignalProfile {
  hookRate: number | null;
  holdRate: number | null;
  outboundCtr: number | null;
  retention25to50: number | null;
  retention50to75: number | null;
  retention75to95: number | null;
  retention95to100: number | null;
  watchPercentage: number | null;
}

export interface Signal { type: OpportunityType; label: string; detail: string }
export interface SignalResult { signals: Signal[]; primary: OpportunityType | null }

// Schwellen in Prozentpunkten (pp) ggü. Baseline — bewusst konservativ.
const STRONG = 8;
const MILD = 5;
const WEAK = -8;

const pp = (d: number) => `${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}pp`;
function delta(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : Math.round((a - b) * 10) / 10;
}

/**
 * Klassifiziert eine Ad relativ zur (Produktgruppen-)Baseline.
 * Mehrere Signale dürfen gleichzeitig gelten; `primary` ist das führende Label.
 */
export function classifyAdSignals(
  self: SignalProfile,
  baseline: SignalProfile | null,
  calculatedRoas: number | null,
  confidence: 'low' | 'medium' | 'high',
): SignalResult {
  const signals: Signal[] = [];
  if (!baseline) {
    if (confidence === 'low') signals.push({ type: 'LOW_CONFIDENCE', label: 'Geringe Aussagekraft', detail: 'Noch zu wenig Daten für eine verlässliche Einordnung.' });
    return { signals, primary: confidence === 'low' ? 'LOW_CONFIDENCE' : null };
  }

  const dHook = delta(self.hookRate, baseline.hookRate);
  const dMid = delta(self.retention50to75, baseline.retention50to75);
  const dEarly = delta(self.retention25to50, baseline.retention25to50);
  const d7595 = delta(self.retention75to95, baseline.retention75to95);
  const d95100 = delta(self.retention95to100, baseline.retention95to100);
  const dOut = delta(self.outboundCtr, baseline.outboundCtr);

  const hookStrong = dHook != null && dHook >= STRONG;
  const hookWeak = dHook != null && dHook <= WEAK;
  const midStrong = dMid != null && dMid >= STRONG;
  const midWeak = dMid != null && dMid <= WEAK;
  const earlyStrong = dEarly != null && dEarly >= STRONG;
  const lateWeak = (d7595 != null && d7595 <= WEAK) || (d95100 != null && d95100 <= WEAK);
  const trafficWeak = dOut != null && dOut <= WEAK;
  const roasOk = calculatedRoas != null && calculatedRoas >= 1.5;

  if (hookStrong) signals.push({ type: 'HOOK_WINNER', label: 'Hook Winner', detail: `Hook Rate ${pp(dHook!)} vs. Produkt-Baseline.` });
  if (midStrong || earlyStrong) signals.push({ type: 'STRONG_RETENTION', label: 'Strong Retention', detail: `Retention ${pp((midStrong ? dMid : dEarly)!)} vs. Baseline.` });
  if (midStrong && !hookStrong && !hookWeak) signals.push({ type: 'BODY_WINNER', label: 'Body Winner', detail: 'Starke Mid-Retention bei durchschnittlicher Hook.' });
  if (hookStrong && midStrong && roasOk) signals.push({ type: 'FULL_WINNER', label: 'Full Winner', detail: `Hook ${pp(dHook!)}, Mid-Retention ${pp(dMid!)}, ROAS ${calculatedRoas!.toFixed(1)}.` });

  if (hookWeak) signals.push({ type: 'WEAK_HOOK', label: 'Weak Hook', detail: `Hook Rate ${pp(dHook!)} unter Baseline.` });
  if (midWeak) signals.push({ type: 'MID_VIDEO_DROP', label: 'Mid-Video Drop', detail: `50→75 Retention ${pp(dMid!)} unter Baseline.` });
  if (lateWeak) signals.push({ type: 'LATE_DROP', label: 'Late Drop', detail: 'Späte Retention (75–100 %) unter Baseline.' });
  if (trafficWeak && !midWeak) signals.push({ type: 'TRAFFIC_PROBLEM', label: 'Traffic Problem', detail: `Retention ok, aber Ausg. CTR ${pp(dOut!)} unter Baseline.` });

  if (hookWeak && (midStrong || (dOut != null && dOut >= MILD))) signals.push({ type: 'SALVAGE_BODY', label: 'Salvage: Body', detail: 'Schwache Hook, aber der Teil danach trägt — Body prüfen.' });
  if (hookStrong && (midWeak || lateWeak)) signals.push({ type: 'SALVAGE_HOOK', label: 'Salvage: Hook', detail: 'Starke Hook, danach bricht es ein — Hook bewahren, Rest iterieren.' });
  if (confidence === 'low') signals.push({ type: 'LOW_CONFIDENCE', label: 'Geringe Aussagekraft', detail: 'Werte vielversprechend, aber noch wenig Daten.' });

  const has = (t: OpportunityType) => signals.some((s) => s.type === t);
  let primary: OpportunityType | null = null;
  if (confidence === 'low' && (hookStrong || midStrong || earlyStrong)) primary = 'PROMISING';
  else if (has('FULL_WINNER')) primary = 'FULL_WINNER';
  else if (has('SALVAGE_HOOK')) primary = 'SALVAGE_HOOK';
  else if (has('SALVAGE_BODY')) primary = 'SALVAGE_BODY';
  else if (has('HOOK_WINNER')) primary = 'HOOK_WINNER';
  else if (has('BODY_WINNER')) primary = 'BODY_WINNER';
  else if (has('MID_VIDEO_DROP') || has('WEAK_HOOK') || has('LATE_DROP') || has('TRAFFIC_PROBLEM')) primary = 'NEEDS_ITERATION';
  else if (has('STRONG_RETENTION')) primary = 'STRONG_RETENTION';
  else if (confidence === 'low') primary = 'LOW_CONFIDENCE';
  return { signals, primary };
}

// ---------------------------------------------------------------------------
// Drop ↔ Component Overlap (deterministisch)
// ---------------------------------------------------------------------------

export interface Overlap {
  overlap: boolean;
  overlapSeconds: number;
  shareOfDrop: number;      // Anteil des Drop-Fensters (0..1)
  shareOfComponent: number; // Anteil der Component (0..1)
}

export function dropComponentOverlap(
  dropFrom: number | null, dropTo: number | null,
  compStart: number | null, compEnd: number | null,
): Overlap | null {
  if (dropFrom == null || dropTo == null || compStart == null || compEnd == null) return null;
  if (dropTo <= dropFrom || compEnd <= compStart) return null;
  const start = Math.max(dropFrom, compStart);
  const end = Math.min(dropTo, compEnd);
  const ov = Math.max(0, end - start);
  return {
    overlap: ov > 0,
    overlapSeconds: Math.round(ov * 10) / 10,
    shareOfDrop: Math.round((ov / (dropTo - dropFrom)) * 100) / 100,
    shareOfComponent: Math.round((ov / (compEnd - compStart)) * 100) / 100,
  };
}
