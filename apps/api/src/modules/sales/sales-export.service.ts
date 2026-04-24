import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * CSV-Export aller Sales-Bestellungen in einem Zeitraum. Format: Semikolon-
 * getrennt (Excel-DE-Default) + UTF-8 BOM damit Umlaute in Excel nicht
 * zerschossen werden. Pflichtfelder plus viele Zusatzspalten die für
 * Buchhaltung und Controlling nützlich sind.
 */
@Injectable()
export class SalesExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportCsv(orgId: string, fromStr: string, toStr: string): Promise<string> {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('from/to müssen im Format YYYY-MM-DD sein');
    }
    // Inclusive end-of-day for `to`
    to.setHours(23, 59, 59, 999);

    const orders = await this.prisma.salesOrder.findMany({
      where: { orgId, createdAt: { gte: from, lte: to } },
      include: {
        customer: {
          select: {
            customerNumber: true, companyName: true, email: true,
            externalCustomerNumber: true, easybillCustomerNumber: true,
          },
        },
        lineItems: {
          select: {
            position: true, quantity: true, title: true,
            supplierArticleNumber: true, ean: true,
            unitPriceNet: true, lineNet: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Produkt-Kurzliste im Format "2× SKU-XYZ, 5× ABC"
    const fmtProducts = (items: any[]) =>
      items.map((li) => `${li.quantity}× ${li.supplierArticleNumber || li.title || '?'}`).join(' | ');

    const fmtDate = (d: Date | null) => d ? d.toISOString().slice(0, 10) : '';
    const fmtMoney = (n: any) => n != null ? String(Number(n).toFixed(2)).replace('.', ',') : '';

    const headers = [
      'Bestellnummer',             // VK-2026-00001
      'Externe Bestellnummer',     // Kunden-PO
      'Bestelldatum',
      'Erstellt am',
      'Liefertermin',
      'Kundennummer (intern)',
      'Kundennummer (easybill)',
      'Firma',
      'E-Mail',
      'Status',
      'Produkte',
      'Positionsanzahl',
      'Nettobetrag',
      'Währung',
      'AB versendet am',
      'Ware versendet am',
      'Rechnung versendet am',
      'Bezahlt am',
      'Tracking-Nummern',
      'Versand-Notiz',
      'Zahlungsbedingungen',
      'easybill AB-ID',
      'easybill Rechnungs-ID',
      'Notizen',
    ];

    const rows = orders.map((o) => [
      o.orderNumber,
      o.externalOrderNumber ?? '',
      fmtDate(o.orderDate),
      fmtDate(o.createdAt),
      fmtDate(o.requiredDeliveryDate),
      o.customer.customerNumber,
      o.customer.easybillCustomerNumber ?? '',
      o.customer.companyName,
      o.customer.email ?? '',
      o.status,
      fmtProducts(o.lineItems),
      String(o.lineItems.length),
      fmtMoney(o.totalNet),
      o.currency,
      fmtDate(o.confirmationSentAt),
      fmtDate(o.shippedAt),
      fmtDate(o.invoiceSentAt),
      fmtDate(o.paidAt),
      (o.trackingNumbers ?? []).join(' '),
      o.shippingCarrierNote ?? '',
      o.paymentTerms ?? '',
      o.easybillConfirmationId ?? '',
      o.easybillInvoiceId ?? '',
      (o.notes ?? '').replace(/\s+/g, ' ').slice(0, 500),
    ]);

    // Nettosumme am Ende als Zeile damit die Gesamtsumme direkt sichtbar ist
    const totalNet = orders.reduce((s, o) => s + Number(o.totalNet), 0);
    const summary = [
      '', '', '', '', '', '', '', '', '', '', '', 'SUMME', fmtMoney(totalNet),
      '', '', '', '', '', '', '', '', '', '', '',
    ];

    const csvEscape = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(';') || s.includes('\n') || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const body = [headers, ...rows, summary]
      .map((row) => row.map(csvEscape).join(';'))
      .join('\r\n');

    // UTF-8 BOM → Excel interpretiert die Datei korrekt als UTF-8
    return '\uFEFF' + body;
  }
}
