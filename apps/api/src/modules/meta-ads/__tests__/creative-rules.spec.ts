import { describe, expect, it } from 'vitest';
import { HOOK_RULES, classifyHook, hookVerdict, CREATIVE_RULES_VERSION } from '../creative-rules';

describe('creative-rules — absolute Hook-Schwellen (intern, versioniert)', () => {
  it('Schwellen + Version sind zentral definiert', () => {
    expect(HOOK_RULES.strongPct).toBe(30);
    expect(HOOK_RULES.iterationPct).toBe(20);
    expect(CREATIVE_RULES_VERSION).toBe('v1');
  });

  it('classifyHook: >=30 strong, 20–<30 iteration, <20 weak (Prozent)', () => {
    expect(classifyHook(34.8)).toBe('strong');
    expect(classifyHook(30)).toBe('strong');
    expect(classifyHook(29.9)).toBe('iteration');
    expect(classifyHook(24)).toBe('iteration');
    expect(classifyHook(20)).toBe('iteration');
    expect(classifyHook(19.9)).toBe('weak');
    expect(classifyHook(5)).toBe('weak');
    expect(classifyHook(null)).toBeNull();
    expect(classifyHook(undefined)).toBeNull();
  });

  it('normalisiert Bruchwerte (<=1) als Anteil', () => {
    expect(classifyHook(0.348)).toBe('strong'); // 34.8%
    expect(classifyHook(0.24)).toBe('iteration'); // 24%
    expect(classifyHook(0.19)).toBe('weak'); // 19%
  });

  it('hookVerdict kombiniert absolute Regel + Produkt-Baseline (#6)', () => {
    const v = hookVerdict(28, 21);
    expect(v.hookClass).toBe('iteration'); // 28% < 30%
    expect(v.ratePct).toBe(28);
    expect(v.baselinePct).toBe(21);
    expect(v.deltaPp).toBe(7); // +7pp über Baseline
    expect(v.aboveBaseline).toBe(true);
    expect(v.belowStrongTarget).toBe(true); // noch unter 30%-Ziel
  });

  it('hookVerdict: strong + über Ziel', () => {
    const v = hookVerdict(34.8, 23.8);
    expect(v.hookClass).toBe('strong');
    expect(v.deltaPp).toBe(11);
    expect(v.belowStrongTarget).toBe(false);
  });

  it('hookVerdict ohne Baseline', () => {
    const v = hookVerdict(22, null);
    expect(v.hookClass).toBe('iteration');
    expect(v.deltaPp).toBeNull();
    expect(v.aboveBaseline).toBeNull();
  });
});
