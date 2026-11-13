import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
