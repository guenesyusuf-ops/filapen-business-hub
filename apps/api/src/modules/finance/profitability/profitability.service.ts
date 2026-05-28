import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface ProfitabilityInput {
  productName: string;
  purchasePrice: number;
  shippingCost?: number;
  customsRate?: number;
  salesPrice: number;
  vatRate?: number;
  shippingToCustomer?: number;
  paymentRate?: number;
  adCost?: number | null;
  notes?: string | null;
}

@Injectable()
export class ProfitabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    return this.prisma.profitabilityCalculation.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(orgId: string, id: string) {
    const c = await this.prisma.profitabilityCalculation.findFirst({ where: { id, orgId } });
    if (!c) throw new NotFoundException('Berechnung nicht gefunden');
    return c;
  }

  async create(orgId: string, userId: string, data: ProfitabilityInput) {
    if (!data.productName?.trim()) throw new BadRequestException('Produktname fehlt');
    if (!Number.isFinite(Number(data.purchasePrice))) throw new BadRequestException('Einkaufspreis ungueltig');
    if (!Number.isFinite(Number(data.salesPrice))) throw new BadRequestException('Verkaufspreis ungueltig');
    return this.prisma.profitabilityCalculation.create({
      data: {
        orgId,
        createdById: userId,
        productName: data.productName.trim(),
        purchasePrice: new Prisma.Decimal(Number(data.purchasePrice).toFixed(2)),
        shippingCost: new Prisma.Decimal(Number(data.shippingCost ?? 0).toFixed(2)),
        customsRate: new Prisma.Decimal(Number(data.customsRate ?? 0).toFixed(2)),
        salesPrice: new Prisma.Decimal(Number(data.salesPrice).toFixed(2)),
        vatRate: new Prisma.Decimal(Number(data.vatRate ?? 19).toFixed(2)),
        shippingToCustomer: new Prisma.Decimal(Number(data.shippingToCustomer ?? 0).toFixed(2)),
        paymentRate: new Prisma.Decimal(Number(data.paymentRate ?? 3).toFixed(2)),
        adCost: data.adCost != null ? new Prisma.Decimal(Number(data.adCost).toFixed(2)) : null,
        notes: data.notes?.trim() || null,
      },
    });
  }

  async update(orgId: string, id: string, data: Partial<ProfitabilityInput>) {
    await this.get(orgId, id);
    const updates: any = {};
    if (data.productName !== undefined) updates.productName = data.productName.trim();
    if (data.purchasePrice !== undefined) updates.purchasePrice = new Prisma.Decimal(Number(data.purchasePrice).toFixed(2));
    if (data.shippingCost !== undefined) updates.shippingCost = new Prisma.Decimal(Number(data.shippingCost).toFixed(2));
    if (data.customsRate !== undefined) updates.customsRate = new Prisma.Decimal(Number(data.customsRate).toFixed(2));
    if (data.salesPrice !== undefined) updates.salesPrice = new Prisma.Decimal(Number(data.salesPrice).toFixed(2));
    if (data.vatRate !== undefined) updates.vatRate = new Prisma.Decimal(Number(data.vatRate).toFixed(2));
    if (data.shippingToCustomer !== undefined) updates.shippingToCustomer = new Prisma.Decimal(Number(data.shippingToCustomer).toFixed(2));
    if (data.paymentRate !== undefined) updates.paymentRate = new Prisma.Decimal(Number(data.paymentRate).toFixed(2));
    if (data.adCost !== undefined) updates.adCost = data.adCost != null ? new Prisma.Decimal(Number(data.adCost).toFixed(2)) : null;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
    return this.prisma.profitabilityCalculation.update({ where: { id }, data: updates });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.profitabilityCalculation.delete({ where: { id } });
    return { deleted: true };
  }
}
