import { describe, expect, it } from 'vitest';
import {
  deriveProductionCandidates, hasOpposingStrengths, classifyBody, StrategyAd, StrategyInput,
} from '../creative-strategy';

const baseAd = (over: Partial<StrategyAd>): StrategyAd => ({
  adId: 'ad-x', name: 'AD-X',
  hookClass: 'iteration', hookRatePct: 24, hookBaselinePct: 19, hookDeltaPp: 5,
  retention50to75: 40, bodyBaselinePct: 38, bodyDeltaPp: 2,
  confidence: 'high', impressions: 50000,
  biggestDrop: null, overlapComponent: null,
  components: { hook: { code: 'HK-1', type: 'hook', name: 'Hook 1' }, body: { code: 'BD-1', type: 'body', name: 'Body 1' } },
  ...over,
});

const run = (ads: StrategyAd[], combination: StrategyInput['combination'] = null) =>
  deriveProductionCandidates({ ads, combination, minImpressions: 3000 });

describe('classifyBody (relativ zur Produkt-Baseline)', () => {
  it('±8pp Schwellen', () => {
    expect(classifyBody(10)).toBe('strong');
    expect(classifyBody(8)).toBe('strong');
    expect(classifyBody(3)).toBe('neutral');
    expect(classifyBody(-8)).toBe('weak');
    expect(classifyBody(null)).toBe('neutral');
  });
});

describe('Eval A — Weak Hook + Strong Body', () => {
  it('erwartet Hook ersetzen, Body behalten', () => {
    const c = run([baseAd({ hookClass: 'weak', hookRatePct: 14, hookDeltaPp: -5, bodyDeltaPp: 11 })]);
    const rec = c.find((r) => r.actionType === 'REPLACE_HOOK');
    expect(rec).toBeDefined();
    expect(rec!.changeComponents).toContain('HK-1');
    expect(rec!.keepComponents).toContain('BD-1');
    expect(rec!.variantCount).toBe(4);
    // keine aggressive Body-Änderung
    expect(c.some((r) => r.actionType === 'KEEP_HOOK_REPLACE_BODY')).toBe(false);
  });
});

describe('Eval B — Strong Hook + Weak Body', () => {
  it('erwartet Hook behalten, Body ändern', () => {
    const c = run([baseAd({ hookClass: 'strong', hookRatePct: 32, hookDeltaPp: 13, bodyDeltaPp: -10 })]);
    const rec = c.find((r) => r.actionType === 'KEEP_HOOK_REPLACE_BODY');
    expect(rec).toBeDefined();
    expect(rec!.keepComponents).toContain('HK-1');
    expect(rec!.changeComponents).toContain('BD-1');
    expect(c.some((r) => r.actionType === 'REPLACE_HOOK')).toBe(false);
  });
});

describe('Eval C — Strong Hook + Strong Body', () => {
  it('erwartet Winner iterieren (kontrollierte Varianten)', () => {
    const c = run([baseAd({ hookClass: 'strong', hookRatePct: 34, hookDeltaPp: 15, bodyDeltaPp: 12 })]);
    const rec = c.find((r) => r.actionType === 'ITERATE_WINNING_HOOK');
    expect(rec).toBeDefined();
    expect(rec!.keepComponents).toEqual(expect.arrayContaining(['HK-1', 'BD-1']));
    expect(rec!.changeComponents).toHaveLength(0);
    expect(rec!.variantCount).toBe(2);
  });
});

