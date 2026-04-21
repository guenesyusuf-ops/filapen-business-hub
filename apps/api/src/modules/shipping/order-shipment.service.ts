import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { CarrierAccountService } from './carrier-account.service';
import { ShippingOrderService } from './shipping-order.service';
import type { ShipmentCreateInput } from './carriers/carrier-adapter.interface';

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
          labels: { select: { id: true, url: true, format: true, trackingNumber: true } },
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
    const order = await this.prisma.order.findFirst({ where: { id: data.orderId, orgId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (order.status === 'cancelled') {
      throw new BadRequestException('Stornierte Bestellung kann nicht versendet werden');
    }
    if (!order.shippingAddress) {
      throw new BadRequestException('Lieferadresse fehlt — Shopify-Order ohne shipping_address');
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
      const def = await this.accounts.findDefault(orgId, data.carrier);
      if (def) {
        accountId = def.id;
        const loaded = await this.accounts.loadForUse(orgId, def.id);
        credentials = loaded?.credentialsDecrypted || null;
        senderData = loaded?.senderData || null;
      }
    }

    // Compute weight if not provided
    let weightG = data.weightG ?? 0;
    if (!weightG) {
      const computed = await this.orders.computeOrderWeight(orgId, data.orderId);
      weightG = computed.totalG;
      if (computed.unknownCount > 0) {
        this.logger.warn(`Order ${data.orderId}: ${computed.unknownCount} items lack shipping profile`);
      }
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
      reference: order.orderNumber,
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

    return this.get(orgId, shipment.id);
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

  async setStatus(orgId: string, shipmentId: string, status: any, note?: string) {
    const existing = await this.prisma.orderShipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
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
