import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseAuditService } from './purchase-audit.service';
import { Prisma } from '@prisma/client';

export interface ShipmentItemInput {
  purchaseOrderItemId: string;
  quantity: number;
}

export interface ShipmentInput {
  trackingNumber?: string | null;
  carrier?: string | null;
  shippedAt?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
  items: ShipmentItemInput[];
}

export interface MarkReceivedInput {
  receivedAt?: string | null;
}

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PurchaseAuditService,
  ) {}

  // ------------------ Status-Berechnung ------------------

  /**
   * Leitet den Bestellungs-Status aus Shipments, Invoices und Payments ab.
   * Ruft jede Mutation an Shipments diesen Helper auf.
   */
  async recalcOrderStatus(orderId: string): Promise<void> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { id: true, quantity: true } },
        invoices: { select: { id: true } },
        shipments: {
          include: { items: { select: { purchaseOrderItemId: true, quantity: true } } },
        },
      },
    });
    if (!order) return;
    if (order.status === 'cancelled' || order.status === 'draft') return;

    const hasInvoice = order.invoices.length > 0;
    const anyShipmentExists = order.shipments.length > 0;
    const anyReceived = order.shipments.some((s) => s.receivedAt != null);
    const anyShippedButNotReceived = order.shipments.some((s) => s.receivedAt == null);

    // Summe empfangener Mengen pro PO-Item
    const receivedByItem: Record<string, Prisma.Decimal> = {};
    for (const s of order.shipments) {
      if (!s.receivedAt) continue;
      for (const it of s.items) {
        const prev = receivedByItem[it.purchaseOrderItemId] ?? D(0);
        receivedByItem[it.purchaseOrderItemId] = prev.add(D(it.quantity));
      }
    }

    // Prüfe ob alle Item-Mengen vollständig empfangen sind
    const allItemsFullyReceived = order.items.every((it) => {
      const recv = receivedByItem[it.id] ?? D(0);
      return recv.gte(D(it.quantity));
    });

    let next: any = order.status;

    if (anyShipmentExists) {
      if (allItemsFullyReceived && anyReceived) {
        // Voll angekommen: received → eventuell completed bei voll bezahlt
        next = order.paymentStatus === 'paid' ? 'completed' : 'received';
      } else if (anyReceived) {
        next = 'partially_received';
      } else if (anyShippedButNotReceived) {
        next = 'shipped';
      }
    } else {
      // Keine Sendung: Status entweder invoiced (wenn Rechnung da) oder ordered
      if (hasInvoice && order.status !== 'invoiced') next = 'invoiced';
      else if (!hasInvoice && order.status !== 'ordered') next = 'ordered';
    }

    if (next !== order.status) {
      await this.prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: next },
      });
    }
  }

  // ------------------ Validation ------------------

  private validateInput(data: ShipmentInput) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Mindestens eine Position erforderlich');
    }
    for (const it of data.items) {
      if (!it.purchaseOrderItemId) throw new BadRequestException('Position-Referenz fehlt');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        throw new BadRequestException('Menge pro Position muss > 0 sein');
      }
    }
  }

  private async verifyItems(orgId: string, orderId: string, items: ShipmentItemInput[]) {
    const poItems = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: orderId },
      select: { id: true, quantity: true, productName: true },
    });
    const byId = new Map(poItems.map((i) => [i.id, i]));

    // Schon versandte Mengen pro Item berechnen
    const existingShipments = await this.prisma.shipment.findMany({
      where: { orgId, purchaseOrderId: orderId },
      include: { items: { select: { purchaseOrderItemId: true, quantity: true } } },
    });
    const alreadyShipped: Record<string, Prisma.Decimal> = {};
    for (const s of existingShipments) {
      for (const it of s.items) {
        const prev = alreadyShipped[it.purchaseOrderItemId] ?? D(0);
        alreadyShipped[it.purchaseOrderItemId] = prev.add(D(it.quantity));
      }
    }

    for (const it of items) {
      const poItem = byId.get(it.purchaseOrderItemId);
      if (!poItem) {
        throw new BadRequestException(`Unbekannte Position: ${it.purchaseOrderItemId}`);
      }
      const already = alreadyShipped[it.purchaseOrderItemId] ?? D(0);
      const newTotal = already.add(D(it.quantity));
      if (newTotal.gt(D(poItem.quantity))) {
        throw new BadRequestException(
          `"${poItem.productName}": maximal ${poItem.quantity} möglich — bereits ${already} versendet, versuchst ${it.quantity} weitere`,
        );
      }
    }
  }

  // ------------------ Queries ------------------

  async list(orgId: string, orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orgId, purchaseOrderId: orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async get(orgId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      include: {
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Sendung nicht gefunden');
    return shipment;
  }

  // ------------------ Mutations ------------------

  async create(orgId: string, userId: string, orderId: string, data: ShipmentInput) {
    this.validateInput(data);
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, orgId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (order.status === 'cancelled') {
      throw new BadRequestException('Stornierte Bestellung kann keine Sendung erhalten');
    }
    await this.verifyItems(orgId, orderId, data.items);

    const shipment = await this.prisma.shipment.create({
      data: {
        orgId,
        purchaseOrderId: orderId,
        trackingNumber: data.trackingNumber?.trim() || null,
        carrier: data.carrier?.trim() || null,
        shippedAt: data.shippedAt ? new Date(data.shippedAt) : null,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : null,
        notes: data.notes?.trim() || null,
        createdById: userId,
        items: {
          create: data.items.map((it) => ({
            purchaseOrderItemId: it.purchaseOrderItemId,
            quantity: D(it.quantity),
          })),
        },
      },
      include: { items: true },
    });

    await this.recalcOrderStatus(orderId);
    this.audit.log(orgId, userId, 'shipment', shipment.id, 'create', {
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      itemCount: shipment.items.length,
    }, orderId).catch(() => {});

    return shipment;
  }

  async update(orgId: string, userId: string, shipmentId: string, data: Partial<ShipmentInput>) {
    const existing = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');

    const updates: any = {};
    if (data.trackingNumber !== undefined) updates.trackingNumber = data.trackingNumber?.trim() || null;
    if (data.carrier !== undefined) updates.carrier = data.carrier?.trim() || null;
    if (data.shippedAt !== undefined) updates.shippedAt = data.shippedAt ? new Date(data.shippedAt) : null;
    if (data.receivedAt !== undefined) updates.receivedAt = data.receivedAt ? new Date(data.receivedAt) : null;
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;

    // Items ersetzen falls übergeben
    if (data.items) {
      this.validateInput(data as ShipmentInput);
      // Validierung gegen bereits bestehende andere Sendungen (nicht diese)
      const others = await this.prisma.shipment.findMany({
        where: { orgId, purchaseOrderId: existing.purchaseOrderId, NOT: { id: shipmentId } },
        include: { items: true },
      });
      const alreadyOther: Record<string, Prisma.Decimal> = {};
      for (const s of others) {
        for (const it of s.items) {
          const prev = alreadyOther[it.purchaseOrderItemId] ?? D(0);
          alreadyOther[it.purchaseOrderItemId] = prev.add(D(it.quantity));
        }
      }
      const poItems = await this.prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: existing.purchaseOrderId },
        select: { id: true, quantity: true, productName: true },
      });
      const byId = new Map(poItems.map((i) => [i.id, i]));
      for (const it of data.items) {
        const poItem = byId.get(it.purchaseOrderItemId);
        if (!poItem) throw new BadRequestException('Unbekannte Position');
        const already = alreadyOther[it.purchaseOrderItemId] ?? D(0);
        if (already.add(D(it.quantity)).gt(D(poItem.quantity))) {
          throw new BadRequestException(
            `"${poItem.productName}": würde Bestellmenge überschreiten`,
          );
        }
      }
      await this.prisma.shipmentItem.deleteMany({ where: { shipmentId } });
      await this.prisma.shipmentItem.createMany({
        data: data.items.map((it) => ({
          shipmentId,
          purchaseOrderItemId: it.purchaseOrderItemId,
          quantity: D(it.quantity),
        })),
      });
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: updates,
      include: { items: true },
    });

    await this.recalcOrderStatus(existing.purchaseOrderId);
    this.audit.log(orgId, userId, 'shipment', shipmentId, 'update', {}, existing.purchaseOrderId).catch(() => {});
    return updated;
  }

  /**
   * Markiert eine Sendung als "angekommen". Default Datum = heute, optional custom Datum.
   */
  async markReceived(orgId: string, userId: string, shipmentId: string, data: MarkReceivedInput) {
    const existing = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
    if (existing.receivedAt) {
      throw new BadRequestException('Sendung wurde bereits als angekommen markiert');
    }
    const receivedAt = data.receivedAt ? new Date(data.receivedAt) : new Date();
    if (isNaN(receivedAt.getTime())) throw new BadRequestException('Ankunftsdatum ungültig');

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { receivedAt },
      include: { items: true },
    });

    await this.recalcOrderStatus(existing.purchaseOrderId);
    this.audit.log(orgId, userId, 'shipment', shipmentId, 'mark_received', {
      receivedAt: receivedAt.toISOString().slice(0, 10),
    }, existing.purchaseOrderId).catch(() => {});
    return updated;
  }

  async remove(orgId: string, userId: string, shipmentId: string) {
    const existing = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
    if (!existing) throw new NotFoundException('Sendung nicht gefunden');
    await this.prisma.shipment.delete({ where: { id: shipmentId } });
    await this.recalcOrderStatus(existing.purchaseOrderId);
    this.audit.log(orgId, userId, 'shipment', shipmentId, 'delete', {}, existing.purchaseOrderId).catch(() => {});
    return { deleted: true };
  }
}
