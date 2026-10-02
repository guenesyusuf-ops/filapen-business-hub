import { describe, expect, it } from 'vitest';
import {
  AI_SYSTEM_PROMPT, buildAnalysisUserPrompt, buildAnalysisMessages, extractJson, parseAnalysisResult, assertValidResult, resolveProvider, AiAnalysisContext, AiAnalysisResult,
} from '../ai-analysis';

const ctx: AiAnalysisContext = {
  scopeType: 'ad', productGroupName: 'Filapen Starter', adName: 'Ad 42', periodLabel: 'Letzte 30 Tage',
  confidenceLevel: 'low', confidenceReasons: ['nur 3 Tage Daten'],
  facts: [{ label: 'Spend', value: '120,00 €' }, { label: 'Hook Rate', value: '28.4%' }, { label: 'Hyros ROAS', value: '2.1×' }],
  baselines: [{ label: 'Hook Rate (Gruppe)', value: '22.0%' }],
  retention: [{ segment: '0→25%', retentionPct: 61, dropPct: 39 }],
  biggestDrop: { segment: '50→75%', fromSeconds: 12, toSeconds: 18, dropPct: 41 },
  signals: [{ opportunityType: 'SALVAGE_HOOK', label: 'Salvage: Hook', detail: 'Body hält, Hook schwach' }],
  components: [{ code: 'HK-0003', type: 'hook', name: 'Problem-Hook', keyMetric: '28.4%', keyDelta: '+6pp' }],
  dataVolumeLow: true,
};

describe('AI system prompt guards', () => {
  it('enforces the non-negotiable rules', () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/EINZIGE Wahrheitsquelle/);
    expect(AI_SYSTEM_PROMPT).toMatch(/Erfinde NIEMALS Messwerte/i);
    expect(AI_SYSTEM_PROMPT).toMatch(/KEINE Kausalaussagen/);
    expect(AI_SYSTEM_PROMPT).toMatch(/Hyros ROAS ist der autoritative ROAS/);
    expect(AI_SYSTEM_PROMPT).toMatch(/observation/);
    expect(AI_SYSTEM_PROMPT).toMatch(/hypothesis/);
    expect(AI_SYSTEM_PROMPT).toMatch(/suggestedTest/);
    expect(AI_SYSTEM_PROMPT).toMatch(/NUR mit gültigem JSON/);
  });
});

describe('user prompt carries deterministic context only', () => {
  const user = buildAnalysisUserPrompt(ctx);
  it('includes facts, baselines, retention, drop, signals, components', () => {
    expect(user).toContain('Hook Rate: 28.4%');
    expect(user).toContain('Hyros ROAS: 2.1×');
    expect(user).toContain('Hook Rate (Gruppe): 22.0%');
    expect(user).toContain('0→25%: 61% (Drop 39%)');
    expect(user).toContain('GRÖSSTER RETENTION-VERLUST: 50→75% (-41%)');
    expect(user).toContain('Salvage: Hook (SALVAGE_HOOK)');
    expect(user).toContain('[hook] HK-0003 Problem-Hook');
  });
  it('flags low data volume explicitly', () => {
    expect(user).toMatch(/geringe Datenmenge/);
  });
  it('buildAnalysisMessages returns both roles', () => {
    const m = buildAnalysisMessages(ctx);
    expect(m.system).toBe(AI_SYSTEM_PROMPT);
    expect(m.user).toBe(user);
  });
});

describe('extractJson', () => {
  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('pulls object out of surrounding prose', () => {
    expect(extractJson('Hier ist das Ergebnis: {"a":1} — fertig.')).toBe('{"a":1}');
  });
  it('throws on no object', () => {
    expect(() => extractJson('kein json hier')).toThrow();
    expect(() => extractJson('')).toThrow();
  });
});

