/**
 * Attention Map (Increment G) — rein & deterministisch.
 *
 * WICHTIG: Wir haben KEINE sekundengenaue Retention. Nur Meta-Checkpoints
 * (Impressionen, 3s, 25/50/75/95/100 %, Video-Länge). Die Map ist daher eine
 * INTERPOLATION zwischen diesen Checkpoints — niemals als echte Frame-Retention
 * darstellen. Segment-Signale/Intensität sind relativ zu DIESER Ad.
 */

export type AttentionSignal = 'strong' | 'stable' | 'weak' | 'severe_drop';

export interface AttentionPoint {
  label: string;            // '0s' | '3s' | '25%' | '50%' | '75%' | '95%' | '100%'
  seconds: number | null;   // null, wenn Video-Länge unbekannt
  viewers: number;
}

export interface AttentionSegment {
  label: string;            // z. B. '3s→25%'
  startSecond: number | null;
  endSecond: number | null;
  startViewers: number;
  endViewers: number;
  retention: number | null;        // endViewers/startViewers * 100
  drop: number | null;             // 100 - retention
  normalizedAttention: number;     // 0–100, relativ zum Audience-Maximum dieser Ad
  signal: AttentionSignal;
}

export const ATTENTION_SIGNAL_LABEL: Record<AttentionSignal, string> = {
  strong: 'Strong', stable: 'Stable', weak: 'Weak', severe_drop: 'Severe Drop',
};

/** Schwellen (Drop in % je Segment) — interne Regeln, relativ zur Ad. */
export function attentionSignal(drop: number | null): AttentionSignal {
  if (drop == null) return 'stable';
  if (drop >= 40) return 'severe_drop';
  if (drop >= 25) return 'weak';
  if (drop >= 10) return 'stable';
  return 'strong';
}

function round1(v: number): number { return Math.round(v * 10) / 10; }

/**
 * Baut Attention-Segmente aus den (bereits bestimmten) Checkpoint-Punkten.
 * Punkte mit viewers==null werden ignoriert; es braucht >= 2 gültige Punkte.
 */
export function buildAttentionSegments(points: AttentionPoint[]): { segments: AttentionSegment[]; maxViewers: number } {
  const valid = points.filter((p) => Number.isFinite(p.viewers) && p.viewers >= 0);
  const maxViewers = valid.reduce((m, p) => Math.max(m, p.viewers), 0);
  const segments: AttentionSegment[] = [];
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1];
    const b = valid[i];
    const retention = a.viewers > 0 ? round1((b.viewers / a.viewers) * 100) : null;
    const drop = retention != null ? round1(100 - retention) : null;
    const normalizedAttention = maxViewers > 0 ? round1(((a.viewers + b.viewers) / 2 / maxViewers) * 100) : 0;
    segments.push({
      label: `${a.label}→${b.label}`,
      startSecond: a.seconds, endSecond: b.seconds,
      startViewers: a.viewers, endViewers: b.viewers,
      retention, drop, normalizedAttention,
      signal: attentionSignal(drop),
    });
  }
  return { segments, maxViewers };
}
