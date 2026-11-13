import { Injectable, Logger, HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DsPartnerAuthService } from './ds-partner-auth.service';
import { ShopifyService } from '../integration/shopify/shopify.service';

/** Master-Entscheidung: DE-Tracking nach Shopify inkl. Kunden-Versandmail. */
const NOTIFY_CUSTOMER_ON_FULFILL = true;

/**
 * Logik des externen Partner-Portals (englische UI) + Shopify-Rueckschreibung.
 * Alle Methoden sind partner- und org-scoped; die Kunden-E-Mail wird dem Partner
 * NIE zurueckgegeben (Datensparsamkeit).
 */
@Injectable()
export class DsPortalService {
  private readonly logger = new Logger(DsPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerAuth: DsPartnerAuthService,
    private readonly shopify: ShopifyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(email: string, password: string) {
    const mail = (email ?? '').trim().toLowerCase();
    if (!mail || !password) throw new BadRequestException('E-Mail und Passwort erforderlich');

    const partner = await this.prisma.dsPartner.findFirst({
      where: { email: mail, active: true },
    });
    if (!partner || !this.partnerAuth.verifyPassword(password, partner.passwordHash)) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    await this.prisma.dsPartner.update({
      where: { id: partner.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit(partner.orgId, partner.id, 'portal_login', null, null);

    return {
      token: this.partnerAuth.signToken(partner.id, partner.orgId),
      partner: { name: partner.name },
    };
  }

  /** Partner muss existieren + aktiv sein (bei jedem Request geprueft). */
  private async assertActive(partnerId: string, orgId: string) {
    const p = await this.prisma.dsPartner.findFirst({
      where: { id: partnerId, orgId, active: true }, select: { id: true },
    });
    if (!p) throw new HttpException('Partner inaktiv', HttpStatus.UNAUTHORIZED);
  }

  // ---------------------------------------------------------------------------
  // Bestellungen (Partner-Sicht, ohne Kunden-E-Mail)
  // ---------------------------------------------------------------------------

  async listOrders(partnerId: string, orgId: string, status?: string) {
    await this.assertActive(partnerId, orgId);
    const validStatus = ['new', 'shipped_cn', 'in_de', 'delivered', 'on_hold'];
    const orders = await this.prisma.dsOrder.findMany({
      where: { orgId, partnerId, ...(status && validStatus.includes(status) ? { status: status as any } : {}) },
      select: {
        id: true, orderNumber: true, placedAt: true,
        customerName: true, customerPhone: true, shippingAddress: true, countryCode: true,
        status: true, cnTracking: true, deTracking: true, carrier: true, note: true,
        shippedAt: true, arrivedAt: true, deliveredAt: true,
        items: { select: { id: true, sku: true, title: true, quantity: true, imageUrl: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 500,
    });
    return orders;
  }

  /** Kurz-Infos fuer den Portal-Header: Anzahl Bestellungen + letzte Aktualisierung. */
  async summary(partnerId: string, orgId: string) {
    await this.assertActive(partnerId, orgId);
    const total = await this.prisma.dsOrder.count({ where: { orgId, partnerId } });
    const openCount = await this.prisma.dsOrder.count({ where: { orgId, partnerId, status: { in: ['new', 'shipped_cn'] } } });
    const lastSync = await this.prisma.dsSyncLog.findFirst({
      where: { orgId, status: 'ok' },
      orderBy: { startedAt: 'desc' },
      select: { finishedAt: true, startedAt: true },
    });
    return { total, openCount, lastUpdatedAt: lastSync?.finishedAt ?? lastSync?.startedAt ?? null };
  }

  /** CSV-Export der eigenen Bestellungen (englisch). */
  async exportCsv(partnerId: string, orgId: string, status?: string): Promise<string> {
    const orders = await this.listOrders(partnerId, orgId, status);
    const statusLabel: Record<string, string> = {
      new: 'New', shipped_cn: 'Shipped (CN)', in_de: 'In Germany', delivered: 'Delivered', on_hold: 'On hold',
    };
    const headers = [
      'Order', 'Date', 'Status', 'Customer', 'Phone', 'Country', 'Address',
      'Items', 'CN tracking', 'DE tracking', 'Carrier',
    ];
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const addr = (a: any): string => {
      if (!a || typeof a !== 'object') return '';
      return [a.address1, a.address2, [a.zip, a.city].filter(Boolean).join(' '), a.province, a.country]
        .filter(Boolean).join(', ');
    };
    const lines = [headers.join(';')];
    for (const o of orders) {
      const items = (o.items ?? []).map((i: any) => `${i.quantity}x ${i.sku ?? i.title}`).join(' | ');
      lines.push([
        `#${o.orderNumber}`,
        new Date(o.placedAt).toLocaleDateString('en-GB'),
        statusLabel[o.status] ?? o.status,
        o.customerName ?? '',
        o.customerPhone ?? '',
        o.countryCode ?? '',
        addr(o.shippingAddress),
        items,
        o.cnTracking ?? '',
        o.deTracking ?? '',
        o.carrier ?? '',
      ].map(esc).join(';'));
    }
    return '﻿' + lines.join('\r\n');
  }

  private async loadOwnOrder(partnerId: string, orgId: string, dsOrderId: string) {
    const order = await this.prisma.dsOrder.findFirst({
      where: { id: dsOrderId, orgId, partnerId },
      include: { items: { select: { lineItemExternalId: true } } },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  async markShipped(partnerId: string, orgId: string, dsOrderId: string, cnTracking: string) {
    await this.assertActive(partnerId, orgId);
    const tracking = (cnTracking ?? '').trim();
    if (!tracking) throw new BadRequestException('Chinesische Sendungsnummer erforderlich');
    await this.loadOwnOrder(partnerId, orgId, dsOrderId);
    await this.prisma.dsOrder.update({
      where: { id: dsOrderId },
      data: { status: 'shipped_cn', cnTracking: tracking, shippedAt: new Date() },
    });
    await this.audit(orgId, partnerId, 'ship_cn', dsOrderId, { cnTracking: tracking });
    return { ok: true };
  }

  async markArrived(
    partnerId: string, orgId: string, dsOrderId: string,
    deTracking: string, carrier: string,
  ) {
    await this.assertActive(partnerId, orgId);
    const tracking = (deTracking ?? '').trim();
    const comp = (carrier ?? '').trim();
    if (!tracking) throw new BadRequestException('Deutsche Sendungsnummer erforderlich');
    if (!comp) throw new BadRequestException('Spedition erforderlich');
    const order = await this.loadOwnOrder(partnerId, orgId, dsOrderId);

    await this.prisma.dsOrder.update({
      where: { id: dsOrderId },
      data: { status: 'in_de', deTracking: tracking, carrier: comp, arrivedAt: new Date() },
    });
    await this.audit(orgId, partnerId, 'arrived_de', dsOrderId, { deTracking: tracking, carrier: comp });

    // Phase 3: Rueckschreibung nach Shopify (best effort — Statusupdate bleibt bestehen).
    await this.pushFulfillment(orgId, dsOrderId, order.orderExternalId,
      order.items.map((i) => i.lineItemExternalId), tracking, comp, 'partner', partnerId);

    return { ok: true };
  }

  async markDelivered(partnerId: string, orgId: string, dsOrderId: string) {
    await this.assertActive(partnerId, orgId);
    await this.loadOwnOrder(partnerId, orgId, dsOrderId);
    await this.prisma.dsOrder.update({
      where: { id: dsOrderId },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
    await this.audit(orgId, partnerId, 'delivered', dsOrderId, null);
    return { ok: true };
  }

  async markHold(partnerId: string, orgId: string, dsOrderId: string, note: string) {
    await this.assertActive(partnerId, orgId);
    await this.loadOwnOrder(partnerId, orgId, dsOrderId);
    await this.prisma.dsOrder.update({
      where: { id: dsOrderId },
      data: { status: 'on_hold', note: (note ?? '').slice(0, 2000) },
    });
    await this.audit(orgId, partnerId, 'on_hold', dsOrderId, { note: (note ?? '').slice(0, 500) });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Shopify-Rueckschreibung (Phase 3)
  // ---------------------------------------------------------------------------

  /** Best-effort Fulfillment; Fehler werden protokolliert, nicht geworfen. */
  async pushFulfillment(
    orgId: string, dsOrderId: string, orderExternalId: string,
    lineItemExternalIds: string[], trackingNumber: string, carrier: string,
    actorType: 'partner' | 'user', actorId: string | null,
  ): Promise<{ ok: boolean; status?: string; error?: string }> {
    try {
      const r = await this.shopify.createTrackingFulfillment(orgId, orderExternalId, {
        trackingNumber,
        trackingCompany: carrier,
        notifyCustomer: NOTIFY_CUSTOMER_ON_FULFILL,
        lineItemExternalIds,
      });
      await this.prisma.dsOrder.update({
        where: { id: dsOrderId },
        data: { shopifyFulfilledAt: new Date() },
      });
      await this.audit(orgId, actorId, 'shopify_fulfilled', dsOrderId, { status: r.status, fulfillmentId: r.fulfillmentId }, actorType);
      return { ok: true, status: r.status };
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 1000);
      this.logger.warn(`Shopify-Fulfillment fuer ds_order ${dsOrderId} fehlgeschlagen: ${msg}`);
      await this.audit(orgId, actorId, 'shopify_fulfill_failed', dsOrderId, { error: msg }, actorType);
      return { ok: false, error: msg };
    }
  }

  /** Owner stösst die Rueckschreibung erneut an (nach behobenem Fehler). */
  async retryFulfillmentAsOwner(orgId: string, dsOrderId: string, userId: string) {
    const order = await this.prisma.dsOrder.findFirst({
      where: { id: dsOrderId, orgId },
      include: { items: { select: { lineItemExternalId: true } } },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (!order.deTracking || !order.carrier) {
      throw new BadRequestException('DE-Tracking und Spedition muessen gesetzt sein');
    }
    return this.pushFulfillment(
      orgId, dsOrderId, order.orderExternalId,
      order.items.map((i) => i.lineItemExternalId),
      order.deTracking, order.carrier, 'user', userId,
    );
  }

  private async audit(
    orgId: string, actorId: string | null, action: string,
    dsOrderId: string | null, detail: any, actorType: 'partner' | 'user' = 'partner',
  ) {
    try {
      await this.prisma.dsAuditLog.create({
        data: { orgId, actorType, actorId: actorId ?? undefined, action, dsOrderId: dsOrderId ?? undefined, detail: detail ?? undefined },
      });
    } catch { /* Audit darf den Vorgang nie blockieren */ }
  }
}
