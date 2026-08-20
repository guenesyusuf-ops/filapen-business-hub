import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationService } from './calculation.service';
import { SettingsService } from './settings.service';
import { TargetService, TARGET_KEYS } from './target.service';
import { InsightCandidate, InsightPeriod } from './insights/insight-types';
import {
  detectRoasChange, detectRevenueStreak, detectMarginThreshold,
  detectAdsOutpacingRevenue, detectAnomaly, detectRunRateTargetGap,
  fingerprintOf, DailyPoint,
} from './insights/detection-rules';
import { lastNCompleteDays, previousNDays, monthToDate } from './insights/period-helpers';

/**
 * Insight Detection Engine (Ebene B).
 *
 * Zieht Rohdaten via CalculationService, laesst die reinen Detection-Rules
 * darueber laufen, dedupliziert per Fingerprint, schreibt in pa_insight.
 *
 * Lifecycle:
 *   - Neue Fingerprints -> new
 *   - Bekannte Fingerprints mit anderen Werten -> Update (Status bleibt)
 *   - Bekannte Fingerprints die im aktuellen Run NICHT mehr erzeugt werden
 *     -> resolved (Bedingung nicht mehr wahr)
 */
@Injectable()
export class InsightService {
  private readonly logger = new Logger(InsightService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: CalculationService,
    private readonly settings: SettingsService,
    private readonly targets: TargetService,
  ) {}

  /** Vollstaendiger Refresh-Run fuer eine Organisation. */
  async detectAll(orgId: string): Promise<{ created: number; updated: number; resolved: number }> {
    const now = new Date();
    const candidates = await this.collectCandidates(orgId, now);
    return this.persistCandidates(orgId, candidates);
  }

  // ---------------------------------------------------------------------------
  // Kandidaten sammeln — alle Detection-Rules anwenden
  // ---------------------------------------------------------------------------

  private async collectCandidates(orgId: string, now: Date): Promise<InsightCandidate[]> {
    const currentRange  = lastNCompleteDays(7, now);
    const previousRange = previousNDays(currentRange, 7);

    // Alle Rohdaten fuer die letzten 30 Tage einmal ziehen
    const points = await this.loadDailyPoints(orgId, 30, now);
    if (points.length === 0) return [];

    const currentPoints  = points.filter((p) => isInRange(p.date, currentRange.from, currentRange.to));
    const previousPoints = points.filter((p) => isInRange(p.date, previousRange.from, previousRange.to));
    const last4  = points.slice(-4);

    const candidates: InsightCandidate[] = [];

    // §12/§19 ROAS-Vergleich pro Kanal
    for (const ch of ['webshop', 'amazon', 'tiktok'] as const) {
      const insight = detectRoasChange({ channel: ch, currentRange, previousRange, currentPoints, previousPoints });
      if (insight) candidates.push(insight);
    }

    // §14 Umsatz-Streak
    const streak = detectRevenueStreak({ points: last4, minStepPct: 2, minStreakLength: 3 });
    if (streak) candidates.push(streak);

    // §17 Marge-Schwelle (MTD)
    const mtd = monthToDate(now);
    const mtdComputed = await this.calc.computeMonth(orgId, now.getUTCFullYear(), now.getUTCMonth() + 1);
    const currentMargin = mtdComputed.totals.marginBeforeOverhead !== null
      ? Number(mtdComputed.totals.marginBeforeOverhead) : null;
    const criticalBelow = Number(await this.targets.resolveValue(orgId, TARGET_KEYS.MARGIN_CRITICAL_BELOW));
    const goodFrom      = Number(await this.targets.resolveValue(orgId, TARGET_KEYS.MARGIN_GOOD_FROM));
    const target        = Number(await this.targets.resolveValue(orgId, TARGET_KEYS.MARGIN_TARGET));
    const marginInsight = detectMarginThreshold({ period: mtd, currentMargin, criticalBelow, goodFrom, target });
    if (marginInsight) candidates.push(marginInsight);

    // §18 Ads outpacing Revenue
    const adsInsight = detectAdsOutpacingRevenue({
      currentRange, previousRange, currentPoints, previousPoints, minSpreadPct: 10,
    });
    if (adsInsight) candidates.push(adsInsight);

    // §28 Anomalien fuer Meta-Spend, Shopify-Revenue, Profit
    if (points.length >= 8) {
      const last = points[points.length - 1];
      const history = points.slice(0, -1);
      const metaHist = history.map((p) => p.ads.meta).filter((v) => v > 0);
      if (metaHist.length >= 7) {
        const a = detectAnomaly({
          metric: 'meta_spend', historyValues: metaHist,
          currentValue: last.ads.meta, currentDate: new Date(last.date + 'T00:00:00.000Z'),
          channel: 'webshop',
        });
        if (a) candidates.push(a);
      }
      const shopHist = history.map((p) => p.channels.shopify.grossAdjusted).filter((v) => v > 0);
      if (shopHist.length >= 7) {
        const a = detectAnomaly({
          metric: 'shopify_revenue', historyValues: shopHist,
          currentValue: last.channels.shopify.grossAdjusted, currentDate: new Date(last.date + 'T00:00:00.000Z'),
          channel: 'webshop',
        });
        if (a) candidates.push(a);
      }
    }

    // §27 Run-Rate / Monatsziel
    const revenueTarget = Number(await this.targets.resolveValue(orgId, TARGET_KEYS.MONTHLY_REVENUE_TARGET));
    const profitTarget  = Number(await this.targets.resolveValue(orgId, TARGET_KEYS.MONTHLY_PROFIT_TARGET));
    if (revenueTarget > 0 || profitTarget > 0) {
      const forecasts = detectRunRateTargetGap({
        year: now.getUTCFullYear(), month: now.getUTCMonth() + 1,
        completedDays: mtdComputed.days.length,
        currentMtdNetSales: Number(mtdComputed.netSalesWithWholesale),
        currentMtdProfit: Number(mtdComputed.operatingProfit),
        monthlyRevenueTarget: revenueTarget,
        monthlyProfitTarget: profitTarget,
      });
      candidates.push(...forecasts);
    }

    return candidates;
  }

