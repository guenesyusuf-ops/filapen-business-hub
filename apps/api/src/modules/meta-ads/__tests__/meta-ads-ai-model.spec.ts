import { describe, expect, it } from 'vitest';
import { remapOpenAiModel } from '../meta-ads-ai.service';

describe('remapOpenAiModel — verhindert OpenAI-400 durch Anzeige-/Aliasnamen', () => {
  it('mappt bekannte Anzeigenamen auf echte Modell-IDs', () => {
    expect(remapOpenAiModel('GPT-5.4 mini')).toBe('gpt-4o-mini');
    expect(remapOpenAiModel('gpt-5.4 mini')).toBe('gpt-4o-mini');
    expect(remapOpenAiModel('gpt-5.4-mini')).toBe('gpt-4o-mini');
  });
  it('lässt echte Modell-IDs unverändert', () => {
    expect(remapOpenAiModel('gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(remapOpenAiModel('gpt-4o')).toBe('gpt-4o');
    expect(remapOpenAiModel('gpt-4.1-mini')).toBe('gpt-4.1-mini');
  });
  it('fällt bei leerem Wert auf Default zurück', () => {
    expect(remapOpenAiModel('')).toBe('gpt-4o-mini');
    expect(remapOpenAiModel(null)).toBe('gpt-4o-mini');
    expect(remapOpenAiModel(undefined)).toBe('gpt-4o-mini');
  });
});
