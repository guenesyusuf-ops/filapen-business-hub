import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseAuditService } from './purchase-audit.service';
import { Prisma } from '@prisma/client';

export interface PaymentInput {
  paymentDate: string;
  amount: number;
  currency?: string;
  method?: 'bank_transfer' | 'credit_card' | 'paypal' | 'sepa_debit' | 'cash' | 'other';
  reference?: string | null;
  note?: string | null;
  receiptDocumentId?: string | null;
}

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: PurchaseOrderService,
    private readonly audit: PurchaseAuditService,
  ) {}

  async list(orgId: string, orderId: string) {
    return this.prisma.payment.findMany({
      where: { orgId, purchaseOrderId: orderId },
      orderBy: { paymentDate: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        receiptDocument: true,
      },
    });
  }

  async create(orgId: string, userId: string, orderId: string, data: PaymentInput): Promise<{ payment: any; warning?: string }> {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, orgId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (order.status === 'cancelled') throw new BadRequestException('Stornierte Bestellung kann keine Zahlung erhalten');
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestException('Zahlungsbetrag muss > 0 sein');
    }
    if (data.currency && !['EUR', 'USD'].includes(data.currency)) {
      throw new BadRequestException('Währung muss EUR oder USD sein');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orgId,
        purchaseOrderId: orderId,
        paymentDate: new Date(data.paymentDate),
        amount: D(data.amount),
        currency: data.currency || order.currency,
        method: data.method || 'bank_transfer',
        reference: data.reference?.trim() || null,
        note: data.note?.trim() || null,
        receiptDocumentId: data.receiptDocumentId || null,
        createdById: userId,
      },
    });

    await this.orderService.recalcPaymentTotals(orderId);
    await this.audit.log(orgId, userId, 'payment', payment.id, 'create', { payment }, orderId);

    // Re-read to get fresh paid totals & emit warning if overpaid
    const refreshed = await this.prisma.purchaseOrder.findUnique({ where: { id: orderId } });
    let warning: string | undefined;
    if (refreshed?.paymentStatus === 'overpaid') {
      warning = `Überzahlung — ${refreshed.paidAmount} ${refreshed.currency} bezahlt, Bestellsumme ${refreshed.totalAmount}`;
    }
    return { payment, warning };
  }

  async update(orgId: string, userId: string, paymentId: string, data: Partial<PaymentInput>) {
    const existing = await this.prisma.payment.findFirst({ where: { id: paymentId, orgId } });
    if (!existing) throw new NotFoundException('Zahlung nicht gefunden');
    if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount <= 0)) {
      throw new BadRequestException('Zahlungsbetrag muss > 0 sein');
    }

    const updates: any = {};
    if (data.amount !== undefined) updates.amount = D(data.amount);
    if (data.currency !== undefined) updates.currency = data.currency;
    if (data.paymentDate !== undefined) updates.paymentDate = new Date(data.paymentDate);
    if (data.method !== undefined) updates.method = data.method;
    if (data.reference !== undefined) updates.reference = data.reference?.trim() || null;
    if (data.note !== undefined) updates.note = data.note?.trim() || null;
    if (data.receiptDocumentId !== undefined) updates.receiptDocumentId = data.receiptDocumentId || null;

    const updated = await this.prisma.payment.update({ where: { id: paymentId }, data: updates });
    await this.orderService.recalcPaymentTotals(existing.purchaseOrderId);
    await this.audit.log(orgId, userId, 'payment', paymentId, 'update', { before: existing, after: updated }, existing.purchaseOrderId);
    return updated;
  }

  async remove(orgId: string, userId: string, paymentId: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id: paymentId, orgId } });
    if (!existing) throw new NotFoundException('Zahlung nicht gefunden');
    await this.prisma.payment.delete({ where: { id: paymentId } });
    await this.orderService.recalcPaymentTotals(existing.purchaseOrderId);
    await this.audit.log(orgId, userId, 'payment', paymentId, 'delete', { payment: existing }, existing.purchaseOrderId);
    return { deleted: true };
  }
}
