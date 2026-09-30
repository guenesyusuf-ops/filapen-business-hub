import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EasybillService } from '../easybill.service';
import { STANDARD_EXTERNAL_TIMEOUT_MS } from '../../../common/http/timeouts';

/**
 * Verhaltenstest für den externen Timeout am easybill-`call`-Wrapper.
 *
 * Deckt die vom Increment geforderten Fälle ab:
 *  1. Anbieter antwortet normal      → bestehendes Verhalten, 1 fetch
 *  2. Anbieter hängt (Timeout)       → AbortSignal.timeout löst aus
 *  3. Timeout beendet den Pfad sauber → GATEWAY_TIMEOUT (504), kein roher 500
 *  5. kein automatischer Retry        → fetch genau 1×
 *  6. Write wird durch Retry NICHT verdoppelt (POST → 1 fetch)
 *  +  signal ist gesetzt (AbortSignal)
 */

function baueService() {
  const prisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ settings: { easybillApiKey: 'k' } }),
    },
  };
  const config = { get: vi.fn().mockReturnValue(undefined) };
  const documents = {};
  const svc = new EasybillService(prisma as any, config as any, documents as any);
  return svc;
}

// Zugriff auf den privaten Wrapper (bewusst, um die Netz-Schicht isoliert zu testen)
const call = (svc: EasybillService, path: string, init?: any) =>
  (svc as any).call('org-1', path, init);

describe('easybill call() — externer Timeout', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('normaler Response: löst auf und ruft fetch genau 1× mit signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 42 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = baueService();
    const res = await call(svc, '/documents', { method: 'POST', body: { x: 1 } });

    expect(res).toEqual({ id: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('Timeout: wirft GATEWAY_TIMEOUT (504), kein roher 500', async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const svc = baueService();
    let status: number | undefined;
    try {
      await call(svc, '/documents', { method: 'POST', body: { x: 1 } });
    } catch (e) {
      status = e instanceof HttpException ? e.getStatus() : -1;
    }
    expect(status).toBe(HttpStatus.GATEWAY_TIMEOUT);
    // Write darf durch kein automatisches Retry verdoppelt werden
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('nicht-Timeout-Fehler wird unverändert durchgereicht (kein 504-Schlucken)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('DNS kaputt'));
    vi.stubGlobal('fetch', fetchMock);

    const svc = baueService();
    await expect(call(svc, '/documents', { method: 'POST', body: {} })).rejects.toThrow('DNS kaputt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
