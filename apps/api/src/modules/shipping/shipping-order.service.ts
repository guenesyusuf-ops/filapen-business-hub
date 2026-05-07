import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ListFilters {
  search?: string;
  shopId?: string;
  fromDate?: string;
  toDate?: string;
  hasShipment?: 'yes' | 'no';
  excludedProductVariantIds?: string[];
  includedProductVariantIds?: string[];
  /** SKU+Quantity exact filter: nur Bestellungen die GENAU diese Variants
   *  in der angegebenen Summen-Menge enthalten — und nichts anderes. */
  exclusiveVariantIds?: string[];
  exclusiveQuantityOp?: 'eq' | 'gte' | 'lte' | 'gt' | 'lt';
  exclusiveQuantity?: number;
  /** Nur Bestellungen mit fehlerhafter / unvollständiger Lieferadresse */
  addressStatus?: 'error' | 'ok' | 'all';
  /** Versand-Status-Filter: alle (default), nur unfulfilled oder nur partial */
  fulfillmentStatus?: 'all' | 'unfulfilled' | 'partial';
  limit?: number;
  offset?: number;
}

/**
 * Erkennt eine fehlende Hausnummer. Logik analog zu DHL-Carrier splitStreet:
 *  1. Wenn explizites houseNumber-Feld gesetzt → ok
 *  2. Sonst: Hausnummer am Ende der Strasse (z.B. "Musterstr. 12a") suchen
 *  3. Sonst: address2 isoliert eine Zahl? → ok
 *  4. Sonst: keine Hausnummer → false
 */
function hasHouseNumber(addr: any): boolean {
  const explicit = (addr.houseNumber || addr.house_number || '').toString().trim();
  if (explicit) return true;
  const street = (addr.address1 || addr.street || '').toString().trim();
  // Match: "Strassenname 12", "Strassenname 12a", "Strassenname 12-14", "Strassenname 12/3"
  if (/\d+[a-zA-Z]?(?:\s*[\/-]\s*\d+[a-zA-Z]?)?\s*$/.test(street)) return true;
  // Hausnummer evtl. in address2 isoliert
  const address2 = (addr.address2 || '').toString().trim();
  if (/^\d+[a-zA-Z]?(?:[\/-]\d+[a-zA-Z]?)?$/.test(address2)) return true;
  return false;
}

// Adresse gilt als "fehlerhaft" wenn eines der vier Kern-Felder fehlt
// (Straße, PLZ, Stadt, Land) ODER wenn keine Hausnummer erkennbar ist.
// DHL-API lehnt Labels ohne Hausnummer ab → daher wollen wir das schon
// vor dem Label-Druck fangen statt erst beim Versuch.
function isAddressValid(addr: any): boolean {
  if (!addr || typeof addr !== 'object') return false;
  const street = (addr.address1 || addr.street || '').toString().trim();
  const zip = (addr.zip || addr.postalCode || addr.postcode || '').toString().trim();
  const city = (addr.city || addr.town || '').toString().trim();
  const country = (addr.country_code || addr.countryCode || addr.country || '').toString().trim();
  if (!street || !zip || !city || !country) return false;
  // Hausnummer-Check: fehlt sie, gilt die Adresse als fehlerhaft.
  if (!hasHouseNumber(addr)) return false;
  return true;
}