describe('parseAnalysisResult', () => {
  it('normalizes a well-formed response', () => {
    const txt = JSON.stringify({
      summary: 'Hook unter Baseline.',
      observations: [{ text: 'Hook Rate 28.4% vs. 22% Baseline.', confidence: 'medium' }],
      interpretations: [{ text: 'Könnte am Opener liegen.', confidence: 'low' }],
      hypotheses: [{ text: 'Ein stärkerer Opener hebt die Hook Rate.', confidence: 'low' }],
      recommendations: [{ title: 'Neuer Hook', action: 'Pattern-Interrupt in Sek 0-3', suggestedTest: 'A/B gegen Original', confidence: 'medium', componentHint: 'HK-0003' }],
      overallConfidence: 'low',
    });
    const r = parseAnalysisResult(txt);
    expect(r.summary).toContain('Hook');
    expect(r.observations).toHaveLength(1);
    expect(r.recommendations[0].title).toBe('Neuer Hook');
    expect(r.recommendations[0].componentHint).toBe('HK-0003');
    expect(r.overallConfidence).toBe('low');
  });

  it('clamps invalid confidence to low and drops empty entries', () => {
    const txt = '```json\n' + JSON.stringify({
      summary: 'x',
      observations: [{ text: 'ok', confidence: 'super-high' }, { text: '', confidence: 'high' }],
      interpretations: [], hypotheses: [],
      recommendations: [{ title: '', action: '', suggestedTest: '', confidence: 'bogus' }],
      overallConfidence: 'nonsense',
    }) + '\n```';
    const r = parseAnalysisResult(txt);
    expect(r.observations).toHaveLength(1);
    expect(r.observations[0].confidence).toBe('low');
    expect(r.recommendations).toHaveLength(0); // empty title+action dropped
    expect(r.overallConfidence).toBe('low');
  });

  it('throws on unparseable model output', () => {
    expect(() => parseAnalysisResult('the model refused')).toThrow();
  });
});

describe('resolveProvider (explizit, kein stiller Fallback)', () => {
  const base = { hasOpenaiKey: true, hasAnthropicKey: true, openaiModel: 'gpt-4o-mini', anthropicModel: 'claude-sonnet-4-20250514' };
  it('prod OHNE explizite Wahl -> Fehler (keine Implizite)', () => {
    const r = resolveProvider({ ...base, isProd: true });
    expect(r.provider).toBeNull();
    expect(r.error).toMatch(/explizit/);
  });
  it('prod MIT anthropic -> anthropic + Modell', () => {
    const r = resolveProvider({ ...base, isProd: true, forced: 'anthropic' });
    expect(r.provider).toBe('anthropic');
    expect(r.model).toBe('claude-sonnet-4-20250514');
    expect(r.error).toBeNull();
  });
  it('prod MIT openai -> openai + explizites Modell', () => {
    const r = resolveProvider({ ...base, isProd: true, forced: 'openai' });
    expect(r.provider).toBe('openai');
    expect(r.model).toBe('gpt-4o-mini');
  });
  it('explizit gewählter Provider ohne Key -> Fehler (kein Wechsel auf anderen)', () => {
    const r = resolveProvider({ ...base, isProd: true, forced: 'anthropic', hasAnthropicKey: false });
    expect(r.provider).toBe('anthropic');
    expect(r.error).toMatch(/Kein API-Key/);
  });
  it('dev ohne forced -> inferiert nach Key-Präsenz', () => {
    expect(resolveProvider({ ...base, isProd: false, hasOpenaiKey: true }).provider).toBe('openai');
    expect(resolveProvider({ ...base, isProd: false, hasOpenaiKey: false }).provider).toBe('anthropic');
  });
});

describe('assertValidResult', () => {
  const full: AiAnalysisResult = {
    summary: 's',
    observations: [{ text: 'o', confidence: 'low' }],
    interpretations: [{ text: 'i', confidence: 'low' }],
    hypotheses: [{ text: 'h', confidence: 'low' }],
    recommendations: [{ title: 't', action: 'a', suggestedTest: 'test', confidence: 'medium' }],
    overallConfidence: 'low',
  };
  it('akzeptiert vollständige Antwort', () => { expect(() => assertValidResult(full)).not.toThrow(); });
  it('wirft bei fehlender Observation', () => { expect(() => assertValidResult({ ...full, observations: [] })).toThrow(/Observation/); });
  it('wirft bei fehlender Recommendation', () => { expect(() => assertValidResult({ ...full, recommendations: [] })).toThrow(/Recommendation/); });
  it('wirft bei Empfehlung ohne Suggested Test', () => {
    expect(() => assertValidResult({ ...full, recommendations: [{ title: 't', action: 'a', suggestedTest: '', confidence: 'low' }] })).toThrow(/Suggested Test/);
  });
});

import { resolveMetaAiConfig, clampRecommendationConfidence, CREATIVE_ANALYSIS_SCHEMA, AI_PROMPT_VERSION } from '../ai-analysis';

