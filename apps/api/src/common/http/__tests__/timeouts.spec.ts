import { describe, it, expect } from 'vitest';
import {
  FAST_API_TIMEOUT_MS,
  STANDARD_EXTERNAL_TIMEOUT_MS,
  LONG_API_TIMEOUT_MS,
  AI_UI_TIMEOUT_MS,
  AI_UI_LONG_TIMEOUT_MS,
  AI_OCR_TIMEOUT_MS,
  AI_UI_MAX_RETRIES,
  isTimeoutError,
} from '../timeouts';

describe('http/timeouts — Konstanten', () => {
  it('sind aufsteigend und positiv (FAST < STANDARD < LONG)', () => {
    expect(FAST_API_TIMEOUT_MS).toBeGreaterThan(0);
    expect(FAST_API_TIMEOUT_MS).toBeLessThan(STANDARD_EXTERNAL_TIMEOUT_MS);
    expect(STANDARD_EXTERNAL_TIMEOUT_MS).toBeLessThan(LONG_API_TIMEOUT_MS);
  });

  it('AI-Timeouts sind großzügig, OCR am längsten', () => {
    expect(AI_UI_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(AI_UI_LONG_TIMEOUT_MS).toBeGreaterThanOrEqual(AI_UI_TIMEOUT_MS);
    expect(AI_OCR_TIMEOUT_MS).toBeGreaterThanOrEqual(AI_UI_LONG_TIMEOUT_MS);
  });

  it('AI_UI_MAX_RETRIES = 1 → Worst-Case bleibt beschränkt (nicht SDK-Default 2)', () => {
    expect(AI_UI_MAX_RETRIES).toBe(1);
  });
});

describe('isTimeoutError', () => {
  it('erkennt TimeoutError (AbortSignal.timeout)', () => {
    expect(isTimeoutError({ name: 'TimeoutError' })).toBe(true);
  });
  it('erkennt AbortError (ältere undici-Version)', () => {
    expect(isTimeoutError({ name: 'AbortError' })).toBe(true);
  });
  it('ignoriert normale Fehler', () => {
    expect(isTimeoutError(new Error('boom'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});
