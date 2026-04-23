import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SalesCustomerInput {
  companyName: string;
  externalCustomerNumber?: string | null;
  easybillCustomerNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  shippingAddress?: any;
  billingAddress?: any;
  paymentTerms?: string | null;
  notes?: string | null;
}

@Injectable()
export class SalesCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Auto-generate internal customer number of the form KD-00001.
   * Scans existing highest number for the org and increments. Good enough for
   * single-digit-thousands scale; if volume grows we switch to a sequence.
   */
  private async nextCustomerNumber(orgId: string): Promise<string> {
    const latest = await this.prisma.salesCustomer.findFirst({
      where: { orgId, customerNumber: { startsWith: 'KD-' } },
      orderBy: { customerNumber: 'desc' },
      select: { customerNumber: true },
    });
    const lastNum = latest?.customerNumber?.match(/\d+/)?.[0];
    const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1;
    return `KD-${String(next).padStart(5, '0')}`;
  }

  async list(orgId: string, filters: { search?: string; limit?: number; offset?: number } = {}) {
    const where: any = { orgId };
    if (filters.search) {
      where.OR = [
        { companyName: { contains: filters.search, mode: 'insensitive' as const } },
        { email: { contains: filters.search, mode: 'insensitive' as const } },
        { customerNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { externalCustomerNumber: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.salesCustomer.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.salesCustomer.count({ where }),
    ]);
    return { items, total };
  }

  async get(orgId: string, id: string) {
    const c = await this.prisma.salesCustomer.findFirst({ where: { id, orgId } });
    if (!c) throw new NotFoundException('Kunde nicht gefunden');
    return c;
  }

  async create(orgId: string, data: SalesCustomerInput) {
    if (!data.companyName?.trim()) throw new BadRequestException('Firmenname erforderlich');
    const customerNumber = await this.nextCustomerNumber(orgId);
    return this.prisma.salesCustomer.create({
      data: {
        orgId,
        customerNumber,
        companyName: data.companyName.trim(),
        externalCustomerNumber: data.externalCustomerNumber || null,
        easybillCustomerNumber: data.easybillCustomerNumber || null,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        shippingAddress: data.shippingAddress ?? null,
        billingAddress: data.billingAddress ?? null,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
      },
    });
  }

  async update(orgId: string, id: string, data: Partial<SalesCustomerInput>) {
    await this.get(orgId, id); // 404-guard
    return this.prisma.salesCustomer.update({
      where: { id },
      data: {
        ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
        ...(data.externalCustomerNumber !== undefined ? { externalCustomerNumber: data.externalCustomerNumber } : {}),
        ...(data.easybillCustomerNumber !== undefined ? { easybillCustomerNumber: data.easybillCustomerNumber } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.shippingAddress !== undefined ? { shippingAddress: data.shippingAddress } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    // Fails if orders reference this customer (FK ON DELETE RESTRICT) — that's intentional
    await this.prisma.salesCustomer.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Try to find an existing customer that matches the given hints — used by
   * the PDF importer to auto-link orders to existing customers instead of
   * creating duplicates. Matches in priority: externalCustomerNumber → email →
   * companyName (case-insensitive). Returns null if no match.
   */
  async findMatching(
    orgId: string,
    hints: { externalCustomerNumber?: string | null; email?: string | null; companyName?: string | null },
  ) {
    if (hints.externalCustomerNumber) {
      const byExt = await this.prisma.salesCustomer.findFirst({
        where: { orgId, externalCustomerNumber: hints.externalCustomerNumber },
      });
      if (byExt) return byExt;
    }
    if (hints.email) {
      const byEmail = await this.prisma.salesCustomer.findFirst({
        where: { orgId, email: { equals: hints.email, mode: 'insensitive' } },
      });
      if (byEmail) return byEmail;
    }
    if (hints.companyName) {
      const byName = await this.prisma.salesCustomer.findFirst({
        where: { orgId, companyName: { equals: hints.companyName, mode: 'insensitive' } },
      });
      if (byName) return byName;
    }
    return null;
  }
}
