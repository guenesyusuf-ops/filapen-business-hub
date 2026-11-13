import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { DsPartnerAuthService } from './ds-partner-auth.service';
import { isIgnorableLine } from './ds-matching';

export interface DsSkuRow {
  sku: string;
  title: string | null;
  productTitle: string;
  variantExternalId: string | null;
  imageUrl: string | null;
}

export interface DsRuleSkuInput {
  sku: string;
  title?: string | null;
  imageUrl?: string | null;
  variantExternalId?: string | null;
}

/**
 * Owner-seitige Lese-/Pflege-Logik des Dropshipping-Moduls (Hub-intern).
 */
@Injectable()
export class DropshippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerAuth: DsPartnerAuthService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Partner-Verwaltung (Owner-Seite)
  // ---------------------------------------------------------------------------

  async listPartners(orgId: string) {
    return this.prisma.dsPartner.findMany({
      where: { orgId },
      select: {
        id: true, name: true, email: true, active: true, lastLoginAt: true, createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPartner(
    orgId: string,
    input: { name: string; email: string; password: string },
    portalBaseUrl?: string,
  ) {
    const name = (input.name ?? '').trim();
    const email = (input.email ?? '').trim().toLowerCase();
    if (!name || !email) throw new BadRequestException('Name und E-Mail erforderlich');
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Passwort muss mindestens 8 Zeichen haben');
    }
    const existing = await this.prisma.dsPartner.findFirst({ where: { orgId, email } });
    if (existing) throw new BadRequestException('Ein Partner mit dieser E-Mail existiert bereits');
    const partner = await this.prisma.dsPartner.create({
      data: { orgId, name, email, passwordHash: this.partnerAuth.hashPassword(input.password), active: true },
      select: { id: true, name: true, email: true, active: true },
    });

    // Einladungs-E-Mail mit Zugangsdaten (best effort — blockiert nicht).
    const emailReason = await this.email.sendDropshipPartnerInvite({
      to: email, name, password: input.password, portalLink: this.portalLink(portalBaseUrl),
    });

    return { ...partner, emailSent: emailReason === 'sent', emailReason };
  }

  private portalLink(portalBaseUrl?: string): string {
    const base = (portalBaseUrl || this.config.get<string>('WEB_APP_URL', 'https://business.filapen.de')).replace(/\/$/, '');
    return base.endsWith('/partner') ? base : `${base}/partner`;
  }

  /**
   * Einladung erneut senden: setzt ein neues Passwort und mailt die Zugangsdaten.
   * Gibt das neue Passwort zurueck, damit der Owner es notfalls manuell weitergeben kann.
   */
  async resendInvite(orgId: string, id: string, portalBaseUrl?: string) {
    const partner = await this.prisma.dsPartner.findFirst({
      where: { id, orgId }, select: { id: true, name: true, email: true },
    });
    if (!partner) throw new NotFoundException('Partner nicht gefunden');

    const password = this.generatePassword();
    await this.prisma.dsPartner.update({
      where: { id }, data: { passwordHash: this.partnerAuth.hashPassword(password), active: true },
    });
    const emailReason = await this.email.sendDropshipPartnerInvite({
      to: partner.email, name: partner.name, password, portalLink: this.portalLink(portalBaseUrl),
    });
    return { emailSent: emailReason === 'sent', emailReason, email: partner.email, password };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = 'FP-';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async updatePartner(
    orgId: string,
    id: string,
    input: { name?: string; active?: boolean; password?: string },
  ) {
    const partner = await this.prisma.dsPartner.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!partner) throw new NotFoundException('Partner nicht gefunden');
    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.active !== undefined) data.active = input.active;
    if (input.password) {
      if (input.password.length < 8) throw new BadRequestException('Passwort muss mindestens 8 Zeichen haben');
      data.passwordHash = this.partnerAuth.hashPassword(input.password);
    }
    await this.prisma.dsPartner.update({ where: { id }, data });
    return { ok: true };
  }

  async deletePartner(orgId: string, id: string) {
    const partner = await this.prisma.dsPartner.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!partner) throw new NotFoundException('Partner nicht gefunden');
    await this.prisma.dsPartner.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Produkt-Katalog (zum Zusammenstellen von Regeln)
  // ---------------------------------------------------------------------------

  async listSkus(orgId: string, q?: string): Promise<DsSkuRow[]> {
    const search = (q ?? '').trim();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        orgId,
        sku: { not: null },
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { product: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        externalId: true,
        sku: true,
        title: true,
        imageUrl: true,
        product: { select: { title: true, imageUrl: true } },
      },
      orderBy: [{ product: { title: 'asc' } }, { title: 'asc' }],
      take: 2000,
    });

    const seen = new Set<string>();
    const out: DsSkuRow[] = [];
    for (const v of variants) {
      if (!v.sku || seen.has(v.sku)) continue;
      seen.add(v.sku);
      out.push({
        sku: v.sku,
        title: v.title,
        productTitle: v.product?.title ?? '',
        variantExternalId: v.externalId,
        imageUrl: v.imageUrl ?? v.product?.imageUrl ?? null,
      });
    }
    return out;
  }

  /**
   * Vorschlaege: Produkte, die in OFFENEN Bestellungen zusammen mit den bereits
   * gewaehlten SKUs vorkommen, aber noch nicht ausgewaehlt sind. So sieht der
   * Owner sofort, welche Zubehoer-/Varianten-SKUs eine Regel noch braucht, damit
   * mehr Bestellungen exakt passen. Versandzeilen werden ignoriert.
   */
  async suggestions(orgId: string, skus: string[]): Promise<Array<{ sku: string; title: string; count: number; imageUrl: string | null }>> {
    const set = new Set((skus ?? []).map((s) => s.trim()).filter(Boolean));
    if (set.size === 0) return [];
    const arr = [...set];

    const orders = await this.prisma.order.findMany({
      where: {
        orgId,
        status: { not: 'cancelled' },
        financialStatus: 'paid',
        fulfillmentStatus: { in: ['unfulfilled', 'partial'] },
        lineItems: { some: { sku: { in: arr } } },
      },
      select: { lineItems: { select: { sku: true, title: true } } },
      take: 3000,
    });

    const counts = new Map<string, { title: string; count: number }>();
    for (const o of orders) {
      const foreign = new Set<string>();
      for (const li of o.lineItems) {
        if (isIgnorableLine(li)) continue;
        const sku = (li.sku ?? '').trim();
        if (!sku || set.has(sku)) continue;
        foreign.add(sku);
        if (!counts.has(sku)) counts.set(sku, { title: li.title ?? sku, count: 0 });
      }
      for (const sku of foreign) counts.get(sku)!.count++;
    }

    const top = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30);
    const variants = await this.prisma.productVariant.findMany({
      where: { orgId, sku: { in: top.map((t) => t[0]) } },
      select: { sku: true, imageUrl: true, product: { select: { imageUrl: true } } },
    });
    const img = new Map<string, string | null>();
    for (const v of variants) if (v.sku && !img.has(v.sku)) img.set(v.sku, v.imageUrl ?? v.product?.imageUrl ?? null);

    return top.map(([sku, v]) => ({ sku, title: v.title, count: v.count, imageUrl: img.get(sku) ?? null }));
  }

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------

  listRules(orgId: string) {
    return this.prisma.dsRule.findMany({
      where: { orgId },
      include: { skus: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRule(
    orgId: string,
    input: { name?: string; mode?: string; active?: boolean; skus: DsRuleSkuInput[] },
  ) {
    const mode = input.mode === 'exact' ? 'exact' : 'subset';
    const skus = this.normalizeSkus(input.skus);
    if (skus.length === 0) throw new BadRequestException('Mindestens eine SKU erforderlich');
    return this.prisma.dsRule.create({
      data: {
        orgId,
        name: (input.name ?? '').slice(0, 200),
        mode,
        active: input.active ?? true,
        skus: { create: skus.map((s) => ({ orgId, ...s })) },
      },
      include: { skus: true },
    });
  }

  async updateRule(
    orgId: string,
    ruleId: string,
    input: { name?: string; mode?: string; active?: boolean; skus?: DsRuleSkuInput[] },
  ) {
    const rule = await this.prisma.dsRule.findFirst({ where: { id: ruleId, orgId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Regel nicht gefunden');

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.slice(0, 200);
    if (input.mode !== undefined) data.mode = input.mode === 'exact' ? 'exact' : 'subset';
    if (input.active !== undefined) data.active = input.active;

    if (input.skus) {
      const skus = this.normalizeSkus(input.skus);
      if (skus.length === 0) throw new BadRequestException('Mindestens eine SKU erforderlich');
      // Komplett ersetzen (einfach + deterministisch)
      await this.prisma.dsRuleSku.deleteMany({ where: { ruleId, orgId } });
      data.skus = { create: skus.map((s) => ({ orgId, ...s })) };
    }

    return this.prisma.dsRule.update({ where: { id: ruleId }, data, include: { skus: true } });
  }

  async deleteRule(orgId: string, ruleId: string) {
    const rule = await this.prisma.dsRule.findFirst({ where: { id: ruleId, orgId }, select: { id: true } });
    if (!rule) throw new NotFoundException('Regel nicht gefunden');
    await this.prisma.dsRule.delete({ where: { id: ruleId } });
    return { ok: true };
  }

  private normalizeSkus(skus: DsRuleSkuInput[]): Required<DsRuleSkuInput>[] {
    const seen = new Set<string>();
    const out: Required<DsRuleSkuInput>[] = [];
    for (const s of skus ?? []) {
      const sku = (s.sku ?? '').trim();
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      out.push({
        sku,
        title: s.title ?? null,
        imageUrl: s.imageUrl ?? null,
        variantExternalId: s.variantExternalId ?? null,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Bestellungen
  // ---------------------------------------------------------------------------

  async listOrders(orgId: string, status?: string) {
    const validStatus = ['new', 'shipped_cn', 'in_de', 'delivered', 'on_hold'];
    return this.prisma.dsOrder.findMany({
      where: { orgId, ...(status && validStatus.includes(status) ? { status: status as any } : {}) },
      include: { items: true, partner: { select: { id: true, name: true } } },
      orderBy: { placedAt: 'desc' },
      take: 500,
    });
  }

  async stats(orgId: string) {
    const grouped = await this.prisma.dsOrder.groupBy({
      by: ['status'], where: { orgId }, _count: { _all: true },
    });
    const byStatus: Record<string, number> = { new: 0, shipped_cn: 0, in_de: 0, delivered: 0, on_hold: 0 };
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const threshold = new Date(Date.now() - 48 * 3600 * 1000);
    const overdue = await this.prisma.dsOrder.count({
      where: { orgId, status: 'new', placedAt: { lt: threshold } },
    });

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const activeRules = await this.prisma.dsRule.count({ where: { orgId, active: true } });

    return { byStatus, overdue, total, activeRules };
  }

  lastSync(orgId: string) {
    return this.prisma.dsSyncLog.findFirst({ where: { orgId }, orderBy: { startedAt: 'desc' } });
  }

  /** CSV-Export der Bestellungen (fuer den Versand an den Dropshipper). */
  async exportCsv(orgId: string, status?: string): Promise<string> {
    const orders = await this.listOrders(orgId, status);
    const statusLabel: Record<string, string> = {
      new: 'Neu', shipped_cn: 'Versandt (CN)', in_de: 'In Deutschland', delivered: 'Zugestellt', on_hold: 'Problem',
    };
    const headers = [
      'Bestellnummer', 'Datum', 'Status', 'Kunde', 'Telefon', 'Land', 'Adresse',
      'Artikel', 'CN-Tracking', 'DE-Tracking', 'Spedition',
    ];
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const addr = (a: any): string => {
      if (!a || typeof a !== 'object') return '';
      const parts = [
        a.address1, a.address2,
        [a.zip, a.city].filter(Boolean).join(' '),
        a.province, a.country,
      ].filter(Boolean);
      return parts.join(', ');
    };
    const lines = [headers.join(';')];
    for (const o of orders) {
      const items = (o.items ?? []).map((i: any) => `${i.quantity}x ${i.sku ?? i.title}`).join(' | ');
      lines.push([
        `#${o.orderNumber}`,
        new Date(o.placedAt).toLocaleDateString('de-DE'),
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
    // BOM, damit Excel UTF-8 korrekt erkennt
    return '﻿' + lines.join('\r\n');
  }
}
