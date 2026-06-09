import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeInvoiceStatus } from './invoice-status.helper';

/**
 * Claude Vision Extraktion fuer deutsche Eingangsrechnungen.
 *
 * Antwortet als JSON-Objekt mit allen Feldern, die wir in der Detailansicht
 * zeigen — der User kann nach dem OCR-Lauf jedes Feld korrigieren.
 *
 * Wichtig: Wir geben EUR-Beträge als Number zurück, Datumsangaben als
 * YYYY-MM-DD, alle anderen Felder als String. Confidence (0..1) zeigt an,
 * wie sicher das Modell sich ist — Schwellwert <0.6 → wir markieren die
 * Rechnung mit `reviewed=false` und blinken die UI auf.
 */
const PROMPT = `Du bist ein KI-Assistent, der Eingangsrechnungen aus Deutschland und der EU analysiert.

Extrahiere ALLE Felder aus dem Dokument und antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format (keine Erklaerung, kein Markdown):

{
  "supplierName": "Firmenname des Rechnungsstellers oder null",
  "supplierAddress": "Vollstaendige Adresse als einzeiliger String oder null",
  "supplierEmail": "E-Mail oder null",
  "supplierPhone": "Telefonnummer oder null",
  "supplierWebsite": "Webseite (ohne https://) oder null",
  "supplierVatId": "USt-IdNr. (DE...) oder null",

  "invoiceNumber": "Rechnungsnummer oder null",
  "invoiceDate": "YYYY-MM-DD oder null",
  "serviceDate": "Leistungsdatum YYYY-MM-DD oder null",
  "dueDate": "Faelligkeitsdatum YYYY-MM-DD (wenn nicht direkt angegeben aus Zahlungsziel berechnen) oder null",
  "paymentTerms": "Zahlungsziel als Text (z.B. '14 Tage netto') oder null",
  "currency": "ISO 4217 Code (EUR/USD/CHF/...). Default EUR.",

  "netAmount": "Nettobetrag gesamt als Zahl oder null",
  "vatAmount": "MwSt-Betrag gesamt als Zahl oder null",
  "grossAmount": "Bruttobetrag gesamt als Zahl oder null",
  "taxRate": "Steuersatz in Prozent als Zahl (z.B. 19) oder null. Bei Mischsteuersaetzen den haeufigsten.",
  "discountAmount": "Skonto-Betrag als Zahl oder null. Wenn nur % angegeben, leer lassen.",

  "iban": "IBAN ohne Leerzeichen oder null",
  "bic": "BIC oder null",
  "bankName": "Bankname oder null",
  "paymentReference": "Verwendungszweck oder null",

  "category": "Eine der folgenden Kategorien (oder 'other'): marketing, software, office, vehicles, rent, personnel, insurance, other",

  "confidence": "Selbsteinschaetzung 0..1 wie sicher du dir bei den Werten bist"
}

Regeln:
- Alle Geldbetraege als Number (Punkt als Dezimaltrenner). Keine Waehrungszeichen.
- Datumsangaben STRIKT YYYY-MM-DD.
- Wenn ein Feld nicht eindeutig im Dokument steht: null. Nicht raten.
- Bei mehreren Rechnungsnummern: die Hauptnummer ("Rechnung Nr.").
- USt-IdNr nur Buchstaben+Zahlen, ohne Leerzeichen.
- Wenn Zahlungsziel-Text wie "Zahlbar in 14 Tagen ohne Abzug" → dueDate = invoiceDate + 14 Tage.
- Kategorie heuristisch aus Branche oder Bezeichnung der Leistung ableiten.
- Antworte NUR mit dem JSON-Objekt — keine Erklaerung davor oder danach.`;

interface ExtractedInvoice {
  supplierName: string | null;
  supplierAddress: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWebsite: string | null;
  supplierVatId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  paymentTerms: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  grossAmount: number | null;
  taxRate: number | null;
  discountAmount: number | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  paymentReference: string | null;
  category: string | null;
  confidence?: number;
}

