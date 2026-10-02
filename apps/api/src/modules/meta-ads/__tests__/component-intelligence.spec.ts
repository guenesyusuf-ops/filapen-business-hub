import { describe, expect, it } from 'vitest';
import { classifyComponentSignal, keyMetricForType, COMPONENT_MIN, ComponentSignalInput } from '../component-intelligence';

const base: ComponentSignalInput = { type: 'hook', keyMetricPct: null, baselinePct: 20, confidence: 'high', adCount: 3, impressions: 50000 };

describe('classifyComponentSignal — Hook (absolute Regeln)', () => {
  it('strong >=30%', () => expect(classifyComponentSignal({ ...base, keyMetricPct: 34 })).toBe('strong'));
  it('iteration 20–30%', () => expect(classifyComponentSignal({ ...base, keyMetricPct: 24 })).toBe('iteration'));
  it('weak <20%', () => expect(classifyComponentSignal({ ...base, keyMetricPct: 14 })).toBe('weak'));
});

describe('classifyComponentSignal — Body/Proof/CTA (Delta zur Baseline)', () => {
  it('Strong Body: +12pp', () => expect(classifyComponentSignal({ ...base, type: 'body', keyMetricPct: 62, baselinePct: 50 })).toBe('strong'));
  it('Salvage/Weak Body: -18pp', () => expect(classifyComponentSignal({ ...base, type: 'body', keyMetricPct: 32, baselinePct: 50 })).toBe('weak'));
  it('Iteration Body: +3pp', () => expect(classifyComponentSignal({ ...base, type: 'body', keyMetricPct: 53, baselinePct: 50 })).toBe('iteration'));
  it('CTA +1pp (< 8pp) = iteration', () => expect(classifyComponentSignal({ ...base, type: 'cta', keyMetricPct: 2.0, baselinePct: 1.0 })).toBe('iteration'));
  it('CTA +9pp = strong', () => expect(classifyComponentSignal({ ...base, type: 'cta', keyMetricPct: 10, baselinePct: 1 })).toBe('strong'));
});

describe('classifyComponentSignal — Confidence + Datenlage', () => {
  it('Low Confidence + starke Metrik = promising (nicht strong)', () => {
    expect(classifyComponentSignal({ ...base, keyMetricPct: 34, confidence: 'low' })).toBe('promising');
  });
  it('Low Confidence + schwache Metrik bleibt weak', () => {
    expect(classifyComponentSignal({ ...base, keyMetricPct: 14, confidence: 'low' })).toBe('weak');
  });
  it('zu wenig Impressionen = insufficient_data', () => {
    expect(classifyComponentSignal({ ...base, keyMetricPct: 34, impressions: COMPONENT_MIN.impressions - 1 })).toBe('insufficient_data');
  });
  it('0 Ads = insufficient_data', () => {
    expect(classifyComponentSignal({ ...base, keyMetricPct: 34, adCount: 0 })).toBe('insufficient_data');
  });
  it('kein Messwert = insufficient_data', () => {
    expect(classifyComponentSignal({ ...base, keyMetricPct: null })).toBe('insufficient_data');
  });
});

describe('keyMetricForType', () => {
  const agg = { hookRate: 28, holdRate: 9, retention50to75: 55, retention75to95: 60, outboundCtr: 1.5 };
  it('hook -> hookRate', () => expect(keyMetricForType('hook', agg)).toBe(28));
  it('body -> retention50to75', () => expect(keyMetricForType('body', agg)).toBe(55));
  it('proof -> retention75to95', () => expect(keyMetricForType('proof', agg)).toBe(60));
  it('cta -> outboundCtr', () => expect(keyMetricForType('cta', agg)).toBe(1.5));
});
