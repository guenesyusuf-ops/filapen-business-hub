import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesDocumentService } from './sales-document.service';

/**
 * Minimal wrapper around the easybill REST API (https://api.easybill.de/rest/v1).
 * We only use endpoints relevant to turning a SalesOrder into a confirmation
 * (Auftragsbestätigung = document type "OFFER") or an invoice, and pulling the
 * generated PDF back into R2 so it survives an easybill outage.
 *
 * API key is stored in Organization.settings.easybillApiKey (simple encrypted
 * field reuse — same shape as integration credentials elsewhere). For now we
 * read it from Env as a fallback so tests/setup work before settings UI lands.
 */
@Injectable()
export class EasybillService {
  private readonly logger = new Logger(EasybillService.name);
  private readonly baseUrl = 'https://api.easybill.de/rest/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly documents: SalesDocumentService,
  ) {}

  private async apiKey(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const keyFromOrg = (org?.settings as any)?.easybillApiKey;
    const keyFromEnv = this.config.get<string>('EASYBILL_API_KEY');
    const key = keyFromOrg || keyFromEnv;
    if (!key) throw new BadRequestException('easybill API-Key nicht konfiguriert (Settings → Integrationen).');
    return key;
  }

  private async call<T = any>(
    orgId: string,
    path: string,
    init: { method?: string; body?: any; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const key = await this.apiKey(orgId);
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(init.headers || {}),
      },
      body: init.body == null
        ? undefined
        : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`easybill ${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
      throw new BadRequestException(`easybill (${res.status}): ${text.slice(0, 300)}`);
    }
    try { return text ? JSON.parse(text) : ({} as T); } catch { return text as any; }
  }

  async testConnection(orgId: string): Promise<{ ok: true; sample?: any }> {
    const res = await this.call(orgId, '/customers?limit=1');
    return { ok: true, sample: res };
  }

  /**
   * Ensure an easybill customer exists for this SalesCustomer. We keep the
   * easybill ID on the customer so subsequent AB/Invoice creations reuse it.
   */
  private async upsertCustomer(orgId: string, customerId: string): Promise<string> {
    const c = await this.prisma.salesCustomer.findFirst({ where: { id: customerId, orgId } });
    if (!c) throw new BadRequestException('Kunde nicht gefunden');
    if (c.easybillCustomerId) return c.easybillCustomerId;

    const shipAddr = (c.shippingAddress as any) || {};
    const billAddr = (c.billingAddress as any) || shipAddr;
    const created = await this.call<any>(orgId, '/customers', {
      method: 'POST',
      body: {
        company_name: c.companyName,
        first_name: c.contactPerson ? c.contactPerson.split(' ')[0] : null,
        last_name: c.contactPerson ? c.contactPerson.split(' ').slice(1).join(' ') || null : null,
        emails: c.email ? [c.email] : [],
        phone_1: c.phone || null,
        // easybill expects billing address top-level; shipping as separate fields
        street: [billAddr.address1, billAddr.houseNumber].filter(Boolean).join(' ') || null,
        zip_code: billAddr.zip || null,
        city: billAddr.city || null,
        country: billAddr.country || 'DE',
        shipping_address: shipAddr.address1 ? {
          company_name: shipAddr.company || c.companyName,
          street: [shipAddr.address1, shipAddr.houseNumber].filter(Boolean).join(' '),
          zip_code: shipAddr.zip || '',
          city: shipAddr.city || '',
          country: shipAddr.country || 'DE',
        } : null,
        note: c.notes || undefined,
        personal: { salutation: 0, title: null },
      },
    });
    const easybillId = String(created.id);
    await this.prisma.salesCustomer.update({
      where: { id: customerId },
      data: { easybillCustomerId: easybillId },
    });
    return easybillId;
  }

  private orderPayload(order: any, easybillCustomerId: string) {
    const items = (order.lineItems ?? []).map((li: any) => ({
      description: li.title,
      number: li.supplierArticleNumber || undefined,
      quantity: li.quantity,
      single_price_net: Number(li.unitPriceNet),
      // 19% as default — allow overriding later via product mapping
      vat_percent: 19,
      unit: 'Stk.',
    }));
    return {
      customer_id: Number(easybillCustomerId),
      title: `Auftragsbestätigung ${order.orderNumber}`,
      document_date: new Date().toISOString().slice(0, 10),
      service_date_type: 'NONE',
      items,
      text: order.notes || undefined,
      external_id: order.orderNumber,
    };
  }

  /**
   * Create an Auftragsbestätigung (easybill document type "OFFER") from the
   * SalesOrder, download the generated PDF, attach it as SalesOrderDocument,
   * and store the easybill ref on the order.
   */
  async createConfirmation(orgId: string, userId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, orgId },
      include: { customer: true, lineItems: { orderBy: { position: 'asc' } } },
    });
    if (!order) throw new BadRequestException('Bestellung nicht gefunden');
    if (order.easybillConfirmationId) {
      throw new BadRequestException('Auftragsbestätigung existiert bereits — Rechnung wäre der nächste Schritt.');
    }
    const easybillCustomerId = await this.upsertCustomer(orgId, order.customerId);
    const body = { ...this.orderPayload(order, easybillCustomerId), type: 'OFFER' };
    const doc = await this.call<any>(orgId, '/documents', { method: 'POST', body });
    const docId = String(doc.id);

    // Pull PDF
    const pdfBuffer = await this.downloadPdf(orgId, docId);
    const attached = await this.documents.attachBuffer(
      orgId, userId, orderId, pdfBuffer,
      `auftragsbestaetigung-${order.orderNumber}.pdf`,
      'application/pdf', 'confirmation',
    );

    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        easybillConfirmationId: docId,
        easybillConfirmationPdfUrl: attached.url,
        events: { create: { orgId, type: 'note', actorId: userId, note: `easybill AB erstellt (${docId})` } },
      },
    });
    return { easybillId: docId, pdfUrl: attached.url };
  }

  async sendConfirmation(orgId: string, userId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, orgId } });
    if (!order?.easybillConfirmationId) {
      throw new BadRequestException('Keine Auftragsbestätigung vorhanden — erst erstellen.');
    }
    await this.call(orgId, `/documents/${order.easybillConfirmationId}/send`, { method: 'POST', body: {} });
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        confirmationSentAt: new Date(),
        status: order.status === 'draft' ? 'confirmed' : order.status,
        events: { create: { orgId, type: 'confirmation_sent', actorId: userId, note: 'easybill E-Mail versendet' } },
      },
    });
    return { ok: true };
  }

  async createInvoice(orgId: string, userId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, orgId },
      include: { customer: true, lineItems: { orderBy: { position: 'asc' } } },
    });
    if (!order) throw new BadRequestException('Bestellung nicht gefunden');
    if (order.easybillInvoiceId) {
      throw new BadRequestException('Rechnung existiert bereits.');
    }
    const easybillCustomerId = await this.upsertCustomer(orgId, order.customerId);
    const body = { ...this.orderPayload(order, easybillCustomerId), type: 'INVOICE', title: `Rechnung ${order.orderNumber}` };
    const doc = await this.call<any>(orgId, '/documents', { method: 'POST', body });
    const docId = String(doc.id);

    const pdfBuffer = await this.downloadPdf(orgId, docId);
    const attached = await this.documents.attachBuffer(
      orgId, userId, orderId, pdfBuffer,
      `rechnung-${order.orderNumber}.pdf`,
      'application/pdf', 'invoice',
    );

    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        easybillInvoiceId: docId,
        easybillInvoicePdfUrl: attached.url,
        events: { create: { orgId, type: 'note', actorId: userId, note: `easybill Rechnung erstellt (${docId})` } },
      },
    });
    return { easybillId: docId, pdfUrl: attached.url };
  }

  async sendInvoice(orgId: string, userId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: orderId, orgId } });
    if (!order?.easybillInvoiceId) {
      throw new BadRequestException('Keine Rechnung vorhanden — erst erstellen.');
    }
    await this.call(orgId, `/documents/${order.easybillInvoiceId}/send`, { method: 'POST', body: {} });
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        invoiceSentAt: new Date(),
        status: order.shippedAt ? 'completed' : 'invoiced',
        events: { create: { orgId, type: 'invoice_sent', actorId: userId, note: 'easybill Rechnungs-E-Mail versendet' } },
      },
    });
    return { ok: true };
  }

  private async downloadPdf(orgId: string, documentId: string): Promise<Buffer> {
    const key = await this.apiKey(orgId);
    const res = await fetch(`${this.baseUrl}/documents/${documentId}/pdf`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/pdf' },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new BadRequestException(`easybill PDF-Download (${res.status}): ${t.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
