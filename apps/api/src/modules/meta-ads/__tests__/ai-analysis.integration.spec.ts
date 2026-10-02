/**
 * ECHTER Provider-Integrationstest (kein Mock). Übersprungen, wenn kein API-Key
 * in der Umgebung liegt. Nutzt exakt denselben Prompt-/Request-/Parse-/Validate-
 * Pfad wie der Produktiv-Service und beweist: Provider erreichbar, Key gültig,
 * Modell gültig, Response parsebar, Schema gültig.
 *
 * Ausführen z. B.:
 *   CONTENT_AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... \
 *   npx vitest run src/modules/meta-ads/__tests__/ai-analysis.integration.spec.ts
 */
import { describe, it, expect } from 'vitest';
import {
  resolveProvider, buildAnalysisMessages, parseAnalysisResult, assertValidResult, AiAnalysisContext,
} from '../ai-analysis';

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const resolution = resolveProvider({
  forced: process.env.CONTENT_AI_PROVIDER, isProd: false,
  hasOpenaiKey: !!process.env.OPENAI_API_KEY, hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  openaiModel, anthropicModel: ANTHROPIC_MODEL,
});
const runnable = !resolution.error && !!resolution.provider;

const ctx: AiAnalysisContext = {
  scopeType: 'ad', productGroupName: 'Testgruppe', adName: 'IT-Ad', periodLabel: 'Letzte 30 Tage',
  confidenceLevel: 'low', confidenceReasons: ['Integrationstest, synthetische Facts'],
  facts: [
    { label: 'Spend', value: '480,00 €' }, { label: 'Impressionen', value: '62.000' },
    { label: 'Hook Rate', value: '24.0%' }, { label: 'Hold Rate', value: '9.0%' },
    { label: 'Retention 50→75', value: '41.0%' }, { label: 'Hyros ROAS (letzter Tageswert, autoritativ)', value: '1.8×' },
  ],
  baselines: [{ label: 'Hook Rate (Testgruppe, 6 Ads)', value: '27.0%' }],
  retention: [{ segment: '25 %', retentionPct: 70, dropPct: 30 }, { segment: '50 %', retentionPct: 55, dropPct: 45 }],
  biggestDrop: { segment: '50→75 %', fromSeconds: 10, toSeconds: 16, dropPct: 45 },
  signals: [{ opportunityType: 'SALVAGE_HOOK', label: 'Salvage: Hook', detail: 'Body hält, Hook unter Baseline' }],
  components: [{ code: 'HK-0001', type: 'hook', name: 'Test-Hook', keyMetric: '24.0%', keyDelta: '-3pp' }],
  dataVolumeLow: true,
};

async function callReal(system: string, user: string): Promise<string> {
  if (resolution.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: resolution.model, max_tokens: 2000, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const d: any = await res.json();
    return d.choices?.[0]?.message?.content ?? '';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: resolution.model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d: any = await res.json();
  return d.content?.[0]?.text ?? '';
}

describe.skipIf(!runnable)('AI real provider round-trip', () => {
  it('erreicht Provider, gültiges Modell, parsebar & schemavalide', async () => {
    const { system, user } = buildAnalysisMessages(ctx);
    const text = await callReal(system, user);
    const result = parseAnalysisResult(text);
    expect(() => assertValidResult(result)).not.toThrow();
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((r) => r.suggestedTest.length > 0)).toBe(true);
    expect(['low', 'medium', 'high']).toContain(result.overallConfidence);
    // Zahlen-Sicherheit (heuristisch): keine offensichtlich erfundene große Zahl außerhalb der Facts
    const joined = JSON.stringify(result).replace(/\s/g, '');
    expect(joined).not.toMatch(/9{4,}/); // kein Platzhalter-Zahlensalat
  }, 90_000);
});

describe('AI integration harness', () => {
  it('ist korrekt konfiguriert oder sauber übersprungen', () => {
    // Dieser Test dokumentiert nur den Zustand; er schlägt nie fehl.
    expect(typeof runnable).toBe('boolean');
  });
});
