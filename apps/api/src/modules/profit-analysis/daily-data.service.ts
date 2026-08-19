import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, PaChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type Channel = 'shopify' | 'amazon' | 'tiktok';

export interface ChannelSalesPatch {
  gross19?: string;
  gross7?: string;
  returns19?: string;
  returns7?: string;
}

export interface AdsPatch {
  meta?: string;
  google?: string;
  influencer?: string;
  amazonPpc?: string;
  tiktokAds?: string;
}

export interface ShippingPatch {
  shopifyPackages?: number;
  tiktokPackages?: number;
}

export interface ChannelSalesRow {
  channel: Channel;
  gross19: string;
  gross7: string;
  returns19: string;
  returns7: string;
}

export interface AdsRow {
  meta: string;
  google: string;
  influencer: string;
  amazonPpc: string;
  tiktokAds: string;
}

export interface ShippingRow {
  shopifyPackages: number;
  tiktokPackages: number;
}

export interface ProductSaleRow {
  channel: Channel;
  productId: string;
  quantity: number;
}

export interface DayRawData {
  date: string;                          // YYYY-MM-DD
  monthId: string;
  monthStatus: 'open' | 'closed' | 'locked';
  channelSales: Record<Channel, ChannelSalesRow>;
  ads: AdsRow;
  shipping: ShippingRow;
  productSales: ProductSaleRow[];
}

/**
 * CRUD-Layer fuer alle Tages-Rohdaten. Zustaendig fuer:
 *   - lazy-Erstellung von pa_month + pa_day beim ersten Schreib-Zugriff
 *   - Feld-granulares Upsert (Autosave-freundlich)
 *   - Locked/Closed-Month-Guard: nur Owner darf gesperrte Monate schreiben
 *
 * Berechnungen finden NICHT hier statt — dafuer siehe CalculationService.
 */
