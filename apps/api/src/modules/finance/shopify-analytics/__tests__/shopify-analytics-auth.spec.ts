import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ShopifyAnalyticsController } from '../shopify-analytics.controller';

/**
 * RED/GREEN-Regressionstest für die Shopify-Analytics-Auth (Deploy B).
 *
 * RED: /finance/shopify-analytics/overview war anonym lesbar.
 * GREEN: ohne gueltigen Token 401, Service NICHT aufgerufen; mit Token
 * laeuft die Route normal. AUTHENTICATED, DEV_ORG_ID unveraendert.
 */

const GUELTIG = 'gueltiger.token';

function baue() {
  const service = { getOverview: vi.fn().mockResolvedValue({ ok: true }) };
  const auth = {
    validateToken: vi.fn((t: string) => {
      if (t !== GUELTIG) throw new Error('invalid');
      return { sub: 'user-1', orgId: 'org-1', role: 'member' };
    }),
  };
  const c = new ShopifyAnalyticsController(service as any, auth as any);
  return { c, service };
}

const status = async (fn: () => Promise<unknown>): Promise<number | 'ok'> => {
  try { await fn(); return 'ok'; }
  catch (e) { return e instanceof HttpException ? e.getStatus() : -1; }
};

describe('Shopify Analytics — Auth (RED/GREEN)', () => {
  it('GET overview ohne Token -> 401, Service NICHT aufgerufen', async () => {
    const { c, service } = baue();
    expect(await status(() => c.getOverview(undefined, undefined, undefined))).toBe(401);
    expect(service.getOverview).not.toHaveBeenCalled();
  });

  it('GET overview mit gültigem Token -> Service wird aufgerufen', async () => {
    const { c, service } = baue();
    await c.getOverview(undefined, undefined, `Bearer ${GUELTIG}`);
    expect(service.getOverview).toHaveBeenCalled();
  });

  it('GET overview mit ungültigem Token -> 401', async () => {
    const { c, service } = baue();
    expect(await status(() => c.getOverview(undefined, undefined, 'Bearer falsch'))).toBe(401);
    expect(service.getOverview).not.toHaveBeenCalled();
  });
});
