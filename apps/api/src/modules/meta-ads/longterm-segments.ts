/**
 * Long-Term Review — Segment-Engine (rein & deterministisch).
 *
 * Zerlegt eine historische Video-Ad anhand der Meta-Checkpoints in 6 funktionale
 * Performance-Segmente. Namen sind ZUNÄCHST POSITIONAL (kein „Proof"/„Body"),
 * solange keine Component hinterlegt ist. Retention = end/start (keine
 * gemittelten Tagesraten). Späte Segmente werden über Start-Viewer-Confidence
 * relativiert — 95→100 mit 90 % bei 50 Viewern ist NICHT stark.
 *
 * Reuse: buildAttentionSegments (gleiche Checkpoint-Mathematik wie Attention-Map)
 * + timePositionSeconds/round aus meta-ads-calc. Das LLM rechnet nichts davon.
 */
import { buildAttentionSegments, AttentionPoint } from './attention-map';
import { timePositionSeconds, round } from './meta-ads-calc';

export type SegmentKey = 'opening' | 'early' | 'mid_a' | 'mid_b' | 'late' | 'ending';
export type SegmentConfidence = 'low' | 'medium' | 'high';

export interface SegmentDef { key: SegmentKey; label: string; position: string; fromPct: number; toPct: number }
/** fromPct/toPct beziehen sich auf die Videolänge (opening = 0→3s als Sonderfall über Sekunden). */
export const SEGMENTS: SegmentDef[] = [
  { key: 'opening', label: 'Opening / Hook', position: '0–3s', fromPct: 0, toPct: 0 },
  { key: 'early', label: 'Early Section', position: '3s→25 %', fromPct: 0, toPct: 25 },
  { key: 'mid_a', label: 'Mid Section A', position: '25→50 %', fromPct: 25, toPct: 50 },
  { key: 'mid_b', label: 'Mid Section B', position: '50→75 %', fromPct: 50, toPct: 75 },
  { key: 'late', label: 'Late Section', position: '75→95 %', fromPct: 75, toPct: 95 },
  { key: 'ending', label: 'Ending', position: '95→100 %', fromPct: 95, toPct: 100 },
];

const LABEL_TO_KEY: Record<string, SegmentKey> = {
  '0s→3s': 'opening', '3s→25%': 'early', '25%→50%': 'mid_a', '50%→75%': 'mid_b', '75%→95%': 'late', '95%→100%': 'ending',
};

/** Mindest-Evidenz je Segment — relativ zu den Start-Viewern dieses Segments. */
export const SEGMENT_MIN_VIEWERS = { high: 1000, medium: 300 } as const;

export function segmentConfidence(startViewers: number): SegmentConfidence {
  if (startViewers >= SEGMENT_MIN_VIEWERS.high) return 'high';
  if (startViewers >= SEGMENT_MIN_VIEWERS.medium) return 'medium';
  return 'low';
}

export interface SnapshotMetrics {
  impressions: number | null;
  views3s: number | null;
  views25: number | null;
  views50: number | null;
  views75: number | null;
  views95: number | null;
  views100: number | null;
  videoLengthSeconds: number | null;
}

export interface SegmentResult {
  key: SegmentKey;
  label: string;
  position: string;
  startSecond: number | null;
  endSecond: number | null;
  startViewers: number;
  endViewers: number;
  retention: number | null; // %
  drop: number | null;      // %
  confidence: SegmentConfidence;
}

export interface SegmentFunnel {
  segments: SegmentResult[];
  maxViewers: number;
  completion25to100: number | null; // %
  completion50to100: number | null; // %
  completionOverall: number | null; // views100 / impressions %
  hasCheckpoints: boolean;
}

/** Baut die positionalen Performance-Segmente aus den Roh-Checkpoints. */
export function computeSegments(m: SnapshotMetrics): SegmentFunnel {
  const vl = m.videoLengthSeconds ?? null;
  const t = (pct: number) => timePositionSeconds(pct, vl);
  const points: AttentionPoint[] = [
    { label: '0s', seconds: 0, viewers: m.impressions ?? 0 },
    { label: '3s', seconds: 3, viewers: m.views3s ?? 0 },
    { label: '25%', seconds: t(25), viewers: m.views25 ?? 0 },
    { label: '50%', seconds: t(50), viewers: m.views50 ?? 0 },
    { label: '75%', seconds: t(75), viewers: m.views75 ?? 0 },
    { label: '95%', seconds: t(95), viewers: m.views95 ?? 0 },
    { label: '100%', seconds: t(100), viewers: m.views100 ?? 0 },
  ].filter((p) => p.viewers > 0);

  const { segments, maxViewers } = buildAttentionSegments(points);
  const out: SegmentResult[] = segments.map((s) => {
    const def = SEGMENTS.find((d) => d.key === LABEL_TO_KEY[s.label]);
    return {
      key: LABEL_TO_KEY[s.label], label: def?.label ?? s.label, position: def?.position ?? s.label,
      startSecond: s.startSecond, endSecond: s.endSecond,
      startViewers: s.startViewers, endViewers: s.endViewers,
      retention: s.retention, drop: s.drop,
      confidence: segmentConfidence(s.startViewers),
    };
  });

  const safeDivPct = (a: number | null | undefined, b: number | null | undefined): number | null =>
    a != null && b != null && b > 0 ? round((a / b) * 100, 1) : null;

  return {
    segments: out,
    maxViewers,
    completion25to100: safeDivPct(m.views100, m.views25),
    completion50to100: safeDivPct(m.views100, m.views50),
    completionOverall: safeDivPct(m.views100, m.impressions),
    hasCheckpoints: out.length > 0,
  };
}
