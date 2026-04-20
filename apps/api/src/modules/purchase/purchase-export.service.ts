import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ExportType = 'master' | 'items' | 'payments' | 'invoices' | 'open' | 'tax' | 'datev';
type Skr = 'SKR03' | 'SKR04';

interface ExportFilters {
  from?: string;
  to?: string;
  supplierId?: string;
  status?: string;
  paymentStatus?: string;
  skr?: Skr;
}

const BOM = '\uFEFF'; // UTF-8 BOM for Excel
const SEP = ';';

function escapeCsv(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(values: any[]): string {
  return values.map(escapeCsv).join(SEP);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function fmtDateIso(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function fmtDecimal(n: any): string {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'object' && 'toString' in n ? Number(n.toString()) : Number(n);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

function fmtBool(b: boolean): string {
  return b ? 'ja' : 'nein';
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'offen',
  partially_paid: 'teilweise_bezahlt',
  paid: 'vollständig_bezahlt',
  overpaid: 'überzahlt',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Überweisung',
  credit_card: 'Kreditkarte',
  paypal: 'PayPal',
  sepa_debit: 'SEPA-Lastschrift',
  cash: 'Bar',
  other: 'Sonstiges',
};

// SKR03 mapping (vereinfachter Vorschlag — Steuerberater kann anpassen)
const SKR03_ACCOUNTS: Record<number, string> = {
  19: '3400', // Wareneingang 19% VorSt
  7: '3300',  // Wareneingang 7% VorSt
  0: '3200',  // Wareneingang ohne VorSt
};
const SKR04_ACCOUNTS: Record<number, string> = {
  19: '5400',
  7: '5300',
  0: '5200',
};

@Injectable()
export class PurchaseExportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildOrderWhere(orgId: string, f: ExportFilters): any {
    const where: any = { orgId };
    if (f.supplierId) where.supplierId = f.supplierId;
    if (f.status) where.status = f.status;
    if (f.paymentStatus) where.paymentStatus = f.paymentStatus;
    if (f.from || f.to) {
      where.orderDate = {};
      if (f.from) where.orderDate.gte = new Date(f.from);
      if (f.to) where.orderDate.lte = new Date(f.to);
    }
    return where;
  }

  async build(orgId: string, type: ExportType, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    switch (type) {
      case 'master': return this.buildMaster(orgId, filters);
      case 'items': return this.buildItems(orgId, filters);
      case 'payments': return this.buildPayments(orgId, filters);
      case 'invoices': return this.buildInvoices(orgId, filters);
      case 'open': return this.buildOpen(orgId, filters);
      case 'tax': return this.buildTax(orgId, filters);
      case 'datev': return this.buildDatev(orgId, filters);
      default: return this.buildTax(orgId, filters);
    }
  }

  // -------- MASTER (eine Zeile pro Bestellung) --------
  private async buildMaster(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: this.buildOrderWhere(orgId, filters),
      orderBy: { orderDate: 'desc' },
      include: {
        supplier: true,
        createdBy: { select: { name: true, email: true } },
        invoices: { orderBy: { invoiceDate: 'asc' } },
        payments: { orderBy: { paymentDate: 'asc' } },
        documents: { select: { id: true, fileName: true, documentType: true } },
        items: { select: { productName: true, sku: true, quantity: true } },
      },
    });

    const header = [
      'Bestellnummer', 'Bestelldatum', 'Bestelldatum_ISO',
      'Rechnungsnummer', 'Rechnungsdatum', 'Rechnungsdatum_ISO', 'Faelligkeitsdatum', 'Faelligkeitsdatum_ISO',
      'Lieferantennummer', 'Lieferantenname', 'USt-ID_Lieferant', 'Steuernummer_Lieferant',
      'Ansprechpartner', 'EMail_Lieferant', 'Land',
      'Kaeufer', 'Kaeufer_EMail',
      'Nettobetrag', 'Steuerbetrag', 'Bruttobetrag', 'Versandkosten', 'Zollkosten', 'Waehrung', 'Wechselkurs',
      'Bereits_bezahlt', 'Offene_Summe',
      'Zahlungsstatus', 'Anzahl_Zahlungen',
      'Datum_erste_Zahlung', 'Datum_letzte_Zahlung', 'Zahlungsarten',
      'Bestellstatus', 'Wareneingang_am',
      'Dokument_vorhanden', 'Anzahl_Dokumente', 'Rechnungs_Dateiname',
      'Anzahl_Positionen', 'Notiz',
      'Angelegt_am', 'Geaendert_am',
    ];

    const lines = [BOM + toRow(header)];

    for (const o of orders) {
      const inv = o.invoices[0];
      const firstPay = o.payments[0];
      const lastPay = o.payments[o.payments.length - 1];
      const paymentMethods = [...new Set(o.payments.map(p => PAYMENT_METHOD_LABEL[p.method] || p.method))].join(', ');
      const invoiceDoc = o.documents.find(d => d.documentType === 'invoice');

      lines.push(toRow([
        o.orderNumber, fmtDate(o.orderDate), fmtDateIso(o.orderDate),
        inv?.invoiceNumber || '', fmtDate(inv?.invoiceDate), fmtDateIso(inv?.invoiceDate),
        fmtDate(inv?.dueDate), fmtDateIso(inv?.dueDate),
        o.supplier.supplierNumber, o.supplier.companyName, o.supplier.vatId || '', o.supplier.taxNumber || '',
        o.supplier.contactName, o.supplier.email, o.supplier.country || '',
        o.createdBy.name || '', o.createdBy.email,
        fmtDecimal(o.subtotal), fmtDecimal(o.taxTotal), fmtDecimal(o.totalAmount),
        fmtDecimal(o.shippingCost), fmtDecimal(o.customsCost),
        o.currency, fmtDecimal(o.exchangeRate),
        fmtDecimal(o.paidAmount), fmtDecimal(o.openAmount),
        PAYMENT_STATUS_LABEL[o.paymentStatus] || o.paymentStatus, o.payments.length,
        fmtDate(firstPay?.paymentDate), fmtDate(lastPay?.paymentDate), paymentMethods,
        o.status, fmtDate(o.receivedAt),
        fmtBool(o.documents.length > 0), o.documents.length, invoiceDoc?.fileName || '',
        o.items.length, o.notes || '',
        fmtDate(o.createdAt), fmtDate(o.updatedAt),
      ]));
    }

    return {
      filename: `bestellungen_master_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- ITEMS (eine Zeile pro Position) --------
  private async buildItems(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: this.buildOrderWhere(orgId, filters),
      orderBy: { orderDate: 'desc' },
      include: {
        supplier: { select: { supplierNumber: true, companyName: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });

    const header = [
      'Bestellnummer', 'Bestelldatum', 'Position',
      'Lieferantennummer', 'Lieferantenname',
      'Produktname', 'SKU', 'Menge', 'Einzelpreis_netto', 'Steuersatz_Prozent',
      'Positionssumme_netto', 'Positionssteuer', 'Positionssumme_brutto', 'Waehrung',
    ];
    const lines = [BOM + toRow(header)];

    for (const o of orders) {
      o.items.forEach((it, idx) => {
        lines.push(toRow([
          o.orderNumber, fmtDate(o.orderDate), idx + 1,
          o.supplier.supplierNumber, o.supplier.companyName,
          it.productName, it.sku || '', fmtDecimal(it.quantity), fmtDecimal(it.unitPrice),
          fmtDecimal(it.vatRate),
          fmtDecimal(it.lineSubtotal), fmtDecimal(it.lineTax), fmtDecimal(it.lineTotal),
          o.currency,
        ]));
      });
    }
    return {
      filename: `bestellpositionen_detail_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- PAYMENTS (eine Zeile pro Zahlung) --------
  private async buildPayments(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const where: any = { orgId };
    if (filters.from || filters.to) {
      where.paymentDate = {};
      if (filters.from) where.paymentDate.gte = new Date(filters.from);
      if (filters.to) where.paymentDate.lte = new Date(filters.to);
    }
    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        purchaseOrder: {
          include: {
            supplier: { select: { supplierNumber: true, companyName: true } },
            invoices: { take: 1, orderBy: { invoiceDate: 'asc' } },
          },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    const header = [
      'Zahlungs_ID', 'Zahlungsdatum', 'Zahlungsdatum_ISO',
      'Bestellnummer', 'Rechnungsnummer',
      'Lieferantennummer', 'Lieferantenname',
      'Betrag', 'Waehrung', 'Zahlungsart', 'Referenz', 'Notiz',
      'Erfasst_von', 'Erfasst_am',
    ];
    const lines = [BOM + toRow(header)];

    for (const p of payments) {
      const inv = p.purchaseOrder.invoices[0];
      lines.push(toRow([
        p.id, fmtDate(p.paymentDate), fmtDateIso(p.paymentDate),
        p.purchaseOrder.orderNumber, inv?.invoiceNumber || '',
        p.purchaseOrder.supplier.supplierNumber, p.purchaseOrder.supplier.companyName,
        fmtDecimal(p.amount), p.currency, PAYMENT_METHOD_LABEL[p.method] || p.method,
        p.reference || '', p.note || '',
        p.createdBy.name || p.createdBy.email, fmtDate(p.createdAt),
      ]));
    }
    return {
      filename: `zahlungen_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- INVOICES --------
  private async buildInvoices(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const where: any = { orgId };
    if (filters.from || filters.to) {
      where.invoiceDate = {};
      if (filters.from) where.invoiceDate.gte = new Date(filters.from);
      if (filters.to) where.invoiceDate.lte = new Date(filters.to);
    }
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: {
        purchaseOrder: {
          include: { supplier: { select: { supplierNumber: true, companyName: true, vatId: true } } },
        },
        document: { select: { fileName: true } },
      },
    });

    const header = [
      'Rechnungsnummer', 'Rechnungsdatum', 'Faelligkeitsdatum',
      'Bestellnummer', 'Lieferantennummer', 'Lieferantenname', 'USt-ID',
      'Betrag', 'Waehrung', 'Datei',
    ];
    const lines = [BOM + toRow(header)];
    for (const i of invoices) {
      lines.push(toRow([
        i.invoiceNumber, fmtDate(i.invoiceDate), fmtDate(i.dueDate),
        i.purchaseOrder?.orderNumber || '',
        i.purchaseOrder?.supplier.supplierNumber || '',
        i.purchaseOrder?.supplier.companyName || '',
        i.purchaseOrder?.supplier.vatId || '',
        fmtDecimal(i.amount), i.currency, i.document?.fileName || '',
      ]));
    }
    return {
      filename: `rechnungen_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- OPEN ITEMS (offene Posten) --------
  private async buildOpen(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        ...this.buildOrderWhere(orgId, filters),
        paymentStatus: { in: ['unpaid', 'partially_paid'] },
        status: { not: 'cancelled' },
      },
      orderBy: { orderDate: 'asc' },
      include: {
        supplier: true,
        invoices: { take: 1, orderBy: { invoiceDate: 'asc' } },
      },
    });

    const today = new Date();
    const header = [
      'Bestellnummer', 'Bestelldatum',
      'Rechnungsnummer', 'Rechnungsdatum', 'Faelligkeitsdatum', 'Tage_ueberfaellig',
      'Lieferantennummer', 'Lieferantenname', 'EMail',
      'Bruttobetrag', 'Bezahlt', 'Offen', 'Waehrung', 'Status',
    ];
    const lines = [BOM + toRow(header)];
    for (const o of orders) {
      const inv = o.invoices[0];
      let overdueDays = '';
      if (inv?.dueDate) {
        const diff = Math.floor((today.getTime() - inv.dueDate.getTime()) / 86400000);
        overdueDays = diff > 0 ? String(diff) : '0';
      }
      lines.push(toRow([
        o.orderNumber, fmtDate(o.orderDate),
        inv?.invoiceNumber || '', fmtDate(inv?.invoiceDate), fmtDate(inv?.dueDate), overdueDays,
        o.supplier.supplierNumber, o.supplier.companyName, o.supplier.email,
        fmtDecimal(o.totalAmount), fmtDecimal(o.paidAmount), fmtDecimal(o.openAmount),
        o.currency, PAYMENT_STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
      ]));
    }
    return {
      filename: `offene_posten_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- TAX (Steuerberater-Vollexport: Master + DATEV-Konto) --------
  private async buildTax(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const skr: Skr = filters.skr || 'SKR03';
    const accountMap = skr === 'SKR04' ? SKR04_ACCOUNTS : SKR03_ACCOUNTS;

    const orders = await this.prisma.purchaseOrder.findMany({
      where: this.buildOrderWhere(orgId, filters),
      orderBy: { orderDate: 'desc' },
      include: {
        supplier: true,
        createdBy: { select: { name: true, email: true } },
        invoices: { orderBy: { invoiceDate: 'asc' } },
        payments: { orderBy: { paymentDate: 'asc' } },
        documents: true,
        items: true,
      },
    });

    // Build a "tax-ready" row with every column a tax accountant might need
    const header = [
      'Bestellnummer', 'Bestelldatum_DE', 'Bestelldatum_ISO',
      'Rechnungsnummer', 'Rechnungsdatum_DE', 'Rechnungsdatum_ISO', 'Faelligkeitsdatum_DE', 'Faelligkeitsdatum_ISO',
      'Lieferantennummer', 'Lieferantenname', 'USt-ID', 'Steuernummer',
      'Strasse', 'PLZ', 'Ort', 'Land',
      'Ansprechpartner', 'EMail',
      'IBAN', 'BIC', 'Bank',
      'Kaeufer', 'Kaeufer_EMail',
      'Nettobetrag', 'Steuerbetrag', 'Bruttobetrag',
      'Versandkosten', 'Zollkosten',
      'Waehrung', 'Wechselkurs', 'Bruttobetrag_EUR',
      'Bereits_bezahlt', 'Offene_Summe', 'Zahlungsstatus',
      'Anzahl_Zahlungen', 'Erste_Zahlung', 'Letzte_Zahlung', 'Zahlungsarten',
      'Bestellstatus', 'Wareneingang',
      'Dokument_vorhanden', 'Rechnungs_Datei',
      `Konto_${skr}`,
      'Anzahl_Positionen', 'Notiz',
      'Angelegt_am', 'Geaendert_am',
    ];

    const lines = [BOM + toRow(header)];
    for (const o of orders) {
      const inv = o.invoices[0];
      const firstPay = o.payments[0];
      const lastPay = o.payments[o.payments.length - 1];
      const paymentMethods = [...new Set(o.payments.map(p => PAYMENT_METHOD_LABEL[p.method] || p.method))].join(', ');
      const invoiceDoc = o.documents.find(d => d.documentType === 'invoice');

      // Dominant VAT rate determines suggested account
      const vatCounts: Record<string, number> = {};
      for (const it of o.items) {
        const r = Number(it.vatRate);
        vatCounts[r] = (vatCounts[r] || 0) + 1;
      }
      const dominantVat = Object.entries(vatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '19';
      const account = accountMap[Number(dominantVat)] || accountMap[19];

      const exchangeRate = o.exchangeRate ? Number(o.exchangeRate.toString()) : (o.currency === 'EUR' ? 1 : 0);
      const totalEur = o.currency === 'EUR'
        ? Number(o.totalAmount.toString())
        : (exchangeRate > 0 ? Number(o.totalAmount.toString()) * exchangeRate : 0);

      lines.push(toRow([
        o.orderNumber, fmtDate(o.orderDate), fmtDateIso(o.orderDate),
        inv?.invoiceNumber || '', fmtDate(inv?.invoiceDate), fmtDateIso(inv?.invoiceDate),
        fmtDate(inv?.dueDate), fmtDateIso(inv?.dueDate),
        o.supplier.supplierNumber, o.supplier.companyName, o.supplier.vatId || '', o.supplier.taxNumber || '',
        o.supplier.street || '', o.supplier.zipCode || '', o.supplier.city || '', o.supplier.country || '',
        o.supplier.contactName, o.supplier.email,
        o.supplier.iban || '', o.supplier.bic || '', o.supplier.bankName || '',
        o.createdBy.name || '', o.createdBy.email,
        fmtDecimal(o.subtotal), fmtDecimal(o.taxTotal), fmtDecimal(o.totalAmount),
        fmtDecimal(o.shippingCost), fmtDecimal(o.customsCost),
        o.currency, fmtDecimal(o.exchangeRate),
        totalEur > 0 ? fmtDecimal(totalEur) : '',
        fmtDecimal(o.paidAmount), fmtDecimal(o.openAmount),
        PAYMENT_STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
        o.payments.length, fmtDate(firstPay?.paymentDate), fmtDate(lastPay?.paymentDate), paymentMethods,
        o.status, fmtDate(o.receivedAt),
        fmtBool(o.documents.length > 0), invoiceDoc?.fileName || '',
        account,
        o.items.length, o.notes || '',
        fmtDate(o.createdAt), fmtDate(o.updatedAt),
      ]));
    }

    return {
      filename: `steuerberater_export_${skr}_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  // -------- DATEV (vereinfachtes DATEV-CSV — Buchungsstapel) --------
  private async buildDatev(orgId: string, filters: ExportFilters): Promise<{ filename: string; csv: string }> {
    const skr: Skr = filters.skr || 'SKR03';
    const accountMap = skr === 'SKR04' ? SKR04_ACCOUNTS : SKR03_ACCOUNTS;
    // Kreditoren-Konto Range: SKR03 70000-99999, SKR04 ähnlich
    const creditorBase = skr === 'SKR03' ? 70000 : 70000;

    const where = this.buildOrderWhere(orgId, filters);
    where.invoices = { some: {} }; // only orders with invoices
    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      orderBy: { orderDate: 'asc' },
      include: {
        supplier: true,
        invoices: { orderBy: { invoiceDate: 'asc' } },
        items: true,
      },
    });

    // Vereinfachter DATEV CSV — Standard-Felder (nicht Format 700, sondern lesbar für die meisten Buchhaltungssysteme)
    const header = [
      'Umsatz', 'Soll/Haben', 'WKZ_Umsatz', 'Kurs',
      'Konto', 'Gegenkonto', 'BU-Schluessel',
      'Belegdatum', 'Belegfeld_1', 'Belegfeld_2',
      'Buchungstext', 'USt_Prozent',
    ];
    const lines = [BOM + toRow(header)];

    for (const o of orders) {
      const inv = o.invoices[0];
      if (!inv) continue;
      // Dominant VAT
      const vatCounts: Record<string, number> = {};
      for (const it of o.items) {
        const r = Number(it.vatRate);
        vatCounts[r] = (vatCounts[r] || 0) + 1;
      }
      const dominantVat = Number(Object.entries(vatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '19');
      const account = accountMap[dominantVat] || accountMap[19];
      // Creditor account — derive from supplier number ("LIEF-0007" → 70007)
      const supplierMatch = o.supplier.supplierNumber.match(/(\d+)$/);
      const supplierIdx = supplierMatch ? parseInt(supplierMatch[1], 10) : 1;
      const creditor = creditorBase + supplierIdx;

      lines.push(toRow([
        fmtDecimal(inv.amount), 'S', inv.currency, fmtDecimal(o.exchangeRate || 1),
        account, creditor, dominantVat === 19 ? '9' : dominantVat === 7 ? '8' : '0',
        fmtDate(inv.invoiceDate), inv.invoiceNumber, o.orderNumber,
        `Rechnung ${inv.invoiceNumber} ${o.supplier.companyName}`, dominantVat,
      ]));
    }

    return {
      filename: `datev_export_${skr}_${this.dateStamp()}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  private dateStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
