import { describe, expect, it } from 'vitest';
import {
  AI_SYSTEM_PROMPT, buildAnalysisUserPrompt, buildAnalysisMessages, extractJson, parseAnalysisResult, AiAnalysisContext,
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
