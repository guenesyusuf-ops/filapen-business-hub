import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProfileInput {
  productVariantId?: string | null;
  sku?: string | null;
  title?: string | null;
  weightG: number;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  hsCode?: string | null;
  countryOfOrigin?: string | null;
  customsValueCents?: number | null;
  customsCurrency?: string | null;
  excludeFromShipping?: boolean;
  notes?: string | null;
}

@Injectable()
export class ShippingProductProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List products with their shipping profiles (or lack thereof).
   * We combine existing Shopify-synced ProductVariants with any manual profiles.
   */
  async listWithProducts(orgId: string, search?: string) {
    // Bring in ProductVariants with their shipping profile (left join effect)
    const variants = await this.prisma.productVariant.findMany({
      where: {
        orgId,
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
      orderBy: { title: 'asc' },
      take: 500,
      include: {
        product: { select: { id: true, title: true, imageUrl: true } },
        shippingProfile: true,
      },
    });

    return variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      productImage: v.product.imageUrl,
      variantTitle: v.title,
      sku: v.sku,
      price: v.price,
      shippingProfile: v.shippingProfile,
    }));
  }

  async list(orgId: string) {
    return this.prisma.shippingProductProfile.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }

  async get(orgId: string, id: string) {
    const p = await this.prisma.shippingProductProfile.findFirst({ where: { id, orgId } });
    if (!p) throw new NotFoundException('Versandprofil nicht gefunden');
    return p;
  }

  async upsertForVariant(orgId: string, productVariantId: string, data: ProfileInput) {
    // Validate variant belongs to org
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: productVariantId, orgId },
      select: { id: true, title: true, sku: true },
    });
    if (!variant) throw new BadRequestException('Produktvariante nicht gefunden');
    this.validateNumbers(data);

    const existing = await this.prisma.shippingProductProfile.findUnique({
      where: { productVariantId },
    });

    if (existing) {
      return this.prisma.shippingProductProfile.update({
        where: { id: existing.id },
        data: this.sanitize(data, variant),
      });
    }
    return this.prisma.shippingProductProfile.create({
      data: {
        orgId,
        productVariantId,
        ...this.sanitize(data, variant),
      },
    });
  }

  async createManual(orgId: string, data: ProfileInput) {
    this.validateNumbers(data);
    if (!data.sku?.trim() && !data.title?.trim()) {
      throw new BadRequestException('SKU oder Titel erforderlich für manuelles Profil');
    }
    return this.prisma.shippingProductProfile.create({
      data: {
        orgId,
        productVariantId: null,
        ...this.sanitize(data, null),
      },
    });
  }

  async update(orgId: string, id: string, data: Partial<ProfileInput>) {
    const existing = await this.get(orgId, id);
    this.validateNumbers(data);
    return this.prisma.shippingProductProfile.update({
      where: { id: existing.id },
      data: this.sanitize(data, null, true),
    });
  }

  async remove(orgId: string, id: string) {
    const existing = await this.get(orgId, id);
    await this.prisma.shippingProductProfile.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  private validateNumbers(data: Partial<ProfileInput>) {
    if (data.weightG != null && (!Number.isFinite(data.weightG) || data.weightG < 0)) {
      throw new BadRequestException('Gewicht muss ≥ 0 sein');
    }
    for (const k of ['lengthMm', 'widthMm', 'heightMm'] as const) {
      const v = data[k];
      if (v != null && (!Number.isFinite(v) || v < 0)) {
        throw new BadRequestException(`${k} muss ≥ 0 sein`);
      }
    }
  }

  private sanitize(data: Partial<ProfileInput>, variant: { title: string; sku: string | null } | null, partial = false) {
    const out: any = {};
    if (!partial || data.sku !== undefined) out.sku = data.sku?.trim() || variant?.sku || null;
    if (!partial || data.title !== undefined) out.title = data.title?.trim() || variant?.title || null;
    if (!partial || data.weightG !== undefined) out.weightG = data.weightG ?? 0;
    if (!partial || data.lengthMm !== undefined) out.lengthMm = data.lengthMm ?? null;
    if (!partial || data.widthMm !== undefined) out.widthMm = data.widthMm ?? null;
    if (!partial || data.heightMm !== undefined) out.heightMm = data.heightMm ?? null;
    if (!partial || data.hsCode !== undefined) out.hsCode = data.hsCode?.trim() || null;
    if (!partial || data.countryOfOrigin !== undefined) out.countryOfOrigin = data.countryOfOrigin?.trim().toUpperCase().slice(0, 2) || null;
    if (!partial || data.customsValueCents !== undefined) out.customsValueCents = data.customsValueCents ?? null;
    if (!partial || data.customsCurrency !== undefined) out.customsCurrency = data.customsCurrency || 'EUR';
    if (!partial || data.excludeFromShipping !== undefined) out.excludeFromShipping = !!data.excludeFromShipping;
    if (!partial || data.notes !== undefined) out.notes = data.notes?.trim() || null;
    return out;
  }
}
