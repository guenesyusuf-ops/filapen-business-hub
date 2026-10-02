import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService } from './meta-ads.service';
import { MetaAdsImportService } from './meta-ads-import.service';
import { MetaAdsAiService } from './meta-ads-ai.service';
import { MetaAdsIdeasService } from './meta-ads-ideas.service';
import { detectMapping, fieldsFor, normalizeHeader } from './import/alias-map';
import { parseRow } from './import/import-logic';
import { computeSegments } from './longterm-segments';
import { analyzeLongTerm, LtAd, impressionEvidence, conversionEvidence } from './longterm-strategy';
import { CREATIVE_RULES_VERSION } from './creative-rules';
import {
  AI_LT_SYSTEM_PROMPT, AI_LT_PROMPT_VERSION, CREATIVE_LT_SCHEMA, buildLtUserPrompt, parseLtNarrative, assertValidLtNarrative,
  CreativeLongTermResult, LtHealth, LtNextTest, LT_SEG_LABEL, LT_TYPE_LABEL, ConfidenceLevel,
} from './ai-analysis';

export interface PreviewRow {
  rowIndex: number; metaAdId: string | null; adName: string | null; values: Record<string, number>;
  matchedAdId: string | null; matchedAdName: string | null; matchedBy: 'id' | 'name' | null;
  otherProduct: boolean; status: 'ready' | 'unmatched' | 'other_product' | 'invalid'; errors: string[];
}

@Injectable()
export class MetaAdsLongTermService {
  private readonly logger = new Logger(MetaAdsLongTermService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
    private readonly imp: MetaAdsImportService,
    private readonly ai: MetaAdsAiService,
    private readonly ideas: MetaAdsIdeasService,
  ) {}

  // =========================================================================
  // PREVIEW — parsen, Typ erkennen, matchen (KEINE Writes, keine Daily Metrics)
  // =========================================================================
  async preview(orgId: string, file: { buffer: Buffer; originalname: string } | undefined, productGroupId?: string, mappingOverride?: Record<string, string | null>, prefer?: 'dmy' | 'mdy') {
    if (!productGroupId) throw new BadRequestException('Bitte zuerst eine Produktgruppe wählen — die Langzeitbewertung läuft pro Produkt.');
    if (!file?.buffer?.length) throw new BadRequestException('Keine Datei empfangen');
    const { headers, rows } = await this.imp.parseUpload(file.buffer, file.originalname);
    if (!headers.length) throw new BadRequestException('Datei enthält keine Kopfzeile');

    const detected = detectMapping(headers, 'meta_longterm');
    const mapping = mappingOverride ?? detected.mapping;
    const headerIndex = new Map(headers.map((h, i) => [h, i] as const));
    const endCol = headers.find((h) => normalizeHeader(h) === 'berichtsende') ?? null;
    const startCol = mapping.date ?? headers.find((h) => normalizeHeader(h) === 'berichtsstart') ?? null;

    const orgAds = await this.prisma.maAd.findMany({ where: { orgId }, select: { id: true, metaAdId: true, name: true, productGroupId: true } });
    const byMetaId = new Map<string, { id: string; pg: string | null }>();
    const byName = new Map<string, { id: string; pg: string | null; count: number }>();
    for (const a of orgAds) {
      if (a.metaAdId) byMetaId.set(a.metaAdId.trim(), { id: a.id, pg: a.productGroupId });
      const k = a.name.trim().toLowerCase();
      const ex = byName.get(k);
      byName.set(k, ex ? { ...ex, count: ex.count + 1 } : { id: a.id, pg: a.productGroupId, count: 1 });
    }

    const starts: string[] = []; const ends: string[] = [];
    const preview: PreviewRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      const raw: Record<string, string | undefined> = {};
      for (const f of fieldsFor('meta_longterm')) { const h = mapping[f.key]; if (h && headerIndex.has(h)) raw[f.key] = cells[headerIndex.get(h)!]; }
      const parsed = parseRow('meta_longterm', raw, prefer);
      if (startCol && headerIndex.has(startCol)) { const d = cells[headerIndex.get(startCol)!]; if (d) starts.push(String(d)); }
      if (endCol && headerIndex.has(endCol)) { const d = cells[headerIndex.get(endCol)!]; if (d) ends.push(String(d)); }

      let matchedAdId: string | null = null; let matchedBy: 'id' | 'name' | null = null; let pg: string | null = null;
      if (parsed.metaAdId && byMetaId.has(parsed.metaAdId)) { const m = byMetaId.get(parsed.metaAdId)!; matchedAdId = m.id; pg = m.pg; matchedBy = 'id'; }
      else if (parsed.adName) { const hit = byName.get(parsed.adName.toLowerCase()); if (hit && hit.count === 1) { matchedAdId = hit.id; pg = hit.pg; matchedBy = 'name'; } }
      const otherProduct = !!matchedAdId && !!pg && pg !== productGroupId;
      // Datum-Fehler ignorieren wir für Long-Term (aggregiert); nur echte Zahlenfehler zählen.
      const numErrors = parsed.errors.filter((e) => !e.startsWith('Datum'));
      let status: PreviewRow['status'] = 'ready';
      if (numErrors.length) status = 'invalid';
      else if (otherProduct) status = 'other_product';
      else if (!matchedAdId) status = 'unmatched';
      preview.push({
        rowIndex: i + 2, metaAdId: parsed.metaAdId ?? null, adName: parsed.adName ?? null, values: parsed.values,
        matchedAdId: otherProduct ? null : matchedAdId, matchedAdName: otherProduct ? null : (matchedAdId ? orgAds.find((a) => a.id === matchedAdId)?.name ?? null : null),
        matchedBy: otherProduct ? null : matchedBy, otherProduct, status, errors: numErrors,
      });
    }

