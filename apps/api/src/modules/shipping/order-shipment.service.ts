import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { CarrierAccountService } from './carrier-account.service';
import { ShippingOrderService } from './shipping-order.service';
import { ShippingRuleService } from './shipping-rule.service';
import { ShippingEmailAutomationService } from './shipping-email-automation.service';
import { ShopifyService } from '../integration/shopify/shopify.service';
import type { ShipmentCreateInput } from './carriers/carrier-adapter.interface';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

export interface CreateShipmentInput {
  orderId: string;
  carrier: 'dhl' | 'ups' | 'dpd' | 'hermes' | 'gls' | 'custom';
  carrierAccountId?: string | null;
  shippingMethod?: string | null;
  packageId?: string | null;
  weightG?: number; // optional override; else computed from profiles
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  notes?: string | null;
}

interface ListFilters {
  status?: string;
  carrier?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class OrderShipmentService {
  private readonly logger = new Logger(OrderShipmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly registry: CarrierRegistry,
    private readonly accounts: CarrierAccountService,
    private readonly orders: ShippingOrderService,
    private readonly rules: ShippingRuleService,
    private readonly emailAuto: ShippingEmailAutomationService,
    private readonly shopify: ShopifyService,
  ) {}

  async list(orgId: string, filters: ListFilters = {}) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.carrier) where.carrier = filters.carrier;
    if (filters.search) {
      where.OR = [
        { trackingNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { recipientName: { contains: filters.search, mode: 'insensitive' as const } },
        { recipientEmail: { contains: filters.search, mode: 'insensitive' as const } },
        { order: { orderNumber: { contains: filters.search, mode: 'insensitive' as const } } },
      ];
    }
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.orderShipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true, customerEmail: true } },
          // printedAt + printCount zwingend mit ausliefern, sonst sieht das
          // Frontend "nicht gedruckt" obwohl die DB bereits das Gegenteil weiß.
          labels: {
            select: {
              id: true,
              url: true,
              format: true,
              trackingNumber: true,
              printedAt: true,
              printCount: true,
            },
          },
          _count: { select: { statusEvents: true } },
        },
      }),
      this.prisma.orderShipment.count({ where }),
    ]);
    return { items, total };
  }

  async get(orgId: string, id: string) {
    const shipment = await this.prisma.orderShipment.findFirst({
      where: { id, orgId },
      include: {
        order: true,
        labels: { orderBy: { sequenceNumber: 'asc' } },
        statusEvents: { orderBy: { occurredAt: 'desc' } },
        package: true,
        carrierAccount: { select: { id: true, accountName: true, carrier: true, apiReady: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Sendung nicht gefunden');
    return shipment;
  }

  async create(orgId: string, userId: string, data: CreateShipmentInput) {
    const order = await this.prisma.order.findFirst({
      where: { id: data.orderId, orgId },
      include: {
        // All scalar fields plus the lineItem fields we need downstream:
        //   productVariantId → rule evaluation + weight lookup
        //   sku + title       → shipment reference + unknown-weight error message
        //   quantity          → weight computation
        lineItems: {
          select: {
            productVariantId: true,
            sku: true,
            title: true,
            quantity: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (order.status === 'cancelled') {
      throw new BadRequestException('Stornierte Bestellung kann nicht versendet werden');
    }
    if (!order.shippingAddress) {
      throw new BadRequestException('Lieferadresse fehlt — Shopify-Order ohne shipping_address');
    }

    // ----- Rule evaluation (optional — auto-select carrier/method/package) -----
    let resolvedCarrier = data.carrier;
    let resolvedMethod = data.shippingMethod || null;
    let resolvedPackageId = data.packageId || null;
    try {
      const weightEstimate = await this.orders.computeOrderWeight(orgId, data.orderId);
      const rule = await this.rules.evaluate(orgId, {
        weightG: weightEstimate.totalG,
        totalPriceCents: Math.round(Number(order.totalPrice) * 100),
        countryCode: order.countryCode,
        productVariantIds: (order.lineItems || []).map((li: any) => li.productVariantId).filter(Boolean),
        tags: order.tags || [],
        lineCount: (order.lineItems || []).length,
      });
      if (rule) {
        if (rule.type === 'block_shipment') {
          throw new BadRequestException(`Versand blockiert (Regel): ${rule.reason || 'keine Begründung'}`);
        }
        if (rule.type === 'select_carrier' && rule.carrier) resolvedCarrier = rule.carrier as any;
        if (rule.type === 'select_method' && rule.method) resolvedMethod = rule.method;
        if (rule.type === 'select_package' && rule.packageId) resolvedPackageId = rule.packageId;
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Rule evaluation skipped: ${err?.message}`);
    }

    // Resolve or find default carrier account
    let accountId = data.carrierAccountId;
    let credentials: any = null;
    let senderData: any = null;
    if (accountId) {
      const loaded = await this.accounts.loadForUse(orgId, accountId);
      if (!loaded) throw new BadRequestException('Carrier-Konto nicht gefunden');
      credentials = loaded.credentialsDecrypted;
      senderData = loaded.senderData;
    } else {
      const def = await this.accounts.findDefault(orgId, resolvedCarrier);
      if (def) {
        accountId = def.id;
        const loaded = await this.accounts.loadForUse(orgId, def.id);
        credentials = loaded?.credentialsDecrypted || null;
        senderData = loaded?.senderData || null;
      }
    }

    // Compute weight strictly from the product database (Shipping-Profile >
    // ProductVariant.weightG from Shopify sync). No fallback — DHL rejects
    // shipments with 0 weight anyway, and silently assuming 1 kg makes the
    // merchant pay for the wrong postage tier.
    let weightG = data.weightG ?? 0;
    if (!weightG) {
      const computed = await this.orders.computeOrderWeight(orgId, data.orderId);
      if (computed.unknownCount > 0) {
        const items = computed.unknownItems
          .map((i) => `${i.title}${i.sku ? ` (SKU ${i.sku})` : ''}`)
          .slice(0, 5)
          .join(', ');
        const more = computed.unknownCount > 5 ? ` … und ${computed.unknownCount - 5} weitere` : '';
        throw new BadRequestException(
          `Versandgewicht nicht ermittelbar: bei ${computed.unknownCount} Artikel(n) fehlt das Gewicht — ${items}${more}. Bitte in Shopify oder im Versand-Modul (Produkte) Gewichte pflegen und Bestellung neu laden.`,
        );
      }
      weightG = computed.totalG;
    }
    if (weightG <= 0) {
      throw new BadRequestException(
        'Versandgewicht beträgt 0 — Label-Erstellung abgebrochen. Bitte Produkt-Gewichte in Shopify pflegen.',
      );
    }

    // Build adapter input
    const addr = order.shippingAddress as any;
    const input: ShipmentCreateInput = {
      orgId,
      orderId: order.id,
      recipient: {
        name: order.customerName || addr?.name || 'Empfänger',
        email: order.customerEmail,
        phone: order.customerPhone,
        address: {
          street: addr?.address1 || addr?.street || '',
          address2: addr?.address2 || null,
          zip: addr?.zip || '',
          city: addr?.city || '',
          province: addr?.province || null,
          country: (addr?.country_code || addr?.country || 'DE').toUpperCase().slice(0, 2),
        },
      },
      sender: senderData || {
        name: 'Filapen',
        address: { street: 'Musterstr. 1', zip: '12345', city: 'Musterstadt', country: 'DE' },
      },
      shippingMethod: data.shippingMethod ?? undefined,
      weightG,
      lengthMm: data.lengthMm ?? null,
      widthMm: data.widthMm ?? null,
      heightMm: data.heightMm ?? null,
      reference: this.buildShipmentReference(order),
    };

    const adapter = this.registry.get(data.carrier);
    const result = await adapter.createShipment(input, credentials);

    // Persist shipment
    const shipment = await this.prisma.orderShipment.create({
      data: {
        orgId,
        orderId: data.orderId,
        carrier: data.carrier,
        carrierAccountId: accountId || null,
        packageId: data.packageId || null,
        recipientName: input.recipient.name,
        recipientEmail: input.recipient.email || null,
        recipientPhone: input.recipient.phone || null,
        recipientAddress: input.recipient.address as any,
        senderAddress: input.sender as any,
        shippingMethod: data.shippingMethod || null,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl || null,
        weightG,
        lengthMm: data.lengthMm ?? null,
        widthMm: data.widthMm ?? null,
        heightMm: data.heightMm ?? null,
        cost: result.costCents != null ? (result.costCents / 100).toFixed(2) : null,
        currency: result.currency || null,
        status: 'label_created',
        apiMode: !!credentials && !!(credentials as any).billingNumber,
        notes: data.notes || null,
        createdById: userId,
      },
    });

    // Persist label (HTML → R2 for print access)
    await this.saveLabel(shipment.id, result.labelHtml, result.labelPdfBase64, result.labelContent, result.labelFormat, result.trackingNumber);

    // Initial status event
    await this.prisma.orderShipmentStatusEvent.create({
      data: {
        shipmentId: shipment.id,
        status: 'label_created',
        occurredAt: new Date(),
        source: 'api',
        note: 'Shipment erstellt',
      },
    });

    // Trigger automation email (if configured for label_created)
    this.emailAuto.triggerForStatus(orgId, shipment.id, 'label_created').catch((e) =>
      this.logger.warn(`Email-trigger on create failed: ${e?.message}`),
    );

    // Mark the order as fulfilled in Shopify (with tracking info).
    // Fire-and-forget: if Shopify is briefly unavailable we don't want to lose the
    // local shipment record. The attempt is logged and shipment.shopifyFulfilled is
    // updated once (if supported schema-wise; otherwise just logged).
    this.shopify
      .fulfillOrder(orgId, order.id, {
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl ?? null,
        carrierName: this.carrierDisplayName(data.carrier),
        notifyCustomer: true,
      })
      .then((r) => {
        if (r.ok) {
          this.logger.log(`Shopify fulfillment OK for shipment ${shipment.id} (fulfillment_id=${r.fulfillmentId})`);
        } else {
          this.logger.warn(`Shopify fulfillment skipped for shipment ${shipment.id}: ${r.error}`);
        }
      })
      .catch((e) => this.logger.warn(`Shopify fulfillment threw for shipment ${shipment.id}: ${e?.message}`));

    return this.get(orgId, shipment.id);
  }

  /**
   * Build the shipment reference that ends up on the DHL label ("Sendungsreferenz").
   * Preference order:
   *   1. Single line-item → its SKU (optionally combined with order number if >8 chars not reached)
   *   2. Multiple line-items with the same SKU → that SKU
   *   3. Otherwise → order number (adapter pads with "FILAPEN-" prefix if < 8 chars)
   */
  private buildShipmentReference(order: any): string {
    const lineItems: any[] = order.lineItems || [];
    const skus = [
      ...new Set(
        lineItems
          .map((li: any) => (li.sku ?? '').toString().trim())
          .filter(Boolean),
      ),
    ];
    const orderNo = (order.orderNumber ?? '').toString();

    if (skus.length === 1) {
      // One SKU covers the whole shipment — use it.
      // If the SKU alone is < 8 chars (DHL minimum), suffix with order number for uniqueness.
      return skus[0].length >= 8 ? skus[0] : `${skus[0]}-${orderNo}`;
    }
    // Multiple distinct SKUs or none → fall back to order number so the reference stays unique.
    return orderNo;
  }

  private carrierDisplayName(carrier: string): string {
    const map: Record<string, string> = {
      dhl: 'DHL',
      ups: 'UPS',
      dpd: 'DPD',
      hermes: 'Hermes',
      gls: 'GLS',
      custom: 'Versand',
    };
    return map[carrier] || carrier.toUpperCase();
  }

  async createBulk(orgId: string, userId: string, orderIds: string[], carrier: 'dhl' | 'custom', carrierAccountId?: string | null) {
    const results: Array<{ orderId: string; shipmentId?: string; error?: string }> = [];
    for (const orderId of orderIds) {
      try {
        const ship = await this.create(orgId, userId, { orderId, carrier, carrierAccountId });
        results.push({ orderId, shipmentId: ship.id });
      } catch (err: any) {
        results.push({ orderId, error: err.message });
      }
    }
    return { results, total: orderIds.length, succeeded: results.filter((r) => r.shipmentId).length };
  }

  // ---------------------------------------------------------------------
  // Bulk label actions — merge + print-tracking
  // ---------------------------------------------------------------------

  /**
   * Merge PDF labels for the given label IDs into a single PDF buffer.
   * Fetches each stored PDF (public R2 URL), concatenates pages with pdf-lib,
   * and optionally marks the involved labels as printed.
   *
   * Operates on LABEL IDs (nicht Shipment-IDs), damit der User im UI pro
   * Label-Zeile eine Checkbox hat — auch wenn mehrere Labels zur gleichen
   * Sendung gehören.
   */
  async bulkDownloadLabels(
    orgId: string,
    labelIds: string[],
    markPrinted: boolean,
  ): Promise<{ buffer: Buffer; labelCount: number; errors: string[] }> {
    if (!labelIds.length) {
      throw new BadRequestException('Keine Labels ausgewählt');
    }

    // Load labels scoped to this org (via shipment relation), preserving user-select order.
    const labels = await this.prisma.orderShipmentLabel.findMany({
      where: { id: { in: labelIds }, shipment: { orgId } },
      select: {
        id: true,
        url: true,
        format: true,
        trackingNumber: true,
      },
    });
    const orderIndex = new Map(labelIds.map((id, i) => [id, i]));
    labels.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    // Double-check: both format flag AND URL extension must indicate PDF
    // (Legacy stub labels haben Format "pdf_100x150" aber URL endet auf .html —
    // die können pdf-lib nicht laden).
    const isPdfLabel = (l: { format: string; url: string }) =>
      l.format.startsWith('pdf_') && /\.pdf(\?|$)/i.test(l.url);

    const errors: string[] = [];

    const targets: Array<{ labelId: string; url: string; tracking: string; format: string }> = labels
      .filter(isPdfLabel)
      .map((l) => ({
        labelId: l.id,
        url: l.url,
        tracking: l.trackingNumber ?? '',
        format: l.format,
      }));

    const skippedStubs = labels.length - targets.length;
    if (skippedStubs > 0) {
      errors.push(
        `${skippedStubs} Label(s) übersprungen — kein echtes PDF (z.B. alte HTML-Stub-Labels aus Test-Modus).`,
      );
    }

    if (targets.length === 0) {
      throw new BadRequestException(
        'Keine druckbaren PDF-Labels in der Auswahl. Nur echte DHL-API-Labels sind druckbar, HTML-Stubs aus dem Test-Modus nicht.',
      );
    }

    const merged = await PDFDocument.create();

    for (const t of targets) {
      try {
        const res = await fetch(t.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const pdfBytes = Buffer.from(await res.arrayBuffer());
        const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
      } catch (err: any) {
        const msg = `${t.tracking || t.labelId}: ${err.message}`;
        this.logger.warn(`bulkDownloadLabels — skip label: ${msg}`);
        errors.push(msg);
      }
    }

    if (merged.getPageCount() === 0) {
      throw new BadRequestException(
        `Kein Label konnte zusammengeführt werden. Fehler: ${errors.join('; ')}`,
      );
    }

    const bytes = await merged.save();
    const buffer = Buffer.from(bytes);

    if (markPrinted) {
      // Print-Tracking darf niemals die Label-Auslieferung blockieren: Wenn die DB
      // noch nicht migriert ist (fehlende Spalten), die PDF-Datei soll trotzdem
      // zurück kommen. Fehler landet im Log, User bekommt die Datei.
      try {
        await this.prisma.orderShipmentLabel.updateMany({
          where: { id: { in: targets.map((t) => t.labelId) } },
          data: {
            printedAt: new Date(),
            printCount: { increment: 1 },
          },
        });
      } catch (err: any) {
        this.logger.error(
          `Mark-as-printed failed for ${targets.length} labels (wahrscheinlich fehlt Migration add_label_print_tracking.sql): ${err.message}`,
        );
        errors.push(
          `Druck-Tracking konnte nicht gespeichert werden (Migration prüfen): ${err.message}`,
        );
      }
    }

    return { buffer, labelCount: merged.getPageCount(), errors };
  }

  /**
   * Erzeugt ein PDF mit Lieferscheinen — ein Blatt pro Sendung, in der gleichen
   * Reihenfolge wie die übergebenen labelIds. Pflichtfelder:
   *   - Anschrift Kunde
   *   - Bestellnummer
   *   - Plattform (Shop-Plattform der Bestellung, z.B. shopify / amazon / manuell)
   *   - SKU-Liste mit Menge (Format: "ABC-123 ×2")
   */
  async bulkGenerateDeliveryNotes(
    orgId: string,
    labelIds: string[],
  ): Promise<{ buffer: Buffer; pageCount: number; errors: string[] }> {
    if (!labelIds.length) {
      throw new BadRequestException('Keine Labels ausgewählt');
    }

    // Load labels with everything needed for the delivery note. Scoped to org via shipment relation.
    const labels = await this.prisma.orderShipmentLabel.findMany({
      where: { id: { in: labelIds }, shipment: { orgId } },
      select: {
        id: true,
        shipmentId: true,
        shipment: {
          select: {
            id: true,
            recipientName: true,
            recipientAddress: true,
            order: {
              select: {
                orderNumber: true,
                sourceName: true,
                shop: { select: { platform: true, name: true } },
                lineItems: {
                  select: { sku: true, title: true, quantity: true },
                },
              },
            },
          },
        },
      },
    });

    // Preserve the user-selected order (same as bulkDownloadLabels).
    const orderIndex = new Map(labelIds.map((id, i) => [id, i]));
    labels.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    const errors: string[] = [];
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    for (const l of labels) {
      try {
        const s = l.shipment;
        const o = s.order;
        const platform = o?.shop?.platform || o?.sourceName || 'manuell';
        const lineItems = o?.lineItems ?? [];
        this.renderDeliveryNotePage(pdf, font, bold, {
          orderNumber: o?.orderNumber ?? '—',
          platform: String(platform),
          recipientName: s.recipientName,
          recipientAddress: s.recipientAddress as any,
          lineItems,
        });
      } catch (err: any) {
        const msg = `${l.shipmentId}: ${err.message}`;
        this.logger.warn(`bulkGenerateDeliveryNotes — skip: ${msg}`);
        errors.push(msg);
      }
    }

    if (pdf.getPageCount() === 0) {
      throw new BadRequestException(
        `Kein Lieferschein konnte erzeugt werden. Fehler: ${errors.join('; ')}`,
      );
    }

    const bytes = await pdf.save();
    return { buffer: Buffer.from(bytes), pageCount: pdf.getPageCount(), errors };
  }

  /**
   * Zeichnet einen einzelnen Lieferschein auf eine neue A4-Seite.
   * Layout: Header oben, Anschrift + Meta-Block darunter, Artikel-Tabelle am Hauptteil.
   */
  private renderDeliveryNotePage(
    pdf: PDFDocument,
    font: PDFFont,
    bold: PDFFont,
    data: {
      orderNumber: string;
      platform: string;
      recipientName: string;
      recipientAddress: any;
      lineItems: Array<{ sku: string | null; title: string; quantity: number }>;
    },
  ): void {
    const page = pdf.addPage([595.28, 841.89]); // A4 portrait in pt
    const { width, height } = page.getSize();
    const margin = 50;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);

    // Header
    page.drawText('Lieferschein', {
      x: margin,
      y: height - margin - 4,
      size: 22,
      font: bold,
      color: black,
    });
    page.drawLine({
      start: { x: margin, y: height - margin - 14 },
      end: { x: width - margin, y: height - margin - 14 },
      thickness: 1,
      color: gray,
    });

    // Left: Recipient address block
    let y = height - margin - 50;
    page.drawText('Lieferadresse', { x: margin, y, size: 10, font: bold, color: gray });
    y -= 18;
    const addrLines = this.formatRecipientLines(data.recipientName, data.recipientAddress);
    for (const line of addrLines) {
      page.drawText(this.sanitize(line), { x: margin, y, size: 12, font, color: black });
      y -= 16;
    }

    // Right: meta (order number + platform)
    const metaX = 340;
    let metaY = height - margin - 50;
    page.drawText('Bestellnummer', { x: metaX, y: metaY, size: 10, font: bold, color: gray });
    metaY -= 16;
    page.drawText(this.sanitize(data.orderNumber), {
      x: metaX,
      y: metaY,
      size: 12,
      font,
      color: black,
    });
    metaY -= 24;
    page.drawText('Plattform', { x: metaX, y: metaY, size: 10, font: bold, color: gray });
    metaY -= 16;
    page.drawText(this.sanitize(this.platformLabel(data.platform)), {
      x: metaX,
      y: metaY,
      size: 12,
      font,
      color: black,
    });

    // Item table
    const tableY = Math.min(y, metaY) - 32;
    page.drawLine({
      start: { x: margin, y: tableY + 20 },
      end: { x: width - margin, y: tableY + 20 },
      thickness: 0.5,
      color: gray,
    });
    page.drawText('Artikel', { x: margin, y: tableY + 4, size: 10, font: bold, color: gray });
    page.drawText('SKU', { x: margin + 260, y: tableY + 4, size: 10, font: bold, color: gray });
    page.drawText('Menge', { x: width - margin - 50, y: tableY + 4, size: 10, font: bold, color: gray });
    page.drawLine({
      start: { x: margin, y: tableY - 4 },
      end: { x: width - margin, y: tableY - 4 },
      thickness: 0.5,
      color: gray,
    });

    let rowY = tableY - 22;
    const lineHeight = 16;
    for (const item of data.lineItems) {
      if (rowY < margin + 40) break; // stop if out of space — extremely long orders truncate
      const sku = item.sku || '—';
      const title = this.truncate(item.title || '—', 42);
      const qtyText = `×${item.quantity}`;
      page.drawText(this.sanitize(title), { x: margin, y: rowY, size: 11, font, color: black });
      page.drawText(this.sanitize(sku), { x: margin + 260, y: rowY, size: 11, font, color: black });
      page.drawText(qtyText, { x: width - margin - 50, y: rowY, size: 11, font, color: black });
      rowY -= lineHeight;
    }

    // Footer
    page.drawText(`Gedruckt am ${new Date().toLocaleDateString('de-DE')}`, {
      x: margin,
      y: margin - 10,
      size: 9,
      font,
      color: gray,
    });
  }

  private formatRecipientLines(name: string, addr: any): string[] {
    const lines: string[] = [];
    if (name) lines.push(name);
    const company = addr?.company;
    if (company && company !== name) lines.push(String(company));
    // street1 + house number on same line; street2 below if present
    const street1 = [addr?.address1, addr?.houseNumber].filter(Boolean).join(' ');
    if (street1) lines.push(street1);
    if (addr?.address2) lines.push(String(addr.address2));
    const cityLine = [addr?.zip, addr?.city].filter(Boolean).join(' ');
    if (cityLine) lines.push(cityLine);
    if (addr?.province) lines.push(String(addr.province));
    if (addr?.country) lines.push(String(addr.country));
    return lines;
  }

  private platformLabel(p: string): string {
    const map: Record<string, string> = {
      shopify: 'Shopify',
      amazon: 'Amazon',
      etsy: 'Etsy',
      ebay: 'eBay',
      woocommerce: 'WooCommerce',
      manuell: 'Manuell',
    };
    const key = p.toLowerCase();
    return map[key] ?? p;
  }

  /**
   * pdf-lib's Helvetica (WinAnsi) rejects characters outside its encoding, which
   * crashes on emoji or CJK. Strip to WinAnsi-safe set so the delivery note
   * generation never fails over a funky address line.
   */
  private sanitize(s: string | null | undefined): string {
    if (!s) return '';
    // Keep printable latin-1 range; drop everything else.
    // eslint-disable-next-line no-control-regex
    return s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').trim();
  }

  private truncate(s: string, max: number): string {
    // '...' instead of '…' because our sanitize() strips non-Latin-1 chars.
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
  }

  /**
   * Aufräumen alter Stub-Sendungen (aus der Zeit bevor die DHL-API funktionierte).
   * Identifikation:
   *   - Tracking-Nr beginnt mit "STUB" (so erzeugt der Stub-Adapter Dummy-Nummern)
   *   - ODER Label-URL endet auf .html (HTML-Stub-Labels statt echter PDFs)
   * Löscht die zugehörigen Shipments komplett — mit Cascade auch Labels +
   * Status-Events + E-Mail-Logs (falls Cascade auf dem Modell gesetzt ist).
   */
  async cleanupStubShipments(orgId: string): Promise<{ deletedShipments: number; deletedLabels: number }> {
    const stubShipments = await this.prisma.orderShipment.findMany({
      where: {
        orgId,
        OR: [
          { trackingNumber: { startsWith: 'STUB' } },
          { labels: { some: { url: { endsWith: '.html' } } } },
        ],
      },
      select: { id: true, _count: { select: { labels: true } } },
    });

    if (stubShipments.length === 0) {
      return { deletedShipments: 0, deletedLabels: 0 };
    }

    const ids = stubShipments.map((s) => s.id);
    const deletedLabels = stubShipments.reduce((sum, s) => sum + s._count.labels, 0);

    // Delete in order to avoid FK constraint hiccups when cascade isn't enforced at DB level
    await this.prisma.orderShipmentLabel.deleteMany({ where: { shipmentId: { in: ids } } });
    await this.prisma.orderShipmentStatusEvent.deleteMany({ where: { shipmentId: { in: ids } } });
    // Email logs — best effort, table might not have shipmentId reference in all deployments
    try {
      await this.prisma.shippingEmailLog.deleteMany({ where: { shipmentId: { in: ids } } });
    } catch {}
    const del = await this.prisma.orderShipment.deleteMany({ where: { id: { in: ids }, orgId } });

    this.logger.log(`cleanupStubShipments: ${del.count} shipments + ${deletedLabels} labels removed for org ${orgId}`);
    return { deletedShipments: del.count, deletedLabels };
  }

  /** Mark a single label printed / unprinted. */
  async setLabelPrinted(orgId: string, labelId: string, printed: boolean) {
    const label = await this.prisma.orderShipmentLabel.findFirst({
      where: { id: labelId, shipment: { orgId } },
      select: { id: true, printedAt: true },
    });
    if (!label) throw new NotFoundException('Label nicht gefunden');
    await this.prisma.orderShipmentLabel.update({
      where: { id: labelId },
      data: printed
        ? { printedAt: label.printedAt ?? new Date(), printCount: { increment: 1 } }
        : { printedAt: null },
    });
    return { ok: true };
  }

  async setStatus(orgId: string, shipmentId: string, status: any, note?: string) {
    const existing = await this.prisma.orderShipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
    if (existing.status === status) return this.get(orgId, shipmentId);

    const patch: any = { status };
    if (status === 'handed_to_carrier' && !existing.handedOverAt) patch.handedOverAt = new Date();
    if (status === 'delivered' && !existing.deliveredAt) patch.deliveredAt = new Date();
    await this.prisma.orderShipment.update({ where: { id: shipmentId }, data: patch });
    await this.prisma.orderShipmentStatusEvent.create({
      data: {
        shipmentId,
        status,
        occurredAt: new Date(),
        source: 'manual',
        note: note || null,
      },
    });

    // Trigger automation email for the new status
    this.emailAuto.triggerForStatus(orgId, shipmentId, status).catch((e) =>
      this.logger.warn(`Email-trigger on setStatus failed: ${e?.message}`),
    );

    return this.get(orgId, shipmentId);
  }

  async updateTracking(orgId: string, shipmentId: string, trackingNumber: string, trackingUrl?: string) {
    const existing = await this.prisma.orderShipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
    await this.prisma.orderShipment.update({
      where: { id: shipmentId },
      data: { trackingNumber, trackingUrl: trackingUrl || existing.trackingUrl },
    });
    return this.get(orgId, shipmentId);
  }

  async delete(orgId: string, shipmentId: string) {
    const existing = await this.prisma.orderShipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
    if (['delivered', 'returned'].includes(existing.status)) {
      throw new BadRequestException('Abgeschlossene Sendungen können nicht gelöscht werden');
    }
    await this.prisma.orderShipment.delete({ where: { id: shipmentId } });
    return { deleted: true };
  }

  // --- Labels ---

  private async saveLabel(
    shipmentId: string,
    html: string | undefined,
    pdfBase64: string | undefined,
    zpl: string | undefined,
    format: any,
    trackingNumber: string,
  ): Promise<void> {
    // Store HTML label (primary for browser-print + thermoprinter). Real PDF
    // takes priority when carrier API is connected.
    let storageKey: string;
    let url: string;
    let rawContent: string | null = zpl || null;

    if (pdfBase64) {
      // Real carrier returned PDF — upload as PDF
      const buf = Buffer.from(pdfBase64, 'base64');
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.pdf`;
      url = await this.storage.upload(storageKey, buf, 'application/pdf');
    } else if (html) {
      // Stub HTML label
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.html`;
      url = await this.storage.upload(storageKey, Buffer.from(html, 'utf8'), 'text/html; charset=utf-8');
    } else {
      // ZPL only
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.zpl`;
      url = await this.storage.upload(storageKey, Buffer.from(zpl || '', 'utf8'), 'text/plain; charset=utf-8');
    }

    const dimensions = this.parseLabelDimensions(format);
    await this.prisma.orderShipmentLabel.create({
      data: {
        shipmentId,
        sequenceNumber: 1,
        trackingNumber,
        format,
        widthMm: dimensions.width,
        heightMm: dimensions.height,
        storageKey,
        url,
        rawContent,
      },
    });
  }

  private parseLabelDimensions(format: string): { width: number | null; height: number | null } {
    if (format === 'pdf_100x150' || format === 'zpl_100x150') return { width: 100, height: 150 };
    if (format === 'pdf_103x199' || format === 'zpl_103x199') return { width: 103, height: 199 };
    if (format === 'pdf_a4') return { width: 210, height: 297 };
    return { width: null, height: null };
  }

  /**
   * Regenerate a label for an existing shipment (e.g. after address correction).
   */
  async regenerateLabel(orgId: string, shipmentId: string) {
    const shipment = await this.get(orgId, shipmentId);
    const adapter = this.registry.get(shipment.carrier);
    const loaded = shipment.carrierAccountId
      ? await this.accounts.loadForUse(orgId, shipment.carrierAccountId)
      : null;
    const credentials = loaded?.credentialsDecrypted || null;

    const input: ShipmentCreateInput = {
      orgId,
      orderId: shipment.orderId,
      recipient: {
        name: shipment.recipientName,
        email: shipment.recipientEmail,
        phone: shipment.recipientPhone,
        address: shipment.recipientAddress as any,
      },
      sender: (shipment.senderAddress as any) || {
        name: 'Filapen',
        address: { street: 'Musterstr. 1', zip: '12345', city: 'Musterstadt', country: 'DE' },
      },
      shippingMethod: shipment.shippingMethod ?? undefined,
      weightG: shipment.weightG,
      lengthMm: shipment.lengthMm,
      widthMm: shipment.widthMm,
      heightMm: shipment.heightMm,
      reference: shipment.trackingNumber || undefined,
    };

    const result = await adapter.createShipment(input, credentials);
    const existingLabels = await this.prisma.orderShipmentLabel.count({ where: { shipmentId } });
    const dimensions = this.parseLabelDimensions(result.labelFormat);

    let storageKey: string;
    let url: string;
    let rawContent: string | null = result.labelContent || null;
    if (result.labelPdfBase64) {
      const buf = Buffer.from(result.labelPdfBase64, 'base64');
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.pdf`;
      url = await this.storage.upload(storageKey, buf, 'application/pdf');
    } else if (result.labelHtml) {
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.html`;
      url = await this.storage.upload(storageKey, Buffer.from(result.labelHtml, 'utf8'), 'text/html; charset=utf-8');
    } else {
      storageKey = `shipping/${shipmentId}/${Date.now()}-label.zpl`;
      url = await this.storage.upload(storageKey, Buffer.from(result.labelContent || '', 'utf8'), 'text/plain');
    }

    return this.prisma.orderShipmentLabel.create({
      data: {
        shipmentId,
        sequenceNumber: existingLabels + 1,
        trackingNumber: result.trackingNumber,
        format: result.labelFormat,
        widthMm: dimensions.width,
        heightMm: dimensions.height,
        storageKey,
        url,
        rawContent,
      },
    });
  }
}
