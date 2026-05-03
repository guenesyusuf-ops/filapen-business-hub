import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesDocumentService } from './sales-document.service';
import { CarrierAccountService } from '../shipping/carrier-account.service';
import { CarrierRegistry } from '../shipping/carriers/carrier-registry.service';
import type { ShipmentCreateInput } from '../shipping/carriers/carrier-adapter.interface';

// Empfaenger fuer den Lager-Mailing-Workflow. User-Vorgabe.
const WAREHOUSE_EMAIL = 'lager@filapen.de';
const COPY_EMAIL = 'yusuf@filapen.de';

/**
 * Versandlabel-Erstellung aus dem Verkauf-Modul.
 *
 * Logik:
 *   1. Sales-Bestellung + Customer + Line-Items + ShippingProductProfiles laden
 *   2. Pro Line-Item: ceil(quantity / unitsPerCarton) = Anzahl Kartons
 *      (kein VKE → 1 Karton mit voller Menge)
 *   3. Karton-Gewicht ermitteln:
 *        - profile.weightPerCartonG (explizit gepflegt)            → nehmen
 *        - else profile.weightG × unitsPerCarton                    → berechnen
 *        - else: 400er-Fehler, User muss Gewicht pflegen
 *   4. Pro Karton ein DHL-Label, reference = order.orderNumber + Lauf-Nr
 *   5. PDF -> Storage -> SalesOrderDocument(kind=shipping_label)
 */
@Injectable()
export class SalesShippingService {
  private readonly logger = new Logger(SalesShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: SalesDocumentService,
    private readonly accounts: CarrierAccountService,
    private readonly registry: CarrierRegistry,
    private readonly config: ConfigService,
  ) {}

