import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Zwei parallele Historien pro Produkt:
 *   'cost'        -> Einkaufspreis / Herstellkosten
 *   'fulfillment' -> Amazon AWD/FBA-Pauschale
 * Getrennte Tabellen, gleiche Semantik.
 */
export type CostKind = 'cost' | 'fulfillment';

export type Channel = 'shopify' | 'amazon' | 'tiktok';

export interface ProductCostRow {
  productId: string;
  externalId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  status: string;
  currentCost: string | null;                    // Decimal als String
  currentCostEffectiveFrom: string | null;
  currentFulfillment: string | null;
  currentFulfillmentEffectiveFrom: string | null;
  channels: Channel[];                           // leer = Legacy-Fallback "ueberall"
  enabled: boolean;                              // false = ueberall ausgeblendet
}

export interface CostHistoryEntry {
  id: string;
  value: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ProductListQuery {
  search?: string;
  missingCosts?: boolean;         // nur Produkte ohne aktuelle Produktkosten
  missingFulfillment?: boolean;   // nur Produkte ohne aktuelle Fulfillment-Kosten
  status?: 'active' | 'archived' | 'draft' | 'all';
  /** Filter fuer den Tages-Editor: nur Produkte die auf diesem Kanal aktiv sind
   *  (inkl. Legacy-Produkte ohne einzige Zuordnung). */
  channel?: Channel;
  /** true = auch deaktivierte Produkte anzeigen (Produktkosten-Seite).
   *  false/omit = deaktivierte Produkte ausblenden (Tages-Editor). */
  includeDisabled?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ProductCostService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  /**
   * Liste aller Produkte mit aktuellen Kosten (fuer heute gueltig).
   * Verwendet nur 3 Queries: Produkte + beide Kosten-Tabellen.
   */
  async listProducts(orgId: string, q: ProductListQuery = {}): Promise<{
    items: ProductCostRow[];
    total: number;
    missingCostsCount: number;
    missingFulfillmentCount: number;
  }> {
    // 'all' blieb hier frueher im else-Zweig haengen und wurde still zu
    // 'active'. Archivierte und Draft-Produkte waren dadurch NIE bepreisbar,
    // ihre historischen Verkaufszeilen zaehlten aber weiter mit — Wareneinsatz
    // blieb fuer sie dauerhaft 0.
    const status: 'active' | 'archived' | 'draft' | 'all' = q.status ?? 'active';
    const limit = Math.min(500, Math.max(1, q.limit ?? 100));
    const offset = Math.max(0, q.offset ?? 0);
    const today = this.toDateOnly(new Date());

    const productWhere: Prisma.ProductWhereInput = { orgId };
    if (status !== 'all' as any) productWhere.status = status as any;
    if (q.search?.trim()) {
      const s = q.search.trim();
      productWhere.OR = [
        { title:      { contains: s, mode: 'insensitive' } },
        { sku:        { contains: s, mode: 'insensitive' } },
        { externalId: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [products, total, allCurrentCosts, allCurrentFulfillments, allChannels, allSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        orderBy: { title: 'asc' },
        take: limit,
        skip: offset,
        select: { id: true, externalId: true, title: true, sku: true, imageUrl: true, status: true },
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.paProductCost.findMany({
        where: {
          orgId,
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        select: { productId: true, cost: true, effectiveFrom: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.paAmazonFulfillmentCost.findMany({
        where: {
          orgId,
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        select: { productId: true, cost: true, effectiveFrom: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.paProductChannel.findMany({
        where: { orgId },
        select: { productId: true, channel: true },
      }),
      this.prisma.paProductSettings.findMany({
        where: { orgId },
        select: { productId: true, enabled: true },
      }),
    ]);

    // Fuer jedes Produkt den neuesten aktuellen Wert pro Kosten-Art picken
    const costByProduct = new Map<string, { value: string; from: string }>();
    for (const r of allCurrentCosts) {
      if (!costByProduct.has(r.productId)) {
        costByProduct.set(r.productId, { value: r.cost.toString(), from: this.formatDate(r.effectiveFrom) });
      }
    }
    const ffByProduct = new Map<string, { value: string; from: string }>();
    for (const r of allCurrentFulfillments) {
      if (!ffByProduct.has(r.productId)) {
        ffByProduct.set(r.productId, { value: r.cost.toString(), from: this.formatDate(r.effectiveFrom) });
      }
    }

    // Kanal-Zuordnungen indexieren
    const channelsByProduct = new Map<string, Channel[]>();
    for (const c of allChannels) {
      const list = channelsByProduct.get(c.productId) ?? [];
      list.push(c.channel as Channel);
      channelsByProduct.set(c.productId, list);
    }

    // Enabled-Flag pro Produkt (Default true wenn kein Settings-Row)
    const enabledByProduct = new Map<string, boolean>();
    for (const s of allSettings) enabledByProduct.set(s.productId, s.enabled);

    let items: ProductCostRow[] = products.map((p) => {
      const cost = costByProduct.get(p.id);
      const ff = ffByProduct.get(p.id);
      return {
        productId: p.id,
        externalId: p.externalId,
        title: p.title,
        sku: p.sku,
        imageUrl: p.imageUrl,
        status: p.status,
        currentCost: cost?.value ?? null,
        currentCostEffectiveFrom: cost?.from ?? null,
        currentFulfillment: ff?.value ?? null,
        currentFulfillmentEffectiveFrom: ff?.from ?? null,
        channels: channelsByProduct.get(p.id) ?? [],
        enabled: enabledByProduct.get(p.id) ?? true,
      };
    });

    if (q.missingCosts) items = items.filter((r) => r.currentCost === null);
    if (q.missingFulfillment) items = items.filter((r) => r.currentFulfillment === null);

    // Disabled-Filter: Standard blendet aus. includeDisabled=true zeigt alle
    // (fuer die Produktkosten-Seite).
    if (!q.includeDisabled) {
      items = items.filter((r) => r.enabled);
    }

    // Kanal-Filter mit Legacy-Fallback:
    //   channels leer  -> "ueberall" (Produkt taucht in jedem Kanal auf)
    //   channels nicht leer -> nur wenn Kanal enthalten
    if (q.channel) {
      const wanted = q.channel;
      items = items.filter((r) => r.channels.length === 0 || r.channels.includes(wanted));
    }

    // Zwei verschiedene Grundmengen voneinander abzuziehen ergab Unsinn:
    // allCurrentCosts laedt ORG-WEIT und ohne Status-Filter, products ist auf
    // limit=100 und status='active' beschraenkt. Bei 60 aktiven Produkten
    // (10 ohne Kosten) und 30 archivierten MIT Kosten kam 60 − 80 = −20 heraus,
    // angezeigt als "−20" in Warn-Farbe. Genau die Kennzahl, mit der der
    // Nutzer Kostenluecken kontrollieren soll.
    //
    // Jetzt ueber dieselbe Menge gezaehlt, die auch gelistet wird — und ueber
    // ALLE Treffer des Filters, nicht nur die aktuelle Seite.
    // Passt alles auf eine Seite, reicht die bereits geladene Liste — kein
    // zusaetzlicher Roundtrip im Normalfall.
    const alleIds: Array<{ id: string }> = total > products.length
      ? await this.prisma.product.findMany({ where: productWhere, select: { id: true } })
      : products.map((p) => ({ id: p.id }));
    const missingCostsCount = alleIds.filter((p) => !costByProduct.has(p.id)).length;
    const missingFulfillmentCount = alleIds.filter((p) => !ffByProduct.has(p.id)).length;

    return { items, total, missingCostsCount, missingFulfillmentCount };
  }

  /** Produkt komplett ein/aus. Deaktivierte Produkte tauchen weder in
   *  Produktkosten-Filter noch in irgendeinem Tages-Editor-Kanal auf. */
  async setEnabled(orgId: string, productId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    await this.assertProductBelongsToOrg(orgId, productId);
    await this.prisma.paProductSettings.upsert({
      where: { productId },
      create: { orgId, productId, enabled },
      update: { enabled },
    });
    return { enabled };
  }

  /**
   * Wert (Kosten oder Fulfillment) gueltig am Datum. Gibt null zurueck wenn
   * kein Datensatz existiert — im Gegensatz zu SettingsService hier KEIN
   * lazy-Default, weil "keine Kosten" fachlich bedeutet "unbekannt" und
   * NICHT "kostenlos". Berechnungen muessen das explizit handhaben.
   */
  async getCostAt(
    orgId: string,
    productId: string,
    kind: CostKind,
    date: Date,
  ): Promise<string | null> {
    const dateOnly = this.toDateOnly(date);
    const model = this.modelFor(kind);
    const row = await (model as any).findFirst({
      where: {
        orgId,
        productId,
        effectiveFrom: { lte: dateOnly },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateOnly } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return row ? row.cost.toString() : null;
  }

  /** Volle Historie eines Produkts fuer eine Kosten-Art. */
  async history(orgId: string, productId: string, kind: CostKind): Promise<CostHistoryEntry[]> {
    await this.assertProductBelongsToOrg(orgId, productId);
    const model = this.modelFor(kind);
    const rows = await (model as any).findMany({
      where: { orgId, productId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        createdBy: { select: { name: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((r: any) => ({
      id: r.id,
      value: r.cost.toString(),
      effectiveFrom: this.formatDate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? this.formatDate(r.effectiveTo) : null,
      note: r.note,
      createdById: r.createdById,
      createdByName: r.createdBy
        ? r.createdBy.name || `${r.createdBy.firstName ?? ''} ${r.createdBy.lastName ?? ''}`.trim() || null
        : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // WRITE
  // ---------------------------------------------------------------------------

  async setCost(
    orgId: string,
    productId: string,
    kind: CostKind,
    newValue: string,
    effectiveFrom: Date,
    userId: string | null,
    note?: string,
  ) {
    await this.assertProductBelongsToOrg(orgId, productId);
    const parsed = this.parseValue(newValue);
    if (parsed.lt(0)) throw new BadRequestException('Kosten duerfen nicht negativ sein');
    const effectiveFromDate = this.toDateOnly(effectiveFrom);
    const yesterday = new Date(effectiveFromDate.getTime() - 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const model = kind === 'cost' ? tx.paProductCost : tx.paAmazonFulfillmentCost;

      // Idempotenz-Check
      const existing = await (model as any).findUnique({
        where: {
          productId_effectiveFrom: {
            productId,
            effectiveFrom: effectiveFromDate,
          },
        },
      });
      if (existing && existing.cost.toString() === parsed.toString()) {
        return this.toApi(existing);
      }

      // Vorgaenger-Periode schliessen
      await (model as any).updateMany({
        where: {
          orgId,
          productId,
          effectiveFrom: { lt: effectiveFromDate },
          effectiveTo: null,
        },
        data: { effectiveTo: yesterday },
      });

      const upserted = existing
        ? await (model as any).update({
            where: { id: existing.id },
            data: {
              cost: parsed,
              note: note ?? existing.note,
              createdById: userId ?? existing.createdById,
            },
          })
        : await (model as any).create({
            data: {
              orgId,
              productId,
              cost: parsed,
              effectiveFrom: effectiveFromDate,
              note: note ?? null,
              createdById: userId,
            },
          });
      return this.toApi(upserted);
    });
  }

  // ---------------------------------------------------------------------------
  // Kanal-Zuordnung
  // ---------------------------------------------------------------------------

  /**
   * Setzt die aktiven Kanaele fuer ein Produkt. Ersetzt bestehende Zuordnungen
   * atomar (delete + create). Leeres Array -> Produkt gilt wieder als
   * "ueberall aktiv" (Legacy-Fallback).
   */
  async setChannels(orgId: string, productId: string, channels: Channel[]): Promise<Channel[]> {
    await this.assertProductBelongsToOrg(orgId, productId);
    const uniq = Array.from(new Set(channels)).filter((c) => ['shopify', 'amazon', 'tiktok'].includes(c));
    await this.prisma.$transaction([
      this.prisma.paProductChannel.deleteMany({ where: { productId } }),
      ...(uniq.length > 0
        ? [this.prisma.paProductChannel.createMany({
            data: uniq.map((channel) => ({ orgId, productId, channel: channel as any })),
          })]
        : []),
    ]);
    return uniq;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private modelFor(kind: CostKind) {
    if (kind === 'cost') return this.prisma.paProductCost;
    if (kind === 'fulfillment') return this.prisma.paAmazonFulfillmentCost;
    throw new BadRequestException(`Unbekannter Kosten-Typ: ${kind}`);
  }

  private async assertProductBelongsToOrg(orgId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, orgId }, select: { id: true } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
  }

  private parseValue(input: string): Prisma.Decimal {
    if (typeof input !== 'string') throw new BadRequestException('Wert muss ein String sein');
    const normalized = input.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new BadRequestException(`Ungueltiger Zahlenwert: "${input}"`);
    }
    return new Prisma.Decimal(normalized);
  }

  private toDateOnly(d: Date): Date {
    const iso = d.toISOString().slice(0, 10);
    return new Date(iso + 'T00:00:00.000Z');
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private toApi(row: any): CostHistoryEntry {
    return {
      id: row.id,
      value: row.cost.toString(),
      effectiveFrom: this.formatDate(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? this.formatDate(row.effectiveTo) : null,
      note: row.note,
      createdById: row.createdById,
      createdByName: null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
