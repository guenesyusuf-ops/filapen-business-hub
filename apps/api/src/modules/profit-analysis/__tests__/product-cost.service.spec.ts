import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProductCostService } from '../product-cost.service';

const ORG = 'org-uuid';
const PRODUCT = 'prod-uuid';
const USER = 'user-uuid';

function makePrismaMock() {
  const state: any = {
    product: {
      findFirst: vi.fn().mockResolvedValue({ id: PRODUCT }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    paProductCost: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paAmazonFulfillmentCost: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paProductChannel: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    paProductSettings: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => fn(state)),
  };
  return state;
}

describe('ProductCostService.getCostAt', () => {
  let prisma: any;
  let svc: ProductCostService;
  beforeEach(() => {
    prisma = makePrismaMock();
    svc = new ProductCostService(prisma);
  });

  it('gibt Produktkosten zurueck wenn Periode existiert', async () => {
    prisma.paProductCost.findFirst.mockResolvedValueOnce({ cost: new Prisma.Decimal('4.50') });
    const v = await svc.getCostAt(ORG, PRODUCT, 'cost', new Date('2026-08-20'));
    expect(v).toBe('4.5');
  });

  it('gibt NULL zurueck wenn keine Kosten hinterlegt sind (kein Lazy-Default)', async () => {
    prisma.paProductCost.findFirst.mockResolvedValueOnce(null);
    const v = await svc.getCostAt(ORG, PRODUCT, 'cost', new Date('2026-08-20'));
    expect(v).toBeNull();
    // kein create() aufgerufen — bewusst, weil "unbekannt" != "kostenlos"
    expect(prisma.paProductCost.create).not.toHaveBeenCalled();
  });

  it('nutzt Amazon-Tabelle bei kind=fulfillment', async () => {
    prisma.paAmazonFulfillmentCost.findFirst.mockResolvedValueOnce({ cost: new Prisma.Decimal('4.80') });
    const v = await svc.getCostAt(ORG, PRODUCT, 'fulfillment', new Date('2026-08-20'));
    expect(v).toBe('4.8');
    expect(prisma.paProductCost.findFirst).not.toHaveBeenCalled();
  });
});

describe('ProductCostService.setCost', () => {
  let prisma: any;
  let svc: ProductCostService;
  beforeEach(() => {
    prisma = makePrismaMock();
    svc = new ProductCostService(prisma);
  });

  it('legt neue Periode an und schliesst die alte', async () => {
    prisma.paProductCost.findUnique.mockResolvedValueOnce(null);
    prisma.paProductCost.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.paProductCost.create.mockResolvedValueOnce({
      id: 'pc-1',
      cost: new Prisma.Decimal('4.50'),
      effectiveFrom: new Date('2026-10-01'),
      effectiveTo: null,
      note: null,
      createdById: USER,
      createdAt: new Date(),
    });

    await svc.setCost(ORG, PRODUCT, 'cost', '4.50', new Date('2026-10-01'), USER);

    const updateArgs = prisma.paProductCost.updateMany.mock.calls[0][0];
    expect(updateArgs.where.effectiveFrom.lt.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(updateArgs.data.effectiveTo.toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('lehnt negative Kosten ab', async () => {
    await expect(
      svc.setCost(ORG, PRODUCT, 'cost', '-1.00', new Date('2026-01-01'), USER),
    ).rejects.toThrow(/negativ/);
  });

  it('idempotent: gleiche Kosten am gleichen Tag = kein Update', async () => {
    prisma.paProductCost.findUnique.mockResolvedValueOnce({
      id: 'pc-1',
      cost: new Prisma.Decimal('4.00'),
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      note: null,
      createdById: null,
      createdAt: new Date(),
    });
    await svc.setCost(ORG, PRODUCT, 'cost', '4.00', new Date('2026-01-01'), USER);
    expect(prisma.paProductCost.updateMany).not.toHaveBeenCalled();
    expect(prisma.paProductCost.create).not.toHaveBeenCalled();
    expect(prisma.paProductCost.update).not.toHaveBeenCalled();
  });

  it('lehnt Produkt aus anderer Org ab', async () => {
    prisma.product.findFirst.mockResolvedValueOnce(null);
    await expect(
      svc.setCost(ORG, 'wrong-product', 'cost', '4.00', new Date('2026-01-01'), USER),
    ).rejects.toThrow(/nicht gefunden/);
  });
});

describe('ProductCostService.listProducts', () => {
  let prisma: any;
  let svc: ProductCostService;
  beforeEach(() => {
    prisma = makePrismaMock();
    svc = new ProductCostService(prisma);
  });

  it('haengt aktuelle Kosten und Fulfillment an jedes Produkt', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      { id: 'p1', externalId: 'ext-1', title: '3D-Stift', sku: 'STIFT', imageUrl: null, status: 'active' },
      { id: 'p2', externalId: 'ext-2', title: 'PCL Filament', sku: 'FILA', imageUrl: null, status: 'active' },
    ]);
    prisma.product.count.mockResolvedValueOnce(2);
    prisma.paProductCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('8.00'), effectiveFrom: new Date('2026-01-01') },
      // p2 hat keine Kosten
    ]);
    prisma.paAmazonFulfillmentCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('4.80'), effectiveFrom: new Date('2026-01-01') },
      { productId: 'p2', cost: new Prisma.Decimal('3.40'), effectiveFrom: new Date('2026-01-01') },
    ]);

    const res = await svc.listProducts(ORG);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].currentCost).toBe('8');
    expect(res.items[0].currentFulfillment).toBe('4.8');
    expect(res.items[1].currentCost).toBeNull();
    expect(res.items[1].currentFulfillment).toBe('3.4');
    expect(res.missingCostsCount).toBe(1);
    expect(res.missingFulfillmentCount).toBe(0);
  });

  it('filter missingCosts liefert nur Produkte ohne Kosten', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      { id: 'p1', externalId: 'e1', title: 'A', sku: null, imageUrl: null, status: 'active' },
      { id: 'p2', externalId: 'e2', title: 'B', sku: null, imageUrl: null, status: 'active' },
    ]);
    prisma.product.count.mockResolvedValueOnce(2);
    prisma.paProductCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('5.00'), effectiveFrom: new Date('2026-01-01') },
    ]);
    prisma.paAmazonFulfillmentCost.findMany.mockResolvedValueOnce([]);

    const res = await svc.listProducts(ORG, { missingCosts: true });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].productId).toBe('p2');
  });
});
