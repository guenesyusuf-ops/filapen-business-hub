import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ListFilters {
  search?: string;
  shopId?: string;
  fromDate?: string;
  toDate?: string;
  hasShipment?: 'yes' | 'no';
  excludedProductVariantIds?: string[];
  limit?: number;
  offset?: number;
}

@Injectable()
export class ShippingOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List orders that are shippable: open, unfulfilled, not cancelled.
   * Default: show only orders WITHOUT a shipment yet.
   */
  async list(orgId: string, filters: ListFilters = {}) {
    const where: any = {
      orgId,
      status: { not: 'cancelled' as const },
      fulfillmentStatus: { in: ['unfulfilled', 'partial'] as const },
    };
    if (filters.shopId) where.shopId = filters.shopId;
    if (filters.fromDate || filters.toDate) {
      where.placedAt = {};
      if (filters.fromDate) where.placedAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.placedAt.lte = new Date(filters.toDate);
    }
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { customerName: { contains: filters.search, mode: 'insensitive' as const } },
        { customerEmail: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }
    // Product variant exclusion (Produkt X raushalten)
    if (filters.excludedProductVariantIds?.length) {
      where.lineItems = {
        none: { productVariantId: { in: filters.excludedProductVariantIds } },
      };
    }
    // Has-shipment filter
    if (filters.hasShipment === 'yes') where.shipments = { some: {} };
    if (filters.hasShipment === 'no') where.shipments = { none: {} };

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          status: true,
          fulfillmentStatus: true,
          financialStatus: true,
          currency: true,
          totalPrice: true,
          totalShipping: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          shippingAddress: true,
          countryCode: true,
          tags: true,
          shop: { select: { id: true, name: true, domain: true } },
          lineItems: {
            select: {
              id: true,
              productVariantId: true,
              title: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
          },
          shipments: {
            select: { id: true, status: true, trackingNumber: true, carrier: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }

  async get(orgId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        shop: true,
        lineItems: true,
        shipments: {
          include: { labels: true, statusEvents: { orderBy: { occurredAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  /**
   * Compute shipping weight for an order based on ShippingProductProfile
   * fallbacks: profile.weightG * quantity; unknown items contribute 0 (warned).
   */
  async computeOrderWeight(orgId: string, orderId: string): Promise<{ totalG: number; unknownCount: number }> {
    const lineItems = await this.prisma.orderLineItem.findMany({
      where: { orderId, orgId },
      select: { productVariantId: true, sku: true, quantity: true },
    });
    if (lineItems.length === 0) return { totalG: 0, unknownCount: 0 };

    const productVariantIds = lineItems.map((li) => li.productVariantId).filter(Boolean) as string[];
    const skus = lineItems.map((li) => li.sku).filter(Boolean) as string[];

    const profiles = await this.prisma.shippingProductProfile.findMany({
      where: {
        orgId,
        OR: [
          productVariantIds.length ? { productVariantId: { in: productVariantIds } } : {},
          skus.length ? { sku: { in: skus } } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });

    const byVariant = new Map(profiles.filter((p) => p.productVariantId).map((p) => [p.productVariantId!, p]));
    const bySku = new Map(profiles.filter((p) => p.sku).map((p) => [p.sku!, p]));

    let totalG = 0;
    let unknownCount = 0;
    for (const li of lineItems) {
      const profile = (li.productVariantId && byVariant.get(li.productVariantId)) || (li.sku && bySku.get(li.sku));
      if (!profile || profile.excludeFromShipping) {
        unknownCount++;
        continue;
      }
      totalG += (profile.weightG || 0) * Number(li.quantity);
    }
    return { totalG, unknownCount };
  }
}
