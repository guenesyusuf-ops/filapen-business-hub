import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { WorkManagementController } from '../work-management.controller';

/**
 * RED/GREEN-Regressionstest für die offenen Schreib-Routen des WM-Moduls.
 *
 * RED (vor dem Fix): die Routen nahmen keinen Auth-Header und riefen den
 * schreibenden Service ohne Pruefung auf — anonymes Loeschen/Aendern.
 * GREEN (nach dem Fix): ohne gueltigen Token 401, und der schreibende
 * Service wird NICHT aufgerufen.
 *
 * Schutzniveau AUTHENTICATED — bewusst identisch zu den bereits geschuetzten
 * Nachbar-Routen desselben Controllers (POST projects, POST tasks), die
 * ebenfalls nur Authentifizierung pruefen. Keine neue Rollenlogik.
 */

const GUELTIG = 'gueltiger.token';

function baue() {
  const wmService: Record<string, ReturnType<typeof vi.fn>> = {
    deleteProject: vi.fn().mockResolvedValue({ ok: true }),
    updateTask: vi.fn().mockResolvedValue({ ok: true }),
    createSubtask: vi.fn().mockResolvedValue({ ok: true }),
    removeMember: vi.fn().mockResolvedValue({ ok: true }),
  };
  const wmApproval = {};
  const auth = {
    validateToken: vi.fn((t: string) => {
      if (t !== GUELTIG) throw new Error('invalid');
      return { sub: 'user-1', orgId: 'org-1', role: 'member' };
    }),
  };
  const c = new WorkManagementController(wmService as any, wmApproval as any, auth as any);
  return { c, wmService };
}

const status = async (fn: () => Promise<unknown>): Promise<number | 'ok'> => {
  try { await fn(); return 'ok'; }
  catch (e) { return e instanceof HttpException ? e.getStatus() : -1; }
};

describe('WM Schreib-Routen — Auth (RED/GREEN)', () => {
  it('DELETE projects/:id ohne Token -> 401, deleteProject NICHT aufgerufen', async () => {
    const { c, wmService } = baue();
    expect(await status(() => c.deleteProject('p1', undefined))).toBe(401);
    expect(wmService.deleteProject).not.toHaveBeenCalled();
  });

  it('DELETE projects/:id mit gültigem Token -> Service wird aufgerufen', async () => {
    const { c, wmService } = baue();
    await c.deleteProject('p1', `Bearer ${GUELTIG}`);
    expect(wmService.deleteProject).toHaveBeenCalledWith('p1');
  });

  it('PUT tasks/:id ohne Token -> 401, updateTask NICHT aufgerufen', async () => {
    const { c, wmService } = baue();
    expect(await status(() => c.updateTask('t1', {} as any, undefined))).toBe(401);
    expect(wmService.updateTask).not.toHaveBeenCalled();
  });

  it('POST tasks/:id/subtasks ohne Token -> 401, createSubtask NICHT aufgerufen', async () => {
    const { c, wmService } = baue();
    expect(await status(() => c.createSubtask('t1', {} as any, undefined))).toBe(401);
    expect(wmService.createSubtask).not.toHaveBeenCalled();
  });

  it('DELETE members/:id ohne Token -> 401, removeMember NICHT aufgerufen', async () => {
    const { c, wmService } = baue();
    expect(await status(() => c.removeMember('m1', undefined))).toBe(401);
    expect(wmService.removeMember).not.toHaveBeenCalled();
  });
});
