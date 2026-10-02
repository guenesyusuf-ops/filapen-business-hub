import { describe, expect, it } from 'vitest';
import { recommendCombination, bucketOf, CombiComponent } from '../combination-engine';

const c = (o: Partial<CombiComponent>): CombiComponent => ({
  id: o.id!, code: o.code ?? o.id!, name: o.name ?? o.id!, type: o.type ?? 'hook',
  keyMetric: o.keyMetric ?? null, keyDelta: o.keyDelta ?? null, signal: o.signal ?? 'strong',
  confidence: o.confidence ?? 'high', adCount: o.adCount ?? 3, sourceAdName: o.sourceAdName ?? null,
});

describe('bucketOf', () => {
  it('mappt Typen auf Buckets', () => {
    expect(bucketOf('hook')).toBe('hook');
    expect(bucketOf('visual_opening')).toBe('hook');
    expect(bucketOf('body')).toBe('body');
    expect(bucketOf('problem_section')).toBe('body');
    expect(bucketOf('testimonial')).toBe('proof');
    expect(bucketOf('cta')).toBe('cta');
  });
});

describe('recommendCombination', () => {
  it('kombiniert stärksten Hook + Body (+ CTA) aus verschiedenen Ads', () => {
    const r = recommendCombination([
      c({ id: 'HK-01', type: 'hook', keyMetric: 34, signal: 'strong', sourceAdName: 'AD-B' }),
      c({ id: 'HK-02', type: 'hook', keyMetric: 22, signal: 'iteration', sourceAdName: 'AD-A' }),
      c({ id: 'BD-07', type: 'body', keyMetric: 62, keyDelta: 12, signal: 'strong', sourceAdName: 'AD-A' }),
      c({ id: 'CT-03', type: 'cta', keyMetric: 2.1, keyDelta: 9, signal: 'strong', sourceAdName: 'AD-C' }),
    ])!;
    expect(r).not.toBeNull();
    expect(r.componentIds).toEqual(['HK-01', 'BD-07', 'CT-03']);
    expect(r.label).toBe('recommended');
    expect(r.confidence).toBe('high');
    expect(r.slots.find((s) => s.bucket === 'hook')!.code).toBe('HK-01');
  });

  it('wählt strong vor promising, dann höhere Metrik', () => {
    const r = recommendCombination([
      c({ id: 'HK-a', type: 'hook', keyMetric: 31, signal: 'promising', confidence: 'low' }),
      c({ id: 'HK-b', type: 'hook', keyMetric: 33, signal: 'strong' }),
      c({ id: 'BD-x', type: 'body', keyMetric: 60, signal: 'strong' }),
    ])!;
    expect(r.slots.find((s) => s.bucket === 'hook')!.code).toBe('HK-b');
  });

  it('Low Confidence / promising -> Label promising (nicht recommended)', () => {
    const r = recommendCombination([
      c({ id: 'HK-1', type: 'hook', keyMetric: 31, signal: 'promising', confidence: 'low' }),
      c({ id: 'BD-1', type: 'body', keyMetric: 60, signal: 'strong', confidence: 'high' }),
    ])!;
    expect(r.label).toBe('promising');
    expect(r.confidence).toBe('low');
  });

  it('keine willkürliche Kombination: ohne Hook ODER Body -> null', () => {
    expect(recommendCombination([c({ id: 'BD-1', type: 'body', signal: 'strong' })])).toBeNull();
    expect(recommendCombination([c({ id: 'HK-1', type: 'hook', signal: 'strong' })])).toBeNull();
  });

  it('ignoriert weak/iteration/insufficient_data als Slot-Kandidaten', () => {
    expect(recommendCombination([
      c({ id: 'HK-1', type: 'hook', signal: 'weak' }),
      c({ id: 'BD-1', type: 'body', signal: 'strong' }),
    ])).toBeNull(); // Hook nur weak -> kein Hook-Slot -> null
  });
});