  async createDhlLabels(orgId: string, userId: string, salesOrderId: string): Promise<{
    cartons: number;
    labelsCreated: number;
    documentIds: string[];
    trackingNumbers: string[];
  }> {
    // 1) Order + Customer + Line-Items laden
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, orgId },
      include: {
        customer: true,
        lineItems: { orderBy: { position: 'asc' } },
      },
    });
    if (!order) throw new BadRequestException('Bestellung nicht gefunden');
    if (order.status === 'cancelled') {
      throw new BadRequestException('Stornierte Bestellung kann nicht versendet werden');
    }
    if (!order.customer) {
      throw new BadRequestException('Kein Kunde an der Bestellung — bitte erst zuweisen');
    }

    // 2) DHL-Account + Sender ermitteln
    const account = await this.accounts.findDefault(orgId, 'dhl');
    if (!account) {
      throw new BadRequestException('Kein DHL-Account konfiguriert. Versand → Integrationen → DHL.');
    }
    const loaded = await this.accounts.loadForUse(orgId, account.id);
    if (!loaded) throw new BadRequestException('DHL-Account-Credentials konnten nicht geladen werden.');
    const credentials = loaded.credentialsDecrypted;
    const senderData = (loaded.senderData as any) ?? null;
    if (!senderData) {
      throw new BadRequestException('Sender-Adresse fehlt am DHL-Account. Versand → Integrationen → DHL → Bearbeiten.');
    }

    // 3) Empfaenger-Adresse aus Customer-Shipping-Address
    const recipientAddr = (order.customer.shippingAddress as any)
      ?? (order.customer.billingAddress as any);
    if (!recipientAddr) {
      throw new BadRequestException('Kunde hat keine Lieferadresse hinterlegt.');
    }
    const recipientName = order.customer.companyName || order.customer.contactPerson || 'Empfänger';

    // 4) Shipping-Profiles bulk laden — eine Query statt N
    const variantIds = order.lineItems
      .map((li) => li.matchedProductVariantId)
      .filter(Boolean) as string[];
    const skus = order.lineItems
      .map((li) => li.supplierArticleNumber)
      .filter(Boolean) as string[];

    const profiles = await this.prisma.shippingProductProfile.findMany({
      where: {
        orgId,
        OR: [
          variantIds.length ? { productVariantId: { in: variantIds } } : { id: '00000000-0000-0000-0000-000000000000' },
          skus.length ? { sku: { in: skus } } : { id: '00000000-0000-0000-0000-000000000000' },
        ],
      },
    });
    const byVariantId = new Map(profiles.filter((p) => p.productVariantId).map((p) => [p.productVariantId!, p]));
    const bySku = new Map(profiles.filter((p) => p.sku).map((p) => [p.sku!, p]));

    // 5) Pro Line-Item Karton-Plan bauen, Gewicht ermitteln
    type Plan = { lineId: string; title: string; cartons: number; weightG: number };
    const plans: Plan[] = [];
    const missingWeight: { title: string; sku: string | null }[] = [];

    for (const li of order.lineItems) {
      if (li.quantity <= 0) continue;

      const profile =
        (li.matchedProductVariantId && byVariantId.get(li.matchedProductVariantId))
        || (li.supplierArticleNumber && bySku.get(li.supplierArticleNumber))
        || null;

      const vke = li.unitsPerCarton && li.unitsPerCarton > 0 ? li.unitsPerCarton : null;
      const cartons = vke ? Math.ceil(li.quantity / vke) : 1;
      const unitsPerThisCarton = vke ?? li.quantity;

      // Gewicht bestimmen
      let weightG = 0;
      if (profile?.weightPerCartonG && profile.weightPerCartonG > 0) {
        weightG = profile.weightPerCartonG;
      } else if (profile?.weightG && profile.weightG > 0) {
        weightG = profile.weightG * unitsPerThisCarton;
      }

      if (weightG <= 0) {
        missingWeight.push({ title: li.title, sku: li.supplierArticleNumber });
        continue;
      }

      plans.push({ lineId: li.id, title: li.title, cartons, weightG });
    }

    if (missingWeight.length > 0) {
      const list = missingWeight.slice(0, 5)
        .map((m) => `${m.title}${m.sku ? ` [${m.sku}]` : ''}`).join(', ');
      const more = missingWeight.length > 5 ? ` … und ${missingWeight.length - 5} weitere` : '';
      throw new BadRequestException(
        `Versandgewicht fehlt für ${missingWeight.length} Position(en): ${list}${more}.\n\n` +
        'Pflege das Gewicht (pro Einheit oder pro Karton) im Versand-Modul → Produkte.',
      );
    }
    if (plans.length === 0) {
      throw new BadRequestException('Keine versendbaren Positionen gefunden.');
    }

    const totalCartons = plans.reduce((s, p) => s + p.cartons, 0);

    // 6) DHL-Adapter
    const adapter = this.registry.get('dhl');

    const createdDocIds: string[] = [];
    const createdTrackings: string[] = [];
    let cartonIndex = 0;

    for (const plan of plans) {
      for (let i = 0; i < plan.cartons; i++) {
        cartonIndex++;
        // Reference auf dem DHL-Label = unsere Bestellnummer + Karton-Index
        // (z.B. "VK-2026-00006 (3/12)") — User-Wunsch
        const reference = totalCartons > 1
          ? `${order.orderNumber} (${cartonIndex}/${totalCartons})`
          : order.orderNumber;

        const input: ShipmentCreateInput = {
          orgId,
          orderId: order.id, // wir verwenden hier salesOrder.id — nicht Order.id
          recipient: {
            name: recipientName,
            email: order.customer.email,
            phone: order.customer.phone,
            address: {
              street: recipientAddr.street || recipientAddr.address1 || recipientAddr.line1 || '',
              houseNumber: recipientAddr.houseNumber || recipientAddr.house_number,
              address2: recipientAddr.address2 || recipientAddr.line2 || null,
              zip: recipientAddr.zip || recipientAddr.postalCode || recipientAddr.postal_code || '',
              city: recipientAddr.city || '',
              province: recipientAddr.province || null,
              country: ((recipientAddr.country || recipientAddr.country_code || 'DE') as string).toUpperCase().slice(0, 2),
            },
          },
          sender: senderData,
          weightG: plan.weightG,
          reference,
        };

        let result;
        try {
          result = await adapter.createShipment(input, credentials);
        } catch (err: any) {
          throw new BadRequestException(
            `DHL-Label-Erstellung fehlgeschlagen bei Karton ${cartonIndex}/${totalCartons} (${plan.title}): ${err?.message ?? err}.\n\n` +
            `Bisher erstellt: ${createdDocIds.length} Label(s).`,
          );
        }

        // PDF in Storage + als SalesOrderDocument anhaengen
        if (!result.labelPdfBase64) {
          throw new BadRequestException(
            `DHL hat kein PDF zurueckgegeben fuer Karton ${cartonIndex}. Adapter liefert nur ${result.labelFormat}.`,
          );
        }
        const pdfBuffer = Buffer.from(result.labelPdfBase64, 'base64');
        const fileName = totalCartons > 1
          ? `dhl-label-${order.orderNumber}-${cartonIndex}-von-${totalCartons}.pdf`
          : `dhl-label-${order.orderNumber}.pdf`;
        const attached = await this.documents.attachBuffer(
          orgId, userId, salesOrderId, pdfBuffer, fileName, 'application/pdf', 'shipping_label',
        );
        createdDocIds.push(attached.id);
        createdTrackings.push(result.trackingNumber);
      }
    }

    // 7) Tracking-Nummern auf der Order persistieren + Versand-Event
    await this.prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        trackingNumbers: Array.from(new Set([...(order.trackingNumbers ?? []), ...createdTrackings])),
        events: { create: {
          orgId,
          type: 'note',
          actorId: userId,
          note: `${createdDocIds.length} DHL-Label(s) erstellt (${totalCartons} Karton/s)`,
        } },
      },
    });

    return {
      cartons: totalCartons,
      labelsCreated: createdDocIds.length,
      documentIds: createdDocIds,
      trackingNumbers: createdTrackings,
    };
  }

  /**
   * Schickt alle Versandlabels (kind=shipping_label) + den Lieferschein
   * (kind=delivery_note) per E-Mail ans Lager. PDFs werden aus R2 gepullt
   * und base64 als Resend-Attachments mitgeliefert.
   *
   * Empfaenger:
   *   - lager@filapen.de (Lager — soll versenden)
   *   - yusuf@filapen.de (Kopie an User)
   *
   * Setzt nach Erfolg labelsSentToWarehouseAt — Frontend zeigt das als
   * "Labels ans Lager versendet am DD.MM.YYYY" Hinweis.
   */
  async sendLabelsToWarehouse(orgId: string, userId: string, salesOrderId: string): Promise<{
    sent: boolean;
    labelCount: number;
    hasDeliveryNote: boolean;
    sentAt: string;
  }> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, orgId },
      include: { customer: true },
    });
    if (!order) throw new BadRequestException('Bestellung nicht gefunden');

    // Alle Versandlabels + Lieferschein als Anhang sammeln
    const docs = await this.prisma.salesOrderDocument.findMany({
      where: { orgId, orderId: salesOrderId, kind: { in: ['shipping_label', 'delivery_note'] } },
      orderBy: { uploadedAt: 'asc' },
    });
    const labels = docs.filter((d) => d.kind === 'shipping_label');
    const deliveryNote = docs.find((d) => d.kind === 'delivery_note') ?? null;
    if (labels.length === 0) {
      throw new BadRequestException('Keine Versandlabels vorhanden — erst über "Labels erstellen" anlegen.');
    }

    // PDFs herunterladen — die url ist die public R2-URL, einfach via fetch.
    // Hinweis: Resend akzeptiert max ~40MB pro Mail; bei sehr vielen Kartons
    // packen wir die einzeln, ZIP wuerde Lager-User mehr nerven.
    const fetchPdf = async (url: string): Promise<string> => {
      const res = await fetch(url);
      if (!res.ok) throw new BadRequestException(`PDF-Download fehlgeschlagen (${res.status}): ${url}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab).toString('base64');
    };

    const attachments: { filename: string; content: string }[] = [];
    if (deliveryNote) {
      attachments.push({
        filename: deliveryNote.fileName,
        content: await fetchPdf(deliveryNote.url),
      });
    }
    for (const lbl of labels) {
      attachments.push({
        filename: lbl.fileName,
        content: await fetchPdf(lbl.url),
      });
    }

    const customerName = order.customer?.companyName
      || order.customer?.contactPerson
      || 'Kunde';
    const subject = 'Bitte versenden';
    const text =
      `Hallo,\n\n` +
      `bitte versende die Bestellung von ${customerName} mit der Bestellnummer ${order.orderNumber}.\n` +
      `Anbei die ${labels.length} Versandlabel${labels.length !== 1 ? 's' : ''}` +
      (deliveryNote ? ' und der Lieferschein.' : '.') +
      `\n\nViele Gruesse\nFilapen Business Hub`;
    const html =
      `<p>Hallo,</p>` +
      `<p>bitte versende die Bestellung von <strong>${customerName}</strong> mit der Bestellnummer <strong>${order.orderNumber}</strong>.</p>` +
      `<p>Anbei die ${labels.length} Versandlabel${labels.length !== 1 ? 's' : ''}` +
      (deliveryNote ? ' und der Lieferschein.' : '.') +
      `</p>` +
      `<p>Viele Grüße<br/>Filapen Business Hub</p>`;

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new BadRequestException('RESEND_API_KEY nicht konfiguriert.');
    // Absender muss eine in Resend verifizierte Domain sein. Default
    // "noreply@filapen.de" — falls dein Resend-Account einen anderen
    // Verifizierungsstand hat, lieber via Env-Var ueberschreibbar.
    const from = this.config.get<string>('SALES_WAREHOUSE_FROM') || 'Filapen Business Hub <noreply@filapen.de>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [WAREHOUSE_EMAIL, COPY_EMAIL],
        subject,
        text,
        html,
        attachments,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(`Email-Versand fehlgeschlagen (${res.status}): ${body.slice(0, 400)}`);
    }

    // Zeitstempel persistieren + Event loggen
    const now = new Date();
    await this.prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        labelsSentToWarehouseAt: now,
        events: { create: {
          orgId, type: 'note', actorId: userId,
          note: `Labels ans Lager versendet (${labels.length} Label${labels.length !== 1 ? 's' : ''}${deliveryNote ? ' + Lieferschein' : ''})`,
        } },
      },
    });

    return {
      sent: true,
      labelCount: labels.length,
      hasDeliveryNote: !!deliveryNote,
      sentAt: now.toISOString(),
    };
  }
}
