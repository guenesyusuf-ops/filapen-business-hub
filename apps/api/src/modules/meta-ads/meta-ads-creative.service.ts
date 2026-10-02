import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, MaComponentType, MaAwareness, MaRecipeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService, PeriodRange } from './meta-ads.service';
import { aggregate, confidenceFrom, biggestDrop, round, AggregatedMetrics, DailyMetricInput } from './meta-ads-calc';
import { classifyAdSignals, dropComponentOverlap, SignalProfile } from './creative-signals';
import { classifyComponentSignal, keyMetricForType } from './component-intelligence';
import { recommendCombination, CombiComponent } from './combination-engine';

const CODE_PREFIX: Record<string, string> = {
  hook: 'HK', body: 'BD', cta: 'CT', proof: 'PR', testimonial: 'TM', product_demo: 'PD',
  offer_section: 'OF', problem_section: 'PB', solution_section: 'SL', transition: 'TR',
  visual_opening: 'VO', voiceover: 'VV', b_roll: 'BR',
};

const dec = (v: Prisma.Decimal | number | null): number | null => (v == null ? null : Number(v));

export interface ComponentInput {
  type: string;
  name?: string;
  text?: string | null;
  productGroupId?: string | null;
  sourceAdId?: string | null;
  startTimeSeconds?: number | null;
  endTimeSeconds?: number | null;
  angleId?: string | null;
  awareness?: string | null;
  notes?: string | null;
  linkToSourceAd?: boolean; // beim Anlegen aus einer Ad: direkt verknüpfen
}

