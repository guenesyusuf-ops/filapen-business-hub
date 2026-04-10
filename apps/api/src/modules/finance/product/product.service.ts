import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { ProductProfitability } from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductListParams {
  startDate: Date;
  endDate: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BulkUpdateResult {
  updated: number;
  failed: Array<{ variantId: string; error: string }>;
}

export interface CogsCoverage {
  totalVariants: number;
  withCogs: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List products with profitability data aggregated from order line items
   * within the given date range.
   */
  async listProducts(
    orgId: string,
    params: ProductListParams,
  ): Promise<PaginatedResult<ProductProfitability>> {
    const {
      startDate,
      endDate,
      sortBy = 'grossRevenue',
      sortOrder = 'desc',
      page = 1,
      pageSize = 25,
      search,
      category,
    } = params;

    const offset = (page - 1) * pageSize;

    // Map sort column names to SQL expressions
    const sortColumnMap: Record<string, string> = {
      grossRevenue: 'gross_revenue',
      grossProfit: 'gross_profit',
      grossMarginPercent: 'gross_margin_pct',
      unitsSold: 'units_sold',
      refundRate: 'refund_rate',
      title: 'p.title',
    };
    const orderCol = sortColumnMap[sortBy] ?? 'gross_revenue';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Build optional WHERE clauses
    const searchClause = search
      ? Prisma.sql`AND (p.title ILIKE ${'%' + search + '%'} OR pv.sku ILIKE ${'%' + search + '%'})`
      : Prisma.empty;
    const categoryClause = category
      ? Prisma.sql`AND p.category = ${category}`
      : Prisma.empty;

    // Count total matching products
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT p.id)::bigint AS count
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id
      INNER JOIN order_line_items oli ON oli.product_variant_id = pv.id
      INNER JOIN orders o ON o.id = oli.order_id
      WHERE p.org_id = ${orgId}::uuid
        AND o.placed_at >= ${startDate}
        AND o.placed_at <= ${endDate}
        AND o.status != 'cancelled'
        ${searchClause}
        ${categoryClause}
    `;

    const total = Number(countResult[0]?.count ?? 0);

    // Main profitability query
    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        title: string;
        sku: string | null;
        image_url: string | null;
        units_sold: bigint;
        gross_revenue: Prisma.Decimal;
        total_cogs: Prisma.Decimal;
        gross_profit: Prisma.Decimal;
        gross_margin_pct: Prisma.Decimal;
        refund_count: bigint;
        refund_rate: Prisma.Decimal;
      }>
    >`
      SELECT
        p.id                                                  AS product_id,
        p.title                                               AS title,
        MIN(pv.sku)                                           AS sku,
        p.image_url                                           AS image_url,
        COALESCE(SUM(oli.quantity), 0)::bigint                AS units_sold,
        COALESCE(SUM(oli.line_total), 0)                      AS gross_revenue,
        COALESCE(SUM(oli.line_cogs), 0)                       AS total_cogs,
        COALESCE(SUM(oli.line_total), 0) - COALESCE(SUM(oli.line_cogs), 0)
                                                              AS gross_profit,
        CASE
          WHEN SUM(oli.line_total) > 0
          THEN ((SUM(oli.line_total) - SUM(COALESCE(oli.line_cogs, 0))) / SUM(oli.line_total) * 100)
          ELSE 0
        END                                                   AS gross_margin_pct,
        COUNT(DISTINCT CASE WHEN o.financial_status IN ('refunded', 'partially_refunded') THEN o.id END)::bigint
                                                              AS refund_count,
        CASE
          WHEN COUNT(DISTINCT o.id) > 0
          THEN (COUNT(DISTINCT CASE WHEN o.financial_status IN ('refunded', 'partially_refunded') THEN o.id END)::numeric
                / COUNT(DISTINCT o.id)::numeric * 100)
          ELSE 0
        END                                                   AS refund_rate
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id
      INNER JOIN order_line_items oli ON oli.product_variant_id = pv.id
      INNER JOIN orders o ON o.id = oli.order_id
      WHERE p.org_id = ${orgId}::uuid
        AND o.placed_at >= ${startDate}
        AND o.placed_at <= ${endDate}
        AND o.status != 'cancelled'
        ${searchClause}
        ${categoryClause}
      GROUP BY p.id, p.title, p.image_url
      ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(orderDir)}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const items: ProductProfitability[] = rows.map((r) => ({
      productId: r.product_id,
      title: r.title,
      sku: r.sku,
      imageUrl: r.image_url,
      unitsSold: Number(r.units_sold),
      grossRevenue: Number(r.gross_revenue),
      totalCogs: Number(r.total_cogs),
      grossProfit: Number(r.gross_profit),
      grossMarginPercent: Math.round(Number(r.gross_margin_pct) * 100) / 100,
      refundCount: Number(r.refund_count),
      refundRate: Math.round(Number(r.refund_rate) * 100) / 100,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * List the raw product catalog (title, description, image, variants with
   * price/barcode/SKU/inventory). Does NOT require order data — returns
   * all products synced from Shopify (or other sources) for this org.
   */
  async listCatalog(
    orgId: string,
    params: {
      search?: string;
      sortBy?: 'title' | 'price' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const {
      search,
      sortBy = 'title',
      sortOrder = 'asc',
      page = 1,
      pageSize = 60,
    } = params;

    const where: Prisma.ProductWhereInput = {
      orgId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { vendor: { contains: search, mode: 'insensitive' as const } },
              { category: { contains: search, mode: 'insensitive' as const } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: search, mode: 'insensitive' as const } },
                      { barcode: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    // Sorting: Prisma can sort by title/createdAt directly. For price we
    // fetch and sort in memory (variant-based) — acceptable at current scale.
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sortBy === 'title'
        ? { title: sortOrder }
        : sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : { title: 'asc' };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          variants: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              title: true,
              sku: true,
              barcode: true,
              price: true,
              compareAtPrice: true,
              inventoryQuantity: true,
            },
          },
        },
      }),
    ]);

    let items = products.map((p) => {
      const variants = p.variants.map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        inventoryQuantity: v.inventoryQuantity,
      }));

      const prices = variants.map((v) => v.price).filter((n) => !isNaN(n));
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const totalInventory = variants.reduce(
        (sum, v) => sum + (v.inventoryQuantity || 0),
        0,
      );

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        handle: p.handle,
        imageUrl: p.imageUrl,
        status: p.status,
        category: p.category,
        vendor: p.vendor,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        variants,
        minPrice,
        maxPrice,
        totalInventory,
      };
    });

    // Post-sort for price since we computed minPrice in memory
    if (sortBy === 'price') {
      items = items.sort((a, b) =>
        sortOrder === 'asc' ? a.minPrice - b.minPrice : b.minPrice - a.minPrice,
      );
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Get a single product with all its variants.
   */
  async getProduct(orgId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId },
      include: {
        variants: {
          orderBy: { title: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    return product;
  }

  /**
   * Update COGS for a single product variant.
   * Returns the list of order dates that need reaggregation.
   */
  async updateCogs(
    orgId: string,
    variantId: string,
    cogs: number,
  ): Promise<Date[]> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, orgId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Update the variant COGS
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          cogs: new Prisma.Decimal(cogs),
          cogsUpdatedAt: new Date(),
        },
      });

      // Propagate to all line items that reference this variant
      await tx.$queryRaw`
        UPDATE order_line_items
        SET unit_cogs = ${cogs}::numeric,
            line_cogs = quantity * ${cogs}::numeric
        WHERE product_variant_id = ${variantId}::uuid
          AND org_id = ${orgId}::uuid
      `;
    });

    // Find affected order dates for reaggregation
    const affectedDates = await this.prisma.$queryRaw<
      Array<{ order_date: Date }>
    >`
      SELECT DISTINCT DATE(o.placed_at) AS order_date
      FROM orders o
      INNER JOIN order_line_items oli ON oli.order_id = o.id
      WHERE oli.product_variant_id = ${variantId}::uuid
        AND oli.org_id = ${orgId}::uuid
        AND o.status != 'cancelled'
      ORDER BY order_date
    `;

    return affectedDates.map((r) => r.order_date);
  }

  /**
   * Bulk update COGS for multiple variants.
   */
  async bulkUpdateCogs(
    orgId: string,
    updates: Array<{ variantId: string; cogs: number }>,
  ): Promise<BulkUpdateResult> {
    let updated = 0;
    const failed: Array<{ variantId: string; error: string }> = [];

    // Process sequentially to avoid lock contention; each is fast
    for (const { variantId, cogs } of updates) {
      try {
        await this.updateCogs(orgId, variantId, cogs);
        updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ variantId, error: message });
      }
    }

    return { updated, failed };
  }

  /**
   * Import COGS from CSV rows. Matches by SKU.
   * Returns stats about matched/unmatched rows.
   */
  async importCogs(
    orgId: string,
    rows: Array<{ sku: string; cogs: number }>,
  ): Promise<{ matched: number; unmatched: number; errors: string[] }> {
    let matched = 0;
    let unmatched = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.sku || row.cogs == null || isNaN(row.cogs)) {
        errors.push(`Invalid row: sku=${row.sku}, cogs=${row.cogs}`);
        continue;
      }

      // Find variant by SKU within this org
      const variant = await this.prisma.productVariant.findFirst({
        where: { orgId, sku: row.sku },
      });

      if (!variant) {
        unmatched++;
        continue;
      }

      try {
        await this.updateCogs(orgId, variant.id, row.cogs);
        matched++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`SKU ${row.sku}: ${message}`);
      }
    }

    return { matched, unmatched, errors };
  }

  /**
   * Get COGS coverage statistics for the organization.
   */
  async getCogsCoverage(orgId: string): Promise<CogsCoverage> {
    const result = await this.prisma.$queryRaw<
      [{ total: bigint; with_cogs: bigint }]
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(CASE WHEN cogs IS NOT NULL THEN 1 END)::bigint AS with_cogs
      FROM product_variants
      WHERE org_id = ${orgId}::uuid
    `;

    const total = Number(result[0]?.total ?? 0);
    const withCogs = Number(result[0]?.with_cogs ?? 0);

    return {
      totalVariants: total,
      withCogs,
      percentage: total > 0 ? Math.round((withCogs / total) * 10000) / 100 : 0,
    };
  }
}