describe('Eval D — Mid/Late Drop + Proof-Overlap', () => {
  it('erwartet Proof testen, Rest behalten', () => {
    const c = run([baseAd({
      hookClass: 'strong', hookRatePct: 31, hookDeltaPp: 12, bodyDeltaPp: 2,
      biggestDrop: { position: 'mid', segment: '50%→75%', dropPct: 38, fromSeconds: 18, toSeconds: 24 },
      overlapComponent: { code: 'PR-4', type: 'proof', name: 'Proof 4' },
    })]);
    const rec = c.find((r) => r.actionType === 'REPLACE_PROOF');
    expect(rec).toBeDefined();
    expect(rec!.changeComponents).toContain('PR-4');
    expect(rec!.keepComponents).toContain('HK-1');
  });

  it('ohne Proof-Overlap keine REPLACE_PROOF-Empfehlung', () => {
    const c = run([baseAd({
      biggestDrop: { position: 'mid', segment: '50%→75%', dropPct: 38, fromSeconds: 18, toSeconds: 24 },
      overlapComponent: null,
    })]);
    expect(c.some((r) => r.actionType === 'REPLACE_PROOF')).toBe(false);
  });
});

describe('Eval E — Strong Components aus mehreren Ads', () => {
  it('erwartet BUILD_COMPONENT_COMBINATION aus der Combination Engine', () => {
    const c = run([baseAd({})], {
      componentIds: ['c1', 'c2', 'c3'], label: 'recommended', confidence: 'high',
      slots: [
        { bucket: 'hook', code: 'HK-42', name: 'Hook 42', sourceAdName: 'AD-B' },
        { bucket: 'body', code: 'BD-17', name: 'Body 17', sourceAdName: 'AD-A' },
        { bucket: 'cta', code: 'CT-3', name: 'CTA 3', sourceAdName: 'AD-C' },
      ],
    });
    const rec = c.find((r) => r.actionType === 'BUILD_COMPONENT_COMBINATION');
    expect(rec).toBeDefined();
    expect(rec!.suggestedComponents).toEqual(['HK-42', 'BD-17', 'CT-3']);
    expect(rec!.priority).toBe('high');
  });
});

describe('Eval F — Low Confidence / zu wenig Daten', () => {
  it('low confidence -> RETEST, keine aggressive Produktion', () => {
    const c = run([baseAd({ hookClass: 'weak', hookRatePct: 14, bodyDeltaPp: 11, confidence: 'low' })]);
    expect(c).toHaveLength(1);
    expect(c[0].actionType).toBe('RETEST_LOW_CONFIDENCE');
    expect(c.some((r) => r.actionType === 'REPLACE_HOOK')).toBe(false);
  });

  it('zu wenige Impressionen -> INSUFFICIENT_DATA', () => {
    const c = run([baseAd({ confidence: 'medium', impressions: 1200 })]);
    expect(c).toHaveLength(1);
    expect(c[0].actionType).toBe('INSUFFICIENT_DATA');
  });
});

describe('Eval G — zwei Ads mit gegensätzlichen Stärken', () => {
  it('erkennt Cross-Ad-Signal und schlägt Kombination vor', () => {
    const ads = [
      baseAd({ adId: 'a1', name: 'AD-A', hookClass: 'strong', hookRatePct: 32, hookDeltaPp: 13, bodyDeltaPp: -9 }),
      baseAd({ adId: 'a2', name: 'AD-B', hookClass: 'weak', hookRatePct: 13, hookDeltaPp: -6, bodyDeltaPp: 12 }),
    ];
    expect(hasOpposingStrengths(ads)).toBe(true);
    const c = run(ads, {
      componentIds: ['h', 'b'], label: 'recommended', confidence: 'medium',
      slots: [
        { bucket: 'hook', code: 'HK-A', name: 'Hook A', sourceAdName: 'AD-A' },
        { bucket: 'body', code: 'BD-B', name: 'Body B', sourceAdName: 'AD-B' },
      ],
    });
    expect(c.some((r) => r.actionType === 'BUILD_COMPONENT_COMBINATION')).toBe(true);
    // AD-A (strong hook, weak body) -> Body ersetzen; AD-B (weak hook, strong body) -> Hook ersetzen
    expect(c.some((r) => r.actionType === 'KEEP_HOOK_REPLACE_BODY')).toBe(true);
    expect(c.some((r) => r.actionType === 'REPLACE_HOOK')).toBe(true);
  });
});