@Injectable()
export class MetaAdsCreativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
  ) {}

  // =========================================================================
  // Components — CRUD
  // =========================================================================

  async createComponent(orgId: string, userId: string, input: ComponentInput) {
    const type = this.parseType(input?.type);
    const name = (input?.name ?? '').trim();
    if (!name) throw new BadRequestException('Name ist erforderlich');
    if (input.productGroupId) await this.mustOwn('maProductGroup', orgId, input.productGroupId, 'Produktgruppe');
    if (input.sourceAdId) await this.mustOwn('maAd', orgId, input.sourceAdId, 'Ad');
    if (input.angleId) await this.mustOwn('maAngle', orgId, input.angleId, 'Angle');
    const st = input.startTimeSeconds ?? null;
    const en = input.endTimeSeconds ?? null;
    if (st != null && en != null && en <= st) throw new BadRequestException('Endzeit muss nach der Startzeit liegen');

    const count = await this.prisma.maCreativeComponent.count({ where: { orgId, type } });
    const code = `${CODE_PREFIX[type] ?? 'CM'}-${String(count + 1).padStart(4, '0')}`;

    const comp = await this.prisma.maCreativeComponent.create({
      data: {
        orgId, type, code, name,
        text: input.text ?? null, productGroupId: input.productGroupId ?? null,
        sourceAdId: input.sourceAdId ?? null, startTimeSeconds: st, endTimeSeconds: en,
        angleId: input.angleId ?? null, awareness: input.awareness ? this.parseAwareness(input.awareness) : null,
        notes: input.notes ?? null, createdById: userId,
      },
    });

    // Beim Anlegen aus einer Ad: Component gleich als in dieser Ad verwendet verknüpfen.
    if (input.sourceAdId && input.linkToSourceAd !== false) {
      await this.prisma.maAdComponent.upsert({
        where: { adId_componentId: { adId: input.sourceAdId, componentId: comp.id } },
        update: {},
        create: { orgId, adId: input.sourceAdId, componentId: comp.id, role: type },
      });
    }
    return this.serializeComponent(comp);
  }

  async updateComponent(orgId: string, id: string, input: Partial<ComponentInput>) {
    await this.mustOwn('maCreativeComponent', orgId, id, 'Component');
    const data: Prisma.MaCreativeComponentUncheckedUpdateInput = {};
    if (input.name !== undefined) { const n = (input.name ?? '').trim(); if (!n) throw new BadRequestException('Name darf nicht leer sein'); data.name = n; }
    if (input.text !== undefined) data.text = input.text ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.startTimeSeconds !== undefined) data.startTimeSeconds = input.startTimeSeconds ?? null;
    if (input.endTimeSeconds !== undefined) data.endTimeSeconds = input.endTimeSeconds ?? null;
    if (input.angleId !== undefined) { if (input.angleId) await this.mustOwn('maAngle', orgId, input.angleId, 'Angle'); data.angleId = input.angleId ?? null; }
    if (input.awareness !== undefined) data.awareness = input.awareness ? this.parseAwareness(input.awareness) : null;
    if (input.productGroupId !== undefined) { if (input.productGroupId) await this.mustOwn('maProductGroup', orgId, input.productGroupId, 'Produktgruppe'); data.productGroupId = input.productGroupId ?? null; }
    const comp = await this.prisma.maCreativeComponent.update({ where: { id }, data });
    return this.serializeComponent(comp);
  }

  async deleteComponent(orgId: string, id: string) {
    await this.mustOwn('maCreativeComponent', orgId, id, 'Component');
    await this.prisma.maCreativeComponent.delete({ where: { id } });
    return { ok: true };
  }

  async listComponents(orgId: string, opts: { type?: string; productGroupId?: string; sourceAdId?: string; search?: string; range?: PeriodRange; start?: string; end?: string }) {
    const where: Prisma.MaCreativeComponentWhereInput = { orgId };
    if (opts.type) where.type = this.parseType(opts.type);
    if (opts.productGroupId) where.productGroupId = opts.productGroupId;
    if (opts.sourceAdId) where.sourceAdId = opts.sourceAdId;
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }, { text: { contains: q, mode: 'insensitive' } }];
    }
    const comps = await this.prisma.maCreativeComponent.findMany({
      where, include: { productGroup: { select: { name: true } }, sourceAd: { select: { name: true } } },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
    const period = this.ads.resolvePeriod(opts.range, opts.start, opts.end);
    const perf = await this.performanceForComponents(orgId, comps.map((c) => c.id), period);
    const baselineByGroup = new Map<string, AggregatedMetrics>();
    const items = [] as any[];
    for (const c of comps) {
      const p = perf.get(c.id) ?? { agg: aggregate([]), adCount: 0 };
      let baseline: SignalProfile | null = null;
      if (c.productGroupId) {
        if (!baselineByGroup.has(c.productGroupId)) baselineByGroup.set(c.productGroupId, await this.groupBaseline(orgId, c.productGroupId, period));
        baseline = this.profileOf(baselineByGroup.get(c.productGroupId)!);
      }
      items.push(this.serializeComponentRow(c, p.agg, p.adCount, baseline));
    }
    return { items };
  }

  /** Increment D: Component Intelligence je Produktgruppe — Matrix nach Typ mit Signal. */
  async componentIntelligence(orgId: string, productGroupId: string | undefined, range?: PeriodRange, start?: string, end?: string) {
    const period = this.ads.resolvePeriod(range, start, end);
    const where: Prisma.MaCreativeComponentWhereInput = { orgId };
    if (productGroupId) where.productGroupId = productGroupId;
    const comps = await this.prisma.maCreativeComponent.findMany({
      where, include: { productGroup: { select: { name: true } }, sourceAd: { select: { name: true } } },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
    const perf = await this.performanceForComponents(orgId, comps.map((c) => c.id), period);
    const baseline = productGroupId ? this.profileOf(await this.groupBaseline(orgId, productGroupId, period)) : null;
    const rows = comps.map((c) => {
      const p = perf.get(c.id) ?? { agg: aggregate([]), adCount: 0 };
      return this.serializeComponentRow(c, p.agg, p.adCount, baseline);
    });
    const bucket = (t: string) => t === 'hook' || t === 'visual_opening' ? 'hook'
      : t === 'cta' || t === 'offer_section' ? 'cta'
      : t === 'proof' || t === 'testimonial' ? 'proof'
      : ['body', 'problem_section', 'solution_section', 'product_demo'].includes(t) ? 'body' : 'other';
    const groups: Record<string, any[]> = { hook: [], body: [], proof: [], cta: [], other: [] };
    for (const r of rows) groups[bucket(r.type)].push(r);
    return { productGroupId: productGroupId ?? null, period, groups, items: rows };
  }

  /** Increment E: deterministisch die stärksten Bausteine der Produktgruppe zu einer Kombination zusammenführen. */
  async recommendedCombination(orgId: string, productGroupId: string | undefined, range?: PeriodRange, start?: string, end?: string) {
    if (!productGroupId) throw new BadRequestException('Produktgruppe erforderlich — keine produktübergreifenden Kombinationen.');
    const intel = await this.componentIntelligence(orgId, productGroupId, range, start, end);
    const comps: CombiComponent[] = intel.items.map((r: any) => ({
      id: r.id, code: r.code, name: r.name, type: r.type,
      keyMetric: r.keyMetric, keyDelta: r.keyDelta, signal: r.signal,
      confidence: r.confidence.level, adCount: r.adCount, sourceAdName: r.sourceAdName,
    }));
    return { productGroupId, combination: recommendCombination(comps), componentCount: comps.length };
  }

  async getComponent(orgId: string, id: string, range?: PeriodRange, start?: string, end?: string) {
    const c = await this.prisma.maCreativeComponent.findFirst({
      where: { id, orgId },
      include: { productGroup: { select: { name: true } }, sourceAd: { select: { name: true } }, angle: { select: { name: true } } },
    });
    if (!c) throw new NotFoundException('Component nicht gefunden');
    const period = this.ads.resolvePeriod(range, start, end);
    const links = await this.prisma.maAdComponent.findMany({ where: { componentId: id }, include: { ad: { select: { id: true, name: true, status: true, videoLengthSeconds: true } } } });
    const adIds = links.map((l) => l.adId);
    const agg = await this.ads.aggregateForAdIds(orgId, adIds, period);
    const baseline = c.productGroupId ? this.profileOf(await this.groupBaseline(orgId, c.productGroupId, period)) : null;
    return {
      ...this.serializeComponent(c),
      productGroupName: c.productGroup?.name ?? null,
      sourceAdName: c.sourceAd?.name ?? null,
      angleName: c.angle?.name ?? null,
      usedInAds: links.map((l) => ({ id: l.ad.id, name: l.ad.name, status: l.ad.status, role: l.role })),
      performance: this.perfSummary(agg),
      baseline,
      confidence: confidenceFrom(agg),
      period,
    };
  }

  /** Nur die aggregierte Performance einer Component (über ihre Ads) — als Assoziation, nicht Kausalität. */
  async getComponentPerformance(orgId: string, id: string, range?: PeriodRange, start?: string, end?: string) {
    const c = await this.prisma.maCreativeComponent.findFirst({ where: { id, orgId }, select: { id: true, productGroupId: true } });
    if (!c) throw new NotFoundException('Component nicht gefunden');
    const period = this.ads.resolvePeriod(range, start, end);
    const links = await this.prisma.maAdComponent.findMany({ where: { componentId: id }, select: { adId: true } });
    const adIds = links.map((l) => l.adId);
    const agg = await this.ads.aggregateForAdIds(orgId, adIds, period);
    const baseline = c.productGroupId ? this.profileOf(await this.groupBaseline(orgId, c.productGroupId, period)) : null;
    return { componentId: id, adCount: adIds.length, performance: this.perfSummary(agg), baseline, confidence: confidenceFrom(agg), period };
  }

  // =========================================================================
  // Ad ↔ Components (für Ad-Detail inkl. Drop-Overlap)
  // =========================================================================

  async listAdComponents(orgId: string, adId: string, range?: PeriodRange, start?: string, end?: string) {
    const ad = await this.prisma.maAd.findFirst({ where: { id: adId, orgId }, select: { id: true, videoLengthSeconds: true } });
    if (!ad) throw new NotFoundException('Ad nicht gefunden');
    const period = this.ads.resolvePeriod(range, start, end);
    const agg = await this.ads.aggregateForAdIds(orgId, [adId], period);
    const drop = biggestDrop(agg, ad.videoLengthSeconds);
    const links = await this.prisma.maAdComponent.findMany({ where: { adId, orgId }, include: { component: true }, orderBy: { position: 'asc' } });
    return {
      biggestDrop: drop,
      items: links.map((l) => {
        const c = l.component;
        const overlap = drop ? dropComponentOverlap(drop.fromSeconds, drop.toSeconds, c.startTimeSeconds, c.endTimeSeconds) : null;
        return { ...this.serializeComponent(c), role: l.role, overlap };
      }),
    };
  }

  async linkComponent(orgId: string, adId: string, componentId: string, role?: string) {
    await this.mustOwn('maAd', orgId, adId, 'Ad');
    await this.mustOwn('maCreativeComponent', orgId, componentId, 'Component');
    await this.prisma.maAdComponent.upsert({
      where: { adId_componentId: { adId, componentId } },
      update: role !== undefined ? { role } : {},
      create: { orgId, adId, componentId, role: role ?? null },
    });
    return { ok: true };
  }

  async unlinkComponent(orgId: string, adId: string, componentId: string) {
    await this.prisma.maAdComponent.deleteMany({ where: { orgId, adId, componentId } });
    return { ok: true };
  }

  // =========================================================================
  // Creative Lab — deterministische Signale, nach Produktgruppe
  // =========================================================================

  async creativeLab(orgId: string, opts: { productGroupId?: string; range?: PeriodRange; start?: string; end?: string; format?: string }) {
    const period = this.ads.resolvePeriod(opts.range, opts.start, opts.end);
    const where: Prisma.MaAdWhereInput = { orgId };
    if (opts.productGroupId) where.productGroupId = opts.productGroupId;
    if (opts.format) where.format = opts.format as any;
    const ads = await this.prisma.maAd.findMany({ where, include: { productGroup: { select: { name: true } }, angle: { select: { name: true } } } });

    // Baseline je Produktgruppe (für korrekte relative Bewertung).
    const baselineCache = new Map<string, AggregatedMetrics>();
    const perf = await this.performanceForAds(orgId, ads.map((a) => a.id), period);

    const winningCreatives: any[] = [];
    const needsIteration: any[] = [];
    const salvage: any[] = [];
    const strongRetention: any[] = [];
    const recent: any[] = [];

    for (const ad of ads) {
      const agg = perf.get(ad.id) ?? aggregate([]);
      const conf = confidenceFrom(agg);
      let baseline: SignalProfile | null = null;
      if (ad.productGroupId) {
        if (!baselineCache.has(ad.productGroupId)) baselineCache.set(ad.productGroupId, await this.groupBaseline(orgId, ad.productGroupId, period, ad.id));
        baseline = this.profileOf(baselineCache.get(ad.productGroupId)!);
      }
      const roas = agg.calculatedRoas;
      const { signals, primary } = classifyAdSignals(this.profileOf(agg), baseline, roas, conf.level);
      const card = {
        id: ad.id, name: ad.name, format: ad.format, status: ad.status,
        productGroupName: ad.productGroup?.name ?? null, angleName: ad.angle?.name ?? null,
        metrics: { spend: agg.spend, calculatedRoas: agg.calculatedRoas, hookRate: agg.hookRate, holdRate: agg.holdRate, retention50to75: agg.retention50to75, outboundCtr: agg.outboundCtr, uniqueSales: agg.uniqueSales },
        confidence: conf, signals, primary,
      };
      const has = (t: string) => signals.some((s) => s.type === t);
      recent.push(card);
      if (primary === 'FULL_WINNER' || primary === 'HOOK_WINNER' || primary === 'BODY_WINNER') winningCreatives.push(card);
      if (primary === 'SALVAGE_BODY' || primary === 'SALVAGE_HOOK') salvage.push(card);
      if (primary === 'NEEDS_ITERATION') needsIteration.push(card);
      if (has('STRONG_RETENTION') && conf.level !== 'low') strongRetention.push(card);
    }
    recent.sort((a, b) => (b.metrics.spend ?? 0) - (a.metrics.spend ?? 0));

    // Winning Hooks / Bodies aus Components.
    const winningHooks = await this.winningComponents(orgId, 'hook', opts.productGroupId, period);
    const winningBodies = await this.winningComponents(orgId, 'body', opts.productGroupId, period);

    return {
      period,
      sections: {
        winningCreatives, winningHooks, winningBodies, strongRetention, needsIteration, salvage,
        recent: recent.slice(0, 12),
      },
      counts: {
        winningCreatives: winningCreatives.length, winningHooks: winningHooks.length, winningBodies: winningBodies.length,
        strongRetention: strongRetention.length, needsIteration: needsIteration.length, salvage: salvage.length,
      },
    };
  }

  private async winningComponents(orgId: string, type: 'hook' | 'body', productGroupId: string | undefined, period: { from?: string; to?: string }) {
    const where: Prisma.MaCreativeComponentWhereInput = { orgId, type };
    if (productGroupId) where.productGroupId = productGroupId;
    const comps = await this.prisma.maCreativeComponent.findMany({ where, include: { sourceAd: { select: { name: true } }, productGroup: { select: { name: true } } } });
    const perf = await this.performanceForComponents(orgId, comps.map((c) => c.id), period);
    const baselineByGroup = new Map<string, AggregatedMetrics>();
    const out: any[] = [];
    for (const c of comps) {
      const p = perf.get(c.id) ?? { agg: aggregate([]), adCount: 0 };
      if (p.adCount === 0) continue;
      let baseline: SignalProfile | null = null;
      if (c.productGroupId) {
        if (!baselineByGroup.has(c.productGroupId)) baselineByGroup.set(c.productGroupId, await this.groupBaseline(orgId, c.productGroupId, period));
        baseline = this.profileOf(baselineByGroup.get(c.productGroupId)!);
      }
      const row = this.serializeComponentRow(c, p.agg, p.adCount, baseline);
      const conf = confidenceFrom(p.agg);
      // "Winning": Kernmetrik ueber Baseline + nicht Low Confidence + in >=1 Ad.
      const keyDelta = row.keyDelta;
      if (conf.level !== 'low' && keyDelta != null && keyDelta >= 8) out.push(row);
    }
    return out;
  }

  // =========================================================================
  // Recipes
  // =========================================================================

  async listRecipes(orgId: string, productGroupId?: string) {
    const where: Prisma.MaCreativeRecipeWhereInput = { orgId };
    if (productGroupId) where.productGroupId = productGroupId;
    const rows = await this.prisma.maCreativeRecipe.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { productGroup: { select: { name: true } }, components: { include: { component: { select: { code: true, name: true, type: true } } }, orderBy: { position: 'asc' } } },
    });
    return { items: rows.map((r) => this.serializeRecipe(r)) };
  }

  async createRecipe(orgId: string, userId: string, input: { name?: string; productGroupId?: string | null; angleId?: string | null; awareness?: string | null; offerId?: string | null; notes?: string | null; componentIds?: string[] }) {
    const name = (input?.name ?? '').trim();
    if (!name) throw new BadRequestException('Name ist erforderlich');
    if (input.productGroupId) await this.mustOwn('maProductGroup', orgId, input.productGroupId, 'Produktgruppe');
    if (input.angleId) await this.mustOwn('maAngle', orgId, input.angleId, 'Angle');
    if (input.offerId) await this.mustOwn('maOffer', orgId, input.offerId, 'Offer');
    const compIds = input.componentIds ?? [];
    if (compIds.length) {
      const owned = await this.prisma.maCreativeComponent.count({ where: { orgId, id: { in: compIds } } });
      if (owned !== compIds.length) throw new BadRequestException('Mindestens eine Component gehört nicht zu dieser Organisation');
    }
    const recipe = await this.prisma.maCreativeRecipe.create({
      data: {
        orgId, name, productGroupId: input.productGroupId ?? null, angleId: input.angleId ?? null,
        awareness: input.awareness ? this.parseAwareness(input.awareness) : null, offerId: input.offerId ?? null,
        notes: input.notes ?? null, createdById: userId,
        components: { create: compIds.map((cid, i) => ({ componentId: cid, position: i })) },
      },
      include: { productGroup: { select: { name: true } }, components: { include: { component: { select: { code: true, name: true, type: true } } }, orderBy: { position: 'asc' } } },
    });
    return this.serializeRecipe(recipe);
  }

  async getRecipe(orgId: string, id: string) {
    const r = await this.prisma.maCreativeRecipe.findFirst({
      where: { id, orgId },
      include: { productGroup: { select: { name: true } }, components: { include: { component: true }, orderBy: { position: 'asc' } } },
    });
    if (!r) throw new NotFoundException('Recipe nicht gefunden');
    return this.serializeRecipe(r);
  }

  async updateRecipe(orgId: string, id: string, input: { name?: string; notes?: string | null; status?: string }) {
    await this.mustOwn('maCreativeRecipe', orgId, id, 'Recipe');
    const data: Prisma.MaCreativeRecipeUncheckedUpdateInput = {};
    if (input.name !== undefined) { const n = (input.name ?? '').trim(); if (!n) throw new BadRequestException('Name darf nicht leer sein'); data.name = n; }
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.status !== undefined) { if (!(input.status in MaRecipeStatus)) throw new BadRequestException('Ungültiger Status'); data.status = input.status as MaRecipeStatus; }
    const r = await this.prisma.maCreativeRecipe.update({ where: { id }, data, include: { productGroup: { select: { name: true } }, components: { include: { component: { select: { code: true, name: true, type: true } } }, orderBy: { position: 'asc' } } } });
    return this.serializeRecipe(r);
  }

  // =========================================================================
  // Interne Helfer
  // =========================================================================

  private async performanceForAds(orgId: string, adIds: string[], period: { from?: string; to?: string }): Promise<Map<string, AggregatedMetrics>> {
    const map = new Map<string, AggregatedMetrics>();
    if (!adIds.length) return map;
    const rows = await this.prisma.maAdDailyMetric.findMany({ where: { orgId, adId: { in: adIds }, ...(period.from || period.to ? { date: { ...(period.from ? { gte: new Date(period.from) } : {}), ...(period.to ? { lte: new Date(period.to) } : {}) } } : {}) } });
    const byAd = new Map<string, DailyMetricInput[]>();
    for (const id of adIds) byAd.set(id, []);
    for (const r of rows) byAd.get(r.adId)?.push(this.toCalc(r));
    for (const [id, rs] of byAd) map.set(id, aggregate(rs));
    return map;
  }

  private async performanceForComponents(orgId: string, compIds: string[], period: { from?: string; to?: string }): Promise<Map<string, { agg: AggregatedMetrics; adCount: number }>> {
    const map = new Map<string, { agg: AggregatedMetrics; adCount: number }>();
    if (!compIds.length) return map;
    for (const id of compIds) map.set(id, { agg: aggregate([]), adCount: 0 });

    const links = await this.prisma.maAdComponent.findMany({ where: { componentId: { in: compIds } }, select: { componentId: true, adId: true } });
    const adIdsByComp = new Map<string, string[]>();
    for (const id of compIds) adIdsByComp.set(id, []);
    const allAdIds = new Set<string>();
    for (const l of links) { adIdsByComp.get(l.componentId)!.push(l.adId); allAdIds.add(l.adId); }
    if (!allAdIds.size) return map;

    // Rohzeilen aller beteiligten Ads einmal laden, dann pro Component aggregieren
    // (Aggregat ist nicht additiv — daher immer aus Rohzeilen).
    const rows = await this.prisma.maAdDailyMetric.findMany({
      where: { orgId, adId: { in: [...allAdIds] }, ...(period.from || period.to ? { date: { ...(period.from ? { gte: new Date(period.from) } : {}), ...(period.to ? { lte: new Date(period.to) } : {}) } } : {}) },
    });
    const byAd = new Map<string, DailyMetricInput[]>();
    for (const r of rows) { if (!byAd.has(r.adId)) byAd.set(r.adId, []); byAd.get(r.adId)!.push(this.toCalc(r)); }

    for (const [cid, ids] of adIdsByComp) {
      const compRows: DailyMetricInput[] = [];
      for (const adId of ids) for (const dm of byAd.get(adId) ?? []) compRows.push(dm);
      map.set(cid, { agg: aggregate(compRows), adCount: ids.length });
    }
    return map;
  }

  private async groupBaseline(orgId: string, productGroupId: string, period: { from?: string; to?: string }, excludeAdId?: string): Promise<AggregatedMetrics> {
    const ads = await this.prisma.maAd.findMany({ where: { orgId, productGroupId, ...(excludeAdId ? { id: { not: excludeAdId } } : {}) }, select: { id: true } });
    return this.ads.aggregateForAdIds(orgId, ads.map((a) => a.id), period);
  }

  private profileOf(a: AggregatedMetrics): SignalProfile {
    return {
      hookRate: a.hookRate, holdRate: a.holdRate, outboundCtr: a.outboundCtr,
      retention25to50: a.retention25to50, retention50to75: a.retention50to75,
      retention75to95: a.retention75to95, retention95to100: a.retention95to100, watchPercentage: null,
    };
  }

  private perfSummary(a: AggregatedMetrics) {
    return {
      spend: a.spend, impressions: a.impressions, hookRate: a.hookRate, holdRate: a.holdRate,
      retention25to50: a.retention25to50, retention50to75: a.retention50to75, retention75to95: a.retention75to95, retention95to100: a.retention95to100,
      outboundCtr: a.outboundCtr, uniqueSales: a.uniqueSales, revenue: a.revenue, calculatedRoas: a.calculatedRoas,
      hyrosRoas: null, dataPoints: a.dataPoints,
    };
  }

  private serializeComponentRow(c: any, agg: AggregatedMetrics, adCount: number, baseline: SignalProfile | null) {
    const keyMetric = keyMetricForType(c.type, agg);
    const baseKey = baseline == null ? null : keyMetricForType(c.type, baseline as any);
    const keyDelta = keyMetric != null && baseKey != null ? round(keyMetric - baseKey, 1) : null;
    const conf = confidenceFrom(agg);
    const signal = classifyComponentSignal({ type: c.type, keyMetricPct: keyMetric, baselinePct: baseKey, confidence: conf.level, adCount, impressions: agg.impressions });
    return {
      ...this.serializeComponent(c),
      productGroupName: c.productGroup?.name ?? null,
      sourceAdName: c.sourceAd?.name ?? null,
      adCount, keyMetric, keyBaseline: baseKey, keyDelta,
      confidence: conf, signal,
      metrics: { spend: agg.spend, impressions: agg.impressions, hookRate: agg.hookRate, holdRate: agg.holdRate, retention50to75: agg.retention50to75, retention75to95: agg.retention75to95, outboundCtr: agg.outboundCtr, uniqueSales: agg.uniqueSales, calculatedRoas: agg.calculatedRoas },
    };
  }

  private serializeComponent(c: any) {
    return {
      id: c.id, code: c.code, type: c.type, name: c.name, text: c.text ?? null,
      productGroupId: c.productGroupId ?? null, sourceAdId: c.sourceAdId ?? null,
      startTimeSeconds: c.startTimeSeconds ?? null, endTimeSeconds: c.endTimeSeconds ?? null,
      angleId: c.angleId ?? null, awareness: c.awareness ?? null, notes: c.notes ?? null,
      createdAt: c.createdAt?.toISOString?.() ?? null,
    };
  }

  private serializeRecipe(r: any) {
    return {
      id: r.id, name: r.name, status: r.status, productGroupId: r.productGroupId ?? null,
      productGroupName: r.productGroup?.name ?? null, notes: r.notes ?? null,
      components: (r.components ?? []).map((rc: any) => ({
        id: rc.id, componentId: rc.componentId, role: rc.role, position: rc.position,
        code: rc.component?.code ?? null, name: rc.component?.name ?? null, type: rc.component?.type ?? null,
      })),
      createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }

  private toCalc(r: any): DailyMetricInput {
    return {
      spend: dec(r.spend), impressions: r.impressions, hookRate: dec(r.hookRate), holdRate: dec(r.holdRate),
      videoViews3s: r.videoViews3s, videoViews25: r.videoViews25, videoViews50: r.videoViews50, videoViews75: r.videoViews75,
      videoViews95: r.videoViews95, videoViews100: r.videoViews100, thruplays: r.thruplays, averageWatchTimeSeconds: dec(r.averageWatchTimeSeconds),
      cpcAll: dec(r.cpcAll), ctrAll: dec(r.ctrAll), outboundCtr: dec(r.outboundCtr),
      totalSales: r.totalSales, uniqueSales: r.uniqueSales, hyrosRoas: dec(r.hyrosRoas), revenue: dec(r.revenue),
    };
  }

  private parseType(v: string): MaComponentType {
    if (!v || !(v in MaComponentType)) throw new BadRequestException(`Ungültiger Component-Typ: ${v}`);
    return MaComponentType[v as keyof typeof MaComponentType];
  }
  private parseAwareness(v: string): MaAwareness {
    if (!(v in MaAwareness)) throw new BadRequestException(`Ungültiges Awareness-Level: ${v}`);
    return MaAwareness[v as keyof typeof MaAwareness];
  }
  private async mustOwn(model: 'maProductGroup' | 'maAd' | 'maAngle' | 'maOffer' | 'maCreativeComponent' | 'maCreativeRecipe', orgId: string, id: string, label: string) {
    const found = await (this.prisma[model] as any).findFirst({ where: { id, orgId }, select: { id: true } });
    if (!found) throw new BadRequestException(`${label} gehört nicht zu dieser Organisation`);
  }
}
