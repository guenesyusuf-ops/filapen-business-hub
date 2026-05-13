import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * B2B-Konditionen pro Kunde:
 *  - Globale Felder (Mindestbestellmenge, Mindestbestellwert, Rabatt-%,
 *    Lieferbedingungen) — leben auf sales_customers.
 *  - Produkt-Sonderpreise — leben in sales_customer_product_prices, jeweils
 *    fuer einen Produkt-Variant ODER ein Produkt (Hauptprodukt).
 *
 * Endpoints (siehe Controller):
 *   GET    /sales/customers/:id/conditions  → Globale Felder + Preisliste
 *   PUT    /sales/customers/:id/conditions  → Globale Felder updaten
 *   POST   /sales/customers/:id/product-prices  → neuen Preis anlegen
 *   PUT    /sales/product-prices/:priceId   → Preis aendern
 *   DELETE /sales/product-prices/:priceId   → Preis entfernen
 */

export interface CustomerConditionsInput {
  paymentTerms?: string | null;
  minOrderQuantity?: number | null;
  minOrderValue?: number | null;
  discountPercent?: number | null;
  shippingTerms?: string | null;
}

export interface ProductPriceInput {
  productId?: string | null;
  productVariantId?: string | null;
  netPrice: number;
  currency?: string;
  minQuantity?: number | null;
  notes?: string | null;
}

