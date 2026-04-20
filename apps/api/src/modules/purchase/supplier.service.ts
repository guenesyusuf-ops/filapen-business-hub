import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseAuditService } from './purchase-audit.service';

export interface SupplierInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  vatId?: string | null;
  taxNumber?: string | null;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  country?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  paymentTermDays?: number | null;
  defaultCurrency?: string;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PurchaseAuditService,
  ) {}

  private validate(data: Partial<SupplierInput>) {
    if (data.email !== undefined && !EMAIL_RE.test(data.email)) {
      throw new BadRequestException('Ungültige E-Mail-Adresse');
    }
    if (data.defaultCurrency && !['EUR', 'USD'].includes(data.defaultCurrency)) {
      throw new BadRequestException('Währung muss EUR oder USD sein');
    }
    if (data.paymentTermDays !== undefined && data.paymentTermDays !== null && data.paymentTermDays < 0) {
      throw new BadRequestException('Zahlungsziel darf nicht negativ sein');
    }
  }

  private async generateSupplierNumber(orgId: string): Promise<string> {
    const last = await this.prisma.supplier.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { supplierNumber: true },
    });
    let next = 1;
    if (last?.supplierNumber) {
      const match = last.supplierNumber.match(/(\d+)$/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `LIEF-${String(next).padStart(4, '0')}`;
  }

  async list(orgId: string, filters?: { search?: string; status?: 'active' | 'inactive' }) {
    const where: any = { orgId };
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { companyName: { contains: filters.search, mode: 'insensitive' } },
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { supplierNumber: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.supplier.findMany({
      where,
      orderBy: { companyName: 'asc' },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    });
  }

  async get(orgId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, orgId },
      include: {
        _count: { select: { purchaseOrders: true } },
        purchaseOrders: {
          orderBy: { orderDate: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            orderDate: true,
            totalAmount: true,
            paidAmount: true,
            openAmount: true,
            currency: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Lieferant nicht gefunden');
    return supplier;
  }

  async create(orgId: string, userId: string, data: SupplierInput) {
    if (!data.companyName?.trim()) throw new BadRequestException('Firmenname ist Pflicht');
    if (!data.contactName?.trim()) throw new BadRequestException('Ansprechpartner ist Pflicht');
    if (!data.email?.trim()) throw new BadRequestException('E-Mail ist Pflicht');
    if (!data.phone?.trim()) throw new BadRequestException('Telefon ist Pflicht');
    this.validate(data);

    const supplierNumber = await this.generateSupplierNumber(orgId);

    const supplier = await this.prisma.supplier.create({
      data: {
        orgId,
        supplierNumber,
        companyName: data.companyName.trim(),
        contactName: data.contactName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        vatId: data.vatId?.trim() || null,
        taxNumber: data.taxNumber?.trim() || null,
        street: data.street?.trim() || null,
        zipCode: data.zipCode?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || 'DE',
        iban: data.iban?.replace(/\s/g, '') || null,
        bic: data.bic?.trim() || null,
        bankName: data.bankName?.trim() || null,
        paymentTermDays: data.paymentTermDays ?? 30,
        defaultCurrency: data.defaultCurrency || 'EUR',
        notes: data.notes?.trim() || null,
        status: data.status || 'active',
        createdById: userId,
      },
    });

    await this.audit.log(orgId, userId, 'supplier', supplier.id, 'create', { supplier });
    return supplier;
  }

  async update(orgId: string, userId: string, id: string, data: Partial<SupplierInput>) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Lieferant nicht gefunden');
    this.validate(data);

    const updates: any = {};
    if (data.companyName !== undefined) updates.companyName = data.companyName.trim();
    if (data.contactName !== undefined) updates.contactName = data.contactName.trim();
    if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) updates.phone = data.phone.trim();
    if (data.vatId !== undefined) updates.vatId = data.vatId?.trim() || null;
    if (data.taxNumber !== undefined) updates.taxNumber = data.taxNumber?.trim() || null;
    if (data.street !== undefined) updates.street = data.street?.trim() || null;
    if (data.zipCode !== undefined) updates.zipCode = data.zipCode?.trim() || null;
    if (data.city !== undefined) updates.city = data.city?.trim() || null;
    if (data.country !== undefined) updates.country = data.country?.trim() || 'DE';
    if (data.iban !== undefined) updates.iban = data.iban?.replace(/\s/g, '') || null;
    if (data.bic !== undefined) updates.bic = data.bic?.trim() || null;
    if (data.bankName !== undefined) updates.bankName = data.bankName?.trim() || null;
    if (data.paymentTermDays !== undefined) updates.paymentTermDays = data.paymentTermDays;
    if (data.defaultCurrency !== undefined) updates.defaultCurrency = data.defaultCurrency;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
    if (data.status !== undefined) updates.status = data.status;

    const updated = await this.prisma.supplier.update({ where: { id }, data: updates });
    await this.audit.log(orgId, userId, 'supplier', id, 'update', { before: existing, after: updated });
    return updated;
  }

  async remove(orgId: string, userId: string, id: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, orgId },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!existing) throw new NotFoundException('Lieferant nicht gefunden');
    if (existing._count.purchaseOrders > 0) {
      // soft-deactivate instead of hard delete
      const updated = await this.prisma.supplier.update({
        where: { id },
        data: { status: 'inactive' },
      });
      await this.audit.log(orgId, userId, 'supplier', id, 'deactivate', { reason: 'has_orders' });
      throw new ConflictException(
        'Lieferant hat bestehende Bestellungen — wurde nur auf inaktiv gesetzt.',
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
    await this.audit.log(orgId, userId, 'supplier', id, 'delete', { supplier: existing });
    return { deleted: true };
  }
}