  // ---------------------------------------------------------------------------
  // Persist — Insert/Update/Resolve
  // ---------------------------------------------------------------------------

  private async persistCandidates(orgId: string, candidates: InsightCandidate[]) {
    let created = 0, updated = 0, resolved = 0;
    const currentFingerprints = new Set(candidates.map(fingerprintOf));

    // Bestehende aktive Insights holen
    const existing = await this.prisma.paInsight.findMany({
      where: { orgId, status: { in: ['new', 'active'] } },
      select: { id: true, fingerprint: true },
    });

    // Bestehende die NICHT mehr auftauchen -> resolved
    const toResolve = existing.filter((e) => !currentFingerprints.has(e.fingerprint));
    if (toResolve.length > 0) {
      await this.prisma.paInsight.updateMany({
        where: { id: { in: toResolve.map((r) => r.id) } },
        data: { status: 'resolved', resolvedAt: new Date() },
      });
      resolved = toResolve.length;
    }

    // Neue oder aktualisierte Insights schreiben
    for (const c of candidates) {
      const fp = fingerprintOf(c);
      const existingRow = await this.prisma.paInsight.findUnique({
        where: { orgId_fingerprint: { orgId, fingerprint: fp } },
      });
      const data = {
        insightType: c.type,
        channel: c.channel ?? null,
        periodKey: c.period.key,
        fingerprint: fp,
        severity: c.severity as any,
        metric: c.metric ?? null,
        currentValue: c.currentValue !== undefined ? String(c.currentValue) : null,
        comparisonValue: c.comparisonValue !== undefined ? String(c.comparisonValue) : null,
        absoluteChange: c.absoluteChange !== undefined ? String(c.absoluteChange) : null,
        percentageChange: c.percentageChange !== undefined ? String(c.percentageChange) : null,
        unit: c.unit ?? null,
        facts: (c.facts ?? null) as any,
        title: c.title,
        message: c.message,
        priorityScore: c.priorityScore,
        periodFrom: c.period.from,
        periodTo: c.period.to,
      };

      if (existingRow) {
        await this.prisma.paInsight.update({
          where: { id: existingRow.id },
          data: { ...data, status: existingRow.status === 'resolved' ? 'new' : existingRow.status },
        });
        updated++;
      } else {
        await this.prisma.paInsight.create({ data: { orgId, ...data } });
        created++;
      }
    }

    this.logger.log(`Insights refresh org=${orgId}: created=${created} updated=${updated} resolved=${resolved}`);
    return { created, updated, resolved };
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async list(orgId: string, filters: {
    status?: 'new' | 'active' | 'acknowledged' | 'resolved' | 'dismissed';
    severity?: 'info' | 'positive' | 'warning' | 'critical';
    channel?: string;
    limit?: number;
  } = {}) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    else where.status = { in: ['new', 'active'] };   // default: nur aktive
    if (filters.severity) where.severity = filters.severity;
    if (filters.channel) where.channel = filters.channel;
    const items = await this.prisma.paInsight.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { detectedAt: 'desc' }],
      take: Math.min(200, filters.limit ?? 100),
    });
    return { items: items.map(toApi) };
  }

  /** Top-N (fuer Dashboard-Panel §2, 3-5 wichtigste). */
  async topActive(orgId: string, n = 5) {
    const items = await this.prisma.paInsight.findMany({
      where: { orgId, status: { in: ['new', 'active'] } },
      orderBy: [{ priorityScore: 'desc' }, { detectedAt: 'desc' }],
      take: n,
    });
    return { items: items.map(toApi) };
  }

  async acknowledge(orgId: string, id: string, userId: string) {
    const row = await this.prisma.paInsight.findFirst({ where: { id, orgId } });
    if (!row) throw new Error('Insight nicht gefunden');
    await this.prisma.paInsight.update({
      where: { id },
      data: { status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedById: userId },
    });
    return { ok: true };
  }

  async dismiss(orgId: string, id: string) {
    await this.prisma.paInsight.update({ where: { id }, data: { status: 'dismissed' } });
    return { ok: true };
  }

  async setFeedback(orgId: string, id: string, feedback: 'helpful' | 'not_helpful', userId: string) {
    await this.prisma.paInsight.update({
      where: { id },
      data: { feedback: feedback as any, feedbackAt: new Date(), feedbackById: userId },
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // §5 "Warum?" — Driver-Analyse
  // ---------------------------------------------------------------------------

  async explain(orgId: string, id: string) {
    const insight = await this.prisma.paInsight.findFirst({ where: { id, orgId } });
    if (!insight) return null;
    const now = new Date();
    const currentRange  = lastNCompleteDays(7, now);
    const previousRange = previousNDays(currentRange, 7);
    const points = await this.loadDailyPoints(orgId, 30, now);
    const currentPoints  = points.filter((p) => isInRange(p.date, currentRange.from, currentRange.to));
    const previousPoints = points.filter((p) => isInRange(p.date, previousRange.from, previousRange.to));

    // Driver-Analyse fuer ROAS/Marge-Insights: was hat sich veraendert?
    const cur = currentPoints.reduce((a, d) => ({
      shopifyNet: a.shopifyNet + d.channels.shopify.net,
      shopifyGross: a.shopifyGross + d.channels.shopify.grossAdjusted,
      meta: a.meta + d.ads.meta, google: a.google + d.ads.google,
      influencer: a.influencer + d.ads.influencer,
    }), { shopifyNet: 0, shopifyGross: 0, meta: 0, google: 0, influencer: 0 });
    const prev = previousPoints.reduce((a, d) => ({
      shopifyNet: a.shopifyNet + d.channels.shopify.net,
      shopifyGross: a.shopifyGross + d.channels.shopify.grossAdjusted,
      meta: a.meta + d.ads.meta, google: a.google + d.ads.google,
      influencer: a.influencer + d.ads.influencer,
    }), { shopifyNet: 0, shopifyGross: 0, meta: 0, google: 0, influencer: 0 });

    const drivers = [
      { label: 'Meta Ads',        metric: 'meta',        change: pctChange(cur.meta, prev.meta) },
      { label: 'Google Ads',      metric: 'google',      change: pctChange(cur.google, prev.google) },
      { label: 'Influencer',      metric: 'influencer',  change: pctChange(cur.influencer, prev.influencer) },
      { label: 'Shopify Netto',   metric: 'shopify_net', change: pctChange(cur.shopifyNet, prev.shopifyNet) },
    ].filter((d) => d.change !== null)
      .map((d) => ({
        label: d.label,
        metric: d.metric,
        change: Math.round(d.change! * 100) / 100,
        unit: 'percent' as const,
        direction: d.change! > 0 ? 'up' as const : 'down' as const,
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5);

    return {
      headline: 'Mögliche Treiber (letzte 7 Tage vs. vorherige 7 Tage)',
      drivers,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Laed die Tages-Punkte fuer die letzten N Tage aus dem CalculationService. */
  private async loadDailyPoints(orgId: string, days: number, now: Date): Promise<DailyPoint[]> {
    // Fuer effizientes Laden: computeMonth fuer den aktuellen Monat + ggf. Vormonat
    const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
    const monthsToLoad: Array<{ year: number; month: number }> = [{ year: y, month: m }];
    if (now.getUTCDate() < days) {
      // Nur wenn wir den Vormonat brauchen (typisch am Monatsanfang)
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      monthsToLoad.unshift({ year: prevY, month: prevM });
    }
    const results = await Promise.all(monthsToLoad.map((mm) => this.calc.computeMonth(orgId, mm.year, mm.month)));
    const points: DailyPoint[] = [];
    for (const cm of results) {
      for (const d of cm.days) {
        points.push({
          date: d.date,
          netSales: Number(d.aggregate.totalNetSales),
          profit: Number(d.aggregate.totalProfit),
          margin: d.aggregate.totalMargin !== null ? Number(d.aggregate.totalMargin) : null,
          ads: {
            meta: 0, google: 0, influencer: 0, amazonPpc: 0, tiktokAds: 0,
          },
          channels: {
            shopify: { grossAdjusted: Number(d.shopify.vat.grossAdjusted), net: Number(d.shopify.profit.netSales), ads: { meta: 0, google: 0, influencer: 0 } },
            amazon:  { grossAdjusted: Number(d.amazon.vat.grossAdjusted),  net: Number(d.amazon.profit.netSales),  ads: { amazonPpc: 0 } },
            tiktok:  { grossAdjusted: Number(d.tiktok.vat.grossAdjusted),  net: Number(d.tiktok.profit.netSales),  ads: { tiktokAds: 0 } },
          },
        });
      }
    }
    // Ads-Zahlen aus Raw-Data anreichern (die sind nicht im ComputedDay)
    const rawAds = await this.prisma.paDailyAds.findMany({
      where: { orgId, day: { date: { gte: new Date(new Date(now.toISOString().slice(0, 10)).getTime() - days * 24 * 60 * 60 * 1000) } } },
      include: { day: { select: { date: true } } },
    });
    const adsByDate = new Map(rawAds.map((r) => [r.day.date.toISOString().slice(0, 10), r]));
    for (const p of points) {
      const a = adsByDate.get(p.date);
      if (a) {
        p.ads.meta = Number(a.meta); p.ads.google = Number(a.google);
        p.ads.influencer = Number(a.influencer);
        p.ads.amazonPpc = Number(a.amazonPpc); p.ads.tiktokAds = Number(a.tiktokAds);
        p.channels.shopify.ads = { meta: Number(a.meta), google: Number(a.google), influencer: Number(a.influencer) };
        p.channels.amazon.ads.amazonPpc = Number(a.amazonPpc);
        p.channels.tiktok.ads.tiktokAds = Number(a.tiktokAds);
      }
    }
    // Sortiert + auf N Tage begrenzt
    return points.sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  }
}

function toApi(row: any) {
  return {
    id: row.id,
    insightType: row.insightType,
    channel: row.channel,
    severity: row.severity,
    status: row.status,
    title: row.aiTitle ?? row.title,
    message: row.aiMessage ?? row.message,
    metric: row.metric,
    currentValue: row.currentValue?.toString() ?? null,
    comparisonValue: row.comparisonValue?.toString() ?? null,
    percentageChange: row.percentageChange?.toString() ?? null,
    unit: row.unit,
    facts: row.facts,
    priorityScore: row.priorityScore,
    periodFrom: row.periodFrom?.toISOString().slice(0, 10) ?? null,
    periodTo: row.periodTo?.toISOString().slice(0, 10) ?? null,
    detectedAt: row.detectedAt.toISOString(),
    feedback: row.feedback,
    hasAi: !!row.aiGeneratedAt,
  };
}

function isInRange(iso: string, from: Date, to: Date): boolean {
  return iso >= from.toISOString().slice(0, 10) && iso <= to.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
