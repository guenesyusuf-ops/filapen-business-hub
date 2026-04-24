import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LineItemInput {
  position?: number;
  title: string;
  supplierArticleNumber?: string | null;
  ean?: string | null;
  unitsPerCarton?: number | null;
  quantity: number;
  unitPriceNet: number;
  lineNet?: number;
  matchedProductVariantId?: string | null;
}

export interface SalesOrderInput {
  customerId: string;
  externalOrderNumber?: string | null;
  orderDate?: string | Date | null;
  requiredDeliveryDate?: string | Date | null;
  contactPerson?: string | null;
  shippingAddress?: any;
  billingAddress?: any;
  paymentTerms?: string | null;
  currency?: string;
  notes?: string | null;
  lineItems?: LineItemInput[];
  assignedToId?: string | null;
  sourceDocumentId?: string | null;
  extractionConfidence?: number | null;
}

@Injectable()
export class SalesOrderService {
  private readonly logger = new Logger(SalesOrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async nextOrderNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VK-${year}-`;
    const latest = await this.prisma.salesOrder.findFirst({
      where: { orgId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const lastNum = latest?.orderNumber?.split('-')[2];
    const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private computeTotal(items: LineItemInput[]): number {
    return items.reduce((sum, i) => {
      const line = i.lineNet != null ? Number(i.lineNet) : Number(i.quantity) * Number(i.unitPriceNet);
      return sum + (Number.isFinite(line) ? line : 0);
    }, 0);
  }

  async list(
    orgId: string,
    filters: {
      status?: string;
      customerId?: string;
      search?: string;
      urgency?: 'urgent' | 'overdue';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { externalOrderNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { customer: { companyName: { contains: filters.search, mode: 'insensitive' as const } } },
      ];
    }
    // Urgency filters: in-verzug = past due + not shipped; urgent = within 3d + not shipped
    if (filters.urgency === 'overdue') {
      where.shippedAt = null;
      where.requiredDeliveryDate = { lt: new Date() };
    }
    if (filters.urgency === 'urgent') {
      const threeDaysOut = new Date();
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);
      where.shippedAt = null;
      where.requiredDeliveryDate = { gte: new Date(), lte: threeDaysOut };
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true, customerNumber: true } },
          // matchedVariant → product → imageUrl damit die Listenansicht kleine
          // Produkt-Kacheln rendern kann. Nicht alle Line-Items sind gematched
          // (unbekannte SKUs aus Import), daher nullable Chain.
          lineItems: {
            select: {
              id: true, title: true, quantity: true,
              ean: true, supplierArticleNumber: true,
              matchedVariant: {
                select: { id: true, sku: true, product: { select: { id: true, title: true, imageUrl: true } } },
              },
            },
          },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    // On-the-fly Matching: wenn matchedVariant NULL ist aber ean/supplier-
    // ArticleNumber gesetzt, lookup via ProductVariant.barcode oder .sku.
    // So sehen Kachel-Bilder auch für Line-Items erscheinen, die VOR dem
    // nachträglichen EAN-Eintrag importiert wurden. Batch-Lookup damit's
    // performant bleibt.
    await this.enrichLineItemVariants(orgId, items as any[]);

    return { items, total };
  }

  /**
   * Ergänzt Line-Items deren matchedVariantId NULL ist, aber deren ean oder
   * supplierArticleNumber zu einer ProductVariant passt. Mutiert die Items
   * in-place mit einem zusätzlichen matchedVariant-Objekt (gleiche Shape wie
   * von Prisma). Ein DB-Call pro Feld (EAN + SKU) für alle offenen Items.
   */
  private async enrichLineItemVariants(orgId: string, orders: any[]): Promise<void> {
    const unmatched: any[] = [];
    for (const o of orders) {
      for (const li of o.lineItems ?? []) {
        if (!li.matchedVariant && (li.ean || li.supplierArticleNumber)) {
          unmatched.push(li);
        }
      }
    }
    if (unmatched.length === 0) return;

    const eans = Array.from(new Set(unmatched.map((li) => li.ean).filter(Boolean))) as string[];
    const skus = Array.from(new Set(unmatched.map((li) => li.supplierArticleNumber).filter(Boolean))) as string[];

    const variants = await this.prisma.productVariant.findMany({
      where: {
        orgId,
        OR: [
          eans.length ? { barcode: { in: eans } } : undefined,
          skus.length ? { sku: { in: skus } } : undefined,
        ].filter(Boolean) as any[],
      },
      select: {
        id: true, sku: true, barcode: true,
        product: { select: { id: true, title: true, imageUrl: true } },
      },
    });

    // Index by barcode AND by sku für schnelle Zuordnung
    const byBarcode = new Map<string, any>();
    const bySku = new Map<string, any>();
    for (const v of variants) {
      if (v.barcode) byBarcode.set(v.barcode, v);
      if (v.sku) bySku.set(v.sku, v);
    }

    for (const li of unmatched) {
      const v = (li.ean && byBarcode.get(li.ean)) || (li.supplierArticleNumber && bySku.get(li.supplierArticleNumber));
      if (v) {
        li.matchedVariant = {
          id: v.id,
          sku: v.sku,
          product: v.product,
        };
      }
    }
  }

  async get(orgId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, orgId },
      include: {
        customer: true,
        lineItems: { orderBy: { position: 'asc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        shipments: { orderBy: { shippedAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  async create(orgId: string, userId: string, data: SalesOrderInput) {
    if (!data.customerId) throw new BadRequestException('customerId erforderlich');
    const customer = await this.prisma.salesCustomer.findFirst({
      where: { id: data.customerId, orgId },
    });
    if (!customer) throw new BadRequestException('Kunde nicht gefunden');

    const orderNumber = await this.nextOrderNumber(orgId);
    const items = data.lineItems ?? [];
    const total = this.computeTotal(items);

    const order = await this.prisma.salesOrder.create({
      data: {
        orgId,
        orderNumber,
        customerId: data.customerId,
        externalOrderNumber: data.externalOrderNumber || null,
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
        requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : null,
        contactPerson: data.contactPerson || customer.contactPerson || null,
        shippingAddress: data.shippingAddress ?? customer.shippingAddress ?? null,
        billingAddress: data.billingAddress ?? customer.billingAddress ?? null,
        paymentTerms: data.paymentTerms || customer.paymentTerms || null,
        currency: data.currency || 'EUR',
        totalNet: total.toFixed(2),
        status: 'draft',
        createdById: userId,
        assignedToId: data.assignedToId || null,
        sourceDocumentId: data.sourceDocumentId || null,
        extractionConfidence: data.extractionConfidence ?? null,
        notes: data.notes || null,
        lineItems: {
          create: items.map((i, idx) => ({
            orgId,
            position: i.position ?? idx + 1,
            title: i.title,
            supplierArticleNumber: i.supplierArticleNumber || null,
            ean: i.ean || null,
            unitsPerCarton: i.unitsPerCarton ?? null,
            quantity: i.quantity,
            unitPriceNet: Number(i.unitPriceNet).toFixed(4),
            lineNet: (i.lineNet != null ? Number(i.lineNet) : i.quantity * Number(i.unitPriceNet)).toFixed(2),
            matchedProductVariantId: i.matchedProductVariantId || null,
          })),
        },
        events: {
          create: {
            orgId,
            type: data.sourceDocumentId ? 'imported' : 'created',
            actorId: userId,
            note: data.sourceDocumentId ? 'Aus PDF importiert' : 'Manuell angelegt',
          },
        },
      },
      include: { customer: true, lineItems: true, documents: true },
    });
    return order;
  }

  async update(orgId: string, userId: string, id: string, data: Partial<SalesOrderInput>) {
    await this.get(orgId, id);
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data.externalOrderNumber !== undefined ? { externalOrderNumber: data.externalOrderNumber } : {}),
        ...(data.orderDate !== undefined ? { orderDate: data.orderDate ? new Date(data.orderDate) : null } : {}),
        ...(data.requiredDeliveryDate !== undefined ? { requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : null } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.shippingAddress !== undefined ? { shippingAddress: data.shippingAddress } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
        events: {
          create: {
            orgId,
            type: 'edited',
            actorId: userId,
            note: 'Kopfdaten geändert',
          },
        },
      },
    });
    return updated;
  }

  async replaceLineItems(orgId: string, userId: string, id: string, items: LineItemInput[]) {
    await this.get(orgId, id);
    const total = this.computeTotal(items);
    await this.prisma.$transaction([
      this.prisma.salesOrderLineItem.deleteMany({ where: { orderId: id } }),
      this.prisma.salesOrderLineItem.createMany({
        data: items.map((i, idx) => ({
          orgId,
          orderId: id,
          position: i.position ?? idx + 1,
          title: i.title,
          supplierArticleNumber: i.supplierArticleNumber || null,
          ean: i.ean || null,
          unitsPerCarton: i.unitsPerCarton ?? null,
          quantity: i.quantity,
          unitPriceNet: Number(i.unitPriceNet).toFixed(4),
          lineNet: (i.lineNet != null ? Number(i.lineNet) : i.quantity * Number(i.unitPriceNet)).toFixed(2),
          matchedProductVariantId: i.matchedProductVariantId || null,
        })),
      }),
      this.prisma.salesOrder.update({
        where: { id },
        data: { totalNet: total.toFixed(2) },
      }),
      this.prisma.salesOrderEvent.create({
        data: { orgId, orderId: id, type: 'edited', actorId: userId, note: 'Positionen aktualisiert' },
      }),
    ]);
    return this.get(orgId, id);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.salesOrder.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Toggle a status badge (Auftragsbestätigung / Versand / Rechnung). When a
   * badge gets flipped on we set the corresponding timestamp and advance the
   * status machine so the list view can show meaningful progress.
   */
  async toggleStatus(
    orgId: string,
    userId: string,
    id: string,
    kind: 'confirmation_sent' | 'shipped' | 'invoice_sent' | 'paid',
    on: boolean,
  ) {
    const order = await this.get(orgId, id);
    const now = new Date();
    const data: any = { events: { create: { orgId, type: kind, actorId: userId } } };

    if (kind === 'confirmation_sent') {
      data.confirmationSentAt = on ? (order.confirmationSentAt ?? now) : null;
      if (on && order.status === 'draft') data.status = 'confirmed';
    }
    if (kind === 'shipped') {
      data.shippedAt = on ? (order.shippedAt ?? now) : null;
      if (on) data.status = 'shipped';
      else if (order.status === 'shipped') data.status = 'confirmed';
    }
    if (kind === 'invoice_sent') {
      data.invoiceSentAt = on ? (order.invoiceSentAt ?? now) : null;
      if (on && order.status === 'shipped') data.status = 'invoiced';
    }
    if (kind === 'paid') {
      data.paidAt = on ? (order.paidAt ?? now) : null;
      // Paid implies the order is fully closed out — advance to completed when
      // it was invoiced. Otherwise leave status alone (user might mark paid
      // early before the invoice flow).
      if (on && (order.status === 'invoiced' || order.invoiceSentAt)) data.status = 'completed';
      else if (!on && order.status === 'completed') data.status = 'invoiced';
    }

    return this.prisma.salesOrder.update({ where: { id }, data, include: { customer: true } });
  }

  async updateShipping(
    orgId: string,
    userId: string,
    id: string,
    data: { trackingNumbers?: string[]; shippingCarrierNote?: string | null; shippedAt?: string | Date | null },
  ) {
    await this.get(orgId, id);
    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data.trackingNumbers !== undefined ? { trackingNumbers: data.trackingNumbers } : {}),
        ...(data.shippingCarrierNote !== undefined ? { shippingCarrierNote: data.shippingCarrierNote } : {}),
        ...(data.shippedAt !== undefined ? { shippedAt: data.shippedAt ? new Date(data.shippedAt) : null } : {}),
        events: { create: { orgId, type: 'edited', actorId: userId, note: 'Versand-Info geändert' } },
      },
    });
  }

  /**
   * Legt eine neue (Teil-)Sendung an, ordnet die angegebenen Line-Items
   * dieser Sendung zu und aktualisiert den Gesamt-Status des Orders:
   *
   *   - ALLE LineItems shipmentId → order.status = 'shipped', shippedAt = jetzt
   *   - Einige LineItems shipmentId → status bleibt (Teilsendung, kein 'shipped')
   *
   * Eingabe-Validierung:
   *   - lineItemIds müssen zur selben Order gehören
   *   - lineItemIds dürfen nicht bereits versendet sein
   */
  async createShipment(
    orgId: string,
    userId: string,
    orderId: string,
    data: { lineItemIds: string[]; trackingNumbers?: string[]; carrierNote?: string | null; notes?: string | null },
  ) {
    if (!data.lineItemIds?.length) {
      throw new BadRequestException('Mindestens eine Position auswählen');
    }
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, orgId },
      include: { lineItems: { select: { id: true, shipmentId: true } } },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');

    // Alle ausgewählten IDs müssen zu dieser Order gehören UND noch offen sein
    const validIds = new Set(order.lineItems.map((li) => li.id));
    const alreadyShipped = new Set(order.lineItems.filter((li) => li.shipmentId).map((li) => li.id));
    for (const liId of data.lineItemIds) {
      if (!validIds.has(liId)) {
        throw new BadRequestException(`Position ${liId} gehört nicht zu dieser Bestellung`);
      }
      if (alreadyShipped.has(liId)) {
        throw new BadRequestException(`Position ${liId} ist bereits versendet`);
      }
    }

    const tracking = (data.trackingNumbers ?? []).map((t) => t.trim()).filter(Boolean);

    const shipment = await this.prisma.$transaction(async (tx) => {
      const s = await tx.salesOrderShipment.create({
        data: {
          orgId,
          orderId,
          trackingNumbers: tracking,
          carrierNote: data.carrierNote || null,
          notes: data.notes || null,
          createdById: userId,
        },
      });
      await tx.salesOrderLineItem.updateMany({
        where: { id: { in: data.lineItemIds }, orderId },
        data: { shipmentId: s.id },
      });
      return s;
    });

    // Check if everything is shipped now → aktualisiere Gesamt-Order-Status
    const remaining = await this.prisma.salesOrderLineItem.count({
      where: { orderId, shipmentId: null },
    });
    const now = new Date();
    const allShipped = remaining === 0;
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        ...(allShipped ? {
          shippedAt: now,
          status: order.status === 'draft' || order.status === 'confirmed' ? 'shipped' : order.status,
        } : {}),
        // Tracking-Nummern aggregieren (alle Shipments) damit Legacy-Anzeige
        // weiter funktioniert. Re-fetch + neu berechnen.
        trackingNumbers: await this.aggregateTrackingNumbers(orderId),
        events: {
          create: {
            orgId, type: 'shipped', actorId: userId,
            note: allShipped
              ? `Restliche Positionen versendet (${data.lineItemIds.length} Pos., ${tracking.length} Tracking-Nrn)`
              : `Teilsendung: ${data.lineItemIds.length} Positionen versendet (${tracking.length} Tracking-Nrn), ${remaining} noch offen`,
          },
        },
      },
    });

    return shipment;
  }

  async deleteShipment(orgId: string, userId: string, orderId: string, shipmentId: string) {
    const shipment = await this.prisma.salesOrderShipment.findFirst({
      where: { id: shipmentId, orderId, orgId },
      include: { lineItems: { select: { id: true } } },
    });
    if (!shipment) throw new NotFoundException('Sendung nicht gefunden');

    await this.prisma.$transaction(async (tx) => {
      // Line-Items wieder freigeben (shipmentId → null geschieht automatisch
      // via ON DELETE SET NULL, aber wir setzen es explizit um Race-Conditions
      // zu vermeiden wenn Cascade-Order anders ist).
      await tx.salesOrderLineItem.updateMany({
        where: { shipmentId },
        data: { shipmentId: null },
      });
      await tx.salesOrderShipment.delete({ where: { id: shipmentId } });
    });

    // Order-Status neu berechnen: wenn vorher shipped aber jetzt nicht alle
    // versendet sind → zurück auf 'confirmed'
    const stillOpen = await this.prisma.salesOrderLineItem.count({
      where: { orderId, shipmentId: null },
    });
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        ...(stillOpen > 0 ? { shippedAt: null, status: 'confirmed' } : {}),
        trackingNumbers: await this.aggregateTrackingNumbers(orderId),
        events: {
          create: {
            orgId, type: 'edited', actorId: userId,
            note: `Sendung ${shipmentId.slice(0, 8)} storniert — ${shipment.lineItems.length} Positionen wieder offen`,
          },
        },
      },
    });

    return { ok: true };
  }

  private async aggregateTrackingNumbers(orderId: string): Promise<string[]> {
    const shipments = await this.prisma.salesOrderShipment.findMany({
      where: { orderId },
      select: { trackingNumbers: true },
    });
    const all = new Set<string>();
    for (const s of shipments) for (const t of s.trackingNumbers) all.add(t);
    return Array.from(all);
  }

  /**
   * Dashboard KPIs — counters for the landing card grid.
   */
  async dashboard(orgId: string) {
    const now = new Date();
    const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [open, urgent, overdue, monthRevenueRaw] = await Promise.all([
      this.prisma.salesOrder.count({ where: { orgId, shippedAt: null, status: { notIn: ['cancelled', 'completed'] } } }),
      this.prisma.salesOrder.count({
        where: {
          orgId, shippedAt: null,
          requiredDeliveryDate: { gte: now, lte: in3Days },
        },
      }),
      this.prisma.salesOrder.count({
        where: { orgId, shippedAt: null, requiredDeliveryDate: { lt: now } },
      }),
      this.prisma.salesOrder.aggregate({
        where: { orgId, createdAt: { gte: monthStart } },
        _sum: { totalNet: true },
      }),
    ]);
    return {
      open,
      urgent,
      overdue,
      monthRevenue: Number(monthRevenueRaw._sum.totalNet ?? 0),
    };
  }
}