    const periodStart = starts.sort()[0] ?? null;
    const periodEnd = ends.sort().slice(-1)[0] ?? null;
    const spanDays = periodStart && periodEnd ? Math.round((Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000) : null;
    const uniqueAds = new Set(preview.map((r) => r.metaAdId ?? r.adName)).size;
    const detectedType: 'historical' | 'daily' = (!!endCol && (spanDays == null || spanDays >= 1) && uniqueAds >= preview.length * 0.6) ? 'historical' : 'daily';

    const summary = {
      total: preview.length,
      ready: preview.filter((r) => r.status === 'ready').length,
      unmatched: preview.filter((r) => r.status === 'unmatched').length,
      otherProduct: preview.filter((r) => r.status === 'other_product').length,
      invalid: preview.filter((r) => r.status === 'invalid').length,
      withSpend: preview.filter((r) => r.values.spend != null).length,
      withPurchases: preview.filter((r) => r.values.purchases != null).length,
      withCheckpoints: preview.filter((r) => r.values.videoViews25 != null).length,
      withHookHold: preview.filter((r) => r.values.hookRate != null || r.values.holdRate != null).length,
      matchedExisting: preview.filter((r) => r.matchedAdId).length,
    };
    return { detectedType, periodStart, periodEnd, spanDays, uniqueAds, mapping, unmapped: detected.unmapped, rows: preview, summary, productGroupId };
  }