@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = key ? new Anthropic({ apiKey: key }) : null;
  }

  /**
   * Extrahiert die Daten und schreibt sie auf die Rechnung. Setzt
   * ocr_status entsprechend ("processing" → "success" / "failed").
   * Wirft NICHT — Fehler werden in ocr_error gespeichert.
   */
  async processInvoice(
    invoiceId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<void> {
    // Setze processing-Status (best effort)
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { ocrStatus: 'processing' },
    }).catch(() => undefined);

    if (!this.client) {
      await this.recordFailure(invoiceId, 'OCR nicht konfiguriert — ANTHROPIC_API_KEY fehlt');
      return;
    }

    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    const isImage = /^image\//.test(file.mimetype);

    if (!isPdf && !isImage) {
      await this.recordFailure(invoiceId, `Dateityp ${file.mimetype} nicht unterstuetzt`);
      return;
    }

    try {
      const base64 = file.buffer.toString('base64');
      const userContent: any[] = [];
      if (isPdf) {
        userContent.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        });
      } else {
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: file.mimetype, data: base64 },
        });
      }
      userContent.push({ type: 'text', text: PROMPT });

      this.logger.log(`OCR start: invoice=${invoiceId} file=${file.originalname}`);
      const res = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: userContent }],
      });

      const text = (res.content.find((b: any) => b.type === 'text') as any)?.text ?? '';
      let parsed: ExtractedInvoice;
      try {
        parsed = JSON.parse(this.stripFences(text));
      } catch (err) {
        await this.recordFailure(invoiceId, `Antwort war kein gueltiges JSON: ${text.slice(0, 200)}`);
        return;
      }

      const confidence = Number(parsed.confidence ?? 0.7);

      // Aktuellen Stand der Rechnung holen — falls der User in der
      // Zwischenzeit schon editiert hat (reviewed=true), dann nur die
      // noch leeren Felder fuellen. Sonst koennten User-Eingaben
      // vom verzoegerten OCR-Lauf ueberschrieben werden.
      const current = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          orgId: true, reviewed: true,
          supplierName: true, supplierAddress: true, supplierEmail: true,
          supplierPhone: true, supplierWebsite: true, supplierVatId: true,
          invoiceNumber: true, invoiceDate: true, serviceDate: true, dueDate: true,
          paymentTerms: true, currency: true,
          netAmount: true, vatAmount: true, grossAmount: true, taxRate: true, discountAmount: true,
          iban: true, bic: true, bankName: true, paymentReference: true,
          category: true, paidAt: true,
        },
      });
      if (!current) return;

      const onlyFillEmpty = current.reviewed === true;

      const ocrValues: Record<string, any> = {
        supplierName: this.s(parsed.supplierName),
        supplierAddress: this.s(parsed.supplierAddress),
        supplierEmail: this.s(parsed.supplierEmail),
        supplierPhone: this.s(parsed.supplierPhone),
        supplierWebsite: this.s(parsed.supplierWebsite),
        supplierVatId: this.s(parsed.supplierVatId),
        invoiceNumber: this.s(parsed.invoiceNumber),
        invoiceDate: this.d(parsed.invoiceDate),
        serviceDate: this.d(parsed.serviceDate),
        dueDate: this.d(parsed.dueDate),
        paymentTerms: this.s(parsed.paymentTerms),
        currency: this.s(parsed.currency) ?? 'EUR',
        netAmount: this.dec(parsed.netAmount),
        vatAmount: this.dec(parsed.vatAmount),
        grossAmount: this.dec(parsed.grossAmount),
        taxRate: this.dec(parsed.taxRate, 5, 2),
        discountAmount: this.dec(parsed.discountAmount),
        iban: this.s(parsed.iban)?.replace(/\s+/g, '') ?? null,
        bic: this.s(parsed.bic),
        bankName: this.s(parsed.bankName),
        paymentReference: this.s(parsed.paymentReference),
        category: this.normalizeCategory(parsed.category),
      };

      const data: any = {
        ocrStatus: 'success',
        ocrConfidence: confidence,
        ocrError: null,
        ocrRawText: text.slice(0, 8000),
      };

      for (const [key, ocrVal] of Object.entries(ocrValues)) {
        if (ocrVal == null) continue;
        if (onlyFillEmpty && this.isFilled((current as any)[key])) continue;
        data[key] = ocrVal;
      }

      // Status nur neu berechnen wenn wir das dueDate gesetzt haben
      if ('dueDate' in data) {
        data.status = computeInvoiceStatus({ dueDate: data.dueDate, paidAt: current.paidAt });
      }

      await this.prisma.invoice.update({ where: { id: invoiceId }, data });
      await this.prisma.invoiceEvent.create({
        data: {
          invoiceId,
          orgId: (await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { orgId: true } }))!.orgId,
          type: 'ocr_completed',
          note: `OCR erfolgreich — Confidence ${(confidence * 100).toFixed(0)}%`,
          metadata: { confidence, status: data.status },
        },
      });
      this.logger.log(`OCR done: invoice=${invoiceId} confidence=${confidence}`);
    } catch (err: any) {
      this.logger.error(`OCR failed: invoice=${invoiceId} err=${err?.message}`);
      await this.recordFailure(invoiceId, err?.message ?? 'Unbekannter Fehler');
    }
  }

  /**
   * Best-effort Duplikat-Check: gleiche Rechnungsnummer + (gleicher Lieferant
   * ODER gleicher Brutto-Betrag) innerhalb der letzten 365 Tage.
   */
  async findDuplicates(orgId: string, params: {
    invoiceNumber?: string | null;
    supplierName?: string | null;
    grossAmount?: number | null;
    excludeId?: string;
  }): Promise<Array<{ id: string; invoiceNumber: string | null; supplierName: string | null; invoiceDate: string | null; grossAmount: string | null }>> {
    if (!params.invoiceNumber && !params.supplierName) return [];
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const where: any = { orgId, createdAt: { gte: since } };
    if (params.excludeId) where.id = { not: params.excludeId };

    const or: any[] = [];
    if (params.invoiceNumber) or.push({ invoiceNumber: params.invoiceNumber });
    if (params.supplierName && params.grossAmount != null) {
      or.push({
        supplierName: params.supplierName,
        grossAmount: new Prisma.Decimal(Number(params.grossAmount).toFixed(2)),
      });
    }
    if (or.length === 0) return [];
    where.OR = or;

    const rows = await this.prisma.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, supplierName: true, invoiceDate: true, grossAmount: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      supplierName: r.supplierName,
      invoiceDate: r.invoiceDate ? r.invoiceDate.toISOString().slice(0, 10) : null,
      grossAmount: r.grossAmount ? r.grossAmount.toString() : null,
    }));
  }

  // -------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------

  private async recordFailure(invoiceId: string, message: string) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { ocrStatus: 'failed', ocrError: message },
    }).catch(() => undefined);
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { orgId: true } });
    if (inv) {
      await this.prisma.invoiceEvent.create({
        data: { invoiceId, orgId: inv.orgId, type: 'ocr_failed', note: message.slice(0, 500) },
      }).catch(() => undefined);
    }
  }

  private stripFences(s: string): string {
    return s.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  private s(v: any): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t.length === 0 || t.toLowerCase() === 'null' ? null : t;
  }

  private d(v: any): Date | null {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private dec(v: any, precision = 12, scale = 2): Prisma.Decimal | null {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return new Prisma.Decimal(n.toFixed(scale));
  }

  private normalizeCategory(v: any): string {
    const allowed = ['marketing', 'software', 'office', 'vehicles', 'rent', 'personnel', 'insurance', 'other'];
    if (typeof v === 'string' && allowed.includes(v.toLowerCase())) return v.toLowerCase();
    return 'other';
  }

  private isFilled(v: any): boolean {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (v instanceof Date) return true;
    if (typeof v === 'number') return Number.isFinite(v);
    // Prisma.Decimal hat toString()
    if (typeof v === 'object' && typeof v.toString === 'function') {
      const s = v.toString();
      // category default ist 'other' — gilt fuer uns nicht als "vom User gefuellt"
      return s !== '' && s !== 'other';
    }
    return !!v;
  }
}