@Injectable()
export class SalesConditionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liefert globale Konditionen + alle Produkt-Sonderpreise des Kunden. */
  async getConditions(orgId: string, customerId: string) {
    const customer = await this.prisma.salesCustomer.findFirst({
      where: { id: customerId, orgId },
      select: {
        id: true,
        customerNumber: true,
        companyName: true,
        paymentTerms: true,
        minOrderQuantity: true,
        minOrderValue: true,
        discountPercent: true,
        shippingTerms: true,
      },
    });
    if (!customer) throw new NotFoundException('Kunde nicht gefunden');

    const productPrices = await this.prisma.salesCustomerProductPrice.findMany({
      where: { orgId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, title: true, sku: true } },
        productVariant: {
          select: { id: true, title: true, sku: true, productId: true, product: { select: { id: true, title: true } } },
        },
      },
    });

    return {
      customer,
      productPrices: productPrices.map((p) => ({
        ...p,
        netPrice: p.netPrice.toString(),
      })),
    };
  }

  /** Globale Kunden-Konditionen updaten. */
  async updateConditions(orgId: string, customerId: string, data: CustomerConditionsInput) {
    const existing = await this.prisma.salesCustomer.findFirst({
      where: { id: customerId, orgId },
    });
    if (!existing) throw new NotFoundException('Kunde nicht gefunden');

    const updates: Prisma.SalesCustomerUpdateInput = {};
    if (data.paymentTerms !== undefined) updates.paymentTerms = data.paymentTerms?.trim() || null;
    if (data.minOrderQuantity !== undefined) {
      updates.minOrderQuantity = data.minOrderQuantity != null ? Math.floor(Number(data.minOrderQuantity)) : null;
    }
    if (data.minOrderValue !== undefined) {
      updates.minOrderValue = data.minOrderValue != null ? new Prisma.Decimal(Number(data.minOrderValue).toFixed(2)) : null;
    }
    if (data.discountPercent !== undefined) {
      updates.discountPercent = data.discountPercent != null ? new Prisma.Decimal(Number(data.discountPercent).toFixed(2)) : null;
    }
    if (data.shippingTerms !== undefined) updates.shippingTerms = data.shippingTerms?.trim() || null;

    const updated = await this.prisma.salesCustomer.update({
      where: { id: customerId },
      data: updates,
      select: {
        id: true,
        paymentTerms: true,
        minOrderQuantity: true,
        minOrderValue: true,
        discountPercent: true,
        shippingTerms: true,
      },
    });
    return updated;
  }

  /** Neuen Produkt-Sonderpreis fuer den Kunden anlegen. */
  async addProductPrice(orgId: string, customerId: string, data: ProductPriceInput) {
    const customer = await this.prisma.salesCustomer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundException('Kunde nicht gefunden');

    if (!data.productId && !data.productVariantId) {
      throw new BadRequestException('Entweder productId oder productVariantId erforderlich');
    }
    if (!Number.isFinite(Number(data.netPrice)) || Number(data.netPrice) < 0) {
      throw new BadRequestException('netPrice ungueltig');
    }

    // Existenz pruefen + orgId-Match
    if (data.productVariantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: data.productVariantId, orgId } });
      if (!variant) throw new BadRequestException('Produkt-Variante nicht gefunden');
    } else if (data.productId) {
      const product = await this.prisma.product.findFirst({ where: { id: data.productId, orgId } });
      if (!product) throw new BadRequestException('Produkt nicht gefunden');
    }

    const created = await this.prisma.salesCustomerProductPrice.create({
      data: {
        orgId,
        customerId,
        productId: data.productVariantId ? null : data.productId,
        productVariantId: data.productVariantId || null,
        netPrice: new Prisma.Decimal(Number(data.netPrice).toFixed(4)),
        currency: data.currency || 'EUR',
        minQuantity: data.minQuantity != null ? Math.floor(Number(data.minQuantity)) : null,
        notes: data.notes?.trim() || null,
      },
      include: {
        product: { select: { id: true, title: true, sku: true } },
        productVariant: {
          select: { id: true, title: true, sku: true, productId: true, product: { select: { id: true, title: true } } },
        },
      },
    });
    return { ...created, netPrice: created.netPrice.toString() };
  }

  /** Produkt-Sonderpreis aktualisieren. */
  async updateProductPrice(orgId: string, priceId: string, data: Partial<ProductPriceInput>) {
    const existing = await this.prisma.salesCustomerProductPrice.findFirst({ where: { id: priceId, orgId } });
    if (!existing) throw new NotFoundException('Preis-Eintrag nicht gefunden');

    const updates: Prisma.SalesCustomerProductPriceUpdateInput = {};
    if (data.netPrice !== undefined) {
      if (!Number.isFinite(Number(data.netPrice)) || Number(data.netPrice) < 0) {
        throw new BadRequestException('netPrice ungueltig');
      }
      updates.netPrice = new Prisma.Decimal(Number(data.netPrice).toFixed(4));
    }
    if (data.currency !== undefined) updates.currency = data.currency || 'EUR';
    if (data.minQuantity !== undefined) {
      updates.minQuantity = data.minQuantity != null ? Math.floor(Number(data.minQuantity)) : null;
    }
    if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;

    const updated = await this.prisma.salesCustomerProductPrice.update({
      where: { id: priceId },
      data: updates,
      include: {
        product: { select: { id: true, title: true, sku: true } },
        productVariant: {
          select: { id: true, title: true, sku: true, productId: true, product: { select: { id: true, title: true } } },
        },
      },
    });
    return { ...updated, netPrice: updated.netPrice.toString() };
  }

  async removeProductPrice(orgId: string, priceId: string) {
    const existing = await this.prisma.salesCustomerProductPrice.findFirst({ where: { id: priceId, orgId } });
    if (!existing) throw new NotFoundException('Preis-Eintrag nicht gefunden');
    await this.prisma.salesCustomerProductPrice.delete({ where: { id: priceId } });
    return { deleted: true };
  }

  /** Produkt-Suche (Produkte + Varianten) — fuer den Dropdown im Frontend. */
  async searchProducts(orgId: string, q?: string) {
    const where: any = { orgId };
    if (q?.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { sku: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const products = await this.prisma.product.findMany({
      where,
      take: 30,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        sku: true,
        variants: {
          select: { id: true, title: true, sku: true, price: true, vatRate: true },
        },
      },
    });
    return products;
  }
}
