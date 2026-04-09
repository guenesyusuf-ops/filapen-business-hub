import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreatePaymentMethodDto {
  gatewayName: string;
  feePercentage: number;
  feeFixedAmount: number;
  feeCurrency?: string;
  isActive?: boolean;
}

export interface CreateFixedCostDto {
  name: string;
  category: 'software' | 'salary' | 'warehouse' | 'agency' | 'creator' | 'other';
  amount: number;
  currency?: string;
  recurrence: 'monthly' | 'weekly' | 'quarterly' | 'annual' | 'one_time';
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
}

export type UpdateFixedCostDto = Partial<CreateFixedCostDto>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CostService {
  private readonly logger = new Logger(CostService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Payment Method Config
  // =========================================================================

  async listPaymentMethods(orgId: string) {
    return this.prisma.paymentMethodConfig.findMany({
      where: { orgId },
      orderBy: { gatewayName: 'asc' },
    });
  }

  async upsertPaymentMethod(orgId: string, data: CreatePaymentMethodDto) {
    return this.prisma.paymentMethodConfig.upsert({
      where: {
        orgId_gatewayName: { orgId, gatewayName: data.gatewayName },
      },
      create: {
        orgId,
        gatewayName: data.gatewayName,
        feePercentage: new Prisma.Decimal(data.feePercentage),
        feeFixedAmount: new Prisma.Decimal(data.feeFixedAmount),
        feeCurrency: data.feeCurrency ?? 'USD',
        isActive: data.isActive ?? true,
      },
      update: {
        feePercentage: new Prisma.Decimal(data.feePercentage),
        feeFixedAmount: new Prisma.Decimal(data.feeFixedAmount),
        feeCurrency: data.feeCurrency ?? 'USD',
        isActive: data.isActive ?? true,
      },
    });
  }

  async deletePaymentMethod(orgId: string, id: string): Promise<void> {
    const existing = await this.prisma.paymentMethodConfig.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Payment method config ${id} not found`);
    }
    await this.prisma.paymentMethodConfig.delete({ where: { id } });
  }

  /**
   * Calculate payment processing fee for a single order.
   *
   * Formula: (orderTotal * percentageFee / 100) + fixedFeeAmount
   * Matches gateway name to config; falls back to first active config tagged
   * as the "default" gateway, or returns 0 if no config exists.
   */
  calculatePaymentFee(
    orderTotal: number,
    gateway: string | null,
    configs: Array<{
      gatewayName: string;
      feePercentage: Prisma.Decimal;
      feeFixedAmount: Prisma.Decimal;
      isActive: boolean;
    }>,
  ): number {
    const activeConfigs = configs.filter((c) => c.isActive);
    if (activeConfigs.length === 0) return 0;

    const normalizedGateway = (gateway ?? '').toLowerCase().trim();

    // Try exact match first
    let config = activeConfigs.find(
      (c) => c.gatewayName.toLowerCase().trim() === normalizedGateway,
    );

    // Fall back to a config named "default"
    if (!config) {
      config = activeConfigs.find(
        (c) => c.gatewayName.toLowerCase().trim() === 'default',
      );
    }

    // If still no match, use the first active config as fallback
    if (!config) {
      config = activeConfigs[0];
    }

    const pct = Number(config.feePercentage);
    const fixed = Number(config.feeFixedAmount);

    return Math.round(((orderTotal * pct) / 100 + fixed) * 100) / 100;
  }

  // =========================================================================
  // Fixed Costs
  // =========================================================================

  async listFixedCosts(orgId: string) {
    return this.prisma.fixedCost.findMany({
      where: { orgId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createFixedCost(orgId: string, data: CreateFixedCostDto) {
    return this.prisma.fixedCost.create({
      data: {
        orgId,
        name: data.name,
        category: data.category,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency ?? 'USD',
        recurrence: data.recurrence,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async updateFixedCost(orgId: string, id: string, data: UpdateFixedCostDto) {
    const existing = await this.prisma.fixedCost.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Fixed cost ${id} not found`);
    }

    const updateData: Prisma.FixedCostUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.recurrence !== undefined) updateData.recurrence = data.recurrence;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return this.prisma.fixedCost.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteFixedCost(orgId: string, id: string): Promise<void> {
    const existing = await this.prisma.fixedCost.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Fixed cost ${id} not found`);
    }
    await this.prisma.fixedCost.delete({ where: { id } });
  }

  /**
   * Calculate the prorated daily allocation of all applicable fixed costs for
   * a given date.
   *
   * Proration rules:
   *   monthly     → amount / daysInMonth(date)
   *   weekly      → amount / 7
   *   quarterly   → amount / ~91.3 (365.25 / 4)
   *   annual      → amount / 365.25
   *   one_time    → full amount only on start_date
   */
  calculateDailyFixedCosts(
    fixedCosts: Array<{
      amount: Prisma.Decimal;
      recurrence: string;
      startDate: Date;
      endDate: Date | null;
    }>,
    date: Date,
  ): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    let total = 0;

    for (const fc of fixedCosts) {
      const start = new Date(fc.startDate);
      start.setHours(0, 0, 0, 0);

      // Must be on or after start date
      if (d < start) continue;

      // If end date exists, must be on or before
      if (fc.endDate) {
        const end = new Date(fc.endDate);
        end.setHours(0, 0, 0, 0);
        if (d > end) continue;
      }

      const amount = Number(fc.amount);

      switch (fc.recurrence) {
        case 'monthly': {
          const year = d.getFullYear();
          const month = d.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          total += amount / daysInMonth;
          break;
        }
        case 'weekly':
          total += amount / 7;
          break;
        case 'quarterly':
          total += amount / (365.25 / 4);
          break;
        case 'annual':
          total += amount / 365.25;
          break;
        case 'one_time': {
          // Only on the exact start date
          if (d.getTime() === start.getTime()) {
            total += amount;
          }
          break;
        }
        default:
          this.logger.warn(`Unknown recurrence: ${fc.recurrence}`);
      }
    }

    // Round to 2 decimal places
    return Math.round(total * 100) / 100;
  }
}
