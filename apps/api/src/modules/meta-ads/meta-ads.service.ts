import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, MaFormat, MaAwareness, MaAdStatus, MaProductGroupType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  aggregate, deriveRow, buildRetentionSteps, biggestDrop, confidenceFrom,
  watchPercentage, round, timePositionSeconds, DailyMetricInput, AggregatedMetrics,
} from './meta-ads-calc';
import { buildAttentionSegments, AttentionPoint } from './attention-map';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hook/Hold Rate immer als Prozent speichern: Bruch-Eingaben (0 < x <= 1) auf Prozent skalieren. */
function rateToPercent(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v > 0 && v <= 1 ? Math.round(v * 10000) / 100 : v;
}

export type PeriodRange =
  | 'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'last30' | 'lifetime' | 'custom';

export interface AdInput {
  productGroupId: string;
  name: string;
  metaAdId?: string | null;
  startDate?: string | null;
  format?: string;
  angleId?: string | null;
  hookText?: string | null;
  awareness?: string | null;
  offerId?: string | null;
  adLink?: string | null;
  status?: string;
  videoLengthSeconds?: number | null;
  parentAdId?: string | null;
  changeType?: string | null;
  notes?: string | null;
}

export interface DailyMetricInputDto {
  date: string;
  spend?: number | null;
  impressions?: number | null;
  hookRate?: number | null;
  holdRate?: number | null;
  videoViews3s?: number | null;
  videoViews25?: number | null;
  videoViews50?: number | null;
  videoViews75?: number | null;
  videoViews95?: number | null;
  videoViews100?: number | null;
  thruplays?: number | null;
  averageWatchTimeSeconds?: number | null;
  cpcAll?: number | null;
  ctrAll?: number | null;
  outboundCtr?: number | null;
  totalSales?: number | null;
  uniqueSales?: number | null;
  hyrosRoas?: number | null;
  revenue?: number | null;
}

const dec = (v: Prisma.Decimal | number | null): number | null =>
  v == null ? null : Number(v);

