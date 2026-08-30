import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CashflowPayment {
  id: string;
  date: string;             // YYYY-MM-DD, paymentDate
  amount: string;           // Betrag der EINZELNEN Zahlung
  currency: string;
  orderId: string;
  orderNumber: string;
  supplierName: string;
  method: string;
  reference: string | null;
  note: string | null;
  productNames: string[];   // Item-Namen der zugehoerigen PurchaseOrder
}

export interface CashflowResponse {
  payments: CashflowPayment[];
  totalAmount: string;      // Summe aller Zahlungen im Zeitraum
  count: number;
}

/**
 * Cashflow-View fuer profit-analysis Uebersicht.
 *
 * Master's Regeln:
 *  - Nur Zahlungen mit paymentDate im gewaehlten Zeitraum (nicht Bestelldatum!)
 *  - Teilzahlungen einzeln listen, nicht kumuliert pro PurchaseOrder
 *  - Datum + Produkt(e) + Betrag pro Zeile
 */
@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayments(orgId: string, from: string, to: string): Promise<CashflowResponse> {
    // Datums-Guard — from/to sind YYYY-MM-DD Strings
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T23:59:59Z`);

    // Payments haengen an PurchaseOrders die zur Org gehoeren.
    // Filter: paymentDate im [from, to] Intervall.
    const payments = await this.prisma.payment.findMany({
      where: {
        orgId,
        paymentDate: { gte: fromDate, lte: toDate },
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            supplier: { select: { companyName: true } },
            items: {
              select: { productName: true, quantity: true, position: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    let sum = 0;
    const rows: CashflowPayment[] = payments.map((p) => {
      const amt = Number(p.amount);
      sum += amt;
      return {
        id: p.id,
        date: p.paymentDate.toISOString().slice(0, 10),
        amount: p.amount.toString(),
        currency: p.currency,
        orderId: p.purchaseOrder.id,
        orderNumber: p.purchaseOrder.orderNumber,
        supplierName: p.purchaseOrder.supplier?.companyName ?? '—',
        method: p.method,
        reference: p.reference,
        note: p.note,
        productNames: p.purchaseOrder.items.map((it) => it.productName),
      };
    });

    return {
      payments: rows,
      totalAmount: sum.toFixed(2),
      count: rows.length,
    };
  }
}
