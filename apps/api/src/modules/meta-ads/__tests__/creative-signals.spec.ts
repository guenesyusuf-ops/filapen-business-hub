import { describe, it, expect } from 'vitest';
import { classifyAdSignals, dropComponentOverlap, SignalProfile } from '../creative-signals';

const base: SignalProfile = {
  hookRate: 30, holdRate: 40, outboundCtr: 2,
  retention25to50: 70, retention50to75: 50, retention75to95: 40, retention95to100: 90, watchPercentage: 50,
};
const prof = (p: Partial<SignalProfile>): SignalProfile => ({ ...base, ...p });
const types = (r: ReturnType<typeof classifyAdSignals>) => r.signals.map((s) => s.type);

describe('classifyAdSignals (deterministisch, Baseline-relativ)', () => {
  it('FULL_WINNER: starke Hook + starke Mid-Retention + ROAS', () => {
    const r = classifyAdSignals(prof({ hookRate: 45, retention50to75: 62 }), base, 4.2, 'high');
    expect(r.primary).toBe('FULL_WINNER');
    expect(types(r)).toContain('HOOK_WINNER');
    expect(types(r)).toContain('STRONG_RETENTION');
  });

  it('HOOK_WINNER: nur Hook stark, Rest neutral', () => {
    const r = classifyAdSignals(prof({ hookRate: 45 }), base, 1.0, 'high');
    expect(r.primary).toBe('HOOK_WINNER');
  });

  it('BODY_WINNER: Mid-Retention stark, Hook neutral', () => {
    const r = classifyAdSignals(prof({ retention50to75: 62 }), base, 1.0, 'high');
    expect(r.primary).toBe('BODY_WINNER');
  });

  it('NEEDS_ITERATION: schwache Hook + Mid-Drop', () => {
    const r = classifyAdSignals(prof({ hookRate: 18, retention50to75: 38 }), base, 1.0, 'high');
    expect(r.primary).toBe('NEEDS_ITERATION');
    expect(types(r)).toEqual(expect.arrayContaining(['WEAK_HOOK', 'MID_VIDEO_DROP']));
  });

  it('SALVAGE_BODY: schwache Hook, aber starke Mid-Retention', () => {
    const r = classifyAdSignals(prof({ hookRate: 18, retention50to75: 62 }), base, 2.0, 'high');
    expect(r.primary).toBe('SALVAGE_BODY');
    expect(types(r)).not.toContain('BODY_WINNER'); // Body-Winner nur bei nicht-schwacher Hook
  });

  it('SALVAGE_HOOK: starke Hook, danach Mid-Drop', () => {
    const r = classifyAdSignals(prof({ hookRate: 45, retention50to75: 38 }), base, 1.0, 'high');
    expect(r.primary).toBe('SALVAGE_HOOK');
  });

  it('TRAFFIC_PROBLEM: Retention ok, aber Outbound CTR deutlich unter Baseline', () => {
    // self Outbound 2 vs Baseline 12 → -10pp (WEAK), Retention neutral → TRAFFIC_PROBLEM
    const weak = classifyAdSignals(base, { ...base, outboundCtr: 12 }, 1.0, 'high');
    expect(types(weak)).toContain('TRAFFIC_PROBLEM');
    // kleine Abweichung (-2pp) → kein Signal
    const mild = classifyAdSignals(prof({ outboundCtr: 0 }), base, 1.0, 'high');
    expect(types(mild)).not.toContain('TRAFFIC_PROBLEM');
  });

  it('Low Confidence + gute Werte → PROMISING statt Winner', () => {
    const r = classifyAdSignals(prof({ hookRate: 45, retention50to75: 62 }), base, 4.2, 'low');
    expect(r.primary).toBe('PROMISING');
    expect(types(r)).toContain('LOW_CONFIDENCE');
  });

  it('ohne Baseline: kein Winner-Urteil', () => {
    const r = classifyAdSignals(prof({ hookRate: 45 }), null, 4.2, 'high');
    expect(r.primary).toBeNull();
  });
});

describe('dropComponentOverlap (deterministisch)', () => {
  it('Overlap mit Dauer + Anteilen', () => {
    // Drop 20–30 (10s), Component 24–31 (7s) → Overlap 24–30 = 6s
    const o = dropComponentOverlap(20, 30, 24, 31)!;
    expect(o.overlap).toBe(true);
    expect(o.overlapSeconds).toBe(6);
    expect(o.shareOfDrop).toBe(0.6);       // 6/10
    expect(o.shareOfComponent).toBeCloseTo(0.86, 1); // 6/7
  });

  it('kein Overlap', () => {
    const o = dropComponentOverlap(0, 4, 10, 20)!;
    expect(o.overlap).toBe(false);
    expect(o.overlapSeconds).toBe(0);
  });

  it('null bei fehlenden Zeiten', () => {
    expect(dropComponentOverlap(20, 30, null, 31)).toBeNull();
    expect(dropComponentOverlap(30, 20, 24, 31)).toBeNull(); // ungültiges Fenster
  });
});
