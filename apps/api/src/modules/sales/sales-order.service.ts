import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LineItemInput {
  position?: number;
  title: string;
  supplierArticleNumber?: string | null;
  ean?: string | null;
  unitsPerCarton?: number | null;
  quantity: number;
  unitPriceNet: number;
  lineNet?: number;
  matchedProductVariantId?: string | null;
}

export interface SalesOrderInput {
  customerId: string;
  externalOrderNumber?: string | null;
  orderDate?: string | Date | null;
  requiredDeliveryDate?: string | Date | null;
  contactPerson?: string | null;
  shippingAddress?: any;
  billingAddress?: any;
  paymentTerms?: string | null;
  currency?: string;
  notes?: string | null;
  lineItems?: LineItemInput[];
  assignedToId?: string | null;
  sourceDocumentId?: string | null;
  extractionConfidence?: number | null;
}

@Injectable()
export class SalesOrderService {
  private readonly logger = new Logger(SalesOrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async nextOrderNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VK-${year}-`;
    const latest = await this.prisma.salesOrder.findFirst({
      where: { orgId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const lastNum = latest?.orderNumber?.split('-')[2];
    const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private computeTotal(items: LineItemInput[]): number {
    return items.reduce((sum, i) => {
      const line = i.lineNet != null ? Number(i.lineNet) : Number(i.quantity) * Number(i.unitPriceNet);
      return sum + (Number.isFinite(line) ? line : 0);
    }, 0);
  }

  async list(
    orgId: string,
    filters: {
      status?: string;
      customerId?: string;
      search?: string;
      urgency?: 'urgent' | 'overdue';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { externalOrderNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { customer: { companyName: { contains: filters.search, mode: 'insensitive' as const } } },
      ];
    }
    // Urgency filters: in-verzug = past due + not shipped; urgent = within 3d + not shipped
    if (filters.urgency === 'overdue') {
      where.shippedAt = null;
      where.requiredDeliveryDate = { lt: new Date() };
    }
    if (filters.urgency === 'urgent') {
      const threeDaysOut = new Date();
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);
      where.shippedAt = null;
      where.requiredDeliveryDate = { gte: new Date(), lte: threeDaysOut };
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true, customerNumber: true } },
          // matchedVariant → product → imageUrl damit die Listenansicht kleine
          // Produkt-Kacheln rendern kann. Nicht alle Line-Items sind gematched
          // (unbekannte SKUs aus Import), daher nullable Chain.
          lineItems: {
            select: {
              id: true, title: true, quantity: true,
              matchedVariant: {
                select: { id: true, sku: true, product: { select: { id: true, title: true, imageUrl: true } } },
              },
            },
          },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    return { items, total };
  }

  async get(orgId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, orgId },
      include: {
        customer: true,
        lineItems: { orderBy: { position: 'asc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  async create(orgId: string, userId: string, data: SalesOrderInput) {
    if (!data.customerId) throw new BadRequestException('customerId erforderlich');
    const customer = await this.prisma.salesCustomer.findFirst({
      where: { id: data.customerId, orgId },
    });
    if (!customer) throw new BadRequestException('Kunde nicht gefunden');

    const orderNumber = await this.nextOrderNumber(orgId);
    const items = data.lineItems ?? [];
    const total = this.computeTotal(items);

    const order = await this.prisma.salesOrder.create({
      data: {
        orgId,
        orderNumber,
        customerId: data.customerId,
        externalOrderNumber: data.externalOrderNumber || null,
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
        requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : null,
        contactPerson: data.contactPerson || customer.contactPerson || null,
        shippingAddress: data.shippingAddress ?? customer.shippingAddress ?? null,
        billingAddress: data.billingAddress ?? customer.billingAddress ?? null,
        paymentTerms: data.paymentTerms || customer.paymentTerms || null,
        currency: data.currency || 'EUR',
        totalNet: total.toFixed(2),
        status: 'draft',
        createdById: userId,
        assignedToId: data.assignedToId || null,
        sourceDocumentId: data.sourceDocumentId || null,
        extractionConfidence: data.extractionConfidence ?? null,
        notes: data.notes || null,
        lineItems: {
          create: items.map((i, idx) => ({
            orgId,
            position: i.position ?? idx + 1,
            title: i.title,
            supplierArticleNumber: i.supplierArticleNumber || null,
            ean: i.ean || null,
            unitsPerCarton: i.unitsPerCarton ?? null,
            quantity: i.quantity,
            unitPriceNet: Number(i.unitPriceNet).toFixed(4),
            lineNet: (i.lineNet != null ? Number(i.lineNet) : i.quantity * Number(i.unitPriceNet)).toFixed(2),
            matchedProductVariantId: i.matchedProductVariantId || null,
          })),
        },
        events: {
          create: {
            orgId,
            type: data.sourceDocumentId ? 'imported' : 'created',
            actorId: userId,
            note: data.sourceDocumentId ? 'Aus PDF importiert' : 'Manuell angelegt',
          },
        },
      },
      include: { customer: true, lineItems: true, documents: true },
    });
    return order;
  }

  async update(orgId: string, userId: string, id: string, data: Partial<SalesOrderInput>) {
    await this.get(orgId, id);
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data.externalOrderNumber !== undefined ? { externalOrderNumber: data.externalOrderNumber } : {}),
        ...(data.orderDate !== undefined ? { orderDate: data.orderDate ? new Date(data.orderDate) : null } : {}),
        ...(data.requiredDeliveryDate !== undefined ? { requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : null } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.shippingAddress !== undefined ? { shippingAddress: data.shippingAddress } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
        events: {
          create: {
            orgId,
            type: 'edited',
            actorId: userId,
            note: 'Kopfdaten geändert',
          },
        },
      },
    });
    return updated;
  }

  async replaceLineItems(orgId: string, userId: string, id: string, items: LineItemInput[]) {
    await this.get(orgId, id);
    const total = this.computeTotal(items);
    await this.prisma.$transaction([
      this.prisma.salesOrderLineItem.deleteMany({ where: { orderId: id } }),
      this.prisma.salesOrderLineItem.createMany({
        data: items.map((i, idx) => ({
          orgId,
          orderId: id,
          position: i.position ?? idx + 1,
          title: i.title,
          supplierArticleNumber: i.supplierArticleNumber || null,
          ean: i.ean || null,
          unitsPerCarton: i.unitsPerCarton ?? null,
          quantity: i.quantity,
          unitPriceNet: Number(i.unitPriceNet).toFixed(4),
          lineNet: (i.lineNet != null ? Number(i.lineNet) : i.quantity * Number(i.unitPriceNet)).toFixed(2),
          matchedProductVariantId: i.matchedProductVariantId || null,
        })),
      }),
      this.prisma.salesOrder.update({
        where: { id },
        data: { totalNet: total.toFixed(2) },
      }),
      this.prisma.salesOrderEvent.create({
        data: { orgId, orderId: id, type: 'edited', actorId: userId, note: 'Positionen aktualisiert' },
      }),
    ]);
    return this.get(orgId, id);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.salesOrder.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Toggle a status badge (Auftragsbestätigung / Versand / Rechnung). When a
   * badge gets flipped on we set the corresponding timestamp and advance the
   * status machine so the list view can show meaningful progress.
   */
  async toggleStatus(
    orgId: string,
    userId: string,
    id: string,
    kind: 'confirmation_sent' | 'shipped' | 'invoice_sent' | 'paid',
    on: boolean,
  ) {
    const order = await this.get(orgId, id);
    const now = new Date();
    const data: any = { events: { create: { orgId, type: kind, actorId: userId } } };

    if (kind === 'confirmation_sent') {
      data.confirmationSentAt = on ? (order.confirmationSentAt ?? now) : null;
      if (on && order.status === 'draft') data.status = 'confirmed';
    }
    if (kind === 'shipped') {
      data.shippedAt = on ? (order.shippedAt ?? now) : null;
      if (on) data.status = 'shipped';
      else if (order.status === 'shipped') data.status = 'confirmed';
    }
    if (kind === 'invoice_sent') {
      data.invoiceSentAt = on ? (order.invoiceSentAt ?? now) : null;
      if (on && order.status === 'shipped') data.status = 'invoiced';
    }
    if (kind === 'paid') {
      data.paidAt = on ? (order.paidAt ?? now) : null;
      // Paid implies the order is fully closed out — advance to completed when
      // it was invoiced. Otherwise leave status alone (user might mark paid
      // early before the invoice flow).
      if (on && (order.status === 'invoiced' || order.invoiceSentAt)) data.status = 'completed';
      else if (!on && order.status === 'completed') data.status = 'invoiced';
    }

    return this.prisma.salesOrder.update({ where: { id }, data, include: { customer: true } });
  }

  async updateShipping(
    orgId: string,
    userId: string,
    id: string,
    data: { trackingNumbers?: string[]; shippingCarrierNote?: string | null; shippedAt?: string | Date | null },
  ) {
    await this.get(orgId, id);
    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data.trackingNumbers !== undefined ? { trackingNumbers: data.trackingNumbers } : {}),
        ...(data.shippingCarrierNote !== undefined ? { shippingCarrierNote: data.shippingCarrierNote } : {}),
        ...(data.shippedAt !== undefined ? { shippedAt: data.shippedAt ? new Date(data.shippedAt) : null } : {}),
        events: { create: { orgId, type: 'edited', actorId: userId, note: 'Versand-Info geändert' } },
      },
    });
  }

  /**
   * Dashboard KPIs — counters for the landing card grid.
   */
  async dashboard(orgId: string) {
    const now = new Date();
    const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [open, urgent, overdue, monthRevenueRaw] = await Promise.all([
      this.prisma.salesOrder.count({ where: { orgId, shippedAt: null, status: { notIn: ['cancelled', 'completed'] } } }),
      this.prisma.salesOrder.count({
        where: {
          orgId, shippedAt: null,
          requiredDeliveryDate: { gte: now, lte: in3Days },
        },
      }),
      this.prisma.salesOrder.count({
        where: { orgId, shippedAt: null, requiredDeliveryDate: { lt: now } },
      }),
      this.prisma.salesOrder.aggregate({
        where: { orgId, createdAt: { gte: monthStart } },
        _sum: { totalNet: true },
      }),
    ]);
    return {
      open,
      urgent,
      overdue,
      monthRevenue: Number(monthRevenueRaw._sum.totalNet ?? 0),
    };
  }
}
