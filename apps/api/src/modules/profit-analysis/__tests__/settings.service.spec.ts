import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { SettingsService } from '../settings.service';
import { SETTING_KEYS } from '../settings.constants';

/**
 * Unit-Tests fuer die Historisierungs-Kernlogik.
 * Der PrismaService wird gemockt — wir pruefen dass die richtigen Queries
 * gebaut werden (welche where-Klauseln, welche Werte, welche Transaktion).
 * Integration-Tests gegen echte DB folgen in spaeterer Phase.
 */

function makePrismaMock(overrides: Partial<any> = {}) {
  const state = {
    paSettingHistory: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => fn(state)),
    ...overrides,
  };
  return state;
}

const ORG = 'org-uuid';
const USER = 'user-uuid';

describe('SettingsService.getValueAt', () => {
  let prisma: any;
  let svc: SettingsService;
  beforeEach(() => {
    prisma = makePrismaMock();
    svc = new SettingsService(prisma as any);
  });

  it('gibt den aktuellen Wert zurueck wenn eine Periode existiert', async () => {
    prisma.paSettingHistory.findFirst.mockResolvedValueOnce({
      value: new Prisma.Decimal('15.0'),
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    });
    const v = await svc.getValueAt(ORG, SETTING_KEYS.FEE_AMAZON, new Date('2026-08-20'));
    expect(v).toBe('15');
    expect(prisma.paSettingHistory.findFirst).toHaveBeenCalledOnce();
    const args = prisma.paSettingHistory.findFirst.mock.calls[0][0];
    expect(args.where.orgId).toBe(ORG);
    expect(args.where.key).toBe(SETTING_KEYS.FEE_AMAZON);
    expect(args.orderBy).toEqual({ effectiveFrom: 'desc' });
  });

  it('legt bei fehlender Historie den Default-Wert lazy an', async () => {
    prisma.paSettingHistory.findFirst.mockResolvedValueOnce(null);
    prisma.paSettingHistory.create.mockResolvedValueOnce({});
    const v = await svc.getValueAt(ORG, SETTING_KEYS.FEE_AMAZON, new Date('2026-08-20'));
    expect(v).toBe('15.0');
    expect(prisma.paSettingHistory.create).toHaveBeenCalledOnce();
    const data = prisma.paSettingHistory.create.mock.calls[0][0].data;
    expect(data.orgId).toBe(ORG);
    expect(data.key).toBe(SETTING_KEYS.FEE_AMAZON);
    expect(data.effectiveFrom.toISOString().slice(0, 10)).toBe('2000-01-01');
  });

  it('respektiert Perioden-Grenze: sucht Wert der am gefragten Datum galt', async () => {
    // Signalisiere dass der Query "effective_from <= date AND (effective_to IS NULL OR >= date)" ist
    prisma.paSettingHistory.findFirst.mockResolvedValueOnce({
      value: new Prisma.Decimal('3.0'),
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-08-31'),
    });
    const v = await svc.getValueAt(ORG, SETTING_KEYS.PAYMENT_FEE_SHOPIFY, new Date('2026-08-15'));
    expect(v).toBe('3');
    const args = prisma.paSettingHistory.findFirst.mock.calls[0][0];
    expect(args.where.effectiveFrom.lte).toBeInstanceOf(Date);
    expect(args.where.effectiveFrom.lte.toISOString().slice(0, 10)).toBe('2026-08-15');
    expect(args.where.OR).toEqual([
      { effectiveTo: null },
      { effectiveTo: { gte: expect.any(Date) } },
    ]);
  });
});

describe('SettingsService.setValue', () => {
  let prisma: any;
  let svc: SettingsService;
  beforeEach(() => {
    prisma = makePrismaMock();
    svc = new SettingsService(prisma as any);
  });

  it('legt eine neue Periode an und schliesst die alte (updateMany mit effective_to = yesterday)', async () => {
    prisma.paSettingHistory.findUnique.mockResolvedValueOnce(null);
    prisma.paSettingHistory.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.paSettingHistory.create.mockResolvedValueOnce({
      key: SETTING_KEYS.FEE_AMAZON,
      value: new Prisma.Decimal('14.5'),
      effectiveFrom: new Date('2026-09-01'),
      effectiveTo: null,
      note: 'Neue Konditionen',
      createdById: USER,
      createdAt: new Date('2026-08-20T10:00:00Z'),
    });

    await svc.setValue(
      ORG,
      SETTING_KEYS.FEE_AMAZON,
      '14.5',
      new Date('2026-09-01'),
      USER,
      'Neue Konditionen',
    );

    // Vorgaenger-Periode wurde geschlossen
    expect(prisma.paSettingHistory.updateMany).toHaveBeenCalledOnce();
    const updateArgs = prisma.paSettingHistory.updateMany.mock.calls[0][0];
    expect(updateArgs.where.effectiveFrom.lt.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(updateArgs.where.effectiveTo).toBe(null);
    expect(updateArgs.data.effectiveTo.toISOString().slice(0, 10)).toBe('2026-08-31');

    // Neue Zeile wurde angelegt
    expect(prisma.paSettingHistory.create).toHaveBeenCalledOnce();
  });

  it('idempotent: gleicher Wert am gleichen Tag = kein Update', async () => {
    prisma.paSettingHistory.findUnique.mockResolvedValueOnce({
      id: 'row-1',
      key: SETTING_KEYS.FEE_AMAZON,
      value: new Prisma.Decimal('15.0'),
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      note: null,
      createdById: null,
      createdAt: new Date('2026-01-01'),
    });
    await svc.setValue(ORG, SETTING_KEYS.FEE_AMAZON, '15.0', new Date('2026-01-01'), USER);
    expect(prisma.paSettingHistory.updateMany).not.toHaveBeenCalled();
    expect(prisma.paSettingHistory.create).not.toHaveBeenCalled();
    expect(prisma.paSettingHistory.update).not.toHaveBeenCalled();
  });

  it('akzeptiert Komma-Notation ("3,5")', async () => {
    prisma.paSettingHistory.findUnique.mockResolvedValueOnce(null);
    prisma.paSettingHistory.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.paSettingHistory.create.mockResolvedValueOnce({
      key: SETTING_KEYS.PAYMENT_FEE_SHOPIFY,
      value: new Prisma.Decimal('3.5'),
      effectiveFrom: new Date('2026-09-01'),
      effectiveTo: null,
      note: null,
      createdById: USER,
      createdAt: new Date(),
    });
    await svc.setValue(ORG, SETTING_KEYS.PAYMENT_FEE_SHOPIFY, '3,5', new Date('2026-09-01'), USER);
    const created = prisma.paSettingHistory.create.mock.calls[0][0].data;
    expect(created.value.toString()).toBe('3.5');
  });

  it('lehnt Nonsense-Werte ab', async () => {
    await expect(
      svc.setValue(ORG, SETTING_KEYS.FEE_AMAZON, 'nicht-eine-zahl', new Date('2026-09-01'), USER),
    ).rejects.toThrow();
  });

  it('lehnt unbekannten Key ab', async () => {
    await expect(
      svc.setValue(ORG, 'nonsense_key' as any, '10', new Date('2026-09-01'), USER),
    ).rejects.toThrow();
  });
});