@Injectable()
export class ShippingOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List orders that are shippable: open, unfulfilled, not cancelled.
   * Default: show only orders WITHOUT a shipment yet.
   */
  async list(orgId: string, filters: ListFilters = {}) {
    const where: any = {
      orgId,
      // status: 'open' bedeutet Bestellung lebt noch (nicht cancelled, nicht
      // automatisch closed). closed kommt z.B. wenn Shopify selbst nach
      // Fulfillment+Refund "abschliesst" — solche Bestellungen wollen wir
      // im Versand-Modul nicht mehr sehen, auch wenn fulfillment irgendwie
      // partial oder unfulfilled stehengeblieben ist.
      status: 'open' as const,
      fulfillmentStatus:
        filters.fulfillmentStatus === 'unfulfilled'
          ? ('unfulfilled' as const)
          : filters.fulfillmentStatus === 'partial'
            ? ('partial' as const)
            : { in: ['unfulfilled', 'partial'] as const },
      // Refunded (komplett oder teilweise) wird nicht mehr versendet —
      // raus aus der Liste, damit der Versand-Mitarbeiter keine Etiketten
      // fuer rueckerstattete Bestellungen mehr druckt.
      financialStatus: { notIn: ['refunded', 'partially_refunded'] as const },
    };
    if (filters.shopId) where.shopId = filters.shopId;
    if (filters.fromDate || filters.toDate) {
      where.placedAt = {};
      if (filters.fromDate) where.placedAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.placedAt.lte = new Date(filters.toDate);
    }
    if (filters.search) {
      // Bei rein-numerischen Eingaben (typische Bestellnummer-Suche wie "1234")
      // matchen wir orderNumber mit startsWith — contains erzeugte sonst für
      // "1" Treffer wie "#200100" und "#12345", was verwirrt. Für Text-
      // Eingaben (Kundennamen) bleibt contains sinnvoll.
      const q = filters.search.trim();
      const isNumeric = /^\d+$/.test(q.replace(/[#-]/g, ''));
      if (isNumeric) {
        // Order-Number-Feld kann # oder führende Nullen haben; prüfe beide Varianten
        const cleaned = q.replace(/^#/, '');
        where.OR = [
          { orderNumber: { startsWith: cleaned, mode: 'insensitive' as const } },
          { orderNumber: { startsWith: `#${cleaned}`, mode: 'insensitive' as const } },
          { orderNumber: { equals: cleaned, mode: 'insensitive' as const } },
          { orderNumber: { equals: `#${cleaned}`, mode: 'insensitive' as const } },
        ];
      } else {
        where.OR = [
          { orderNumber: { contains: q, mode: 'insensitive' as const } },
          { customerName: { contains: q, mode: 'insensitive' as const } },
          { customerEmail: { contains: q, mode: 'insensitive' as const } },
        ];
      }
    }
    // Product variant filters (combinable: nur mit X + nicht mit Y)
    const lineItemConditions: any[] = [];
    if (filters.includedProductVariantIds?.length) {
      lineItemConditions.push({
        some: { productVariantId: { in: filters.includedProductVariantIds } },
      });
    }
    if (filters.excludedProductVariantIds?.length) {
      lineItemConditions.push({
        none: { productVariantId: { in: filters.excludedProductVariantIds } },
      });
    }
    // Exklusiv-Filter: genau diese Variants und nichts anderes.
    //
    // Multi-Variant Variante:
    //   1. Order muss ALLE ausgewaehlten Variants enthalten (jede mit >=1 Line)
    //   2. Order darf KEINE anderen Variants enthalten (auch nicht NULL)
    //   3. SUMME(quantity) ueber alle ausgewaehlten Variants in der Order
    //      passt zum Operator+Wert (eq/gte/lte/gt/lt)
    //
    // Edge Case bei Shopify: Mehrere Line-Items derselben Variant (z.B. wegen
    // Gruppen-Rabatt-Split) → wir aggregieren mit SUM, weil die UI das auch tut.
    if (filters.exclusiveVariantIds?.length && filters.exclusiveQuantity != null) {
      const op = filters.exclusiveQuantityOp ?? 'eq';
      const matchesOp = (sum: number, n: number): boolean => {
        switch (op) {
          case 'gt': return sum > n;
          case 'gte': return sum >= n;
          case 'lt': return sum < n;
          case 'lte': return sum <= n;
          default: return sum === n; // 'eq'
        }
      };
      const variantCount = filters.exclusiveVariantIds.length;
      const rows = await this.prisma.$queryRaw<Array<{ orderId: string; sumQ: number; distinctMatched: number }>>`
        SELECT li.order_id::text AS "orderId",
               SUM(li.quantity)::int AS "sumQ",
               COUNT(DISTINCT li.product_variant_id)::int AS "distinctMatched"
        FROM order_line_items li
        WHERE li.org_id = ${orgId}::uuid
          AND li.product_variant_id = ANY(${filters.exclusiveVariantIds}::uuid[])
          AND NOT EXISTS (
            SELECT 1 FROM order_line_items li2
            WHERE li2.order_id = li.order_id
              AND (li2.product_variant_id IS NULL
                   OR NOT (li2.product_variant_id = ANY(${filters.exclusiveVariantIds}::uuid[])))
          )
        GROUP BY li.order_id
      `;
      // ALLE ausgewaehlten Variants muessen vorkommen + Summen-Menge passt
      const matchingIds = rows
        .filter((r) => Number(r.distinctMatched) === variantCount)
        .filter((r) => matchesOp(Number(r.sumQ), filters.exclusiveQuantity!))
        .map((r) => r.orderId);
      if (where.id?.in) {
        const prev: string[] = where.id.in;
        where.id = { in: matchingIds.filter((id) => prev.includes(id)) };
      } else {
        where.id = { in: matchingIds };
      }
    }
    if (lineItemConditions.length === 1) {
      where.lineItems = lineItemConditions[0];
    } else if (lineItemConditions.length > 1) {
      // Merge multiple relation filters via AND so both apply
      where.AND = [
        ...(where.AND || []),
        ...lineItemConditions.map((c) => ({ lineItems: c })),
      ];
    }
    // Has-shipment filter
    if (filters.hasShipment === 'yes') where.shipments = { some: {} };
    if (filters.hasShipment === 'no') where.shipments = { none: {} };

    // Address-Status ist ein JSON-Feld → Prisma-WHERE kann das nicht direkt
    // filtern. Wir holen erst die IDs aller Orders die dem where entsprechen,
    // filtern in-memory nach Adress-Status, und begrenzen dann die eigentliche
    // Query auf diese IDs mit Pagination. Kostet 1 extra Query, stellt aber
    // sicher, dass die Pagination korrekt auf die gefilterten Orders wirkt
    // (statt blind die ersten 50 der Gesamtliste zu holen und danach zu filtern).
    if (filters.addressStatus === 'error' || filters.addressStatus === 'ok') {
      const wantError = filters.addressStatus === 'error';
      const allCandidates = await this.prisma.order.findMany({
        where,
        select: { id: true, shippingAddress: true },
      });
      const matchingIds = allCandidates
        .filter((o: any) => isAddressValid(o.shippingAddress) !== wantError)
        .map((o) => o.id);
      // Scope the main query to those IDs only
      where.id = { in: matchingIds };
    }

    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          status: true,
          fulfillmentStatus: true,
          financialStatus: true,
          currency: true,
          totalPrice: true,
          totalShipping: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          shippingAddress: true,
          countryCode: true,
          tags: true,
          shop: { select: { id: true, name: true, domain: true } },
          lineItems: {
            select: {
              id: true,
              productVariantId: true,
              title: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              // Produkt-Image via Variant→Product, damit Versand-Liste Produktbilder
              // anzeigen kann (inkl. Stückzahl-Badge wenn quantity > 1)
              productVariant: {
                select: {
                  product: {
                    select: { id: true, imageUrl: true, title: true },
                  },
                },
              },
            },
          },
          shipments: {
            select: { id: true, status: true, trackingNumber: true, carrier: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    // Flatten productVariant.product.imageUrl onto the lineItem for easier frontend use.
    // Fallback-Chain für Bild-Matching:
    //   1. lineItem.productVariantId → ProductVariant.product.imageUrl (direkter Join)
    //   2. lineItem.sku → ProductVariant.sku → Product.imageUrl
    //      (rettet alte Orders die vor dem Variant-Matching importiert wurden)
    //   3. lineItem.title fuzzy match → Product.title (letzte Notlösung)
    //
    // Wir sammeln erst alle fehlenden SKUs + Titel in einem Batch-Query statt
    // pro Order einzeln zu fragen.
    const missingSkus = new Set<string>();
    const missingTitles = new Set<string>();
    for (const o of items) {
      for (const li of o.lineItems || []) {
        const hasImage = (li as any).productVariant?.product?.imageUrl;
        if (!hasImage) {
          if (li.sku) missingSkus.add(li.sku);
          else if (li.title) missingTitles.add(li.title);
        }
      }
    }

    // Batch-Lookup via SKU (schneller + präziser als Fuzzy-Match)
    const skuMatches = missingSkus.size
      ? await this.prisma.productVariant.findMany({
          where: { orgId, sku: { in: Array.from(missingSkus) } },
          select: {
            sku: true,
            product: { select: { id: true, imageUrl: true, title: true } },
          },
        })
      : [];
    const skuMap = new Map(
      skuMatches
        .filter((v) => v.sku && v.product?.imageUrl)
        .map((v) => [v.sku!, v.product]),
    );

    // Batch-Lookup via Produkt-Titel (nur für Line-Items ohne SKU)
    const titleMatches = missingTitles.size
      ? await this.prisma.product.findMany({
          where: { orgId, title: { in: Array.from(missingTitles) } },
          select: { id: true, imageUrl: true, title: true },
        })
      : [];
    const titleMap = new Map(
      titleMatches.filter((p) => p.imageUrl).map((p) => [p.title, p]),
    );

    const flattened = items.map((o) => ({
      ...o,
      // Address-Status-Marker (für Frontend-Badge und Filter)
      hasAddressError: !isAddressValid(o.shippingAddress),
      lineItems: (o.lineItems || []).map((li: any) => {
        const direct = li.productVariant?.product;
        const fallbackSku = li.sku ? skuMap.get(li.sku) : null;
        const fallbackTitle = !li.sku ? titleMap.get(li.title) : null;
        const match = (direct?.imageUrl ? direct : null) || fallbackSku || fallbackTitle;
        return {
          ...li,
          productImageUrl: match?.imageUrl ?? null,
          productId: match?.id ?? direct?.id ?? null,
          productTitle: match?.title ?? direct?.title ?? li.title,
          productVariant: undefined,
        };
      }),
    }));

    // Post-Filter entfällt — Adress-Status-Filter wurde schon VOR der
    // Pagination via where.id angewendet (siehe oben).
    return { items: flattened, total };
  }

  /**
   * Zählt nur-Bestellungen mit Adress-Fehler für Tab-Badge.
   * Muss separat laufen weil list() eine Prisma-basierte Paginierung hat,
   * aber der Address-Filter in-memory passiert.
   */
  async countAddressErrors(orgId: string): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: {
        orgId,
        status: 'open' as const,
        fulfillmentStatus: { in: ['unfulfilled', 'partial'] as const },
        financialStatus: { notIn: ['refunded', 'partially_refunded'] as const },
        shipments: { none: {} },
      },
      select: { shippingAddress: true },
    });
    return orders.filter((o: any) => !isAddressValid(o.shippingAddress)).length;
  }

  /**
   * Update der Lieferadresse einer Bestellung.
   * Überschreibt shippingAddress-JSON und die denormalized customer*-Felder.
   * Nach Update erscheint die Bestellung wieder im normalen "Bestellungen"-Tab
   * (falls isAddressValid erneut true ist).
   */
  async updateAddress(
    orgId: string,
    orderId: string,
    newAddress: {
      name?: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      address1: string;
      address2?: string | null;
      houseNumber?: string | null;
      zip: string;
      city: string;
      province?: string | null;
      country: string; // ISO-2
      phone?: string | null;
      email?: string | null;
    },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, orgId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');

    // Merge: altes JSON behalten für unveränderte Felder, neue Werte überschreiben
    const currentAddr = (order.shippingAddress as any) || {};
    const mergedAddress = {
      ...currentAddr,
      name: newAddress.name ?? currentAddr.name,
      firstName: newAddress.firstName ?? currentAddr.firstName,
      lastName: newAddress.lastName ?? currentAddr.lastName,
      company: newAddress.company ?? currentAddr.company,
      address1: newAddress.address1,
      address2: newAddress.address2 ?? null,
      houseNumber: newAddress.houseNumber ?? null,
      zip: newAddress.zip,
      city: newAddress.city,
      province: newAddress.province ?? null,
      country: newAddress.country.toUpperCase(),
      country_code: newAddress.country.toUpperCase(),
      phone: newAddress.phone ?? currentAddr.phone,
    };

    // Denormalized Felder synchronisieren (werden vom Shipment-Service direkt genutzt)
    const fallbackName = [newAddress.firstName, newAddress.lastName].filter(Boolean).join(' ').trim();
    const customerName = newAddress.name ?? (fallbackName || order.customerName || null);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shippingAddress: mergedAddress,
        countryCode: newAddress.country.toUpperCase().slice(0, 2),
        customerName: customerName || null,
        customerEmail: newAddress.email ?? order.customerEmail,
        customerPhone: newAddress.phone ?? order.customerPhone,
      },
    });

    return { ok: true, orderId };
  }

  async get(orgId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        shop: true,
        lineItems: true,
        shipments: {
          include: { labels: true, statusEvents: { orderBy: { occurredAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return order;
  }

  /**
   * Versandgewicht einer Bestellung berechnen. Fallback-Kette pro Position:
   *   1. ShippingProductProfile.weightG (explizit im Versand-Modul gepflegt)
   *   2. ProductVariant.weightG (automatisch aus Shopify-Sync)
   *   3. → zählt als "unknown" (verursacht Hard-Fail beim Label-Create)
   * Items mit profile.excludeFromShipping werden übersprungen (z.B. digitale Goods).
   */
  async computeOrderWeight(
    orgId: string,
    orderId: string,
  ): Promise<{
    totalG: number;
    unknownCount: number;
    unknownItems: Array<{ title: string; sku: string | null; productVariantId: string | null }>;
  }> {
    const lineItems = await this.prisma.orderLineItem.findMany({
      where: { orderId, orgId },
      select: { productVariantId: true, sku: true, quantity: true, title: true },
    });
    if (lineItems.length === 0) return { totalG: 0, unknownCount: 0, unknownItems: [] };

    const productVariantIds = lineItems.map((li) => li.productVariantId).filter(Boolean) as string[];
    const skus = lineItems.map((li) => li.sku).filter(Boolean) as string[];

    const [profiles, variants] = await Promise.all([
      this.prisma.shippingProductProfile.findMany({
        where: {
          orgId,
          OR: [
            productVariantIds.length ? { productVariantId: { in: productVariantIds } } : {},
            skus.length ? { sku: { in: skus } } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
      }),
      productVariantIds.length
        ? this.prisma.productVariant.findMany({
            where: { orgId, id: { in: productVariantIds } },
            select: { id: true, weightG: true },
          })
        : Promise.resolve([] as Array<{ id: string; weightG: number }>),
    ]);

    const profileByVariant = new Map(profiles.filter((p) => p.productVariantId).map((p) => [p.productVariantId!, p]));
    const profileBySku = new Map(profiles.filter((p) => p.sku).map((p) => [p.sku!, p]));
    const variantById = new Map(variants.map((v) => [v.id, v.weightG]));

    let totalG = 0;
    let unknownCount = 0;
    const unknownItems: Array<{ title: string; sku: string | null; productVariantId: string | null }> = [];

    for (const li of lineItems) {
      const profile =
        (li.productVariantId && profileByVariant.get(li.productVariantId)) ||
        (li.sku && profileBySku.get(li.sku)) ||
        null;

      // Explicitly excluded from shipping (e.g. digital goods) → skip without counting as unknown
      if (profile?.excludeFromShipping) continue;

      let itemWeightG = 0;
      if (profile && profile.weightG != null && profile.weightG > 0) {
        itemWeightG = profile.weightG;
      } else if (li.productVariantId) {
        const vw = variantById.get(li.productVariantId);
        if (vw != null && vw > 0) itemWeightG = vw;
      }

      if (itemWeightG <= 0) {
        unknownCount++;
        unknownItems.push({
          title: li.title || 'Unbekanntes Produkt',
          sku: li.sku,
          productVariantId: li.productVariantId,
        });
        continue;
      }

      totalG += itemWeightG * Number(li.quantity);
    }

    return { totalG, unknownCount, unknownItems };
  }
}