describe('resolveMetaAiConfig — explizit, kein stiller Fallback (Increment A)', () => {
  const ok = { provider: 'openai', model: 'gpt-5.6-sol', reasoningEffort: 'high', hasOpenaiKey: true };
  it('gültige Config', () => {
    const r = resolveMetaAiConfig(ok);
    expect(r.provider).toBe('openai'); expect(r.model).toBe('gpt-5.6-sol');
    expect(r.reasoningEffort).toBe('high'); expect(r.error).toBeNull();
  });
  it('Modell-ID wird verbatim verwendet (kein Remap)', () => {
    expect(resolveMetaAiConfig({ ...ok, model: 'gpt-5.6-sol' }).model).toBe('gpt-5.6-sol');
  });
  it('fehlendes Modell -> Fehler, KEIN Fallback', () => {
    const r = resolveMetaAiConfig({ ...ok, model: '' });
    expect(r.model).toBeNull(); expect(r.error).toMatch(/META_ADS_AI_MODEL/);
  });
  it('nicht-openai Provider -> Fehler', () => {
    expect(resolveMetaAiConfig({ ...ok, provider: 'anthropic' }).error).toMatch(/openai/);
    expect(resolveMetaAiConfig({ ...ok, provider: '' }).error).toMatch(/explizit/);
  });
  it('fehlender Key -> Fehler', () => {
    expect(resolveMetaAiConfig({ ...ok, hasOpenaiKey: false }).error).toMatch(/OPENAI_API_KEY/);
  });
  it('reasoningEffort default high + clamp ungültig', () => {
    expect(resolveMetaAiConfig({ ...ok, reasoningEffort: undefined as any }).reasoningEffort).toBe('high');
    expect(resolveMetaAiConfig({ ...ok, reasoningEffort: 'ultra' }).reasoningEffort).toBe('high');
    expect(resolveMetaAiConfig({ ...ok, reasoningEffort: 'low' }).reasoningEffort).toBe('low');
  });
});

describe('clampRecommendationConfidence (#40)', () => {
  it('AI darf dataConfidence nie übersteigen', () => {
    expect(clampRecommendationConfidence('high', 'low')).toBe('low');
    expect(clampRecommendationConfidence('high', 'medium')).toBe('medium');
    expect(clampRecommendationConfidence('medium', 'high')).toBe('medium');
    expect(clampRecommendationConfidence('high', 'high')).toBe('high');
    expect(clampRecommendationConfidence('low', 'high')).toBe('low');
  });
});

describe('CREATIVE_ANALYSIS_SCHEMA (strict Structured Outputs)', () => {
  it('ist strict mit additionalProperties:false und allen Pflichtfeldern', () => {
    expect(CREATIVE_ANALYSIS_SCHEMA.strict).toBe(true);
    const s: any = CREATIVE_ANALYSIS_SCHEMA.schema;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['summary', 'observations', 'interpretations', 'hypotheses', 'recommendations', 'overallConfidence']);
    expect(s.properties.recommendations.items.required).toContain('suggestedTest');
    expect(AI_PROMPT_VERSION).toBe('v1');
  });
});

describe('Increment B — Product-Level Fact Model im Prompt', () => {
  const ctxB: AiAnalysisContext = {
    scopeType: 'product_group', productGroupName: 'Produkt A', adName: null, periodLabel: 'Letzte 30 Tage',
    confidenceLevel: 'high', confidenceReasons: ['12 Ads'],
    facts: [{ label: 'Produkt-Baseline Hook Rate', value: '23.8%' }], baselines: [], signals: [], components: [],
    hookTargets: { strongPct: 30, iterationPct: 20 },
    ads: [
      { name: 'AD-04', hookRatePct: 34.8, hookClass: 'strong', hookDeltaPp: 11, holdRatePct: 12, retention50to75: 55, outboundCtr: 1.8, spend: 480, uniqueSales: 24, calculatedRoas: 3.2, biggestDrop: '50→75% (-20%), Sek 10-16', confidence: 'high' },
      { name: 'AD-07', hookRatePct: 21.4, hookClass: 'iteration', hookDeltaPp: -2.4, holdRatePct: 10, retention50to75: 62, outboundCtr: 1.5, spend: 300, uniqueSales: 11, calculatedRoas: 2.1, biggestDrop: null, confidence: 'medium' },
    ],
    dataVolumeLow: false,
  };
  const user = buildAnalysisUserPrompt(ctxB);
  it('rendert interne Hook-Regeln', () => {
    expect(user).toMatch(/Strong Hook >= 30 %/);
    expect(user).toMatch(/Iteration Zone 20–30 %/);
  });
  it('rendert Ads einzeln mit Klasse + Delta vs Produkt-Baseline', () => {
    expect(user).toContain('ADS IM PRODUKT');
    expect(user).toContain('AD-04: Hook 34.8% [strong] (+11pp vs Produkt-Baseline)');
    expect(user).toContain('AD-07: Hook 21.4% [iteration] (-2.4pp vs Produkt-Baseline)');
    expect(user).toContain('größter Drop 50→75% (-20%), Sek 10-16');
  });
});