@Injectable()
export class DailyDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Alle Rohdaten eines Monats. Wenn der Monat noch nicht existiert,
   * wird KEIN leerer Container angelegt — Read ist idempotent + nicht-mutierend.
   * Fehlender Monat -> leere Struktur.
   */
  async getMonthRaw(orgId: string, year: number, month: number): Promise<{
    monthId: string | null;
    status: 'open' | 'closed' | 'locked' | null;
    days: DayRawData[];
  }> {
    const monthRow = await this.prisma.paMonth.findUnique({
      where: { orgId_year_month: { orgId, year, month } },
      include: {
        days: {
          orderBy: { date: 'asc' },
          include: {
            channelSales: true,
            ads: true,
            shipping: true,
            productSales: true,
          },
        },
      },
    });

    if (!monthRow) {
      return { monthId: null, status: null, days: [] };
    }

    const days: DayRawData[] = monthRow.days.map((d) => this.toDayApi(d, monthRow.id, monthRow.status as any));
    return { monthId: monthRow.id, status: monthRow.status as any, days };
  }

  // ---------------------------------------------------------------------------
  // Write — feld-granular, autosave-freundlich
  // ---------------------------------------------------------------------------

  async upsertChannelSales(
    orgId: string, role: string, dateIso: string,
    channel: Channel, patch: ChannelSalesPatch,
  ): Promise<ChannelSalesRow> {
    const { day } = await this.ensureDay(orgId, role, dateIso);
    const data = {
      ...(patch.gross19 !== undefined && { gross19: this.decOrThrow(patch.gross19, 'gross19') }),
      ...(patch.gross7 !== undefined && { gross7: this.decOrThrow(patch.gross7, 'gross7') }),
      ...(patch.returns19 !== undefined && { returns19: this.decOrThrow(patch.returns19, 'returns19') }),
      ...(patch.returns7 !== undefined && { returns7: this.decOrThrow(patch.returns7, 'returns7') }),
    };
    const upserted = await this.prisma.paChannelSales.upsert({
      where: { dayId_channel: { dayId: day.id, channel: channel as PaChannel } },
      create: {
        orgId, dayId: day.id, channel: channel as PaChannel,
        gross19: data.gross19 ?? new Prisma.Decimal(0),
        gross7: data.gross7 ?? new Prisma.Decimal(0),
        returns19: data.returns19 ?? new Prisma.Decimal(0),
        returns7: data.returns7 ?? new Prisma.Decimal(0),
      },
      update: data,
    });
    return this.toChannelSalesApi(upserted);
  }

  async upsertAds(orgId: string, role: string, dateIso: string, patch: AdsPatch): Promise<AdsRow> {
    const { day } = await this.ensureDay(orgId, role, dateIso);
    const data = {
      ...(patch.meta       !== undefined && { meta:       this.decOrThrow(patch.meta,       'meta')       }),
      ...(patch.google     !== undefined && { google:     this.decOrThrow(patch.google,     'google')     }),
      ...(patch.influencer !== undefined && { influencer: this.decOrThrow(patch.influencer, 'influencer') }),
      ...(patch.amazonPpc  !== undefined && { amazonPpc:  this.decOrThrow(patch.amazonPpc,  'amazonPpc')  }),
      ...(patch.tiktokAds  !== undefined && { tiktokAds:  this.decOrThrow(patch.tiktokAds,  'tiktokAds')  }),
    };
    const upserted = await this.prisma.paDailyAds.upsert({
      where: { dayId: day.id },
      create: {
        orgId, dayId: day.id,
        meta: data.meta ?? new Prisma.Decimal(0),
        google: data.google ?? new Prisma.Decimal(0),
        influencer: data.influencer ?? new Prisma.Decimal(0),
        amazonPpc: data.amazonPpc ?? new Prisma.Decimal(0),
        tiktokAds: data.tiktokAds ?? new Prisma.Decimal(0),
      },
      update: data,
    });
    return this.toAdsApi(upserted);
  }

  async upsertShipping(orgId: string, role: string, dateIso: string, patch: ShippingPatch): Promise<ShippingRow> {
    const { day } = await this.ensureDay(orgId, role, dateIso);
    if (patch.shopifyPackages !== undefined && (patch.shopifyPackages < 0 || !Number.isInteger(patch.shopifyPackages))) {
      throw new BadRequestException('shopifyPackages muss eine positive Ganzzahl sein');
    }
    if (patch.tiktokPackages !== undefined && (patch.tiktokPackages < 0 || !Number.isInteger(patch.tiktokPackages))) {
      throw new BadRequestException('tiktokPackages muss eine positive Ganzzahl sein');
    }
    const upserted = await this.prisma.paDailyShipping.upsert({
      where: { dayId: day.id },
      create: {
        orgId, dayId: day.id,
        shopifyPackages: patch.shopifyPackages ?? 0,
        tiktokPackages: patch.tiktokPackages ?? 0,
      },
      update: {
        ...(patch.shopifyPackages !== undefined && { shopifyPackages: patch.shopifyPackages }),
        ...(patch.tiktokPackages !== undefined && { tiktokPackages: patch.tiktokPackages }),
      },
    });
    return { shopifyPackages: upserted.shopifyPackages, tiktokPackages: upserted.tiktokPackages };
  }

  async upsertProductSale(
    orgId: string, role: string, dateIso: string,
    channel: Channel, productId: string, quantity: number,
  ): Promise<ProductSaleRow> {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new BadRequestException('quantity muss eine positive Ganzzahl sein');
    }
    // Produkt-Zugehoerigkeit pruefen (Cross-Org-Schutz)
    const product = await this.prisma.product.findFirst({
      where: { id: productId, orgId }, select: { id: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');

    const { day } = await this.ensureDay(orgId, role, dateIso);

    // Wenn quantity = 0 UND ein Datensatz existiert -> loeschen (Aufraeumen)
    if (quantity === 0) {
      await this.prisma.paDailyProductSale.deleteMany({
        where: { dayId: day.id, channel: channel as PaChannel, productId },
      });
      return { channel, productId, quantity: 0 };
    }

    const upserted = await this.prisma.paDailyProductSale.upsert({
      where: { dayId_channel_productId: { dayId: day.id, channel: channel as PaChannel, productId } },
      create: { orgId, dayId: day.id, channel: channel as PaChannel, productId, quantity },
      update: { quantity },
    });
    return { channel: upserted.channel as Channel, productId: upserted.productId, quantity: upserted.quantity };
  }

  // ---------------------------------------------------------------------------
  // Lazy-Erstellung von Monat + Tag
  // ---------------------------------------------------------------------------

  private async ensureDay(orgId: string, role: string, dateIso: string) {
    const parsed = this.parseDate(dateIso);
    // Bestehenden Tag suchen (mit Monat-Status pruefen)
    const existing = await this.prisma.paDay.findUnique({
      where: { orgId_date: { orgId, date: parsed } },
      include: { month: { select: { id: true, status: true } } },
    });
    if (existing) {
      this.assertMonthWritable(existing.month.status as any, role);
      return { day: existing, month: existing.month };
    }
    // Monat lazy erstellen
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth() + 1;
    const monthRow = await this.prisma.paMonth.upsert({
      where: { orgId_year_month: { orgId, year, month } },
      create: { orgId, year, month },
      update: {},
    });
    this.assertMonthWritable(monthRow.status as any, role);
    const day = await this.prisma.paDay.upsert({
      where: { orgId_date: { orgId, date: parsed } },
      create: { orgId, monthId: monthRow.id, date: parsed },
      update: {},
    });
    return { day, month: monthRow };
  }

  private assertMonthWritable(status: 'open' | 'closed' | 'locked', role: string) {
    if (status === 'open') return;
    if (status === 'closed' && (role === 'owner' || role === 'admin')) return;
    if (status === 'locked' && role === 'owner') return;
    if (status === 'closed') {
      throw new ForbiddenException('Monat ist abgeschlossen — nur Admin/Owner koennen aendern');
    }
    throw new ForbiddenException('Monat ist gesperrt — nur Owner kann aendern');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parseDate(iso: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      throw new BadRequestException(`Datum muss im Format YYYY-MM-DD sein, war "${iso}"`);
    }
    const d = new Date(iso + 'T00:00:00.000Z');
    if (isNaN(d.getTime())) throw new BadRequestException(`Ungueltiges Datum: ${iso}`);
    return d;
  }

  private decOrThrow(input: string, field: string): Prisma.Decimal {
    if (typeof input !== 'string') throw new BadRequestException(`${field} muss ein String sein`);
    const normalized = input.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new BadRequestException(`${field}: ungueltiger Betrag "${input}"`);
    }
    return new Prisma.Decimal(normalized);
  }

  private toDayApi(d: any, monthId: string, monthStatus: any): DayRawData {
    const channelSales: Record<Channel, ChannelSalesRow> = {
      shopify: this.zeroChannelSales('shopify'),
      amazon: this.zeroChannelSales('amazon'),
      tiktok: this.zeroChannelSales('tiktok'),
    };
    for (const cs of d.channelSales as any[]) {
      channelSales[cs.channel as Channel] = this.toChannelSalesApi(cs);
    }
    return {
      date: d.date.toISOString().slice(0, 10),
      monthId,
      monthStatus,
      channelSales,
      ads: d.ads ? this.toAdsApi(d.ads) : this.zeroAds(),
      shipping: d.shipping
        ? { shopifyPackages: d.shipping.shopifyPackages, tiktokPackages: d.shipping.tiktokPackages }
        : { shopifyPackages: 0, tiktokPackages: 0 },
      productSales: (d.productSales as any[]).map((ps) => ({
        channel: ps.channel as Channel,
        productId: ps.productId,
        quantity: ps.quantity,
      })),
    };
  }

  private toChannelSalesApi(cs: any): ChannelSalesRow {
    return {
      channel: cs.channel as Channel,
      gross19: cs.gross19.toString(),
      gross7: cs.gross7.toString(),
      returns19: cs.returns19.toString(),
      returns7: cs.returns7.toString(),
    };
  }

  private toAdsApi(a: any): AdsRow {
    return {
      meta: a.meta.toString(),
      google: a.google.toString(),
      influencer: a.influencer.toString(),
      amazonPpc: a.amazonPpc.toString(),
      tiktokAds: a.tiktokAds.toString(),
    };
  }

  private zeroChannelSales(channel: Channel): ChannelSalesRow {
    return { channel, gross19: '0', gross7: '0', returns19: '0', returns7: '0' };
  }

  private zeroAds(): AdsRow {
    return { meta: '0', google: '0', influencer: '0', amazonPpc: '0', tiktokAds: '0' };
  }
}
