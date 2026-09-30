import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from '../dashboard.service';

/**
 * Regressionstest für die zwei Finance-Dashboard-Bugs dieser Session.
 *
 * Er ruft die ECHTE Methode getOrderMetrics auf und fängt die tatsächlich
 * an Postgres übergebene Query samt gebundener Parameter ab. Kein
 * "wurde aufgerufen"-Mock — geprüft werden die zwei Invarianten, die beide
 * Bugs verletzt haben:
 *
 *   Bug 386e1a0: Query referenzierte $4, es wurden aber nur 3 Parameter
 *                gebunden  ->  Platzhalterzahl != Parameterzahl.
 *   Bug 9b25695: `channel = $4` gegen eine ENUM-Spalte (enum = text)
 *                ->  Postgres-Typfehler. Korrekt ist `channel::text = $4`.
 *
 * Eine echte Test-DB existiert im Projekt nicht (alle vorhandenen Tests
 * mocken Prisma). Dieser Test bleibt bei dieser Konvention, prüft aber die
 * reale Query-Konstruktion statt nur den Aufruf. Ein zusätzlicher
 * DB-Integrationstest ist als Review-Punkt empfohlen.
 */

function baue() {
  const captured: { sql?: string; params: unknown[] } = { params: [] };
  const prisma = {
    $queryRawUnsafe: vi.fn((sql: string, ...params: unknown[]) => {
      captured.sql = sql;
      captured.params = params;
      // Realistische Nullzeile, damit die Nachverarbeitung durchläuft
      return Promise.resolve([
        {
          order_count: BigInt(0),
          avg_order_value: 0,
          refund_count: BigInt(0),
          new_customer_count: BigInt(0),
          returning_customer_count: BigInt(0),
          total_ad_spend: 0,
          net_revenue: 0,
        },
      ]);
    }),
  };
  const svc = new DashboardService(prisma as any, {} as any, {} as any);
  return { svc, prisma, captured };
}

const maxPlaceholder = (sql: string): number => {
  const nums = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
};

describe('DashboardService.getOrderMetrics — Query-Invarianten', () => {
  it('bindet genau so viele Parameter, wie Platzhalter vorhanden sind (fängt 386e1a0)', async () => {
    const { svc, captured } = baue();
    await (svc as any).getOrderMetrics(
      '00000000-0000-0000-0000-000000000001',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
      'all',
    );
    expect(captured.sql).toBeDefined();
    expect(maxPlaceholder(captured.sql!)).toBe(captured.params.length);
  });

  it('vergleicht die ENUM-Spalte channel über ::text, nicht direkt (fängt 9b25695)', async () => {
    const { svc, captured } = baue();
    await (svc as any).getOrderMetrics(
      '00000000-0000-0000-0000-000000000001',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
      'all',
    );
    // Muss den Cast enthalten …
    expect(captured.sql).toMatch(/channel::text\s*=\s*\$\d+/);
    // … und darf NICHT die fehleranfällige Form enum = $n ohne Cast enthalten
    expect(captured.sql).not.toMatch(/[^:]channel\s*=\s*\$\d+/);
  });

  it('bindet den channel-Wert als letzten Parameter (kein Interpolieren)', async () => {
    const { svc, captured } = baue();
    await (svc as any).getOrderMetrics(
      '00000000-0000-0000-0000-000000000001',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
      'amazon',
    );
    expect(captured.params).toContain('amazon');
    // channel darf nicht roh in die SQL interpoliert sein
    expect(captured.sql).not.toContain("'amazon'");
  });

  it('Default ohne channel: bindet "all" statt zu interpolieren', async () => {
    const { svc, captured } = baue();
    await (svc as any).getOrderMetrics(
      '00000000-0000-0000-0000-000000000001',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
      undefined,
    );
    expect(captured.params).toContain('all');
    expect(captured.sql).not.toContain("'all'");
  });
});
