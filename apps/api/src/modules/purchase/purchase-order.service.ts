import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseAuditService } from './purchase-audit.service';
import { Prisma } from '@prisma/client';

export interface PoItemInput {
  productId?: string | null;
  productVariantId?: string | null;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

export interface PoInput {
  supplierId: string;
  orderDate: string; // ISO date
  expectedDelivery?: string | null;
  currency?: string;
  exchangeRate?: number | null;
  shippingCost?: number | null;
  customsCost?: number | null;
  notes?: string | null;
  internalNotes?: string | null;
  items: PoItemInput[];
}

export interface InvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  amount: number;
  currency?: string;
  documentId?: string | null;
}

interface ListFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  supplierId?: string;
  createdById?: string;
  currency?: string;
  hasDocument?: 'yes' | 'no';
  onTheWay?: boolean;
  includeCancelled?: boolean;
  onlyCancelled?: boolean;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

const D = (n: number | string | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(n);

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PurchaseAuditService,
  ) {}

  // ----------------------- helpers -----------------------

  private async generateOrderNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BES-${year}-`;
    const last = await this.prisma.purchaseOrder.findFirst({
      where: { orgId, orderNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    let next = 1;
    if (last?.orderNumber) {
      const match = last.orderNumber.match(/(\d+)$/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private validateItems(items: PoItemInput[]) {
    if (!items?.length) throw new BadRequestException('Mindestens eine Position erforderlich');
    for (const it of items) {
      if (!it.productName?.trim()) throw new BadRequestException('Produktname fehlt');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        throw new BadRequestException('Menge muss > 0 sein');
      }
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
        throw new BadRequestException('Einzelpreis darf nicht negativ sein');
      }
      if (it.vatRate !== undefined && (it.vatRate < 0 || it.vatRate > 100)) {
        throw new BadRequestException('Steuersatz ungültig');
      }
    }
  }

  private validateCurrency(currency?: string) {
    if (currency && !['EUR', 'USD'].includes(currency)) {
      throw new BadRequestException('Währung muss EUR oder USD sein');
    }
  }

  private computeItemTotals(qty: number, price: number, vatRate: number) {
    const subtotal = D(qty).mul(price);
    const tax = subtotal.mul(vatRate).div(100);
    const total = subtotal.add(tax);
    return {
      lineSubtotal: subtotal.toDecimalPlaces(2),
      lineTax: tax.toDecimalPlaces(2),
      lineTotal: total.toDecimalPlaces(2),
    };
  }

  private computeOrderTotals(items: { lineSubtotal: Prisma.Decimal; lineTax: Prisma.Decimal; lineTotal: Prisma.Decimal }[], shipping: number, customs: number) {
    const subtotal = items.reduce((acc, it) => acc.add(it.lineSubtotal), D(0));
    const taxTotal = items.reduce((acc, it) => acc.add(it.lineTax), D(0));
    const itemsTotal = items.reduce((acc, it) => acc.add(it.lineTotal), D(0));
    const totalAmount = itemsTotal.add(shipping || 0).add(customs || 0);
    return {
      subtotal: subtotal.toDecimalPlaces(2),
      taxTotal: taxTotal.toDecimalPlaces(2),
      totalAmount: totalAmount.toDecimalPlaces(2),
    };
  }

  private derivePaymentStatus(total: Prisma.Decimal, paid: Prisma.Decimal): 'unpaid' | 'partially_paid' | 'paid' | 'overpaid' {
    if (paid.equals(0)) return 'unpaid';
    if (paid.gt(total)) return 'overpaid';
    if (paid.equals(total)) return 'paid';
    return 'partially_paid';
  }

  // Recompute paid/open/paymentStatus after payment changes
  async recalcPaymentTotals(orderId: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) return;
    const paid = order.payments.reduce((acc, p) => acc.add(p.amount), D(0));
    const open = D(order.totalAmount).sub(paid);
    const paymentStatus = this.derivePaymentStatus(D(order.totalAmount), paid);

    // Keine Bestellstatus-Änderung über Zahlungen — Status wird nur über
    // Sendungen (shipped/completed) oder User-Aktion (ordered/cancelled) gesteuert.
    await this.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: {
        paidAmount: paid.toDecimalPlaces(2),
        openAmount: open.toDecimalPlaces(2),
        paymentStatus,
      },
    });
  }

  // ----------------------- queries -----------------------

  async list(orgId: string, filters: ListFilters = {}) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.currency) where.currency = filters.currency;
    if (filters.from || filters.to) {
      where.orderDate = {};
      if (filters.from) where.orderDate.gte = new Date(filters.from);
      if (filters.to) where.orderDate.lte = new Date(filters.to);
    }
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { invoices: { some: { invoiceNumber: { contains: filters.search, mode: 'insensitive' } } } },
        { supplier: { companyName: { contains: filters.search, mode: 'insensitive' } } },
        { items: { some: { productName: { contains: filters.search, mode: 'insensitive' } } } },
        { shipments: { some: { trackingNumber: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }
    if (filters.hasDocument === 'yes') where.documents = { some: {} };
    if (filters.hasDocument === 'no') where.documents = { none: {} };

    // Cancelled-Handling
    if (filters.onlyCancelled) {
      where.status = 'cancelled';
    } else if (!filters.includeCancelled && !filters.status) {
      where.status = { not: 'cancelled' };
    }

    // "Unterwegs": Bestellung hat mindestens eine Sendung mit Tracking, noch nicht angekommen
    if (filters.onTheWay) {
      where.shipments = { some: { trackingNumber: { not: null }, receivedAt: null } };
    }

    const sortMap: Record<string, any> = {
      orderDate: { orderDate: filters.dir || 'desc' },
      total: { totalAmount: filters.dir || 'desc' },
      open: { openAmount: filters.dir || 'desc' },
      orderNumber: { orderNumber: filters.dir || 'desc' },
    };
    const orderBy = sortMap[filters.sort || 'orderDate'] || { orderDate: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy,
        skip: filters.offset || 0,
        take: Math.min(filters.limit || 50, 200),
        include: {
          supplier: { select: { id: true, supplierNumber: true, companyName: true, vatId: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          items: { select: { id: true, productName: true, quantity: true } },
          invoices: { select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, amount: true } },
          payments: { select: { id: true, paymentDate: true, amount: true } },
          shipments: { select: { id: true, trackingNumber: true, carrier: true, shippedAt: true, receivedAt: true } },
          documents: { select: { id: true, fileName: true, fileUrl: true, mimeType: true, documentType: true } },
          _count: { select: { documents: true, payments: true, shipments: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }

  async get(orgId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, orgId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        items: { orderBy: { position: 'asc' } },
        invoices: { orderBy: { invoiceDate: 'desc' } },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
            receiptDocument: true,
          },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
        },
        shipments: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  // ----------------------- mutations -----------------------

  async create(orgId: string, userId: string, data: PoInput) {
    if (!data.supplierId) throw new BadRequestException('Lieferant fehlt');
    if (!data.orderDate) throw new BadRequestException('Bestelldatum fehlt');
    this.validateCurrency(data.currency);
    this.validateItems(data.items);

    const supplier = await this.prisma.supplier.findFirst({ where: { id: data.supplierId, orgId } });
    if (!supplier) throw new BadRequestException('Lieferant unbekannt');

    const orderNumber = await this.generateOrderNumber(orgId);
    const currency = data.currency || supplier.defaultCurrency || 'EUR';

    const itemRows = data.items.map((it, idx) => {
      const vatRate = it.vatRate ?? 19;
      const totals = this.computeItemTotals(it.quantity, it.unitPrice, vatRate);
      return {
        productId: it.productId || null,
        productVariantId: it.productVariantId || null,
        productName: it.productName.trim(),
        sku: it.sku?.trim() || null,
        quantity: D(it.quantity),
        unitPrice: D(it.unitPrice),
        vatRate: D(vatRate),
        ...totals,
        position: idx,
      };
    });

    const totals = this.computeOrderTotals(itemRows, Number(data.shippingCost || 0), Number(data.customsCost || 0));
    const open = totals.totalAmount;

    const order = await this.prisma.purchaseOrder.create({
      data: {
        orgId,
        orderNumber,
        supplierId: data.supplierId,
        orderDate: new Date(data.orderDate),
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
        currency,
        exchangeRate: data.exchangeRate ? D(data.exchangeRate) : null,
        shippingCost: data.shippingCost != null ? D(data.shippingCost) : null,
        customsCost: data.customsCost != null ? D(data.customsCost) : null,
        ...totals,
        paidAmount: D(0),
        openAmount: open,
        status: 'draft',
        paymentStatus: 'unpaid',
        notes: data.notes?.trim() || null,
        internalNotes: data.internalNotes?.trim() || null,
        createdById: userId,
        items: { create: itemRows },
      },
      include: {
        items: { orderBy: { position: 'asc' } },
        supplier: true,
      },
    });

    await this.audit.log(orgId, userId, 'order', order.id, 'create', {
      orderNumber: order.orderNumber,
      total: order.totalAmount,
      itemCount: itemRows.length,
    });
    return order;
  }

  async update(orgId: string, userId: string, id: string, data: Partial<PoInput>) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Bestellung nicht gefunden');
    if (existing.status === 'cancelled') throw new BadRequestException('Stornierte Bestellung kann nicht geändert werden');

    this.validateCurrency(data.currency);

    // If items provided, replace them entirely
    if (data.items) {
      this.validateItems(data.items);
      await this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      const itemRows = data.items.map((it, idx) => {
        const vatRate = it.vatRate ?? 19;
        const totals = this.computeItemTotals(it.quantity, it.unitPrice, vatRate);
        return {
          purchaseOrderId: id,
          productId: it.productId || null,
          productVariantId: it.productVariantId || null,
          productName: it.productName.trim(),
          sku: it.sku?.trim() || null,
          quantity: D(it.quantity),
          unitPrice: D(it.unitPrice),
          vatRate: D(vatRate),
          ...totals,
          position: idx,
        };
      });
      await this.prisma.purchaseOrderItem.createMany({ data: itemRows });
    }

    // Recompute totals from items in DB
    const items = await this.prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
    const shipping = Number(data.shippingCost ?? existing.shippingCost ?? 0);
    const customs = Number(data.customsCost ?? existing.customsCost ?? 0);
    const totals = this.computeOrderTotals(items as any, shipping, customs);
    const paid = D(existing.paidAmount);
    const open = totals.totalAmount.sub(paid);
    const paymentStatus = this.derivePaymentStatus(totals.totalAmount, paid);

    const updates: any = { ...totals, openAmount: open, paymentStatus };
    if (data.supplierId) updates.supplierId = data.supplierId;
    if (data.orderDate) updates.orderDate = new Date(data.orderDate);
    if (data.expectedDelivery !== undefined) {
      updates.expectedDelivery = data.expectedDelivery ? new Date(data.expectedDelivery) : null;
    }
    if (data.currency) updates.currency = data.currency;
    if (data.exchangeRate !== undefined) updates.exchangeRate = data.exchangeRate ? D(data.exchangeRate) : null;
    if (data.shippingCost !== undefined) updates.shippingCost = data.shippingCost != null ? D(data.shippingCost) : null;
    if (data.customsCost !== undefined) updates.customsCost = data.customsCost != null ? D(data.customsCost) : null;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
    if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes?.trim() || null;

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: updates,
      include: { items: { orderBy: { position: 'asc' } }, supplier: true },
    });

    await this.audit.log(orgId, userId, 'order', id, 'update', { changes: Object.keys(updates) });
    return updated;
  }

  async setStatus(orgId: string, userId: string, id: string, status: 'draft' | 'ordered' | 'cancelled') {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Bestellung nicht gefunden');
    if (existing.status === status) return existing;

    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status } });
    await this.audit.log(orgId, userId, 'order', id, `status:${status}`, { from: existing.status, to: status });
    return updated;
  }

  async remove(orgId: string, userId: string, id: string) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Bestellung nicht gefunden');
    if (existing.status !== 'draft') {
      throw new BadRequestException('Nur Entwürfe können gelöscht werden — sonst stornieren');
    }
    await this.prisma.purchaseOrder.delete({ where: { id } });
    await this.audit.log(orgId, userId, 'order', id, 'delete', { orderNumber: existing.orderNumber });
    return { deleted: true };
  }

  // ----------------------- invoices -----------------------

  async addInvoice(orgId: string, userId: string, orderId: string, data: InvoiceInput) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, orgId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (!data.invoiceNumber?.trim()) throw new BadRequestException('Rechnungsnummer fehlt');
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new BadRequestException('Rechnungsbetrag ungültig');
    this.validateCurrency(data.currency);

    // Duplicate check
    const dupe = await this.prisma.purchaseInvoice.findFirst({
      where: { orgId, invoiceNumber: data.invoiceNumber.trim() },
    });
    if (dupe) {
      throw new BadRequestException(
        `Rechnungsnummer ${data.invoiceNumber} existiert bereits (Bestellung ${dupe.purchaseOrderId || '—'})`,
      );
    }

    const invoice = await this.prisma.purchaseInvoice.create({
      data: {
        orgId,
        purchaseOrderId: orderId,
        invoiceNumber: data.invoiceNumber.trim(),
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        amount: D(data.amount),
        currency: data.currency || order.currency,
        documentId: data.documentId || null,
        createdById: userId,
      },
    });

    // Rechnung ändert Bestellstatus NICHT — Status wird nur über Sendungen
    // (Unterwegs/Erledigt) oder User-Aktion (Bestellung aufgegeben/Storniert) gesteuert.

    await this.audit.log(orgId, userId, 'invoice', invoice.id, 'create', { invoice }, orderId);
    return invoice;
  }

  async removeInvoice(orgId: string, userId: string, invoiceId: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id: invoiceId, orgId } });
    if (!invoice) throw new NotFoundException('Rechnung nicht gefunden');
    await this.prisma.purchaseInvoice.delete({ where: { id: invoiceId } });
    await this.audit.log(orgId, userId, 'invoice', invoiceId, 'delete', { invoice }, invoice.purchaseOrderId || undefined);
    return { deleted: true };
  }
}