@Injectable()
export class MetaAdsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Produkt-/Analysegruppen (Product Switcher) + Shop-Katalog + Angles + Offers
  // =========================================================================

  /** Analysegruppen der Org (linked | manual | bundle) — für Switcher + Modal. */
  async listProductGroups(orgId: string) {
    const rows = await this.prisma.maProductGroup.findMany({
      where: { orgId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return rows.map((g) => ({ id: g.id, name: g.name, type: g.type, productId: g.productId ?? null }));
  }

  /** Roher Shop-Produktkatalog — nur zum Verknüpfen (type=linked). */
  async listShopProducts(orgId: string) {
    const rows = await this.prisma.product.findMany({
      where: { orgId },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
    return rows.map((p) => ({ id: p.id, title: p.title }));
  }

  /**
   * Analysegruppe anlegen OHNE den Shop-Katalog zu verschmutzen.
   * - type=linked  → productId eines echten Shop-Produkts (Pflicht), Name default = Produkttitel
   * - type=manual  → frei (z. B. "Test Offer XY")
   * - type=bundle  → frei (z. B. "Bundle A+B")
   */
  async createProductGroup(orgId: string, input: { name?: string; type?: string; productId?: string | null }) {
    const type = this.parseGroupType(input?.type ?? 'manual');
    let productId: string | null = null;
    let name = (input?.name ?? '').trim();

    if (type === MaProductGroupType.linked) {
      if (!input?.productId) throw new BadRequestException('Für eine verknüpfte Gruppe ist ein Shop-Produkt erforderlich');
      const product = await this.prisma.product.findFirst({ where: { id: input.productId, orgId }, select: { id: true, title: true } });
      if (!product) throw new BadRequestException('Produkt gehört nicht zu dieser Organisation');
      productId = product.id;
      if (!name) name = product.title;
    }
    if (!name) throw new BadRequestException('Name darf nicht leer sein');

    const existing = await this.prisma.maProductGroup.findFirst({ where: { orgId, name }, select: { id: true } });
    if (existing) throw new BadRequestException(`Eine Gruppe "${name}" existiert bereits`);

    const g = await this.prisma.maProductGroup.create({ data: { orgId, name, type, productId } });
    return { id: g.id, name: g.name, type: g.type, productId: g.productId ?? null };
  }

  private parseGroupType(v: string): MaProductGroupType {
    if (!(v in MaProductGroupType)) throw new BadRequestException(`Ungültiger Gruppentyp: ${v}`);
    return MaProductGroupType[v as keyof typeof MaProductGroupType];
  }

  async listAngles(orgId: string) {
    const rows = await this.prisma.maAngle.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return rows.map((a) => ({ id: a.id, name: a.name }));
  }

  async createAngle(orgId: string, name: string) {
    const clean = (name ?? '').trim();
    if (!clean) throw new BadRequestException('Angle-Name darf nicht leer sein');
    return this.prisma.maAngle.upsert({
      where: { orgId_name: { orgId, name: clean } },
      update: {},
      create: { orgId, name: clean },
    });
  }

  async listOffers(orgId: string) {
    const rows = await this.prisma.maOffer.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return rows.map((o) => ({ id: o.id, name: o.name }));
  }

  async createOffer(orgId: string, name: string) {
    const clean = (name ?? '').trim();
    if (!clean) throw new BadRequestException('Offer-Name darf nicht leer sein');
    return this.prisma.maOffer.upsert({
      where: { orgId_name: { orgId, name: clean } },
      update: {},
      create: { orgId, name: clean },
    });
  }

  // =========================================================================
  // Ads — CRUD
  // =========================================================================

  async createAd(orgId: string, input: AdInput) {
    const data = await this.buildAdData(orgId, input, true);
    const ad = await this.prisma.maAd.create({
      data: { orgId, ...data } as Prisma.MaAdUncheckedCreateInput,
    });
    return this.serializeAd(ad);
  }

  async updateAd(orgId: string, id: string, input: Partial<AdInput>) {
    await this.mustOwnAd(orgId, id);
    const data = await this.buildAdData(orgId, input, false);
    const ad = await this.prisma.maAd.update({
      where: { id },
      data: data as Prisma.MaAdUncheckedUpdateInput,
    });
    return this.serializeAd(ad);
  }

  async deleteAd(orgId: string, id: string) {
    await this.mustOwnAd(orgId, id);
    // Daily Metrics hängen per ON DELETE CASCADE dran.
    await this.prisma.maAd.delete({ where: { id } });
    return { ok: true };
  }

  async getAd(orgId: string, id: string) {
    const ad = await this.prisma.maAd.findFirst({
      where: { id, orgId },
      include: { angle: true, offer: true, productGroup: true },
    });
    if (!ad) throw new NotFoundException('Ad nicht gefunden');
    return this.serializeAd(ad, {
      angleName: ad.angle?.name ?? null,
      offerName: ad.offer?.name ?? null,
      productGroup: ad.productGroup,
    });
  }

  /**
   * Ad-Liste mit server-seitigen Filtern + aggregierten Performance-Werten
   * für den gewählten Zeitraum. Paginierung auf Ad-Ebene.
   */
  async listAds(
    orgId: string,
    opts: {
      productGroupId?: string;
      format?: string;
      angleId?: string;
      offerId?: string;
      status?: string;
      search?: string;
      range?: PeriodRange;
      start?: string;
      end?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const period = this.resolvePeriod(opts.range, opts.start, opts.end);
    const where: Prisma.MaAdWhereInput = { orgId };
    if (opts.productGroupId) where.productGroupId = opts.productGroupId;
    if (opts.format) where.format = this.parseFormat(opts.format);
    if (opts.angleId) where.angleId = opts.angleId;
    if (opts.offerId) where.offerId = opts.offerId;
    if (opts.status) where.status = this.parseStatus(opts.status);
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { metaAdId: { contains: q, mode: 'insensitive' } },
        { hookText: { contains: q, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

    const [total, ads] = await Promise.all([
      this.prisma.maAd.count({ where }),
      this.prisma.maAd.findMany({
        where,
        include: { angle: true, offer: true, productGroup: true },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const metricsByAd = await this.loadMetricsByAd(ads.map((a) => a.id), period);

    const items = ads.map((ad) => {
      const rows = metricsByAd.get(ad.id) ?? [];
      const agg = aggregate(rows);
      return {
        ...this.serializeAd(ad, {
          angleName: ad.angle?.name ?? null,
          offerName: ad.offer?.name ?? null,
          productGroup: ad.productGroup,
        }),
        metrics: agg,
      };
    });

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1, period };
  }

  // =========================================================================
  // Daily Metrics (manuelle Eingabe = Upsert pro Ad + Datum)
  // =========================================================================

  async upsertDailyMetric(orgId: string, adId: string, dto: DailyMetricInputDto) {
    await this.mustOwnAd(orgId, adId);
    if (!dto?.date || !DATE_RE.test(dto.date)) {
      throw new BadRequestException('Datum im Format YYYY-MM-DD erforderlich');
    }
    const warnings = this.validateMetric(dto);
    const date = new Date(dto.date);

    const payload: Prisma.MaAdDailyMetricUncheckedCreateInput = {
      orgId,
      adId,
      date,
      spend: dto.spend ?? null,
      impressions: dto.impressions ?? null,
      // Hook/Hold als Prozent speichern; Bruch-Eingaben (0.21) auf 21 normalisieren.
      hookRate: rateToPercent(dto.hookRate),
      holdRate: rateToPercent(dto.holdRate),
      videoViews3s: dto.videoViews3s ?? null,
      videoViews25: dto.videoViews25 ?? null,
      videoViews50: dto.videoViews50 ?? null,
      videoViews75: dto.videoViews75 ?? null,
      videoViews95: dto.videoViews95 ?? null,
      videoViews100: dto.videoViews100 ?? null,
      thruplays: dto.thruplays ?? null,
      averageWatchTimeSeconds: dto.averageWatchTimeSeconds ?? null,
      cpcAll: dto.cpcAll ?? null,
      ctrAll: dto.ctrAll ?? null,
      outboundCtr: dto.outboundCtr ?? null,
      totalSales: dto.totalSales ?? null,
      uniqueSales: dto.uniqueSales ?? null,
      hyrosRoas: dto.hyrosRoas ?? null,
      revenue: dto.revenue ?? null,
    };
    const { orgId: _o, adId: _a, date: _d, ...updatable } = payload;

    const row = await this.prisma.maAdDailyMetric.upsert({
      where: { adId_date: { adId, date } },
      update: updatable,
      create: payload,
    });
    return { metric: this.serializeMetric(row), warnings };
  }

  async deleteDailyMetric(orgId: string, adId: string, dateStr: string) {
    await this.mustOwnAd(orgId, adId);
    if (!DATE_RE.test(dateStr)) throw new BadRequestException('Datum im Format YYYY-MM-DD erforderlich');
    await this.prisma.maAdDailyMetric.deleteMany({ where: { orgId, adId, date: new Date(dateStr) } });
    return { ok: true };
  }

  /** Tageshistorie einer Ad inkl. abgeleiteter Kennzahlen. */
  async listDailyMetrics(orgId: string, adId: string, range?: PeriodRange, start?: string, end?: string) {
    const ad = await this.prisma.maAd.findFirst({ where: { id: adId, orgId } });
    if (!ad) throw new NotFoundException('Ad nicht gefunden');
    const period = this.resolvePeriod(range, start, end);
    const rows = await this.prisma.maAdDailyMetric.findMany({
      where: this.metricWhere(orgId, [adId], period),
      orderBy: { date: 'desc' },
    });
    const normalized = rows.map((r) => this.toCalcInput(r));
    return {
      items: rows.map((r, i) => ({
        ...this.serializeMetric(r),
        derived: deriveRow(normalized[i], ad.videoLengthSeconds),
      })),
      aggregate: aggregate(normalized),
      videoLengthSeconds: ad.videoLengthSeconds,
      period,
    };
  }

  // =========================================================================
  // Overview — KPI-Aggregate + Zählungen
  // =========================================================================

  async overview(orgId: string, opts: { productGroupId?: string; range?: PeriodRange; start?: string; end?: string }) {
    const period = this.resolvePeriod(opts.range, opts.start, opts.end);
    const adWhere: Prisma.MaAdWhereInput = { orgId };
    if (opts.productGroupId) adWhere.productGroupId = opts.productGroupId;

    const ads = await this.prisma.maAd.findMany({ where: adWhere, select: { id: true, status: true } });
    const adIds = ads.map((a) => a.id);
    const rows = adIds.length
      ? await this.prisma.maAdDailyMetric.findMany({ where: this.metricWhere(orgId, adIds, period) })
      : [];

    const byStatus: Record<string, number> = {};
    for (const a of ads) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;

    return {
      kpis: aggregate(rows.map((r) => this.toCalcInput(r))),
      counts: {
        totalAds: ads.length,
        active: byStatus[MaAdStatus.active] ?? 0,
        paused: byStatus[MaAdStatus.paused] ?? 0,
        ended: byStatus[MaAdStatus.ended] ?? 0,
        draft: byStatus[MaAdStatus.draft] ?? 0,
        archived: byStatus[MaAdStatus.archived] ?? 0,
      },
      period,
    };
  }

  // =========================================================================
  // Retention-Analytics (Phase 3, deterministisch — keine KI)
  // =========================================================================

  async retentionAnalysis(orgId: string, adId: string, range?: PeriodRange, start?: string, end?: string) {
    const ad = await this.prisma.maAd.findFirst({
      where: { id: adId, orgId },
      select: { id: true, name: true, format: true, videoLengthSeconds: true, productGroupId: true, productGroup: { select: { name: true } } },
    });
    if (!ad) throw new NotFoundException('Ad nicht gefunden');

    const period = this.resolvePeriod(range, start, end);
    const agg = await this.aggregateForAdIds(orgId, [adId], period);
    const vl = ad.videoLengthSeconds;

    // Baselines (ohne die Ad selbst)
    const groupAds = ad.productGroupId
      ? await this.prisma.maAd.findMany({ where: { orgId, productGroupId: ad.productGroupId, id: { not: adId } }, select: { id: true } })
      : [];
    const formatAds = await this.prisma.maAd.findMany({ where: { orgId, format: ad.format, id: { not: adId } }, select: { id: true } });

    const groupBase = groupAds.length ? await this.aggregateForAdIds(orgId, groupAds.map((a) => a.id), period) : null;
    const formatBase = formatAds.length ? await this.aggregateForAdIds(orgId, formatAds.map((a) => a.id), period) : null;

    const profile = (a: AggregatedMetrics | null) => a == null ? null : {
      hookRate: a.hookRate, holdRate: a.holdRate, ctrAll: a.ctrAll, outboundCtr: a.outboundCtr,
      retention25to50: a.retention25to50, retention50to75: a.retention50to75,
      retention75to95: a.retention75to95, retention95to100: a.retention95to100,
      completion25to100: a.completion25to100,
      watchPercentage: watchPercentage(a.averageWatchTimeSeconds, vl),
    };

    return {
      adId: ad.id,
      name: ad.name,
      format: ad.format,
      videoLengthSeconds: vl,
      period,
      self: profile(agg),
      steps: buildRetentionSteps(agg, vl),
      biggestDrop: biggestDrop(agg, vl),
      attention: this.buildAttention(agg, vl),
      confidence: confidenceFrom(agg),
      averageWatchTimeSeconds: round(agg.averageWatchTimeSeconds, 2),
      dataPoints: agg.dataPoints,
      baselines: {
        productGroup: groupBase ? { label: ad.productGroup?.name ?? 'Produktgruppe', adCount: groupAds.length, ...profile(groupBase) } : null,
        format: formatBase ? { label: ad.format, adCount: formatAds.length, ...profile(formatBase) } : null,
      },
    };
  }

  async aggregateForAdIds(orgId: string, adIds: string[], period: { from?: string; to?: string }): Promise<AggregatedMetrics> {
    if (!adIds.length) return aggregate([]);
    const rows = await this.prisma.maAdDailyMetric.findMany({ where: this.metricWhere(orgId, adIds, period) });
    return aggregate(rows.map((r) => this.toCalcInput(r)));
  }

  /** Interpolierte Attention-Punkte/-Segmente (keine echte Sekunden-Retention). */
  private buildAttention(agg: AggregatedMetrics, vl: number | null) {
    const t = (pct: number) => timePositionSeconds(pct, vl);
    const points: AttentionPoint[] = [
      { label: '0s', seconds: 0, viewers: agg.impressions },
      { label: '3s', seconds: 3, viewers: agg.videoViews3s },
      { label: '25%', seconds: t(25), viewers: agg.videoViews25 },
      { label: '50%', seconds: t(50), viewers: agg.videoViews50 },
      { label: '75%', seconds: t(75), viewers: agg.videoViews75 },
      { label: '95%', seconds: t(95), viewers: agg.videoViews95 },
      { label: '100%', seconds: t(100), viewers: agg.videoViews100 },
    ].filter((p) => p.viewers > 0);
    const { segments, maxViewers } = buildAttentionSegments(points);
    return { approximate: true, videoLengthSeconds: vl, points, segments, maxViewers };
  }

  /** Produkt-Level Attention-Vergleich: alle Video-Ads einer Gruppe, gleiche relative Timeline. */
  async productAttention(orgId: string, productGroupId: string | undefined, range?: PeriodRange, start?: string, end?: string) {
    if (!productGroupId) throw new BadRequestException('Produktgruppe erforderlich.');
    const period = this.resolvePeriod(range, start, end);
    const ads = await this.prisma.maAd.findMany({
      where: { orgId, productGroupId, format: 'video' },
      select: { id: true, name: true, videoLengthSeconds: true }, orderBy: { createdAt: 'asc' },
    });
    const out = [];
    for (const ad of ads) {
      const agg = await this.aggregateForAdIds(orgId, [ad.id], period);
      const att = this.buildAttention(agg, ad.videoLengthSeconds);
      out.push({
        adId: ad.id, name: ad.name, videoLengthSeconds: ad.videoLengthSeconds,
        hookRate: agg.hookRate, retention50to75: agg.retention50to75,
        biggestDrop: biggestDrop(agg, ad.videoLengthSeconds), confidence: confidenceFrom(agg),
        segments: att.segments, maxViewers: att.maxViewers,
      });
    }
    out.sort((a, b) => (b.hookRate ?? -1) - (a.hookRate ?? -1));
    return { productGroupId, approximate: true, ads: out };
  }

  // =========================================================================
  // Interne Helfer
  // =========================================================================

  private async mustOwnAd(orgId: string, id: string) {
    const found = await this.prisma.maAd.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!found) throw new NotFoundException('Ad nicht gefunden');
  }

  private async buildAdData(orgId: string, input: Partial<AdInput>, isCreate: boolean): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    if (isCreate || input.productGroupId !== undefined) {
      if (!input.productGroupId) throw new BadRequestException('Produkt / Analysegruppe ist erforderlich');
      const group = await this.prisma.maProductGroup.findFirst({ where: { id: input.productGroupId, orgId }, select: { id: true, productId: true } });
      if (!group) throw new BadRequestException('Produktgruppe gehört nicht zu dieser Organisation');
      data.productGroupId = group.id;
      // Spiegel das verknüpfte Shop-Produkt (falls linked) ins Legacy-Feld — sonst null.
      data.productId = group.productId ?? null;
    }
    if (isCreate || input.name !== undefined) {
      const name = (input.name ?? '').trim();
      if (!name) throw new BadRequestException('Ad-Name ist erforderlich');
      data.name = name;
    }
    if (input.metaAdId !== undefined) data.metaAdId = input.metaAdId?.trim() || null;
    if (input.startDate !== undefined) {
      if (input.startDate && !DATE_RE.test(input.startDate)) throw new BadRequestException('Startdatum im Format YYYY-MM-DD');
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.format !== undefined) data.format = this.parseFormat(input.format);
    if (input.angleId !== undefined) data.angleId = await this.validateRef(orgId, 'angle', input.angleId);
    if (input.offerId !== undefined) data.offerId = await this.validateRef(orgId, 'offer', input.offerId);
    if (input.hookText !== undefined) data.hookText = input.hookText ?? null;
    if (input.awareness !== undefined) data.awareness = input.awareness ? this.parseAwareness(input.awareness) : null;
    if (input.adLink !== undefined) data.adLink = input.adLink?.trim() || null;
    if (input.status !== undefined) data.status = this.parseStatus(input.status);
    if (input.videoLengthSeconds !== undefined) {
      if (input.videoLengthSeconds != null && !(input.videoLengthSeconds > 0)) {
        throw new BadRequestException('Video-Länge muss > 0 sein');
      }
      data.videoLengthSeconds = input.videoLengthSeconds ?? null;
    }
    if (input.parentAdId !== undefined) {
      data.parentAdId = input.parentAdId || null;
      if (input.parentAdId) await this.mustOwnAd(orgId, input.parentAdId);
    }
    if (input.changeType !== undefined) data.changeType = input.changeType?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    return data;
  }

  private async validateRef(orgId: string, kind: 'angle' | 'offer', id: string | null | undefined) {
    if (!id) return null;
    const found =
      kind === 'angle'
        ? await this.prisma.maAngle.findFirst({ where: { id, orgId }, select: { id: true } })
        : await this.prisma.maOffer.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!found) throw new BadRequestException(`${kind === 'angle' ? 'Angle' : 'Offer'} gehört nicht zu dieser Organisation`);
    return id;
  }

  /** Harte Validierung (wirft) + weiche Plausibilitäts-Warnungen (nur melden). */
  private validateMetric(dto: DailyMetricInputDto): string[] {
    const nonNeg: (keyof DailyMetricInputDto)[] = [
      'spend', 'impressions', 'videoViews3s', 'videoViews25', 'videoViews50', 'videoViews75',
      'videoViews95', 'videoViews100', 'thruplays', 'averageWatchTimeSeconds', 'cpcAll',
      'totalSales', 'uniqueSales', 'hyrosRoas', 'revenue',
    ];
    for (const f of nonNeg) {
      const v = dto[f] as number | null | undefined;
      if (v != null && v < 0) throw new BadRequestException(`${f} darf nicht negativ sein`);
    }
    const rates: (keyof DailyMetricInputDto)[] = ['hookRate', 'holdRate', 'ctrAll', 'outboundCtr'];
    for (const f of rates) {
      const v = dto[f] as number | null | undefined;
      if (v != null && (v < 0 || v > 100)) throw new BadRequestException(`${f} muss zwischen 0 und 100 liegen`);
    }

    const warnings: string[] = [];
    const n = (v: number | null | undefined) => (v == null ? null : v);
    if (n(dto.uniqueSales) != null && n(dto.totalSales) != null && dto.uniqueSales! > dto.totalSales!)
      warnings.push('Unique Sales größer als Sales gesamt');
    const chain: [keyof DailyMetricInputDto, keyof DailyMetricInputDto][] = [
      ['videoViews50', 'videoViews25'], ['videoViews75', 'videoViews50'],
      ['videoViews95', 'videoViews75'], ['videoViews100', 'videoViews95'],
    ];
    for (const [later, earlier] of chain) {
      const l = dto[later] as number | null | undefined;
      const e = dto[earlier] as number | null | undefined;
      if (l != null && e != null && l > e) warnings.push(`${later} größer als ${earlier} (Retention steigt normalerweise nicht)`);
    }
    return warnings;
  }

  private toCalcInput(r: {
    spend: Prisma.Decimal | null; impressions: number | null; hookRate: Prisma.Decimal | null;
    holdRate: Prisma.Decimal | null; videoViews3s: number | null; videoViews25: number | null;
    videoViews50: number | null; videoViews75: number | null; videoViews95: number | null;
    videoViews100: number | null; thruplays: number | null; averageWatchTimeSeconds: Prisma.Decimal | null;
    cpcAll: Prisma.Decimal | null; ctrAll: Prisma.Decimal | null; outboundCtr: Prisma.Decimal | null;
    totalSales: number | null; uniqueSales: number | null; hyrosRoas: Prisma.Decimal | null;
    revenue: Prisma.Decimal | null;
  }): DailyMetricInput {
    return {
      spend: dec(r.spend), impressions: r.impressions, hookRate: dec(r.hookRate), holdRate: dec(r.holdRate),
      videoViews3s: r.videoViews3s, videoViews25: r.videoViews25, videoViews50: r.videoViews50,
      videoViews75: r.videoViews75, videoViews95: r.videoViews95, videoViews100: r.videoViews100,
      thruplays: r.thruplays, averageWatchTimeSeconds: dec(r.averageWatchTimeSeconds),
      cpcAll: dec(r.cpcAll), ctrAll: dec(r.ctrAll), outboundCtr: dec(r.outboundCtr),
      totalSales: r.totalSales, uniqueSales: r.uniqueSales, hyrosRoas: dec(r.hyrosRoas), revenue: dec(r.revenue),
    };
  }

  private async loadMetricsByAd(adIds: string[], period: { from?: string; to?: string }) {
    const map = new Map<string, DailyMetricInput[]>();
    if (!adIds.length) return map;
    const rows = await this.prisma.maAdDailyMetric.findMany({
      where: this.metricWhere(null, adIds, period),
    });
    for (const id of adIds) map.set(id, []);
    for (const r of rows) {
      const arr = map.get(r.adId);
      if (arr) arr.push(this.toCalcInput(r));
    }
    return map;
  }

  private metricWhere(orgId: string | null, adIds: string[], period: { from?: string; to?: string }): Prisma.MaAdDailyMetricWhereInput {
    const where: Prisma.MaAdDailyMetricWhereInput = { adId: { in: adIds } };
    if (orgId) where.orgId = orgId;
    if (period.from || period.to) {
      where.date = {};
      if (period.from) where.date.gte = new Date(period.from);
      if (period.to) where.date.lte = new Date(period.to);
    }
    return where;
  }

  resolvePeriod(range?: PeriodRange, start?: string, end?: string): { from?: string; to?: string; range: PeriodRange } {
    const r = range ?? 'last7';
    if (r === 'custom') {
      if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
        throw new BadRequestException('Benutzerdefinierter Zeitraum braucht start & end (YYYY-MM-DD)');
      }
      if (start > end) throw new BadRequestException('start muss <= end sein');
      return { from: start, to: end, range: r };
    }
    if (r === 'lifetime') return { range: r };
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const minus = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d); };
    switch (r) {
      case 'today': return { from: iso(today), to: iso(today), range: r };
      case 'yesterday': return { from: minus(1), to: minus(1), range: r };
      case 'last3': return { from: minus(2), to: iso(today), range: r };
      case 'last14': return { from: minus(13), to: iso(today), range: r };
      case 'last30': return { from: minus(29), to: iso(today), range: r };
      case 'last7':
      default: return { from: minus(6), to: iso(today), range: 'last7' };
    }
  }

  private parseFormat(v: string): MaFormat {
    if (!(v in MaFormat)) throw new BadRequestException(`Ungültiges Format: ${v}`);
    return MaFormat[v as keyof typeof MaFormat];
  }
  private parseStatus(v: string): MaAdStatus {
    if (!(v in MaAdStatus)) throw new BadRequestException(`Ungültiger Status: ${v}`);
    return MaAdStatus[v as keyof typeof MaAdStatus];
  }
  private parseAwareness(v: string): MaAwareness {
    if (!(v in MaAwareness)) throw new BadRequestException(`Ungültiges Awareness-Level: ${v}`);
    return MaAwareness[v as keyof typeof MaAwareness];
  }

  private serializeAd(ad: any, extra?: { angleName?: string | null; offerName?: string | null; productGroup?: { id: string; name: string; type: string } | null }) {
    const pg = extra?.productGroup ?? null;
    return {
      id: ad.id,
      productGroupId: ad.productGroupId ?? null,
      productGroupName: pg?.name ?? null,
      productGroupType: pg?.type ?? null,
      name: ad.name,
      metaAdId: ad.metaAdId ?? null,
      startDate: ad.startDate ? ad.startDate.toISOString().slice(0, 10) : null,
      format: ad.format,
      angleId: ad.angleId ?? null,
      angleName: extra?.angleName ?? null,
      hookText: ad.hookText ?? null,
      awareness: ad.awareness ?? null,
      offerId: ad.offerId ?? null,
      offerName: extra?.offerName ?? null,
      adLink: ad.adLink ?? null,
      status: ad.status,
      videoLengthSeconds: ad.videoLengthSeconds ?? null,
      parentAdId: ad.parentAdId ?? null,
      changeType: ad.changeType ?? null,
      notes: ad.notes ?? null,
      createdAt: ad.createdAt?.toISOString?.() ?? null,
      updatedAt: ad.updatedAt?.toISOString?.() ?? null,
    };
  }

  private serializeMetric(m: any) {
    return {
      id: m.id,
      adId: m.adId,
      date: m.date.toISOString().slice(0, 10),
      spend: dec(m.spend),
      impressions: m.impressions,
      hookRate: dec(m.hookRate),
      holdRate: dec(m.holdRate),
      videoViews3s: m.videoViews3s,
      videoViews25: m.videoViews25,
      videoViews50: m.videoViews50,
      videoViews75: m.videoViews75,
      videoViews95: m.videoViews95,
      videoViews100: m.videoViews100,
      thruplays: m.thruplays,
      averageWatchTimeSeconds: dec(m.averageWatchTimeSeconds),
      cpcAll: dec(m.cpcAll),
      ctrAll: dec(m.ctrAll),
      outboundCtr: dec(m.outboundCtr),
      totalSales: m.totalSales,
      uniqueSales: m.uniqueSales,
      hyrosRoas: dec(m.hyrosRoas),
      revenue: dec(m.revenue),
    };
  }
}
