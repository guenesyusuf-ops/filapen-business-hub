import { describe, it, expect, vi } from 'vitest';
import { HttpException, ForbiddenException } from '@nestjs/common';
import { WhiteboardController } from '../whiteboard.controller';

/**
 * Regressionstest für das P0-Increment "offene Read-Routen + 401/500".
 *
 * Deckt die zwei nachgewiesenen Fehler ab:
 *  - GET /api/whiteboard/boards war ohne Token anonym lesbar.
 *  - Auth-Fehler wurden teils vom generischen catch in 500 verwandelt.
 *
 * Getestet wird der ECHTE Controller mit gemocktem Service/Auth — kein
 * neuer Mechanismus, nur Verifikation des bestehenden.
 */

const GUELTIG = 'gueltiger.token';

function baue(rolleValid = true) {
  const service = {
    list: vi.fn().mockResolvedValue([{ id: 'b1', title: 'Board' }]),
  };
  const auth = {
    validateToken: vi.fn((token: string) => {
      if (token !== GUELTIG) throw new Error('invalid');
      return { sub: 'user-1', orgId: 'org-1', role: 'admin' };
    }),
  };
  const prisma = {};
  const c = new WhiteboardController(service as any, auth as any, prisma as any);
  return { c, service, auth };
}

const statusOf = async (fn: () => Promise<unknown>): Promise<number | 'ok'> => {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
};

describe('WhiteboardController GET /boards — Auth', () => {
  it('Test 1: ohne Token -> 401 (nicht mehr anonym lesbar)', async () => {
    const { c, service } = baue();
    expect(await statusOf(() => c.list(undefined))).toBe(401);
    expect(service.list).not.toHaveBeenCalled(); // kein Datenzugriff vor Auth
  });

  it('Test 2: gültiger Token -> Daten, Service aufgerufen', async () => {
    const { c, service } = baue();
    const res = await c.list(`Bearer ${GUELTIG}`);
    expect(res).toEqual([{ id: 'b1', title: 'Board' }]);
    expect(service.list).toHaveBeenCalledOnce();
  });

  it('Test 3: ungültiger Token -> 401', async () => {
    const { c } = baue();
    expect(await statusOf(() => c.list('Bearer kaputt'))).toBe(401);
  });

  it('Test 5: HttpException aus dem Service behält Status (kein 500)', async () => {
    const { c, service } = baue();
    service.list.mockRejectedValueOnce(new ForbiddenException('kein Zugriff'));
    expect(await statusOf(() => c.list(`Bearer ${GUELTIG}`))).toBe(403);
  });

  it('Test 6: unerwarteter Fehler aus dem Service -> 500', async () => {
    const { c, service } = baue();
    service.list.mockRejectedValueOnce(new Error('DB weg'));
    expect(await statusOf(() => c.list(`Bearer ${GUELTIG}`))).toBe(500);
  });
});
