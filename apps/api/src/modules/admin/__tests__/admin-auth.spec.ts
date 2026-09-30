import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import { extractAdminAuth, assertIsAdmin } from '../admin-auth';
import type { AuthService } from '../../auth/auth.service';

/**
 * Regressionstest fuer den P0-Auth-Fix des Admin-Controllers.
 *
 * Deckt die im Audit nachgewiesene Luecke ab: /api/admin/* war ohne Token
 * erreichbar. Diese Tests sichern, dass die Absicherung nicht wieder
 * verlorengeht — sie pruefen genau die Schichten, in denen der Fehler sass:
 * Header-Parsing (kein stiller Fallback) und Rollenpruefung.
 *
 * validateToken wird mit einem Stub nachgebildet, der sich wie das echte
 * JWT-Verfahren verhaelt: gueltiger Token -> Payload, alles andere -> Fehler.
 */

const GUELTIG = 'gueltiger.admin.token';

function stubAuth(rolle: string): AuthService {
  return {
    validateToken: (token: string) => {
      if (token !== GUELTIG) throw new Error('invalid signature');
      return { sub: 'user-1', orgId: 'org-1', role: rolle };
    },
  } as unknown as AuthService;
}

const codeVon = (fn: () => unknown): number => {
  try {
    fn();
    return 0;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
};

describe('extractAdminAuth — Authentifizierung', () => {
  it('Test A: kein Authorization-Header -> 401', () => {
    expect(codeVon(() => extractAdminAuth(undefined, stubAuth('admin')))).toBe(401);
  });

  it('Test A: leerer Header -> 401', () => {
    expect(codeVon(() => extractAdminAuth('', stubAuth('admin')))).toBe(401);
  });

  it('Test B: Header ohne Bearer-Schema -> 401', () => {
    expect(codeVon(() => extractAdminAuth('Token abc', stubAuth('admin')))).toBe(401);
  });

  it('Test D: manipulierter / ungueltig signierter Token -> 401', () => {
    expect(codeVon(() => extractAdminAuth('Bearer kaputt', stubAuth('admin')))).toBe(401);
  });

  it('kein stiller Fallback: ungueltiger Token liefert NIEMALS einen Kontext', () => {
    let kontext: unknown = 'nicht gesetzt';
    try {
      kontext = extractAdminAuth('Bearer kaputt', stubAuth('admin'));
    } catch {
      kontext = null;
    }
    expect(kontext).toBeNull();
  });

  it('gueltiger Token liefert den Auth-Kontext', () => {
    const ctx = extractAdminAuth(`Bearer ${GUELTIG}`, stubAuth('admin'));
    expect(ctx).toEqual({ userId: 'user-1', orgId: 'org-1', role: 'admin' });
  });
});

describe('assertIsAdmin — Autorisierung', () => {
  it('Test E: normaler Benutzer (member) -> 403', () => {
    expect(codeVon(() => assertIsAdmin('member'))).toBe(403);
  });

  it('Test F: viewer ohne Berechtigung -> 403', () => {
    expect(codeVon(() => assertIsAdmin('viewer'))).toBe(403);
  });

  it('Test G: admin ist erlaubt', () => {
    expect(codeVon(() => assertIsAdmin('admin'))).toBe(0);
  });

  it('Test G: owner ist erlaubt', () => {
    expect(codeVon(() => assertIsAdmin('owner'))).toBe(0);
  });

  it('unbekannte Rolle -> 403 (kein Durchrutschen)', () => {
    expect(codeVon(() => assertIsAdmin('superhacker'))).toBe(403);
  });
});
