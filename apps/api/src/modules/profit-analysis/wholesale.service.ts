import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductCostService } from './product-cost.service';
import { calculateWholesaleOrder, roundWholesaleOrder } from './domain/wholesale';

export interface WholesaleItemInputDto {
  productId: string;
  quantity: number;
  unitPriceGross: string;
  vatRate?: string;
}

export interface WholesaleOrderInputDto {
  orderDate: string;
  orderNumber?: string;
  customerName?: string;
  status?: 'draft' | 'confirmed' | 'shipped' | 'invoiced' | 'paid' | 'cancelled';
  note?: string;
  items: WholesaleItemInputDto[];
}

@Injectable()
export class WholesaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productCosts: ProductCostService,
  ) {}

  /** Liste aller Auftraege im Zeitraum. */
  async list(orgId: string, from?: string, to?: string) {
    const where: Prisma.PaWholesaleOrderWhereInput = { orgId };
    if (from || to) {
      where.orderDate = {};
      if (from) (where.orderDate as any).gte = new Date(from + 'T00:00:00Z');
      if (to)   (where.orderDate as any).lte = new Date(to   + 'T23:59:59Z');
    }
    const orders = await this.prisma.paWholesaleOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: { items: { include: { product: { select: { title: true, sku: true, imageUrl: true } } } } },
    });
    return {
      items: orders.map((o) => this.toListRow(o)),
    };
  }

  async get(orgId: string, orderId: string) {
    const order = await this.prisma.paWholesaleOrder.findFirst({
      where: { id: orderId, orgId },
      include: {
        items: { include: { product: { select: { id: true, title: true, sku: true, imageUrl: true } } } },
        createdBy: { select: { name: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    return this.toDetailRow(order);
  }

  async create(orgId: string, userId: string, input: WholesaleOrderInputDto) {
    if (!input.items?.length) throw new BadRequestException('Auftrag benoetigt mindestens eine Position');
    const orderDate = new Date(input.orderDate + 'T00:00:00Z');
    if (isNaN(orderDate.getTime())) throw new BadRequestException('orderDate ungueltig');

    // Fuer jedes Produkt Kosten-Snapshot ermitteln (am Auftragsdatum gueltiger Wert)
    const itemsWithSnapshot = await Promise.all(input.items.map(async (it) => {
      await this.assertProductBelongsToOrg(orgId, it.productId);
      const snapshotStr = await this.productCosts.getCostAt(orgId, it.productId, 'cost', orderDate);
      return {
        productId: it.productId,
        quantity: it.quantity,
        unitPriceGross: this.dec(it.unitPriceGross, 'unitPriceGross'),
        vatRate: this.dec(it.vatRate ?? '19', 'vatRate'),
        productCostSnapshot: snapshotStr ? new Prisma.Decimal(snapshotStr) : new Prisma.Decimal(0),
      };
    }));

    const created = await this.prisma.paWholesaleOrder.create({
      data: {
        orgId,
        orderDate,
        orderNumber: input.orderNumber?.trim() || null,
        customerName: input.customerName?.trim() || null,
        status: (input.status ?? 'draft') as any,
        note: input.note?.trim() || null,
        createdById: userId,
        items: { create: itemsWithSnapshot },
      },
      include: { items: { include: { product: { select: { id: true, title: true, sku: true, imageUrl: true } } } } },
    });
    return this.toDetailRow(created);
  }

  async update(orgId: string, orderId: string, input: Partial<WholesaleOrderInputDto>) {
    const existing = await this.prisma.paWholesaleOrder.findFirst({ where: { id: orderId, orgId } });
    if (!existing) throw new NotFoundException('Auftrag nicht gefunden');

    // Wenn Items im Update kommen, alle bestehenden Items ersetzen + neue Snapshots.
    // (einfacher als item-weises diffen — Wholesale-Auftraege sind klein).
    if (input.items) {
      const orderDate = input.orderDate
        ? new Date(input.orderDate + 'T00:00:00Z')
        : existing.orderDate;
      const itemsWithSnapshot = await Promise.all(input.items.map(async (it) => {
        await this.assertProductBelongsToOrg(orgId, it.productId);
        const snapshotStr = await this.productCosts.getCostAt(orgId, it.productId, 'cost', orderDate);
        return {
          productId: it.productId,
          quantity: it.quantity,
          unitPriceGross: this.dec(it.unitPriceGross, 'unitPriceGross'),
          vatRate: this.dec(it.vatRate ?? '19', 'vatRate'),
          productCostSnapshot: snapshotStr ? new Prisma.Decimal(snapshotStr) : new Prisma.Decimal(0),
        };
      }));
      // Loeschen und Neuanlegen MUSS atomar sein. Ohne Transaktion blieb der
      // Auftrag bei einem Fehler im createMany ohne jede Position zurueck —
      // sein Umsatz fiel damit still auf 0, ohne Fehlermeldung.
      await this.prisma.$transaction([
        this.prisma.paWholesaleOrderItem.deleteMany({ where: { orderId } }),
        this.prisma.paWholesaleOrderItem.createMany({
          data: itemsWithSnapshot.map((i) => ({ ...i, orderId })),
        }),
      ]);
    }

    const updated = await this.prisma.paWholesaleOrder.update({
      where: { id: orderId },
      data: {
        ...(input.orderDate    && { orderDate: new Date(input.orderDate + 'T00:00:00Z') }),
        ...(input.orderNumber  !== undefined && { orderNumber: input.orderNumber?.trim() || null }),
        ...(input.customerName !== undefined && { customerName: input.customerName?.trim() || null }),
        ...(input.status       !== undefined && { status: input.status as any }),
        ...(input.note         !== undefined && { note: input.note?.trim() || null }),
      },
      include: { items: { include: { product: { select: { id: true, title: true, sku: true, imageUrl: true } } } } },
    });
    return this.toDetailRow(updated);
  }

  async remove(orgId: string, orderId: string) {
    const existing = await this.prisma.paWholesaleOrder.findFirst({ where: { id: orderId, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Auftrag nicht gefunden');
    await this.prisma.paWholesaleOrder.delete({ where: { id: orderId } });
    return { ok: true };
  }

  /** Alle Auftraege eines Monats — fuer Monatsberechnung. */
  async listForMonth(orgId: string, year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    return this.prisma.paWholesaleOrder.findMany({
      where: { orgId, orderDate: { gte: from, lte: to } },
      include: { items: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertProductBelongsToOrg(orgId: string, productId: string) {
    const p = await this.prisma.product.findFirst({ where: { id: productId, orgId }, select: { id: true } });
    if (!p) throw new NotFoundException(`Produkt ${productId} nicht gefunden`);
  }

  private dec(s: string, field: string): Prisma.Decimal {
    if (typeof s !== 'string') throw new BadRequestException(`${field} muss String sein`);
    const norm = s.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(norm)) throw new BadRequestException(`${field}: ungueltig`);
    return new Prisma.Decimal(norm);
  }

  private toListRow(o: any) {
    const totals = roundWholesaleOrder(calculateWholesaleOrder(o.items));
    return {
      id: o.id,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      status: o.status,
      note: o.note,
      itemCount: o.items.length,
      totalGross: totals.totalGross.toString(),
      totalNet: totals.totalNet.toString(),
      totalCost: totals.totalCost.toString(),
      totalProfit: totals.totalProfit.toString(),
      margin: totals.margin?.toString() ?? null,
      createdAt: o.createdAt.toISOString(),
    };
  }

  private toDetailRow(o: any) {
    const totals = roundWholesaleOrder(calculateWholesaleOrder(o.items));
    return {
      ...this.toListRow(o),
      items: o.items.map((it: any, idx: number) => ({
        id: it.id,
        productId: it.productId,
        productTitle: it.product?.title ?? null,
        productSku: it.product?.sku ?? null,
        productImageUrl: it.product?.imageUrl ?? null,
        quantity: it.quantity,
        unitPriceGross: it.unitPriceGross.toString(),
        vatRate: it.vatRate.toString(),
        productCostSnapshot: it.productCostSnapshot.toString(),
        totalGross: totals.items[idx].totalGross.toString(),
        totalNet: totals.items[idx].totalNet.toString(),
        totalCost: totals.items[idx].totalCost.toString(),
        totalProfit: totals.items[idx].totalProfit.toString(),
      })),
    };
  }
}
