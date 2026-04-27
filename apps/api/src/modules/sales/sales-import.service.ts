import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesCustomerService } from './sales-customer.service';
import { SalesDocumentService } from './sales-document.service';

/**
 * Extracted structure — matches what Claude Vision is prompted to return.
 * Field order intentionally follows the real layout of a B2B PO so the model
 * reads naturally top-to-bottom.
 */
export interface ExtractedOrder {
  supplierNumber?: string | null;
  externalOrderNumber?: string | null;
  orderDate?: string | null;
  requiredDeliveryDate?: string | null;
  contactPerson?: string | null;
  customer: {
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  shippingAddress?: any;
  billingAddress?: any;
  paymentTerms?: string | null;
  currency?: string | null;
  lineItems: Array<{
    title?: string | null;
    supplierArticleNumber?: string | null;
    ean?: string | null;
    unitsPerCarton?: number | null;
    quantity?: number | null;
    unitPriceNet?: number | null;
    lineNet?: number | null;
  }>;
  totalNet?: number | null;
}

export interface ImportResult {
  extracted: ExtractedOrder;
  confidence: number;
  matchedCustomerId?: string | null;
  matchedLineItems: Array<{ index: number; productVariantId: string; sku: string | null; ean: string | null }>;
  rawModel: string;
  sourceDocumentId: string;
  /** Soft-Warning das Frontend als Banner zeigen kann (z.B. KI-Misidentifikation). */
  warning?: string;
  /** True wenn KI vermutlich Filapen als Kunden gesehen hat — Frontend
   *  zwingt dann den User auf "Bestehenden Kunden waehlen" und zeigt
   *  Bestaetigungs-Frage statt blind zu uebernehmen. */
  suspectedSelfMatch?: boolean;
}

const PROMPT = `Du bist ein präziser OCR- und Daten-Extraktor für B2B-Bestellungen (deutschsprachige Geschäftskundenbestellungen, manchmal englisch).

Extrahiere aus dem angehängten Dokument (PDF oder Bild einer Bestellung) ALLE verfügbaren Felder strikt im folgenden JSON-Schema. Fehlende Felder: null. Datumsfelder im Format YYYY-MM-DD.

KRITISCH — WER IST DER KUNDE (lies das HIER drei mal bevor du extrahierst):

WIR SIND DER VERKÄUFER. Wir heißen "Filapen" / "Filapen GmbH". Unsere Domain
ist filapen.de, unsere Mails buchhaltung@filapen.de, unsere EORI/WEEE-Nummern
sind in der Fußzeile. Wir tauchen praktisch in JEDEM Bestelldokument oben
links als Empfänger der Bestellung auf — als Lieferant. WIR SIND NICHT DER
KUNDE. Das customer-Feld muss IMMER eine andere Firma enthalten.

VERBINDLICHE EXTRAKTIONS-REIHENFOLGE für customer/billingAddress:

  Schritt 1 — Suche nach EXPLIZITEN Labels (höchste Priorität):
    "Rechnungsempfänger:" / "Rechnung an:" / "Bill-To:" / "Invoice to:"
    → Die Adresse direkt darunter = customer.

  Schritt 2 — Falls Schritt 1 leer: nimm die LIEFERANSCHRIFT
    "Lieferanschrift:" / "Lieferadresse:" / "Ship-To:" / "Versand an:"
    → Die Firma dort = customer (auch wenn sie als "Filiale" oder "Lager"
       beschriftet ist — das ist der Käufer).

  Schritt 3 — Falls beides leer: nimm den ABSENDER der Bestellung
    Im Briefkopf steht oft "Von: <Firma>" oder die Firma im Logo oben rechts.
    Das ist der bestellende Kunde.

  Schritt 4 — Letzter Ausweg: Adresse direkt unter "Bestellung" / "Bestell-
    Nr." / "Order" als Käufer interpretieren.

VERBOTEN:
- "Filapen" / "Filapen GmbH" / "Filapen Handels GmbH" → niemals ins customer.
- Adressen die "filapen.de" als Domain enthalten → niemals ins customer.
- EORI-/WEEE-Nummern die zu Filapen gehören → niemals ins customer.
- Wenn nur Filapen im Dokument erkennbar ist und KEINE andere Firma → setze
  customer.companyName = null statt zu raten.

PLAUSIBILITÄTS-CHECK:
- Wenn die einzige Firma die du gefunden hast "Filapen" enthält → STOPP.
  Das ist der Verkäufer. Setze customer auf null und beschreibe in einem
  unsichtbaren Kommentar nichts — gib einfach nulls zurück.
- Wenn customer = "Filapen GmbH" und billingAddress.company = "Amazon EU SARL"
  → die Reihenfolge ist falsch, die Firmen vertauschen.

EXTRAS:
- Bestellnummer (externalOrderNumber) ist die Nummer des KUNDEN, nicht
  unsere interne (z.B. "Bestellnummer 4500183634" = PO-Nummer des Kunden).

WICHTIG — Zahlen-Regeln:
- Beträge als reine Zahl mit Punkt als Dezimalzeichen (keine Währungszeichen, kein Tausender-Trennzeichen).
- "unitPriceNet" ist der Einzelpreis pro EINER Einheit in EUR. Wenn das PDF "Einzelpreis 12,06" zeigt, gib 12.06 zurück (nicht 0.1206, nicht 1206).
- "lineNet" ist der GESAMTbetrag für die ganze Zeile (quantity × unitPriceNet). Wenn das PDF nur einen Wert zeigt, prüfe ob es die Einzelpreis- oder die Summen-Spalte ist — der Summenbetrag ist fast immer der größere von beiden und stimmt mit menge × einzelpreis überein.
- "totalNet" ist der Nettobetrag der GESAMTEN Bestellung.
- Wenn mehrere Preise in der Zeile stehen (Einzel + Summe), extrahiere BEIDE separat. Konsistenz-Check: quantity × unitPriceNet ≈ lineNet (±1 Cent).

Zusätzlich gib am Ende ein Feld "confidence" zurück (Zahl 0–1), das deine Zuversicht in die Gesamt-Extraktion angibt. Wenn das Dokument verrauscht / handschriftlich / unvollständig ist, nutze einen Wert < 0.7.

Gib AUSSCHLIESSLICH gültiges JSON zurück — keine Code-Fences, keine Kommentare, keine Einleitung.

Schema:
{
  "supplierNumber": string | null,
  "externalOrderNumber": string | null,
  "orderDate": string | null,
  "requiredDeliveryDate": string | null,
  "contactPerson": string | null,
  "customer": { "companyName": string | null, "email": string | null, "phone": string | null },
  "shippingAddress": { "name": string | null, "company": string | null, "address1": string | null, "houseNumber": string | null, "address2": string | null, "zip": string | null, "city": string | null, "country": string | null } | null,
  "billingAddress": { same schema as shippingAddress } | null,
  "paymentTerms": string | null,
  "currency": string | null,
  "lineItems": [
    {
      "title": string,
      "supplierArticleNumber": string | null,
      "ean": string | null,
      "unitsPerCarton": number | null,
      "quantity": number,
      "unitPriceNet": number,
      "lineNet": number | null
    }
  ],
  "totalNet": number | null,
  "confidence": number
}`;

@Injectable()
export class SalesImportService {
  private readonly logger = new Logger(SalesImportService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly customers: SalesCustomerService,
    private readonly documents: SalesDocumentService,
  ) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = key ? new Anthropic({ apiKey: key }) : null;
  }

