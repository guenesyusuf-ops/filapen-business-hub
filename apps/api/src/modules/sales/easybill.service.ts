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
  async listDocumentTypes(orgId: string, numberFilter?: string): Promise<any> {
    // Try multiple queries: a general recent list AND a specific number lookup
    // so we can find the user's known AB even if it's older.
    const recent = await this.call<any>(orgId, '/documents?limit=20');
    const recentList: any[] = Array.isArray(recent?.items) ? recent.items : Array.isArray(recent) ? recent : [];

    // Try the various possible type values for Auftragsbestätigung — whichever
    // filter returns items, that's the correct enum for this account.
    const candidates = ['ORDER_CONFIRMATION', 'CONFIRMATION', 'OFFER', 'CREDIT', 'ADVANCE_INVOICE'];
    const typeProbes: Record<string, any> = {};
    for (const t of candidates) {
      try {
        const r = await this.call<any>(orgId, `/documents?type=${t}&limit=3`);
        const list = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
        typeProbes[t] = list.length
          ? list.map((d: any) => ({ id: d.id, type: d.type, number: d.number, title: d.title }))
          : 'none';
      } catch (e: any) {
        typeProbes[t] = `err: ${e.message}`;
      }
    }

    // Specific number lookup
    let specific: any = null;
    if (numberFilter) {
      try {
        const r = await this.call<any>(orgId, `/documents?number=${encodeURIComponent(numberFilter)}&limit=3`);
        const list = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
        specific = list.map((d: any) => ({
          id: d.id, type: d.type, number: d.number, title: d.title,
          text_prefix: (d.text ?? '').slice(0, 60),
        }));
      } catch (e: any) {
        specific = `err: ${e.message}`;
      }
    }

    return {
      recentItems: recentList.map((d: any) => ({ id: d.id, type: d.type, number: d.number, title: d.title })),
      typesFound: Array.from(new Set(recentList.map((d: any) => String(d.type)).filter(Boolean))),
      typeProbes,
      specificLookup: specific,
    };
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

  private orderPayload(order: any, easybillCustomerId: string, type: 'ORDER' | 'INVOICE') {
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

    // Intro- und Schlusstext sind AB-spezifisch (Bezug auf Bestellung +
    // Liefertermin). Bei Rechnungen lassen wir beide Felder leer, dann
    // übernimmt easybill den Default aus der Dokumentvorlage ("nachfolgend
    // berechnen wir Ihnen …" + Zahlungsbedingungen).
    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('de-DE') : '';
    const isConfirmation = type === 'ORDER';

    const orderDateStr = fmt(order.orderDate);
    const externalNum = order.externalOrderNumber || '';
    const introText = !isConfirmation
      ? undefined
      : externalNum && orderDateStr
        ? `Sehr geehrte Damen und Herren,\n\ngemäß Ihrer Bestellung vom ${orderDateStr} mit der Bestellnummer ${externalNum} erbringen wir im einzelnen folgende Leistungen.`
        : `Sehr geehrte Damen und Herren,\n\ngemäß Ihrer Bestellung erbringen wir im einzelnen folgende Leistungen.`;

    const deliveryStr = fmt(order.requiredDeliveryDate);
    const footerText = !isConfirmation
      ? undefined
      : deliveryStr ? `Geplanter Liefertermin: ${deliveryStr}` : undefined;

    const payload: any = {
      type,
      customer_id: Number(easybillCustomerId),
      // Let easybill auto-number the document — we store only our internal ref
      document_date: new Date().toISOString().slice(0, 10),
      service_date_type: 'NONE',
      items,
      external_id: order.orderNumber,
    };
    if (introText !== undefined) payload.text = introText;
    if (footerText !== undefined) payload.text_additional = footerText;

    // status=ACCEPT unterscheidet in easybill den "Auftrag" vom
    // "Auftragsbestätigung"-Rendering. Swagger: status enum ACCEPT/DONE/
    // DROPSHIPPING/CANCEL erlaubt auf Dokumenttypen ORDER/DELIVERY/CHARGE/
    // OFFER. Die UI-Labels Angebot/Auftrag/Auftragsbestätigung/Bestellung
    // in easybill sind Varianten von OFFER und ORDER mit unterschiedlichem
    // Status — aus deutscher Geschäftslogik:
    //   ORDER            = Auftrag (Kundenauftrag intern)
    //   ORDER + ACCEPT   = Auftragsbestätigung (an Kunde verschickbar)
    if (type === 'ORDER') {
      payload.status = 'ACCEPT';
    }
    // Zahlungsbedingungen für Rechnungen — aus paymentTerms-Freitext der
    // Bestellung extrahieren. Format muss etwa so aussehen (egal ob Komma/Punkt):
    //   "3% Skonto innerhalb 7 Tagen, 30 Tage netto"
    //   "2% 7 Tage, 30 Tage"
    //   "14 Tage netto"   (ohne Skonto)
    // easybill rendert dann den Footer-Text inkl. Skonto-Hinweis automatisch.
    if (type === 'INVOICE') {
      const parsed = parsePaymentTerms(order.paymentTerms);
      if (parsed.cash_allowance != null) payload.cash_allowance = parsed.cash_allowance;
      if (parsed.cash_allowance_days != null) payload.cash_allowance_days = parsed.cash_allowance_days;
      if (parsed.due_in_days != null) payload.due_in_days = parsed.due_in_days;
    }
    return payload;
  }

  /**
   * Auftragsbestätigung = easybill Document-Typ "ORDER" (nicht OFFER/Angebot,
   * nicht INVOICE/Rechnung).
   *
   * Flow laut easybill-Swagger + User-Vorgabe:
   *   1. POST /rest/v1/documents  mit { type: "ORDER", ... }
   *      → erzeugt den Auftrag im Entwurfs-Status (is_draft=true)
   *   2. PUT /rest/v1/documents/{id}/done
   *      → stellt den Auftrag fertig (is_draft=false)
   *   3. PDF runterladen und als SalesOrderDocument(kind=confirmation) anheften
   *
   * Hinweis: easybill hat KEINEN separaten Dokumenttyp für "Auftrags-
   * bestätigung" in der REST-API-Swagger-Spec (Enum sind: INVOICE, OFFER,
   * ORDER, CREDIT, DELIVERY, CHARGE, CHARGE_CONFIRM, REMINDER, DUNNING,
   * STORNO, STORNO_CREDIT, RECURRING, PDF, LETTER, PROFORMA_INVOICE,
   * STORNO_PROFORMA_INVOICE). Die Darstellung "Auftragsbestätigung" im
   * PDF-Header ist eine easybill-Dokumentvorlage — unter
   * Einstellungen → Vorlagen → Auftrag kann der Titel umgeschrieben werden.
   * Falls das PDF mit "Auftrag" oder "Bestellung" statt "Auftrags-
   * bestätigung" rendert: easybill-Vorlage entsprechend anpassen.
   *
   * Ehemaliger Workaround: wir hatten vorher OFFER→/done→convert-to-ORDER
   * als zweistufigen Flow — das erzeugte immer ein zusätzliches Angebot
   * das übrig bleibt, und ist laut User-Feedback auch nicht das richtige
   * Zieldokument. Direkter ORDER-Create ist sauber und idiomatisch.
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
    const body = this.orderPayload(order, easybillCustomerId, 'ORDER');

    // Schritt 1: POST /documents mit type=ORDER
    const url1 = `${this.baseUrl}/documents`;
    console.error(`[easybill][AB#1] REQUEST POST ${url1}`);
    console.error(`[easybill][AB#1] BODY ${JSON.stringify(body)}`);
    const created = await this.call<any>(orgId, '/documents', { method: 'POST', body });
    const docId = String(created.id);
    console.error(`[easybill][AB#1] RESPONSE id=${docId} type=${created.type} document_number=${created.document_number ?? created.number ?? '—'} is_draft=${created.is_draft} status=${created.status ?? 'null'}`);

    // Schritt 2: PUT /documents/{id}/done → aus Entwurf holen
    const url2 = `${this.baseUrl}/documents/${docId}/done`;
    console.error(`[easybill][AB#2] REQUEST PUT ${url2}`);
    let done: any = null;
    try {
      done = await this.call<any>(orgId, `/documents/${docId}/done`, { method: 'PUT' });
      console.error(`[easybill][AB#2] RESPONSE id=${done?.id ?? docId} type=${done?.type ?? 'n/a'} document_number=${done?.document_number ?? done?.number ?? '—'} is_draft=${done?.is_draft}`);
    } catch (err: any) {
      // Nicht-fatal: wenn /done fehlschlägt, existiert der Auftrag weiterhin
      // als Entwurf — User kann das in easybill manuell "fertigstellen".
      console.error(`[easybill][AB#2] /done fehlgeschlagen (non-fatal): ${err.message}`);
    }

    // Schritt 3: PDF runterladen + R2-Mirror
    console.error(`[easybill][AB#3] DOWNLOAD PDF ${this.baseUrl}/documents/${docId}/pdf`);
    const pdfBuffer = await this.downloadPdf(orgId, docId);
    console.error(`[easybill][AB#3] PDF bytes=${pdfBuffer.length}`);
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
        events: {
          create: {
            orgId, type: 'note', actorId: userId,
            note: `easybill Auftrag erstellt (ID ${docId}, Nr ${created.document_number ?? created.number ?? '—'})`,
          },
        },
      },
    });
    return {
      easybillId: docId,
      pdfUrl: attached.url,
      easybillType: created.type,
      easybillNumber: created.document_number ?? created.number ?? null,
    };
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
    console.error('[easybill] REQUEST invoice:', JSON.stringify(body));
    const doc = await this.call<any>(orgId, '/documents', { method: 'POST', body });
    const docId = String(doc.id);
    console.error('[easybill] invoice created:', JSON.stringify({
      id: docId, type: doc.type, number: doc.number,
      cash_allowance: doc.cash_allowance, cash_allowance_days: doc.cash_allowance_days,
      due_in_days: doc.due_in_days,
    }));

    // Rechnung aus Entwurfsmodus holen damit sie finalisiert + versendbar ist
    try {
      await this.call(orgId, `/documents/${docId}/done`, { method: 'PUT' });
    } catch (err: any) {
      // Non-fatal: Rechnung existiert, nur Draft. User kann manuell finalisieren.
      console.error(`[easybill] /done fehlgeschlagen (non-fatal): ${err.message}`);
    }

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
 * Extrahiere Skonto % + Tage + Zahlungsziel aus einem Zahlungsbedingungs-
 * Freitext. Gibt undefined-Felder zurück wenn nicht gefunden — der Caller
 * sendet sie dann einfach nicht an easybill (keine Default-Werte).
 *
 * Beispiele:
 *   "3% Skonto innerhalb 7 Tagen, 30 Tage netto"
 *     → { cash_allowance: 3, cash_allowance_days: 7, due_in_days: 30 }
 *   "2% 7 Tage, 30 Tage"
 *     → { cash_allowance: 2, cash_allowance_days: 7, due_in_days: 30 }
 *   "14 Tage netto"
 *     → { due_in_days: 14 }
 *   "Vorkasse" / "sofort"
 *     → { due_in_days: 0 }
 */
function parsePaymentTerms(text: string | null | undefined): {
  cash_allowance?: number;
  cash_allowance_days?: number;
  due_in_days?: number;
} {
  if (!text || typeof text !== 'string') return {};
  const s = text.trim();
  if (!s) return {};
  const result: any = {};

  // "3%" oder "3,5%" — Skonto-Prozentsatz
  const pctMatch = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch) {
    result.cash_allowance = parseFloat(pctMatch[1].replace(',', '.'));
  }

  // "Vorkasse" / "sofort" / "sofort fällig" → 0 Tage
  if (/\b(?:vorkasse|sofort)\b/i.test(s)) {
    result.due_in_days = 0;
    return result;
  }

  // Alle "X Tag(e/en)" Vorkommen
  const daysMatches = Array.from(s.matchAll(/(\d+)\s*Tag/gi)).map((m) => parseInt(m[1], 10));
  if (daysMatches.length >= 2) {
    result.cash_allowance_days = daysMatches[0];
    result.due_in_days = daysMatches[1];
  } else if (daysMatches.length === 1) {
    if (result.cash_allowance != null) {
      result.cash_allowance_days = daysMatches[0];
    } else {
      result.due_in_days = daysMatches[0];
    }
  }
  return result;
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
