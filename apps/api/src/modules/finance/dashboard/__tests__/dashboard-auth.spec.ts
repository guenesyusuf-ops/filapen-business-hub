import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { DashboardController } from '../dashboard.controller';

/**
 * RED/GREEN-Regressionstest für die Finance-Dashboard-Auth (Deploy B).
 *
 * RED (vor dem Fix): die Routen nahmen keinen Auth-Header und riefen den
 * Service anonym auf — jeder ohne Token konnte Finance-Daten lesen und
 * Produkte/Kosten schreiben.
 * GREEN (nach dem Fix): ohne gueltigen Token 401, und der Service wird
 * NICHT aufgerufen; mit gueltigem Token laeuft die Route normal durch.
 *
 * Schutzniveau AUTHENTICATED — identisch zu finance/profitability und den
 * bereits geschuetzten WM-/Whiteboard-Routen. Kein Umbau von DEV_ORG_ID,
 * keine neue Rollen-/Org-Logik. Getestet werden repraesentative Routen:
 * ein GET-Read, ein PATCH-Write, ein POST-Cost-Write.
 */

const GUELTIG = 'gueltiger.token';

function baue() {
  const dashboardService = { getOverview: vi.fn().mockResolvedValue({ ok: true }) };
  const profitEngine = {};
  const costService = {
    createFixedCost: vi.fn().mockResolvedValue({
      id: 'fc1', name: 'x', amount: 1, currency: 'EUR', recurrence: 'monthly',
      category: 'ops', startDate: new Date(), endDate: null,
      createdAt: new Date(), updatedAt: new Date(),
    }),
  };
  const productService = { updateProductInternal: vi.fn().mockResolvedValue({ ok: true }) };
  const attributionService = {};
  const cohortService = {};
  const benchmarkService = {};
  const prisma = {};
  const auth = {
    validateToken: vi.fn((t: string) => {
      if (t !== GUELTIG) throw new Error('invalid');
      return { sub: 'user-1', orgId: 'org-1', role: 'member' };
    }),
  };
  const c = new DashboardController(
    dashboardService as any, profitEngine as any, costService as any,
    productService as any, attributionService as any, cohortService as any,
    benchmarkService as any, prisma as any, auth as any,
  );
  return { c, dashboardService, costService, productService };
}

const status = async (fn: () => Promise<unknown>): Promise<number | 'ok'> => {
  try { await fn(); return 'ok'; }
  catch (e) { return e instanceof HttpException ? e.getStatus() : -1; }
};

describe('Finance Dashboard — Auth (RED/GREEN)', () => {
  it('GET dashboard ohne Token -> 401, Service NICHT aufgerufen', async () => {
    const { c, dashboardService } = baue();
    expect(await status(() => c.getDashboard(undefined, undefined, undefined, undefined))).toBe(401);
    expect(dashboardService.getOverview).not.toHaveBeenCalled();
  });

  it('GET dashboard mit gültigem Token -> Service wird aufgerufen', async () => {
    const { c, dashboardService } = baue();
    await c.getDashboard(undefined, undefined, undefined, `Bearer ${GUELTIG}`);
    expect(dashboardService.getOverview).toHaveBeenCalled();
  });

  it('GET dashboard mit ungültigem Token -> 401', async () => {
    const { c, dashboardService } = baue();
    expect(await status(() => c.getDashboard(undefined, undefined, undefined, 'Bearer falsch'))).toBe(401);
    expect(dashboardService.getOverview).not.toHaveBeenCalled();
  });

  it('PATCH products/:id ohne Token -> 401, Service NICHT aufgerufen', async () => {
    const { c, productService } = baue();
    expect(await status(() => c.updateProductInternal('p1', {} as any, undefined))).toBe(401);
    expect(productService.updateProductInternal).not.toHaveBeenCalled();
  });

  it('POST costs/fixed ohne Token -> 401, Service NICHT aufgerufen', async () => {
    const { c, costService } = baue();
    expect(await status(() => c.createFixedCost({} as any, undefined))).toBe(401);
    expect(costService.createFixedCost).not.toHaveBeenCalled();
  });

  it('POST costs/fixed mit gültigem Token -> Service wird aufgerufen', async () => {
    const { c, costService } = baue();
    await c.createFixedCost({ name: 'x', amount: 100, frequency: 'monthly', startDate: '2026-01-01' } as any, `Bearer ${GUELTIG}`);
    expect(costService.createFixedCost).toHaveBeenCalled();
  });
});
