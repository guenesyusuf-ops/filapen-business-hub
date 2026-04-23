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
   * Diagnostic: return the last few documents from easybill grouped by their
   * type value. Lets us see what `type` enum strings easybill actually uses
   * in THIS account (so we know which value to send for Auftragsbestätigung).
   */
  async listDocumentTypes(orgId: string): Promise<{ items: Array<{ id: any; type: any; number: any; title: any }>; typesFound: string[] }> {
    const res = await this.call<any>(orgId, '/documents?limit=20');
    const list: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    const items = list.map((d: any) => ({ id: d.id, type: d.type, number: d.number, title: d.title }));
    const typesFound = Array.from(new Set(items.map((i) => String(i.type)).filter(Boolean)));
    return { items, typesFound };
  }

  /**
   * Ensure an easybill customer exists for this SalesCustomer. Three paths:
   *   1. We already know the easybill API ID → return it.
   *   2. The user entered an easybill-Kundennummer (10191 etc.) → look it up
   *      via GET /customers?number=… and persist the API ID. Never create.
   *   3. Neither → create a new customer. If easybillCustomerNumber is set
   *      we pass it as `number` so easybill uses that display number.
   */
  private async upsertCustomer(orgId: string, customerId: string): Promise<string> {
    const c = await this.prisma.salesCustomer.findFirst({ where: { id: customerId, orgId } });
    if (!c) throw new BadRequestException('Kunde nicht gefunden');

    // Path 1 (highest priority) — user-entered easybill number ALWAYS wins.
    // Overrides any stale easybillCustomerId that got auto-saved during an
    // earlier attempt where the number wasn't set yet.
    if (c.easybillCustomerNumber) {
      const found = await this.findCustomerByNumber(orgId, c.easybillCustomerNumber);
      if (found) {
        if (found !== c.easybillCustomerId) {
          await this.prisma.salesCustomer.update({
            where: { id: customerId },
            data: { easybillCustomerId: found },
          });
          this.logger.log(`Relinked customer ${customerId} to easybill ID ${found} (number ${c.easybillCustomerNumber})`);
        }
        return found;
      }
      throw new BadRequestException(
        `Kein easybill-Kunde mit Nummer ${c.easybillCustomerNumber} gefunden. Prüfe die Nummer oder lass das Feld leer, dann legen wir einen neuen Kunden an.`,
      );
    }

    // Path 2 — no user-entered number, reuse previously created ID if any.
    if (c.easybillCustomerId) return c.easybillCustomerId;

    // Path 3 — create fresh
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
        // easybill expects billing address top-level + 2-letter ISO country code
        street: [billAddr.address1, billAddr.houseNumber].filter(Boolean).join(' ') || null,
        zip_code: billAddr.zip || null,
        city: billAddr.city || null,
        country: normalizeCountry(billAddr.country),
        shipping_address: shipAddr.address1 ? {
          company_name: shipAddr.company || c.companyName,
          street: [shipAddr.address1, shipAddr.houseNumber].filter(Boolean).join(' '),
          zip_code: shipAddr.zip || '',
          city: shipAddr.city || '',
          country: normalizeCountry(shipAddr.country),
        } : null,
        note: c.notes || undefined,
        personal: { salutation: 0, title: null },
      },
    });
    const easybillId = String(created.id);
    const easybillNum = created.number ? String(created.number) : c.easybillCustomerNumber;
    await this.prisma.salesCustomer.update({
      where: { id: customerId },
      data: {
        easybillCustomerId: easybillId,
        easybillCustomerNumber: easybillNum,
      },
    });
    return easybillId;
  }

  /**
   * Find an easybill customer by their visible customer number (the one shown
   * on documents like "Kunde 10191"). Uses the search query parameter. Returns
   * the internal API ID as string, or null if no match.
   */
  private async findCustomerByNumber(orgId: string, number: string): Promise<string | null> {
    const res = await this.call<any>(orgId, `/customers?number=${encodeURIComponent(number)}&limit=1`);
    const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    const match = list.find((x: any) => String(x.number) === String(number)) ?? list[0];
    return match?.id ? String(match.id) : null;
  }

  private orderPayload(order: any, easybillCustomerId: string, type: 'ORDER_CONFIRMATION' | 'INVOICE') {
    // EMPIRISCHER FIX: easybill interpretiert `single_price_net` offensichtlich
    // als Cent-Integer und NICHT als EUR-Float (12.06 in → 0.1206 €). Wir
    // multiplizieren daher × 100 und runden auf Integer.
    const toPrice = (v: any) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 100);
    };
    const items = (order.lineItems ?? []).map((li: any) => ({
      description: li.title,
      number: li.supplierArticleNumber || undefined,
      quantity: Number(li.quantity),
      single_price_net: toPrice(li.unitPriceNet),
      // 19% as default — allow overriding later via product mapping
      vat_percent: 19,
      unit: 'Stk.',
    }));
    // console.error bypasses Nest's LOG filter and Railway's 500/sec limit dropping
    // our debug lines when Redis spam is active.
    console.error('[easybill] payload items:', JSON.stringify(items.map((i: any) => ({
      q: i.quantity, p: i.single_price_net, t: i.description.slice(0, 30),
    }))));

    // Intro paragraph (Kopftext) — uses customer order date + their order number
    // so the AB reads exactly like the user's manual template.
    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('de-DE') : '';
    const orderDateStr = fmt(order.orderDate);
    const externalNum = order.externalOrderNumber || '';
    const introText = externalNum && orderDateStr
      ? `Sehr geehrte Damen und Herren,\n\ngemäß Ihrer Bestellung vom ${orderDateStr} mit der Bestellnummer ${externalNum} erbringen wir im einzelnen folgende Leistungen.`
      : `Sehr geehrte Damen und Herren,\n\ngemäß Ihrer Bestellung erbringen wir im einzelnen folgende Leistungen.`;

    // Footer (Schlusstext) — planned delivery date. User template always has it.
    const deliveryStr = fmt(order.requiredDeliveryDate);
    const footerText = deliveryStr ? `Geplanter Liefertermin: ${deliveryStr}` : undefined;

    return {
      type,
      customer_id: Number(easybillCustomerId),
      // Let easybill auto-number the document — we store only our internal ref
      document_date: new Date().toISOString().slice(0, 10),
      service_date_type: 'NONE',
      items,
      text: introText,
      text_additional: footerText,
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
    const body = this.orderPayload(order, easybillCustomerId, 'ORDER_CONFIRMATION');
    console.error('[easybill] REQUEST AB:', JSON.stringify(body));
    const doc = await this.call<any>(orgId, '/documents', { method: 'POST', body });
    const docId = String(doc.id);
    console.error('[easybill] RESPONSE AB:', JSON.stringify({
      id: docId, type: doc.type, number: doc.number, items: doc.items,
    }));
    if (doc.type !== 'ORDER_CONFIRMATION') {
      console.error(`[easybill] WARN: returned type="${doc.type}" expected ORDER_CONFIRMATION`);
    }

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
    const body = this.orderPayload(order, easybillCustomerId, 'INVOICE');
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

/**
 * easybill erwartet ein 2-stelliges ISO-3166 Country-Code — Claude Vision
 * liefert aus Deutschen Bestellungen meist "Deutschland" oder gar nichts.
 * Wir mappen die häufigsten Varianten + fallback auf DE. Unbekannter String
 * der trotzdem genau 2 Zeichen hat wird uppercase durchgereicht (schadet
 * nicht und deckt seltene Länder ab).
 */
function normalizeCountry(raw: any): string {
  if (!raw || typeof raw !== 'string') return 'DE';
  const s = raw.trim().toUpperCase();
  if (!s) return 'DE';
  const map: Record<string, string> = {
    'DEUTSCHLAND': 'DE', 'GERMANY': 'DE', 'DE': 'DE', 'DEU': 'DE',
    'ÖSTERREICH': 'AT', 'OESTERREICH': 'AT', 'AUSTRIA': 'AT', 'AT': 'AT', 'AUT': 'AT',
    'SCHWEIZ': 'CH', 'SWITZERLAND': 'CH', 'CH': 'CH', 'CHE': 'CH',
    'FRANKREICH': 'FR', 'FRANCE': 'FR', 'FR': 'FR', 'FRA': 'FR',
    'NIEDERLANDE': 'NL', 'NETHERLANDS': 'NL', 'HOLLAND': 'NL', 'NL': 'NL', 'NLD': 'NL',
    'ITALIEN': 'IT', 'ITALY': 'IT', 'IT': 'IT', 'ITA': 'IT',
    'SPANIEN': 'ES', 'SPAIN': 'ES', 'ES': 'ES', 'ESP': 'ES',
    'BELGIEN': 'BE', 'BELGIUM': 'BE', 'BE': 'BE', 'BEL': 'BE',
    'LUXEMBURG': 'LU', 'LUXEMBOURG': 'LU', 'LU': 'LU', 'LUX': 'LU',
    'POLEN': 'PL', 'POLAND': 'PL', 'PL': 'PL', 'POL': 'PL',
    'TSCHECHIEN': 'CZ', 'CZECHIA': 'CZ', 'CZECH REPUBLIC': 'CZ', 'CZ': 'CZ', 'CZE': 'CZ',
    'DÄNEMARK': 'DK', 'DENMARK': 'DK', 'DK': 'DK', 'DNK': 'DK',
    'UNITED KINGDOM': 'GB', 'GROSSBRITANNIEN': 'GB', 'GB': 'GB', 'UK': 'GB',
  };
  if (map[s]) return map[s];
  // If someone already sent a 2-letter ISO code we don't know about, pass it through
  if (/^[A-Z]{2}$/.test(s)) return s;
  return 'DE';
}