  // =========================================================================
  // RUN — Review persistieren + deterministische Analyse + LLM-Narrativ
  // =========================================================================
  async run(orgId: string, userId: string | null, file: { buffer: Buffer; originalname: string } | undefined, productGroupId?: string, mappingOverride?: Record<string, string | null>, prefer?: 'dmy' | 'mdy') {
    const pv = await this.preview(orgId, file, productGroupId, mappingOverride, prefer);
    // Analysierbare Ads: valide, demselben Produkt zugeordnet oder (noch) nicht in Filapen — NIE other_product.
    const usable = pv.rows.filter((r) => r.status === 'ready' || r.status === 'unmatched');
    if (!usable.length) throw new BadRequestException('Keine auswertbaren Ads für dieses Produkt in der Datei.');

    const matchedIds = usable.map((r) => r.matchedAdId).filter(Boolean) as string[];
    const adMeta = matchedIds.length ? await this.prisma.maAd.findMany({ where: { id: { in: matchedIds } }, select: { id: true, videoLengthSeconds: true } }) : [];
    const vlById = new Map(adMeta.map((a) => [a.id, a.videoLengthSeconds]));

    // Review anlegen (pending), danach Snapshots.
    const review = await this.prisma.maLongTermReview.create({
      data: {
        orgId, productGroupId,
        periodStart: pv.periodStart ? new Date(pv.periodStart) : null, periodEnd: pv.periodEnd ? new Date(pv.periodEnd) : null,
        sourceFilename: file?.originalname?.slice(0, 300) ?? null, sourceType: pv.detectedType,
        status: 'pending', facts: {} as any, adCount: usable.length, createdById: userId,
      },
      select: { id: true },
    });

    const ltAds: LtAd[] = [];
    for (const r of usable) {
      const v = r.values;
      const vl = r.matchedAdId ? (vlById.get(r.matchedAdId) ?? null) : null;
      const snap = await this.prisma.maLongTermAdSnapshot.create({
        data: {
          reviewId: review.id, orgId, metaAdId: r.metaAdId, adName: (r.adName ?? 'Unbenannte Ad').slice(0, 500), matchedAdId: r.matchedAdId,
          spend: v.spend ?? null, impressions: v.impressions ?? null, reach: v.reach ?? null,
          hookRate: v.hookRate ?? null, holdRate: v.holdRate ?? null, purchases: v.purchases ?? null, websitePurchases: v.websitePurchases ?? null,
          metaRoas: v.metaRoas ?? null, outboundCtr: v.outboundCtr ?? null, ctrAll: v.ctrAll ?? null, cpcAll: v.cpcAll ?? null,
          conversionValue: v.conversionValue ?? null, costPerPurchase: v.costPerPurchase ?? null, avgWatchTime: v.averageWatchTimeSeconds ?? null,
          thruplays: v.thruplays ?? null, views3s: v.videoViews3s ?? null, views25: v.videoViews25 ?? null, views50: v.videoViews50 ?? null,
          views75: v.videoViews75 ?? null, views95: v.videoViews95 ?? null, views100: v.videoViews100 ?? null, videoLengthSeconds: vl,
        },
        select: { id: true },
      });
      const segFunnel = computeSegments({ impressions: v.impressions ?? null, views3s: v.videoViews3s ?? null, views25: v.videoViews25 ?? null, views50: v.videoViews50 ?? null, views75: v.videoViews75 ?? null, views95: v.videoViews95 ?? null, views100: v.videoViews100 ?? null, videoLengthSeconds: vl });
      ltAds.push({
        adId: snap.id, metaAdId: r.metaAdId, name: r.adName ?? 'Unbenannte Ad', matchedAdId: r.matchedAdId,
        spend: v.spend ?? null, impressions: v.impressions ?? null, reach: v.reach ?? null,
        purchases: v.purchases ?? null, websitePurchases: v.websitePurchases ?? null, metaRoas: v.metaRoas ?? null,
        costPerPurchase: v.costPerPurchase ?? null, conversionValue: v.conversionValue ?? null,
        hookRatePct: v.hookRate ?? null, holdRatePct: v.holdRate ?? null, outboundCtr: v.outboundCtr ?? null, ctrAll: v.ctrAll ?? null,
        avgWatchTime: v.averageWatchTimeSeconds ?? null, videoLengthSeconds: vl, segments: segFunnel.segments,
      });
    }

    const strat = analyzeLongTerm(ltAds);
    const totalImpr = ltAds.reduce((s, a) => s + (a.impressions ?? 0), 0);
    const totalPurch = ltAds.reduce((s, a) => s + (a.purchases ?? 0), 0);
    const totalSpend = ltAds.reduce((s, a) => s + (a.spend ?? 0), 0);
    const healthConf: ConfidenceLevel = conversionEvidence(totalPurch) === 'high' && impressionEvidence(totalImpr) !== 'low' ? 'high' : impressionEvidence(totalImpr) === 'low' ? 'low' : 'medium';
    const g = await this.prisma.maProductGroup.findFirst({ where: { id: productGroupId, orgId }, select: { name: true } });
    const health: LtHealth = {
      adsAnalyzed: ltAds.length, spend: `${totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      impressions: totalImpr, purchases: totalPurch, periodStart: pv.periodStart, periodEnd: pv.periodEnd, confidence: healthConf,
    };

    // LLM-Narrativ (nur Text, Zahlen deterministisch).
    let result: CreativeLongTermResult | null = null;
    let status: 'ok' | 'error' = 'ok'; let error: string | null = null;
    let usage = { inputTokens: null as number | null, outputTokens: null as number | null, reasoningTokens: null as number | null };
    let latencyMs: number | null = null; let retryCount = 0; let model: string | null = null; let provider: string | null = null; let effort: string | null = null;
    const started = Date.now();
    try {
      const user = buildLtUserPrompt({ productGroupName: g?.name ?? null, health, controls: strat.historicalControls, segmentWinners: strat.segmentWinners, conversionWinners: strat.conversionWinners, salvage: strat.salvageOpportunities, candidates: strat.recombinationCandidates });
      const r = await this.ai.runStructured(AI_LT_SYSTEM_PROMPT, user, CREATIVE_LT_SCHEMA as any);
      usage = r.usage; retryCount = r.attempts - 1; model = r.cfg.model; provider = r.cfg.provider; effort = r.cfg.reasoningEffort;
      const narr = parseLtNarrative(r.text); assertValidLtNarrative(narr);
      result = this.mergeResult(strat, narr, health);
    } catch (e) {
      status = 'error'; error = e instanceof Error ? e.message : 'LLM-Langzeitbewertung fehlgeschlagen';
      this.logger.warn(`LT review failed: ${error}`);
      const cfg = this.ai.metaConfig(); model = cfg.model; provider = cfg.provider; effort = cfg.reasoningEffort;
    } finally { latencyMs = Date.now() - started; }

    const facts = { productGroupName: g?.name ?? null, health, strategy: strat };
    await this.prisma.maLongTermReview.update({
      where: { id: review.id },
      data: {
        status, error, provider, model, confidence: result?.overallConfidence ?? healthConf,
        facts: facts as any, result: (result as any) ?? undefined,
        reasoningEffort: effort, promptVersion: AI_LT_PROMPT_VERSION, strategyVersion: CREATIVE_RULES_VERSION,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens, latencyMs, retryCount,
      },
    });
    return this.get(orgId, review.id);
  }

  /** Deterministische Facts + LLM-Narrativ zum Endergebnis verbinden (join per Kandidaten-id). */
  private mergeResult(strat: ReturnType<typeof analyzeLongTerm>, narr: ReturnType<typeof parseLtNarrative>, health: LtHealth): CreativeLongTermResult {
    const byId = new Map(narr.recommendations.map((r) => [r.id, r]));
    const nextProductionBatch: LtNextTest[] = strat.recombinationCandidates.map((c) => {
      const n = byId.get(c.id);
      return {
        ...c,
        title: n?.title || this.fallbackTitle(c), why: n?.why || c.reason,
        hypothesis: n?.hypothesis || '', expectedLearning: n?.expectedLearning || '',
        recommendationConfidence: n?.recommendationConfidence ?? c.confidence,
        changeLabel: c.changeSegment ? LT_SEG_LABEL[c.changeSegment] : LT_TYPE_LABEL[c.recommendationType],
        keepLabels: c.keepSegments.map((k) => LT_SEG_LABEL[k]),
      };
    });
    const bySeg = (keys: string[]) => strat.segmentWinners.filter((w) => keys.includes(w.segment));
    return {
      version: 'lt-v1',
      executiveSummary: narr.executiveSummary,
      historicalHealth: health, historicalHealthNote: narr.historicalHealthNote,
      historicalControls: strat.historicalControls,
      segmentWinners: strat.segmentWinners,
      topOpenings: strat.segmentRankings.opening ?? [],
      strongEarlySections: strat.segmentRankings.early ?? [],
      strongMidSections: [...(strat.segmentRankings.mid_a ?? []), ...(strat.segmentRankings.mid_b ?? [])],
      strongLateSections: strat.segmentRankings.late ?? [],
      strongEndings: strat.segmentRankings.ending ?? [],
      conversionWinners: strat.conversionWinners,
      salvageOpportunities: strat.salvageOpportunities,
      weakAds: strat.weakAds,
      segmentMatrix: strat.matrix,
      distribution: strat.distribution,
      attentionFindings: narr.attentionFindings,
      recombinationCandidates: strat.recombinationCandidates,
      nextProductionBatch,
      overallConfidence: narr.overallConfidence,
    };
  }
  private fallbackTitle(c: any): string {
    if (c.recommendationType === 'RETEST_LOW_CONFIDENCE') return `${c.baseAdName} — mit mehr Daten erneut testen`;
    if (c.recommendationType === 'MULTI_SEGMENT_EXPLORATION') return 'Exploratory: Best-of-Segment kombinieren';
    return `${c.baseAdName}: ${LT_TYPE_LABEL[c.recommendationType as keyof typeof LT_TYPE_LABEL]}${c.sourceAdName ? ` aus ${c.sourceAdName}` : ''}`;
  }

  async list(orgId: string, productGroupId?: string) {
    const rows = await this.prisma.maLongTermReview.findMany({
      where: { orgId, ...(productGroupId ? { productGroupId } : {}) }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { productGroup: { select: { name: true } }, _count: { select: { snapshots: true } } },
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }
  async get(orgId: string, id: string) {
    const r = await this.prisma.maLongTermReview.findFirst({ where: { id, orgId }, include: { productGroup: { select: { name: true } }, _count: { select: { snapshots: true } } } });
    if (!r) throw new NotFoundException('Review nicht gefunden');
    return this.serialize(r);
  }

  /** Einen Recombination-Test als ma_idea (source=ai, draft) übernehmen — strukturierter Brief, Dedupe. */
  async acceptRecommendation(orgId: string, userId: string | null, reviewId: string, recId: string) {
    const r = await this.prisma.maLongTermReview.findFirst({ where: { id: reviewId, orgId } });
    if (!r) throw new NotFoundException('Review nicht gefunden');
    const result = r.result as any as CreativeLongTermResult | null;
    const rec = result?.nextProductionBatch?.find((x) => x.id === recId);
    if (!rec) throw new BadRequestException('Empfehlung nicht gefunden');

    const existing = await this.prisma.maIdea.findMany({ where: { orgId, source: 'ai', aiMeta: { path: ['longTermReviewId'], equals: reviewId } as any }, select: { id: true, aiMeta: true } });
    const dup = existing.find((e) => (e.aiMeta as any)?.recommendationId === recId);
    if (dup) return { ideaId: dup.id, status: 'draft', alreadyExisted: true };

    const brief = {
      recommendationType: rec.recommendationType, baseAd: { id: rec.baseAdId, name: rec.baseAdName }, sourceAd: rec.sourceAdId ? { id: rec.sourceAdId, name: rec.sourceAdName } : null,
      changeSegment: rec.changeSegment, changeLabel: rec.changeLabel, keepSegments: rec.keepSegments, keepLabels: rec.keepLabels, sourceSegment: rec.sourceSegment,
      sourceStartPercent: rec.sourceStartPercent, sourceEndPercent: rec.sourceEndPercent, approximateStartSecond: rec.approximateStartSecond, approximateEndSecond: rec.approximateEndSecond,
      why: rec.why, hypothesis: rec.hypothesis, expectedLearning: rec.expectedLearning, factReferences: rec.facts, confidence: rec.recommendationConfidence,
    };
    const body = [
      `Base/Control: ${rec.baseAdName}`,
      rec.sourceAdName ? `Source: ${rec.sourceAdName}` : null,
      rec.changeSegment ? `Ändern: ${rec.changeLabel}${rec.approximateStartSecond != null ? ` (ca. ${rec.approximateStartSecond}–${rec.approximateEndSecond}s)` : ''}` : null,
      rec.keepLabels.length ? `Behalten: ${rec.keepLabels.join(', ')}` : null,
      rec.why ? `Warum: ${rec.why}` : null,
      rec.expectedLearning ? `Erwartetes Learning: ${rec.expectedLearning}` : null,
    ].filter(Boolean).join('\n');

    const idea = await this.ideas.createIdea(orgId, userId, {
      title: rec.title || 'Langzeit-Test', body, ideaType: 'iteration', source: 'ai', status: 'draft',
      productGroupId: r.productGroupId ?? undefined,
      opportunityType: rec.recommendationType, rationale: [rec.hypothesis, rec.why].filter(Boolean).join('\n'),
    });
    await this.prisma.maIdea.update({ where: { id: (idea as any).id }, data: { aiModel: r.model, aiMeta: { longTermReviewId: reviewId, recommendationId: recId, confidence: rec.recommendationConfidence, brief } as any } });
    return { ideaId: (idea as any).id, status: 'draft' };
  }

  private serialize(r: any) {
    return {
      id: r.id, productGroupId: r.productGroupId ?? null, productGroupName: r.productGroup?.name ?? null,
      periodStart: r.periodStart ? r.periodStart.toISOString().slice(0, 10) : null, periodEnd: r.periodEnd ? r.periodEnd.toISOString().slice(0, 10) : null,
      sourceFilename: r.sourceFilename ?? null, sourceType: r.sourceType ?? null, status: r.status, confidence: r.confidence ?? null,
      provider: r.provider ?? null, model: r.model ?? null, error: r.error ?? null, adCount: r.adCount ?? r._count?.snapshots ?? null,
      promptVersion: r.promptVersion ?? null, strategyVersion: r.strategyVersion ?? null,
      usage: { inputTokens: r.inputTokens ?? null, outputTokens: r.outputTokens ?? null, reasoningTokens: r.reasoningTokens ?? null, latencyMs: r.latencyMs ?? null, retryCount: r.retryCount ?? null },
      facts: r.facts ?? null, result: r.result ?? null, createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }
}