  /**
   * Run the full import pipeline on one uploaded file. Stores the file as a
   * SalesOrderDocument(kind=original) attached to a placeholder order? No —
   * we don't have an order yet. So we store the raw file in R2 under a
   * separate "import-preview" folder. When the user confirms the import the
   * order is created AND the document is linked. If they cancel, the file
   * stays orphaned (cleanable by a later cron if we care).
   *
   * Caller pattern:
   *   1. POST /orders/import with multipart file → returns { previewId, extracted, ... }
   *   2. User edits on the UI
   *   3. POST /orders/import/:previewId/confirm with edited data → creates SalesOrder
   */
  async runImport(
    orgId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<ImportResult> {
    if (!this.client) {
      throw new BadRequestException('AI nicht konfiguriert — ANTHROPIC_API_KEY fehlt in Env');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Datei fehlt');

    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    const isImage = /image\//.test(file.mimetype);
    const isText = file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.eml')
      || file.originalname.toLowerCase().endsWith('.txt');

    if (!isPdf && !isImage && !isText) {
      throw new BadRequestException(`Dateityp "${file.mimetype}" wird nicht unterstützt. PDF, Bild (JPG/PNG) oder Text.`);
    }

    // Build a "placeholder" document — we want the R2 URL so the user can
    // reference the original after creating the order. We attach it later
    // to the created order via the confirm step.
    const storedUrl = await this.storeOriginal(orgId, file);

    // Lerning aus existierenden Kunden: wir holen die letzten ~100 aktiven
    // Kunden + ihre Alias-Signale (Email-Domain, Stadt, externe Nummer) und
    // geben sie der KI als Hint. Damit wird die Erkennung mit jedem neuen
    // Kunden besser — kein Re-Training nötig, der Kontext wächst automatisch.
    const knownCustomersHint = await this.buildKnownCustomersHint(orgId);

    // Build vision content blocks.
    const base64 = file.buffer.toString('base64');
    const userContent: any[] = [];
    if (isPdf) {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      });
    } else if (isImage) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimetype || 'image/png', data: base64 },
      });
    } else {
      userContent.push({
        type: 'text',
        text: `Das folgende ist der Text einer Bestellung (aus einer E-Mail extrahiert):\n\n${file.buffer.toString('utf-8').slice(0, 50000)}`,
      });
    }
    userContent.push({ type: 'text', text: knownCustomersHint + '\n\n' + PROMPT });

    this.logger.log(`runImport: file=${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    const res = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userContent }],
    });
    const textBlock = res.content.find((b: any) => b.type === 'text') as any;
    const raw = textBlock?.text ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(this.stripFences(raw));
    } catch (err) {
      this.logger.error(`Claude returned non-JSON: ${raw.slice(0, 500)}`);
      throw new BadRequestException('KI-Extraktion fehlgeschlagen — Antwort war kein gültiges JSON.');
    }

    const confidence = Number(parsed.confidence ?? 0.7);
    delete parsed.confidence;

    const extracted = this.normalizeExtracted(parsed);

    // Layer 1 (deterministisch): Wenn Claude Filapen als Kunden extrahiert
    // hat, versuchen wir die richtige Firma aus billingAddress/shippingAddress
    // zu ziehen — diese Felder enthalten oft die korrekte Käufer-Firma auch
    // wenn der "customer.companyName"-Slot vermurkst ist. Auto-Swap passiert
    // STILL — User merkt nur dass alles korrekt ist.
    const swapped = this.autoSwapFilapenCustomer(extracted);
    if (swapped) {
      this.logger.log('autoSwap: Filapen-als-Kunde durch Adress-Feld korrigiert');
    }

    // Layer 2 (Soft-Warning): Wenn auch nach Swap noch Filapen drin steht,
    // konnte deterministisch nichts korrigiert werden → Frontend zwingt User
    // auf manuelle Auswahl. Customer-Felder bleiben wie extrahiert damit User
    // sieht was die KI gesehen hat.
    const ownCompanyPatterns = /filapen|buchhaltung@filapen/i;
    const companyName = (extracted.customer?.companyName ?? '').trim();
    const email = (extracted.customer?.email ?? '').trim();
    let suspectedSelfMatch = false;
    let warning: string | undefined;
    if (ownCompanyPatterns.test(companyName) || ownCompanyPatterns.test(email)) {
      this.logger.warn(
        `Import: KI hat Filapen als Kunden extrahiert UND Auto-Swap fand keinen Kandidaten (company="${companyName}", email="${email}") — User-Bestaetigung erforderlich`,
      );
      suspectedSelfMatch = true;
      warning =
        'Die KI hat "Filapen" als Kunden erkannt und konnte aus den Adress-Feldern keinen anderen Kandidaten ziehen. Bitte aus der Liste den richtigen Kunden auswählen — falls noch nicht vorhanden, einen neuen anlegen.';
    }

    // Auto-match customer — Priorität: easybill-Nummer, dann externe Nr,
    // dann E-Mail, dann Firmenname, dann Adresse (Straße+PLZ). Fehler beim
    // Matching darf NIE den Import blockieren — dann wird halt ein neuer
    // Kunde vorgeschlagen.
    let matched: any = null;
    try {
      matched = await this.customers.findMatching(orgId, {
        externalCustomerNumber: extracted.supplierNumber,
        email: email || null,
        companyName: companyName || null,
        billingAddress: extracted.billingAddress,
      });
    } catch (err: any) {
      this.logger.warn(`Customer-Match fehlgeschlagen (non-fatal): ${err.message}`);
    }

    // Auto-match line items via EAN or supplier article number → ProductVariant
    const matchedLineItems: ImportResult['matchedLineItems'] = [];
    for (let i = 0; i < extracted.lineItems.length; i++) {
      const line = extracted.lineItems[i];
      let variant: { id: string; sku: string | null; barcode: string | null } | null = null;
      if (line.ean) {
        variant = await this.prisma.productVariant.findFirst({
          where: { orgId, barcode: line.ean },
          select: { id: true, sku: true, barcode: true },
        });
      }
      if (!variant && line.supplierArticleNumber) {
        variant = await this.prisma.productVariant.findFirst({
          where: { orgId, sku: line.supplierArticleNumber },
          select: { id: true, sku: true, barcode: true },
        });
      }
      if (variant) {
        matchedLineItems.push({
          index: i,
          productVariantId: variant.id,
          sku: variant.sku,
          ean: variant.barcode,
        });
      }
    }

    // Persist original file as "pending" document — we need a SalesOrder to
    // attach it to, so we store the raw upload result for now and defer the
    // SalesOrderDocument row creation to the confirm step.
    // Bei suspectedSelfMatch nullen wir matchedCustomerId — sonst koennte ein
    // versehentlich angelegter "Filapen GmbH" Customer-Record als Match
    // durchgehen. User muss dann aktiv auswaehlen.
    return {
      extracted,
      confidence,
      matchedCustomerId: suspectedSelfMatch ? null : (matched?.id ?? null),
      matchedLineItems,
      rawModel: 'claude-sonnet-4-5',
      sourceDocumentId: storedUrl, // transient handle — the R2 key stored below
      warning,
      suspectedSelfMatch: suspectedSelfMatch || undefined,
    };
  }

  private stripFences(s: string): string {
    return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  /**
   * Baut den "Bekannte Kunden"-Block für den Prompt. Jeder neue Kunde der
   * angelegt wird taucht hier automatisch auf — Claude lernt mit jeder
   * importierten Bestellung weil sich die Kundenliste füllt. Wir nehmen
   * bis zu 100 Kunden (genug für Kontext, nicht zu viel für Token-Budget).
   * Aliase: Email-Domain (oft im Footer der Bestellung erkennbar) +
   * Stadt aus Billing-Adresse.
   */
  private async buildKnownCustomersHint(orgId: string): Promise<string> {
    try {
      const customers = await this.prisma.salesCustomer.findMany({
        where: { orgId },
        select: {
          companyName: true,
          email: true,
          billingAddress: true,
          externalCustomerNumber: true,
          easybillCustomerNumber: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      if (customers.length === 0) {
        return ''; // Keine Hints — nur die Standard-Logic im PROMPT.
      }

      const lines: string[] = customers.map((c) => {
        const aliases: string[] = [];
        if (c.email) {
          const domain = c.email.split('@')[1];
          if (domain) aliases.push(`Email: @${domain}`);
        }
        const billing: any = c.billingAddress;
        if (billing && typeof billing === 'object') {
          if (billing.city) aliases.push(`Stadt: ${billing.city}`);
        }
        if (c.externalCustomerNumber) aliases.push(`Kd-Nr: ${c.externalCustomerNumber}`);
        if (c.easybillCustomerNumber) aliases.push(`easybill: ${c.easybillCustomerNumber}`);
        const aliasStr = aliases.length > 0 ? ` (${aliases.join(', ')})` : '';
        return `  - ${c.companyName}${aliasStr}`;
      });

      return `BEKANNTE KUNDEN (${customers.length}) — diese Firmen sind unsere Bestandskunden. Wenn du im Dokument eine dieser Firmen oder ein zugehöriges Signal (Email-Domain, Stadt, Kd-Nr) erkennst, ist das ZU 100% der Kunde — auch wenn die Schreibweise leicht abweicht (Abkürzungen, Rechtsform mal mit/ohne, etc.):

${lines.join('\n')}

Wenn keine dieser Firmen passt → folge der normalen Extraktions-Reihenfolge unten und extrahiere die neue Firma normal.`;
    } catch (err: any) {
      // Defensiv: wenn der Hint-Lookup fehlschlägt, importieren wir trotzdem
      // — nur ohne Lern-Kontext. Niemals den ganzen Import wegen einem
      // Customer-Query-Fehler abbrechen.
      this.logger.warn(`buildKnownCustomersHint failed (non-fatal): ${err.message}`);
      return '';
    }
  }

  /**
   * Wenn die KI trotz Hints Filapen als Kunden extrahiert, suchen wir nach
   * einem deterministischen Swap-Kandidaten in den anderen Adress-Feldern.
   * Returns: { swapped: boolean, customer/billing/shipping nach Swap }.
   *
   * Heuristik (deterministic, kein KI-Call):
   *   1. billingAddress.company nicht-Filapen → swap mit customer
   *   2. shippingAddress.company nicht-Filapen → swap mit customer
   *   3. shippingAddress.name (Empfaenger) nicht-Filapen → ist oft die
   *      Person, deren Firma der Kunde ist. Heuristisch riskanter.
   *
   * Wenn keiner passt → kein Swap, suspectedSelfMatch bleibt true und
   * Frontend zwingt User auf manuelle Auswahl.
   */
  private autoSwapFilapenCustomer(extracted: ExtractedOrder): boolean {
    const isFilapen = (s: string | null | undefined) =>
      !!s && /filapen/i.test(s);
    if (!isFilapen(extracted.customer?.companyName)) return false;

    // Kandidat 1: billingAddress.company
    const billCo = (extracted.billingAddress as any)?.company;
    if (billCo && !isFilapen(billCo)) {
      this.logger.log(`autoSwap: billingAddress.company="${billCo}" → customer`);
      extracted.customer.companyName = billCo;
      return true;
    }
    // Kandidat 2: shippingAddress.company
    const shipCo = (extracted.shippingAddress as any)?.company;
    if (shipCo && !isFilapen(shipCo)) {
      this.logger.log(`autoSwap: shippingAddress.company="${shipCo}" → customer`);
      extracted.customer.companyName = shipCo;
      return true;
    }
    // Kein deterministischer Swap möglich
    return false;
  }

  private normalizeExtracted(raw: any): ExtractedOrder {
    const toNumber = (v: any) => {
      if (v == null || v === '') return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      // Strip anything that isn't a digit, separator, or minus
      let s = String(v).trim().replace(/[^\d.,-]/g, '');
      if (!s) return null;
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma > lastDot) {
        // German-style "1.234,56" — remove dots (thousands), comma → decimal
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (lastComma >= 0 && lastDot < 0) {
        // Only comma present — treat as decimal (German "12,06")
        s = s.replace(',', '.');
      } else {
        // US-style "1,234.56" or plain "1234.56" — strip thousands commas
        s = s.replace(/,/g, '');
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const toInt = (v: any) => {
      const n = toNumber(v);
      return n == null ? null : Math.round(n);
    };
    return {
      supplierNumber: raw.supplierNumber ?? null,
      externalOrderNumber: raw.externalOrderNumber ?? null,
      orderDate: raw.orderDate ?? null,
      requiredDeliveryDate: raw.requiredDeliveryDate ?? null,
      contactPerson: raw.contactPerson ?? null,
      customer: {
        companyName: raw.customer?.companyName ?? null,
        email: raw.customer?.email ?? null,
        phone: raw.customer?.phone ?? null,
      },
      shippingAddress: raw.shippingAddress ?? null,
      billingAddress: raw.billingAddress ?? null,
      paymentTerms: raw.paymentTerms ?? null,
      currency: raw.currency ?? 'EUR',
      lineItems: (raw.lineItems ?? []).map((l: any) => ({
        title: l.title ?? '',
        supplierArticleNumber: l.supplierArticleNumber ?? null,
        ean: l.ean ?? null,
        unitsPerCarton: toInt(l.unitsPerCarton),
        quantity: toInt(l.quantity) ?? 1,
        unitPriceNet: toNumber(l.unitPriceNet) ?? 0,
        lineNet: toNumber(l.lineNet),
      })),
      totalNet: toNumber(raw.totalNet),
    };
  }

  /**
   * Upload the raw file to R2 under the import-preview area. Returns the R2 URL
   * which doubles as a "handle" that survives the preview → confirm round-trip.
   * On confirm we promote it to a regular SalesOrderDocument row.
   */
  private async storeOriginal(
    orgId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<string> {
    // Store via documents service won't work (needs orderId). Inline R2 upload.
    const crypto = await import('crypto');
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const uid = crypto.randomBytes(8).toString('hex');
    const key = `sales/${orgId}/import-preview/${Date.now()}-${uid}.${ext}`;
    // @ts-ignore — access the injected storage via the documents service
    const url = await (this.documents as any).storage.upload(key, file.buffer, file.mimetype || 'application/octet-stream');
    // Return "key|url|name|mime|size" packed as a single opaque token so we
    // can round-trip it through the preview response without needing a DB row.
    return Buffer.from(JSON.stringify({ key, url, name: file.originalname, mime: file.mimetype, size: file.size }), 'utf8').toString('base64');
  }

  /**
   * Decode the opaque handle produced by storeOriginal. Used during confirm
   * to persist the original file as a SalesOrderDocument.
   */
  decodeSourceHandle(token: string): { key: string; url: string; name: string; mime: string; size: number } {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Ungültiger sourceDocumentId');
    }
  }
}
