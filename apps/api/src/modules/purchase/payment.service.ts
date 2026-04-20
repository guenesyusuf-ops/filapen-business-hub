import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
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

const VALID_METHODS = new Set(['bank_transfer', 'credit_card', 'paypal', 'sepa_debit', 'cash', 'other']);

function toDecimal(n: any): Prisma.Decimal {
  if (n === null || n === undefined || n === '') {
    throw new BadRequestException('Betrag fehlt');
  }
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) {
    throw new BadRequestException('Betrag ist keine gültige Zahl');
  }
  return new Prisma.Decimal(num.toFixed(4));
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

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
    try {
      if (!data) throw new BadRequestException('Keine Daten');
      if (!data.paymentDate) throw new BadRequestException('Zahlungsdatum fehlt');

      const dateVal = new Date(data.paymentDate);
      if (isNaN(dateVal.getTime())) {
        throw new BadRequestException('Zahlungsdatum ist ungültig');
      }

      const amountNum = typeof data.amount === 'number' ? data.amount : Number(data.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new BadRequestException('Zahlungsbetrag muss > 0 sein');
      }

      if (data.currency && !['EUR', 'USD'].includes(data.currency)) {
        throw new BadRequestException('Währung muss EUR oder USD sein');
      }

      const method = data.method || 'bank_transfer';
      if (!VALID_METHODS.has(method)) {
        throw new BadRequestException(`Ungültige Zahlungsart: ${method}`);
      }

      const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, orgId } });
      if (!order) throw new NotFoundException('Bestellung nicht gefunden');
      if (order.status === 'cancelled') throw new BadRequestException('Stornierte Bestellung kann keine Zahlung erhalten');

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('Benutzer nicht gefunden');

      let receiptDocId: string | null = null;
      if (data.receiptDocumentId) {
        const doc = await this.prisma.purchaseDocument.findFirst({ where: { id: data.receiptDocumentId, orgId } });
        if (doc) receiptDocId = doc.id;
      }

      const payment = await this.prisma.payment.create({
        data: {
          orgId,
          purchaseOrderId: orderId,
          paymentDate: dateVal,
          amount: new Prisma.Decimal(amountNum.toFixed(2)),
          currency: data.currency || order.currency,
          method: method as any,
          reference: data.reference?.trim() || null,
          note: data.note?.trim() || null,
          receiptDocumentId: receiptDocId,
          createdById: userId,
        },
      });

      try {
        await this.orderService.recalcPaymentTotals(orderId);
      } catch (recalcErr: any) {
        this.logger.error(`recalcPaymentTotals failed for order ${orderId}: ${recalcErr?.message}`, recalcErr?.stack);
      }

      this.audit.log(orgId, userId, 'payment', payment.id, 'create', {
        amount: amountNum,
        currency: payment.currency,
        method: payment.method,
      }, orderId).catch(() => {});

      const refreshed = await this.prisma.purchaseOrder.findUnique({ where: { id: orderId } });
      let warning: string | undefined;
      if (refreshed?.paymentStatus === 'overpaid') {
        warning = `Überzahlung — ${refreshed.paidAmount} ${refreshed.currency} bezahlt, Bestellsumme ${refreshed.totalAmount}`;
      }

      return {
        payment: {
          ...payment,
          amount: payment.amount.toString(),
        },
        warning,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(
        `Payment create failed — order=${orderId} user=${userId} amount=${data?.amount}: ${err?.message}`,
        err?.stack,
      );
      throw new BadRequestException(`Zahlung konnte nicht gespeichert werden: ${err?.message || 'unbekannter Fehler'}`);
    }
  }

  async update(orgId: string, userId: string, paymentId: string, data: Partial<PaymentInput>) {
    try {
      const existing = await this.prisma.payment.findFirst({ where: { id: paymentId, orgId } });
      if (!existing) throw new NotFoundException('Zahlung nicht gefunden');
      if (data.amount !== undefined) {
        const num = Number(data.amount);
        if (!Number.isFinite(num) || num <= 0) throw new BadRequestException('Zahlungsbetrag muss > 0 sein');
      }

      const updates: any = {};
      if (data.amount !== undefined) updates.amount = toDecimal(data.amount);
      if (data.currency !== undefined) updates.currency = data.currency;
      if (data.paymentDate !== undefined) updates.paymentDate = new Date(data.paymentDate);
      if (data.method !== undefined) updates.method = data.method;
      if (data.reference !== undefined) updates.reference = data.reference?.trim() || null;
      if (data.note !== undefined) updates.note = data.note?.trim() || null;
      if (data.receiptDocumentId !== undefined) updates.receiptDocumentId = data.receiptDocumentId || null;

      const updated = await this.prisma.payment.update({ where: { id: paymentId }, data: updates });
      await this.orderService.recalcPaymentTotals(existing.purchaseOrderId);
      this.audit.log(orgId, userId, 'payment', paymentId, 'update', {}, existing.purchaseOrderId).catch(() => {});
      return { ...updated, amount: updated.amount.toString() };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      this.logger.error(`Payment update failed — id=${paymentId}: ${err?.message}`, err?.stack);
      throw new BadRequestException(`Zahlung konnte nicht aktualisiert werden: ${err?.message}`);
    }
  }

  async remove(orgId: string, userId: string, paymentId: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id: paymentId, orgId } });
    if (!existing) throw new NotFoundException('Zahlung nicht gefunden');
    await this.prisma.payment.delete({ where: { id: paymentId } });
    await this.orderService.recalcPaymentTotals(existing.purchaseOrderId);
    this.audit.log(orgId, userId, 'payment', paymentId, 'delete', {}, existing.purchaseOrderId).catch(() => {});
    return { deleted: true };
  }
}
