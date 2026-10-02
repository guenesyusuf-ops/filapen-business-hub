import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService, PeriodRange } from './meta-ads.service';
import { MetaAdsCreativeService } from './meta-ads-creative.service';
import { MetaAdsIdeasService } from './meta-ads-ideas.service';
import { AggregatedMetrics, round, biggestDrop } from './meta-ads-calc';
import { classifyAdSignals, SignalProfile } from './creative-signals';
import {
  AiAnalysisContext, AiFact, AiAnalysisResult, ConfidenceLevel, buildAnalysisMessages, parseAnalysisResult, assertValidResult,
  resolveMetaAiConfig, MetaAiConfig, CREATIVE_ANALYSIS_SCHEMA, AI_PROMPT_VERSION, clampRecommendationConfidence,
  AI_STRATEGY_PROMPT_VERSION, AI_STRATEGY_SYSTEM_PROMPT, CREATIVE_STRATEGY_SCHEMA, buildStrategyUserPrompt,
  parseStrategyNarrative, assertValidNarrative, CreativeStrategyResult, CreativeHealth, AdComparison,
  CombinationBlock, AttentionProblem, ProductionRecommendation, StrategyNarrative,
} from './ai-analysis';
import { CREATIVE_RULES_VERSION, HOOK_RULES, classifyHook } from './creative-rules';
import { AiAdRow } from './ai-analysis';
import {
  deriveProductionCandidates, ProductionCandidate, StrategyAd, StrategyComponentRef, ACTION_TYPE_LABEL, DropPosition, classifyBody,
} from './creative-strategy';
import { OPPORTUNITY_LABELS } from './idea-bridge';
import { AI_UI_TIMEOUT_MS, isTimeoutError } from '../../common/http/timeouts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
interface LlmUsage { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null }

/** Robustes Extrahieren von Text/Refusal aus einer OpenAI-Responses-API-Antwort. */
function extractResponsesOutput(data: any): { text: string; refusal: string | null } {
  let text = '';
  let refusal: string | null = null;
  const out = Array.isArray(data?.output) ? data.output : [];
  for (const item of out) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === 'output_text' && typeof c.text === 'string') text += c.text;
        else if (c?.type === 'refusal' && typeof c.refusal === 'string') refusal = c.refusal;
      }
    }
  }
  if (!text && typeof data?.output_text === 'string') text = data.output_text; // SDK-Komfortfeld
  return { text, refusal };
}

const MAX_LLM_ATTEMPTS = 3;
/** Fehler, der NICHT wiederholt werden darf (Auth/Schema/ungültige Anfrage). */
class NonRetryableLlmError extends Error {}

type Provider = 'openai' | 'anthropic';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Anzeige-/Aliasnamen auf echte OpenAI-Modell-IDs mappen (identisch zum
 * Content-Generator). Verhindert produktive 400er, wenn OPENAI_MODEL als
 * Anzeigename gesetzt ist (z. B. "GPT-5.4 mini").
 */
const OPENAI_MODEL_ALIAS: Record<string, string> = {
  'gpt-5.4 mini': DEFAULT_OPENAI_MODEL,
  'gpt-5.4-mini': DEFAULT_OPENAI_MODEL,
  'gpt-5 mini': DEFAULT_OPENAI_MODEL,
  'gpt5 mini': DEFAULT_OPENAI_MODEL,
};
export function remapOpenAiModel(raw?: string | null): string {
  const v = (raw || '').trim();
  if (!v) return DEFAULT_OPENAI_MODEL;
  return OPENAI_MODEL_ALIAS[v.toLowerCase()] || v;
}

const RANGE_LABELS: Record<string, string> = { last7: 'Letzte 7 Tage', last14: 'Letzte 14 Tage', last30: 'Letzte 30 Tage', lifetime: 'Gesamt' };

export interface AnalyzeInput {
  scopeType: 'ad' | 'product_group';
  productGroupId?: string;
  adId?: string;
  range?: PeriodRange;
  start?: string;
  end?: string;
}

@Injectable()
export class MetaAdsAiService {
  private readonly logger = new Logger(MetaAdsAiService.name);
  private readonly openaiKey: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
    private readonly creative: MetaAdsCreativeService,
    private readonly ideas: MetaAdsIdeasService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || null;
  }

  /**
   * Meta-Ads Creative Intelligence Config — getrennt vom Content-Generator.
   * META_ADS_AI_PROVIDER / META_ADS_AI_MODEL / META_ADS_AI_REASONING_EFFORT.
   * KEIN stiller Fallback auf ein schwächeres Modell. Modell-ID verbatim.
   */
  private resolveMetaConfig(): MetaAiConfig {
    return resolveMetaAiConfig({
      provider: this.config.get<string>('META_ADS_AI_PROVIDER'),
      model: this.config.get<string>('META_ADS_AI_MODEL'),
      reasoningEffort: this.config.get<string>('META_ADS_AI_REASONING_EFFORT'),
      hasOpenaiKey: !!this.openaiKey,
    });
  }

  // =========================================================================
  // Analyse starten (LLM auf deterministischem Facts-Snapshot)
  // =========================================================================

  async analyze(orgId: string, userId: string | null, input: AnalyzeInput) {
    if (input.scopeType !== 'ad' && input.scopeType !== 'product_group') throw new BadRequestException('Ungültiger Scope');
    if (input.scopeType === 'ad' && !input.adId) throw new BadRequestException('adId erforderlich');
    // Produkt-Level ist der Hauptmodus: genau EINE Produktgruppe, keine produktübergreifende Vermischung.
    if (input.scopeType === 'product_group' && !input.productGroupId) throw new BadRequestException('Bitte eine Produktgruppe wählen — die Creative-Analyse läuft pro Produkt, nicht produktübergreifend.');

    // Hauptmodus: Produkt-Level Creative Strategy (handlungsorientiertes v2-Schema).
    if (input.scopeType === 'product_group') return this.analyzeGroupStrategy(orgId, userId, input);

    const built = await this.buildAdContext(orgId, input);
    const { context, scope } = built;

    const { system, user } = buildAnalysisMessages(context);
    const cfg = this.resolveMetaConfig();
    const dataConfidence: ConfidenceLevel = context.confidenceLevel;

    let result: AiAnalysisResult | null = null;
    let status: 'ok' | 'error' = 'ok';
    let error: string | null = cfg.error;
    let usage: LlmUsage = { inputTokens: null, outputTokens: null, reasoningTokens: null };
    let latencyMs: number | null = null;
    let retryCount = 0;
    let recommendationConfidence: ConfidenceLevel | null = null;

    if (!cfg.error && cfg.model) {
      const started = Date.now();
      try {
        const run = await this.runCreativeAnalysis(cfg, system, user);
        usage = run.usage; retryCount = run.attempts - 1;
        result = parseAnalysisResult(run.text);
        assertValidResult(result); // fehlende Ebenen -> kontrollierter Error, kein loses Fallback
        // #40: Empfehlungs-Confidence darf die Datenlage nicht übersteigen.
        recommendationConfidence = clampRecommendationConfidence(result.overallConfidence, dataConfidence);
      } catch (e) {
        status = 'error';
        result = null;
        error = e instanceof Error ? e.message : 'LLM-Analyse fehlgeschlagen';
        this.logger.warn(`AI analyze failed (model=${cfg.model}, effort=${cfg.reasoningEffort}): ${error}`);
      } finally {
        latencyMs = Date.now() - started;
      }
    } else {
      status = 'error';
    }

    const row = await this.prisma.maAiAnalysis.create({
      data: {
        orgId, scopeType: input.scopeType,
        productGroupId: scope.productGroupId, adId: scope.adId,
        periodFrom: scope.periodFrom ? new Date(scope.periodFrom) : null,
        periodTo: scope.periodTo ? new Date(scope.periodTo) : null,
        rangeLabel: context.periodLabel, provider: cfg.provider, model: cfg.model,
        status, confidence: recommendationConfidence ?? dataConfidence,
        facts: context as any, result: (result as any) ?? undefined, error, createdById: userId,
        reasoningEffort: cfg.reasoningEffort, promptVersion: AI_PROMPT_VERSION, strategyVersion: CREATIVE_RULES_VERSION,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens,
        latencyMs, retryCount, dataConfidence, recommendationConfidence,
      },
    });
    return this.serialize(row);
  }

  // =========================================================================
  // Increment H/I — Produkt-Level Creative Strategy (handlungsorientiert)
  // =========================================================================

  private async analyzeGroupStrategy(orgId: string, userId: string | null, input: AnalyzeInput) {
    const ctx = await this.buildStrategyContext(orgId, input);
    const cfg = this.resolveMetaConfig();
    const dataConfidence: ConfidenceLevel = ctx.health.confidence;

    let result: CreativeStrategyResult | null = null;
    let status: 'ok' | 'error' = 'ok';
    let error: string | null = cfg.error;
    let usage: LlmUsage = { inputTokens: null, outputTokens: null, reasoningTokens: null };
    let latencyMs: number | null = null;
    let retryCount = 0;
    let recommendationConfidence: ConfidenceLevel | null = null;

    if (!cfg.error && cfg.model) {
      const started = Date.now();
      try {
        const user = buildStrategyUserPrompt({ ...ctx.promptArgs, candidates: ctx.candidates });
        const run = await this.runCreativeAnalysis(cfg, AI_STRATEGY_SYSTEM_PROMPT, user, CREATIVE_STRATEGY_SCHEMA as any);
        usage = run.usage; retryCount = run.attempts - 1;
        const narrative = parseStrategyNarrative(run.text);
        assertValidNarrative(narrative);
        result = this.mergeStrategyResult(ctx, narrative, dataConfidence);
        recommendationConfidence = result.overallConfidence;
      } catch (e) {
        status = 'error'; result = null;
        error = e instanceof Error ? e.message : 'LLM-Strategie fehlgeschlagen';
        this.logger.warn(`AI strategy failed (model=${cfg.model}, effort=${cfg.reasoningEffort}): ${error}`);
      } finally {
        latencyMs = Date.now() - started;
      }
    } else {
      status = 'error';
    }

    const row = await this.prisma.maAiAnalysis.create({
      data: {
        orgId, scopeType: 'product_group',
        productGroupId: ctx.scope.productGroupId, adId: null,
        periodFrom: ctx.scope.periodFrom ? new Date(ctx.scope.periodFrom) : null,
        periodTo: ctx.scope.periodTo ? new Date(ctx.scope.periodTo) : null,
        rangeLabel: ctx.periodLabel, provider: cfg.provider, model: cfg.model,
        status, confidence: recommendationConfidence ?? dataConfidence,
        facts: ctx.snapshot as any, result: (result as any) ?? undefined, error, createdById: userId,
        reasoningEffort: cfg.reasoningEffort, promptVersion: AI_STRATEGY_PROMPT_VERSION, strategyVersion: CREATIVE_RULES_VERSION,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens,
        latencyMs, retryCount, dataConfidence, recommendationConfidence,
      },
    });
    return this.serialize(row);
  }

  /** Verbindet deterministische Kandidaten mit dem LLM-Narrativ (join per key). Zahlen bleiben deterministisch. */
  private mergeStrategyResult(ctx: StrategyContext, n: StrategyNarrative, dataConfidence: ConfidenceLevel): CreativeStrategyResult {
    const byKey = new Map(n.recommendations.map((r) => [r.key, r]));
    const productionRecommendations: ProductionRecommendation[] = ctx.candidates.map((c) => {
      const nr = byKey.get(c.key);
      const recConf = clampRecommendationConfidence(nr?.recommendationConfidence ?? c.dataConfidence, dataConfidence);
      return {
        id: c.key, actionType: c.actionType, actionLabel: ACTION_TYPE_LABEL[c.actionType], priority: c.priority,
        title: nr?.title || c.title,
        affectedAds: c.affectedAds, affectedComponents: c.affectedComponents,
        keepComponents: c.keepComponents, changeComponents: c.changeComponents, suggestedComponents: c.suggestedComponents,
        testVariable: c.testVariable, variantCount: c.variantCount, facts: c.facts, dataConfidence: c.dataConfidence,
        recommendationConfidence: clampRecommendationConfidence(recConf, c.dataConfidence),
        observation: nr?.observation || '', interpretation: nr?.interpretation || '', hypothesis: nr?.hypothesis || '',
        why: nr?.why || '', expectedLearning: nr?.expectedLearning || '', suggestedTest: nr?.suggestedTest || '',
      };
    });
    return {
      version: 'v2',
      executiveSummary: n.executiveSummary,
      creativeHealth: ctx.health,
      creativeHealthNote: n.creativeHealthNote,
      adsCompared: ctx.adsCompared,
      winningPatterns: n.winningPatterns,
      hookFindings: n.hookFindings, bodyFindings: n.bodyFindings, retentionFindings: n.retentionFindings,
      attentionFindings: n.attentionFindings, dropFindings: n.dropFindings, componentFindings: n.componentFindings,
      salvageOpportunities: n.salvageOpportunities, awarenessFindings: n.awarenessFindings,
      nextTests: n.nextTests,
      productionRecommendations,
      componentCombination: ctx.combination,
      attentionProblems: ctx.attentionProblems,
      overallConfidence: clampRecommendationConfidence(n.overallConfidence, dataConfidence),
    };
  }

  /** Deterministischer Strategie-Kontext: Facts, Vergleich, Component Intelligence, Kombination, Attention, Kandidaten. */
  private async buildStrategyContext(orgId: string, input: AnalyzeInput): Promise<StrategyContext> {
    const period = this.ads.resolvePeriod(input.range, input.start, input.end);
    const productGroupId = input.productGroupId!;
    const ov = await this.ads.overview(orgId, { productGroupId, range: input.range, start: input.start, end: input.end });
    const kpis: AggregatedMetrics = ov.kpis;
    const groupHook = kpis.hookRate;
    const groupBody = kpis.retention50to75;

    const g = await this.prisma.maProductGroup.findFirst({ where: { id: productGroupId, orgId }, select: { name: true } });
    const productGroupName = g?.name ?? null;
    const conf = confidenceOf(kpis);

    const health: CreativeHealth = {
      adsAnalyzed: ov.counts.totalAds, spend: eur(kpis.spend), uniqueSales: kpis.uniqueSales, confidence: conf.level,
      baselineHookRatePct: groupHook != null ? Math.round(groupHook) : null,
      baselineRetention50to75Pct: groupBody != null ? Math.round(groupBody) : null,
    };

    // Per-Ad Fact Model (Vergleich innerhalb EINES Produkts).
    const adRows = await this.prisma.maAd.findMany({ where: { orgId, productGroupId }, select: { id: true, name: true, format: true, videoLengthSeconds: true }, orderBy: { createdAt: 'asc' } });
    const strategyAds: StrategyAd[] = [];
    const adsCompared: AdComparison[] = [];
    const attentionProblems: AttentionProblem[] = [];
    for (const ad of adRows) {
      const agg = await this.ads.aggregateForAdIds(orgId, [ad.id], period);
      const aConf = confidenceOf(agg);
      const hookDeltaPp = agg.hookRate != null && groupHook != null ? round(agg.hookRate - groupHook, 1) : null;
      const bodyDeltaPp = agg.retention50to75 != null && groupBody != null ? round(agg.retention50to75 - groupBody, 1) : null;
      let comps: { hook?: StrategyComponentRef | null; body?: StrategyComponentRef | null; proof?: StrategyComponentRef | null; cta?: StrategyComponentRef | null } = {};
      let overlapComponent: StrategyComponentRef | null = null;
      let dropStruct: { segment: string; fromSeconds: number | null; toSeconds: number | null; dropPct: number } | null = null;
      if (ad.format === 'video') {
        try {
          const ac = await this.creative.listAdComponents(orgId, ad.id, input.range, input.start, input.end);
          dropStruct = ac.biggestDrop ? { segment: ac.biggestDrop.segment, fromSeconds: ac.biggestDrop.fromSeconds ?? null, toSeconds: ac.biggestDrop.toSeconds ?? null, dropPct: round(ac.biggestDrop.dropPct, 1)! } : null;
          const pick = (types: string[]) => { const it = (ac.items as any[]).find((i) => types.includes(i.type)); return it ? { code: it.code, type: it.type, name: it.name } : null; };
          comps = { hook: pick(['hook', 'visual_opening']), body: pick(['body', 'problem_section', 'solution_section', 'product_demo']), proof: pick(['proof', 'testimonial']), cta: pick(['cta', 'offer_section']) };
          const ovItem = (ac.items as any[]).find((i) => i.overlap && (i.type === 'proof' || i.type === 'testimonial')) ?? (ac.items as any[]).find((i) => i.overlap);
          if (ovItem) overlapComponent = { code: ovItem.code, type: ovItem.type, name: ovItem.name };
          // Attention-Problem (interpoliert): nur bei relevantem Drop.
          if (dropStruct && dropStruct.dropPct >= 25) {
            attentionProblems.push({
              adId: ad.id, adName: ad.name, segment: dropStruct.segment, dropPct: dropStruct.dropPct,
              fromSeconds: dropStruct.fromSeconds, toSeconds: dropStruct.toSeconds,
              overlapComponent, recommendation: attentionRecommendation(overlapComponent, dropPosition(dropStruct.segment)),
            });
          }
        } catch { /* Ad ohne Components/Retention — ignorieren */ }
      }
      strategyAds.push({
        adId: ad.id, name: ad.name,
        hookClass: classifyHook(agg.hookRate), hookRatePct: agg.hookRate != null ? round(agg.hookRate, 1) : null,
        hookBaselinePct: groupHook != null ? round(groupHook, 1) : null, hookDeltaPp,
        retention50to75: agg.retention50to75 != null ? round(agg.retention50to75, 1) : null,
        bodyBaselinePct: groupBody != null ? round(groupBody, 1) : null, bodyDeltaPp,
        confidence: aConf.level, impressions: agg.impressions,
        biggestDrop: dropStruct ? { position: dropPosition(dropStruct.segment), segment: dropStruct.segment, dropPct: dropStruct.dropPct, fromSeconds: dropStruct.fromSeconds, toSeconds: dropStruct.toSeconds } : null,
        overlapComponent, components: comps,
      });
      adsCompared.push({
        adId: ad.id, name: ad.name,
        hookRatePct: agg.hookRate != null ? round(agg.hookRate, 1) : null, hookClass: classifyHook(agg.hookRate), hookDeltaPp,
        retention50to75: agg.retention50to75 != null ? round(agg.retention50to75, 1) : null, bodyDeltaPp, bodySignal: classifyBody(bodyDeltaPp),
        biggestDrop: dropStruct ? { segment: dropStruct.segment, dropPct: dropStruct.dropPct, fromSeconds: dropStruct.fromSeconds, toSeconds: dropStruct.toSeconds } : null,
        confidence: aConf.level,
      });
    }

    // Component Intelligence (D) + Combination Engine (E).
    const intel = await this.creative.componentIntelligence(orgId, productGroupId, input.range, input.start, input.end).catch(() => ({ items: [] as any[] }));
    const strongOf = (bucketTypes: string[]) => (intel.items as any[])
      .filter((r) => bucketTypes.includes(r.type) && (r.signal === 'strong' || r.signal === 'promising'))
      .sort((a, b) => (b.keyMetric ?? -Infinity) - (a.keyMetric ?? -Infinity))
      .slice(0, 6)
      .map((r) => ({ code: r.code, name: r.name, metricPct: r.keyMetric ?? null, deltaPp: r.keyDelta ?? null, sourceAdName: r.sourceAdName ?? null }));
    const strongHooks = strongOf(['hook', 'visual_opening']);
    const strongBodies = strongOf(['body', 'problem_section', 'solution_section', 'product_demo']);

    let combination: CombinationBlock | null = null;
    try {
      const rc = await this.creative.recommendedCombination(orgId, productGroupId, input.range, input.start, input.end);
      if (rc.combination) {
        const c = rc.combination;
        combination = {
          componentIds: c.componentIds, label: c.label, confidence: c.confidence, reason: c.reason,
          slots: c.slots.map((s: any) => ({ bucket: s.bucket, code: s.code, name: s.name, sourceAdName: s.sourceAdName ?? null, keyMetric: s.keyMetric ?? null, keyDelta: s.keyDelta ?? null })),
        };
      }
    } catch { /* keine belastbare Kombination */ }

    const candidates = deriveProductionCandidates({
      ads: strategyAds,
      combination: combination ? { componentIds: combination.componentIds, label: combination.label, confidence: combination.confidence, slots: combination.slots.map((s) => ({ bucket: s.bucket, code: s.code, name: s.name, sourceAdName: s.sourceAdName })) } : null,
      minImpressions: 3000,
    });

    const hookTargets = { strongPct: HOOK_RULES.strongPct, iterationPct: HOOK_RULES.iterationPct };
    const periodLabel = this.periodLabel(period);
    const promptArgs = {
      productGroupName, periodLabel, confidence: conf.level, confidenceReasons: conf.reasons, dataVolumeLow: conf.level === 'low',
      health, adsCompared, strongHooks, strongBodies, combination, attentionProblems, hookTargets,
    };
    const snapshot = { scopeType: 'product_group', productGroupName, periodLabel, health, adsCompared, strongHooks, strongBodies, combination, attentionProblems, candidates, hookTargets };
    return {
      scope: { productGroupId, adId: null, periodFrom: period.from ?? null, periodTo: period.to ?? null },
      periodLabel, health, adsCompared, candidates, combination, attentionProblems, promptArgs, snapshot,
    };
  }

  async listAnalyses(orgId: string, opts: { scopeType?: string; productGroupId?: string; adId?: string }) {
    const where: any = { orgId };
    if (opts.scopeType) where.scopeType = opts.scopeType;
    if (opts.productGroupId) where.productGroupId = opts.productGroupId;
    if (opts.adId) where.adId = opts.adId;
    const rows = await this.prisma.maAiAnalysis.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
      include: { productGroup: { select: { name: true } }, ad: { select: { name: true } } },
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }

  async getAnalysis(orgId: string, id: string) {
    const row = await this.prisma.maAiAnalysis.findFirst({
      where: { id, orgId },
      include: { productGroup: { select: { name: true } }, ad: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Analyse nicht gefunden');
    return this.serialize(row);
  }

  /** Eine Empfehlung als ma_idea (source=ai, status=draft) übernehmen — nie automatisch als Task. */
  async acceptRecommendation(orgId: string, userId: string | null, analysisId: string, ref: { index?: number; recommendationId?: string }) {
    const row = await this.prisma.maAiAnalysis.findFirst({ where: { id: analysisId, orgId } });
    if (!row) throw new NotFoundException('Analyse nicht gefunden');
    const result = (row.result as any) ?? null;

    // v2 (Creative Strategy) — strukturierter Brief
    if (result?.version === 'v2' && ref.recommendationId) {
      return this.acceptStrategyRecommendation(orgId, userId, row, result as CreativeStrategyResult, ref.recommendationId);
    }

    // Legacy v1 (Einzel-Ad-Drilldown)
    const index = ref.index ?? 0;
    const rec = (result as AiAnalysisResult)?.recommendations?.[index];
    if (!rec) throw new BadRequestException('Empfehlung nicht gefunden');
    const existing = await this.findAcceptedIdea(orgId, analysisId, { recommendationIndex: index });
    if (existing) return { ideaId: existing, status: 'draft', alreadyExisted: true };

    const ctx = row.facts as any as AiAnalysisContext;
    const componentIds: string[] = [];
    if (rec.componentHint) {
      const match = await this.prisma.maCreativeComponent.findFirst({ where: { orgId, code: rec.componentHint.trim() }, select: { id: true } });
      if (match) componentIds.push(match.id);
    }
    const rationale = [(result as AiAnalysisResult)?.summary, ...((result as AiAnalysisResult)?.interpretations ?? []).map((i) => i.text), ...((result as AiAnalysisResult)?.hypotheses ?? []).map((h) => h.text)].filter(Boolean).join('\n');
    const body = [rec.action, rec.suggestedTest ? `Test: ${rec.suggestedTest}` : null].filter(Boolean).join('\n\n');
    const idea = await this.ideas.createIdea(orgId, userId, {
      title: rec.title || 'KI-Empfehlung', body, ideaType: row.scopeType === 'ad' ? 'iteration' : 'new',
      source: 'ai', status: 'draft', productGroupId: row.productGroupId ?? undefined, basedOnAdId: row.adId ?? undefined,
      opportunityType: ctx?.signals?.[0]?.opportunityType ?? null, rationale, componentIds,
    });
    await this.prisma.maIdea.update({ where: { id: (idea as any).id }, data: { aiModel: row.model, aiMeta: { analysisId: row.id, recommendationIndex: index, confidence: rec.confidence } as any } });
    return { ideaId: (idea as any).id, status: 'draft' };
  }

  private async acceptStrategyRecommendation(orgId: string, userId: string | null, row: any, result: CreativeStrategyResult, recId: string) {
    const rec = result.productionRecommendations.find((r) => r.id === recId);
    if (!rec) throw new BadRequestException('Empfehlung nicht gefunden');
    const existing = await this.findAcceptedIdea(orgId, row.id, { recommendationId: recId });
    if (existing) return { ideaId: existing, status: 'draft', alreadyExisted: true };

    // Component-Codes (KEEP/CHANGE/suggested + affected) -> ids
    const codes = Array.from(new Set([
      ...rec.affectedComponents.map((c) => c.code),
      ...rec.suggestedComponents, ...rec.keepComponents, ...rec.changeComponents,
    ].map((c) => (c || '').trim()).filter(Boolean)));
    const found = codes.length ? await this.prisma.maCreativeComponent.findMany({ where: { orgId, code: { in: codes } }, select: { id: true } }) : [];
    const componentIds = found.map((f) => f.id);

    const basedOnAdId = rec.affectedAds[0]?.id ?? null;
    const brief = {
      actionType: rec.actionType, actionLabel: rec.actionLabel, variantCount: rec.variantCount, testVariable: rec.testVariable,
      why: rec.why, observation: rec.observation, interpretation: rec.interpretation, hypothesis: rec.hypothesis,
      keep: rec.keepComponents, change: rec.changeComponents, suggested: rec.suggestedComponents,
      sourceAds: rec.affectedAds, sourceComponents: rec.affectedComponents,
      factRefs: rec.facts, suggestedTest: rec.suggestedTest, expectedLearning: rec.expectedLearning,
    };
    const bodyLines = [
      rec.why && `Warum: ${rec.why}`,
      rec.keepComponents.length && `KEEP: ${rec.keepComponents.join(', ')}`,
      rec.changeComponents.length && `CHANGE: ${rec.changeComponents.join(', ')}`,
      rec.suggestedComponents.length && `USE: ${rec.suggestedComponents.join(', ')}`,
      rec.variantCount != null && `Varianten: ${rec.variantCount}`,
      rec.suggestedTest && `Test: ${rec.suggestedTest}`,
      rec.expectedLearning && `Erwartetes Learning: ${rec.expectedLearning}`,
    ].filter(Boolean).join('\n');
    const rationale = [rec.observation, rec.interpretation, rec.hypothesis].filter(Boolean).join('\n');

    const idea = await this.ideas.createIdea(orgId, userId, {
      title: rec.title || rec.actionLabel, body: bodyLines,
      ideaType: rec.actionType === 'ITERATE_WINNING_HOOK' || rec.actionType === 'ITERATE_WINNING_BODY' ? 'iteration' : rec.actionType === 'BUILD_COMPONENT_COMBINATION' ? 'new' : 'iteration',
      source: 'ai', status: 'draft', productGroupId: row.productGroupId ?? undefined, basedOnAdId: basedOnAdId ?? undefined,
      opportunityType: rec.actionType, rationale, componentIds,
    });
    await this.prisma.maIdea.update({
      where: { id: (idea as any).id },
      data: { aiModel: row.model, aiMeta: { analysisId: row.id, recommendationId: recId, confidence: rec.recommendationConfidence, brief } as any },
    });
    return { ideaId: (idea as any).id, status: 'draft' };
  }

  /** Recipe aus der empfohlenen Kombination (Increment E) — bestehende maCreativeRecipe, dedupe pro Gruppe+Component-Set. */
  async createRecipeFromAnalysis(orgId: string, userId: string | null, analysisId: string) {
    const row = await this.prisma.maAiAnalysis.findFirst({ where: { id: analysisId, orgId } });
    if (!row) throw new NotFoundException('Analyse nicht gefunden');
    const result = (row.result as any) as CreativeStrategyResult | null;
    const combo = result?.componentCombination;
    if (!combo || !combo.componentIds.length) throw new BadRequestException('Keine Kombination in dieser Analyse.');

    // Dedupe: bestehendes Recipe mit identischem Component-Set in derselben Gruppe.
    const want = [...combo.componentIds].sort();
    const existingRecipes = await this.prisma.maCreativeRecipe.findMany({
      where: { orgId, productGroupId: row.productGroupId }, select: { id: true, components: { select: { componentId: true } } },
    });
    const dup = existingRecipes.find((r) => { const got = r.components.map((c) => c.componentId).sort(); return got.length === want.length && got.every((v, i) => v === want[i]); });
    if (dup) return { recipeId: dup.id, alreadyExisted: true };

    const recipe = await this.creative.createRecipe(orgId, userId ?? '', {
      name: `Empfehlung: ${combo.slots.map((s) => s.code).join(' + ')}`,
      productGroupId: row.productGroupId, componentIds: combo.componentIds,
      notes: combo.reason,
    });
    return { recipeId: (recipe as any).id, alreadyExisted: false };
  }

  /** Sucht eine bereits übernommene Idee zu dieser Analyse/Empfehlung (Idempotenz, kein Duplikat). */
  private async findAcceptedIdea(orgId: string, analysisId: string, match: { recommendationId?: string; recommendationIndex?: number }): Promise<string | null> {
    const rows = await this.prisma.maIdea.findMany({
      where: { orgId, source: 'ai', aiMeta: { path: ['analysisId'], equals: analysisId } as any },
      select: { id: true, aiMeta: true }, orderBy: { createdAt: 'asc' },
    });
    const hit = rows.find((r) => {
      const m = (r.aiMeta as any) ?? {};
      if (match.recommendationId != null) return m.recommendationId === match.recommendationId;
      if (match.recommendationIndex != null) return m.recommendationIndex === match.recommendationIndex;
      return false;
    });
    return hit?.id ?? null;
  }

  // =========================================================================
  // Kontext-Builder (NUR deterministische Daten)
  // =========================================================================

  private async buildAdContext(orgId: string, input: AnalyzeInput): Promise<{ context: AiAnalysisContext; scope: Scope }> {
    const adId = input.adId!;
    const adRow = await this.prisma.maAd.findFirst({ where: { id: adId, orgId }, select: { productGroupId: true } });
    if (!adRow) throw new NotFoundException('Ad nicht gefunden');
    const ra = await this.ads.retentionAnalysis(orgId, adId, input.range, input.start, input.end);
    const period = this.ads.resolvePeriod(input.range, input.start, input.end);
    const agg = await this.ads.aggregateForAdIds(orgId, [adId], period);
    const self = ra.self as SignalProfile | null;
    const base = (ra.baselines.productGroup ?? null) as SignalProfile | null;
    const sig = self ? classifyAdSignals(self, base, agg.calculatedRoas, ra.confidence.level) : { signals: [], primary: null };

    const latestHyros = await this.prisma.maAdDailyMetric.findFirst({
      where: { orgId, adId, ...(period.from ? { date: { gte: new Date(period.from) } } : {}), ...(period.to ? { date: { lte: new Date(period.to) } } : {}), hyrosRoas: { not: null } },
      orderBy: { date: 'desc' }, select: { hyrosRoas: true, date: true },
    });

    const facts: AiFact[] = [
      ...this.perfFacts(agg),
      { label: 'Hyros ROAS (letzter Tageswert, autoritativ)', value: latestHyros?.hyrosRoas != null ? `${round(Number(latestHyros.hyrosRoas), 2)}×` : 'kein Tageswert' },
      { label: 'Ø Wiedergabe', value: ra.averageWatchTimeSeconds != null ? `${ra.averageWatchTimeSeconds}s` : '—' },
      { label: 'Tage mit Daten', value: String(ra.dataPoints) },
    ];

    const comps = await this.creative.listAdComponents(orgId, adId, input.range, input.start, input.end).catch(() => ({ items: [] as any[] }));

    const context: AiAnalysisContext = {
      scopeType: 'ad',
      productGroupName: ra.baselines.productGroup?.label ?? null,
      adName: ra.name,
      periodLabel: this.periodLabel(period),
      confidenceLevel: ra.confidence.level,
      confidenceReasons: ra.confidence.reasons,
      facts,
      baselines: this.baselineFacts(ra.baselines),
      retention: (ra.steps ?? []).filter((s: any) => s.retentionFromPrev != null).map((s: any) => ({ segment: s.label, retentionPct: round(s.retentionFromPrev, 1)!, dropPct: round(s.dropFromPrev, 1) ?? 0 })),
      biggestDrop: ra.biggestDrop ? { segment: ra.biggestDrop.segment, fromSeconds: ra.biggestDrop.fromSeconds ?? null, toSeconds: ra.biggestDrop.toSeconds ?? null, dropPct: round(ra.biggestDrop.dropPct, 1)! } : null,
      signals: sig.signals.map((s) => ({ opportunityType: s.type, label: s.label, detail: s.detail })),
      components: (comps.items ?? []).map((c: any) => ({ code: c.code, type: c.type, name: c.name, keyMetric: c.keyMetric != null ? `${c.keyMetric}%` : null, keyDelta: c.keyDelta != null ? `${c.keyDelta > 0 ? '+' : ''}${c.keyDelta}pp` : null })),
      dataVolumeLow: ra.confidence.level === 'low',
    };
    return { context, scope: { productGroupId: adRow.productGroupId ?? null, adId, periodFrom: period.from ?? null, periodTo: period.to ?? null } };
  }

  private async buildGroupContext(orgId: string, input: AnalyzeInput): Promise<{ context: AiAnalysisContext; scope: Scope }> {
    const period = this.ads.resolvePeriod(input.range, input.start, input.end);
    const ov = await this.ads.overview(orgId, { productGroupId: input.productGroupId, range: input.range, start: input.start, end: input.end });
    const lab = await this.creative.creativeLab(orgId, { productGroupId: input.productGroupId, range: input.range, start: input.start, end: input.end });
    const kpis: AggregatedMetrics = ov.kpis;

    let productGroupName: string | null = null;
    if (input.productGroupId) {
      const g = await this.prisma.maProductGroup.findFirst({ where: { id: input.productGroupId, orgId }, select: { name: true } });
      productGroupName = g?.name ?? null;
    }
    const conf = confidenceOf(kpis);

    const signalCards = [...lab.sections.salvage, ...lab.sections.needsIteration] as any[];
    const signals = signalCards.slice(0, 8).map((c) => ({
      opportunityType: c.primary ?? 'NEEDS_ITERATION',
      label: `${c.name}: ${OPPORTUNITY_LABELS[c.primary] ?? c.primary ?? '—'}`,
      detail: `Hook ${pct(c.metrics?.hookRate)}, 50→75 ${pct(c.metrics?.retention50to75)}`,
    }));
    const winComps = [...lab.sections.winningHooks, ...lab.sections.winningBodies] as any[];

    // Produkt-Level Fact Model: jede Ad der Gruppe einzeln (Vergleich innerhalb EINES Produkts).
    const ads = await this.buildAdBreakdown(orgId, input.productGroupId!, period, kpis.hookRate);

    const context: AiAnalysisContext = {
      scopeType: 'product_group',
      productGroupName,
      adName: null,
      periodLabel: this.periodLabel(period),
      confidenceLevel: conf.level,
      confidenceReasons: conf.reasons,
      facts: [
        ...this.perfFacts(kpis),
        { label: 'Hyros ROAS', value: 'pro Tag/Ad — über Zeiträume/Gruppen nicht gemittelt (autoritativ nur je Tageswert)' },
        { label: 'Ads gesamt', value: String(ov.counts.totalAds) },
        { label: 'Produkt-Baseline Hook Rate', value: pct(kpis.hookRate) },
        { label: 'Produkt-Baseline 50→75 Retention', value: pct(kpis.retention50to75) },
        { label: 'Winning Creatives', value: String(lab.sections.winningCreatives.length) },
        { label: 'Salvage-Kandidaten', value: String(lab.sections.salvage.length) },
        { label: 'Needs Iteration', value: String(lab.sections.needsIteration.length) },
      ],
      baselines: [],
      signals,
      components: winComps.slice(0, 12).map((c) => ({ code: c.code, type: c.type, name: c.name, keyMetric: c.keyMetric != null ? `${c.keyMetric}%` : null, keyDelta: c.keyDelta != null ? `${c.keyDelta > 0 ? '+' : ''}${c.keyDelta}pp` : null })),
      ads,
      hookTargets: { strongPct: HOOK_RULES.strongPct, iterationPct: HOOK_RULES.iterationPct },
      dataVolumeLow: conf.level === 'low',
    };
    return { context, scope: { productGroupId: input.productGroupId ?? null, adId: null, periodFrom: period.from ?? null, periodTo: period.to ?? null } };
  }

  /** Product-Level: jede Ad der Gruppe einzeln (deterministisch) — Vergleich innerhalb EINES Produkts. */
  private async buildAdBreakdown(orgId: string, productGroupId: string, period: { from?: string; to?: string }, groupHook: number | null): Promise<AiAdRow[]> {
    const ads = await this.prisma.maAd.findMany({
      where: { orgId, productGroupId },
      select: { id: true, name: true, videoLengthSeconds: true },
      orderBy: { createdAt: 'asc' },
    });
    const rows: AiAdRow[] = [];
    for (const ad of ads) {
      const agg = await this.ads.aggregateForAdIds(orgId, [ad.id], period);
      const conf = confidenceOf(agg);
      const drop = biggestDrop(agg, ad.videoLengthSeconds);
      rows.push({
        name: ad.name,
        hookRatePct: agg.hookRate != null ? round(agg.hookRate, 1) : null,
        hookClass: classifyHook(agg.hookRate),
        hookDeltaPp: agg.hookRate != null && groupHook != null ? round(agg.hookRate - groupHook, 1) : null,
        holdRatePct: agg.holdRate != null ? round(agg.holdRate, 1) : null,
        retention50to75: agg.retention50to75 != null ? round(agg.retention50to75, 1) : null,
        outboundCtr: agg.outboundCtr != null ? round(agg.outboundCtr, 1) : null,
        spend: agg.spend ?? null,
        uniqueSales: agg.uniqueSales ?? null,
        calculatedRoas: agg.calculatedRoas != null ? round(agg.calculatedRoas, 2) : null,
        biggestDrop: drop ? `${drop.segment} (-${round(drop.dropPct, 1)}%)${drop.fromSeconds != null ? `, Sek ${drop.fromSeconds}-${drop.toSeconds ?? '?'}` : ''}` : null,
        confidence: conf.level,
      });
    }
    return rows;
  }

  private perfFacts(a: AggregatedMetrics): AiFact[] {
    return [
      { label: 'Spend', value: eur(a.spend) },
      { label: 'Impressionen', value: int(a.impressions) },
      { label: 'Unique Sales', value: int(a.uniqueSales) },
      { label: 'Berechneter ROAS (Vergleichswert)', value: a.calculatedRoas != null ? `${round(a.calculatedRoas, 2)}×` : '—' },
      { label: 'Hook Rate', value: pct(a.hookRate) },
      { label: 'Hold Rate', value: pct(a.holdRate) },
      { label: 'Ausgehende CTR', value: pct(a.outboundCtr) },
      { label: 'Retention 25→50', value: pct(a.retention25to50) },
      { label: 'Retention 50→75', value: pct(a.retention50to75) },
      { label: 'Retention 75→95', value: pct(a.retention75to95) },
    ];
  }

  private baselineFacts(baselines: any): AiFact[] {
    const out: AiFact[] = [];
    const g = baselines?.productGroup;
    if (g) {
      out.push({ label: `Hook Rate (${g.label}, ${g.adCount} Ads)`, value: pct(g.hookRate) });
      out.push({ label: `Hold Rate (${g.label})`, value: pct(g.holdRate) });
      out.push({ label: `Retention 50→75 (${g.label})`, value: pct(g.retention50to75) });
      out.push({ label: `Ausg. CTR (${g.label})`, value: pct(g.outboundCtr) });
    }
    const f = baselines?.format;
    if (f) out.push({ label: `Hook Rate (Format ${f.label}, ${f.adCount} Ads)`, value: pct(f.hookRate) });
    return out;
  }

  private periodLabel(period: { from?: string; to?: string; range?: string }): string {
    if (period.range && RANGE_LABELS[period.range]) return RANGE_LABELS[period.range];
    if (period.from || period.to) return `${period.from ?? '…'} – ${period.to ?? '…'}`;
    return 'Gesamt';
  }

  // =========================================================================
  // LLM-Call (gleiches Muster wie Content-Generator; weiche Fehler)
  // =========================================================================

  /** Responses-API-Call mit begrenztem Retry (nur transient: 429/5xx/Timeout). Gibt Text + Usage + Versuche zurück. */
  private async runCreativeAnalysis(cfg: MetaAiConfig, system: string, user: string, schema: { name: string; schema: any } = CREATIVE_ANALYSIS_SCHEMA as any): Promise<{ text: string; usage: LlmUsage; attempts: number }> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
      try {
        const r = await this.callResponsesOnce(cfg, system, user, schema);
        return { ...r, attempts: attempt };
      } catch (e) {
        lastErr = e;
        if (e instanceof NonRetryableLlmError) throw e;
        if (attempt < MAX_LLM_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, attempt * 700));
          this.logger.warn(`Meta-AI transient error (attempt ${attempt}/${MAX_LLM_ATTEMPTS}): ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Meta-AI-Call fehlgeschlagen');
  }

  /** Ein OpenAI-Responses-API-Call mit strict Structured Outputs + reasoning.effort. Kein loses Fallback. */
  private async callResponsesOnce(cfg: MetaAiConfig, system: string, user: string, schema: { name: string; schema: any }): Promise<{ text: string; usage: LlmUsage }> {
    let res: Response;
    try {
      res = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.openaiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          reasoning: { effort: cfg.reasoningEffort },
          input: [{ role: 'system', content: system }, { role: 'user', content: user }],
          text: { format: { type: 'json_schema', name: schema.name, strict: true, schema: schema.schema } },
          max_output_tokens: 12000,
        }),
        signal: AbortSignal.timeout(AI_UI_TIMEOUT_MS),
      });
    } catch (e) {
      if (isTimeoutError(e)) throw new Error(`openai Timeout (model=${cfg.model})`);
      throw new Error(`openai Netzwerkfehler (model=${cfg.model})`);
    }
    if (!res.ok) {
      const detail = await this.readProviderError(res);
      const label = `openai ${res.status}${detail ? ` [${detail}]` : ''} (model=${cfg.model})`;
      this.logger.warn(`Meta-AI provider error: ${label}`);
      if ([400, 401, 403, 404, 422].includes(res.status)) throw new NonRetryableLlmError(label);
      throw new Error(label);
    }
    const data: any = await res.json();
    const usage: LlmUsage = {
      inputTokens: data?.usage?.input_tokens ?? null,
      outputTokens: data?.usage?.output_tokens ?? null,
      reasoningTokens: data?.usage?.output_tokens_details?.reasoning_tokens ?? null,
    };
    const { text, refusal } = extractResponsesOutput(data);
    // Kontrollierter Error statt stillem Zurückfallen auf unstrukturierten Text:
    if (refusal) throw new NonRetryableLlmError(`openai refusal: ${refusal.slice(0, 200)} (model=${cfg.model})`);
    if (data?.status === 'incomplete') throw new NonRetryableLlmError(`openai incomplete: ${data?.incomplete_details?.reason ?? '?'} (model=${cfg.model})`);
    if (!text.trim()) throw new NonRetryableLlmError(`openai leere/strukturlose Antwort (model=${cfg.model})`);
    return { text, usage };
  }

  /** Liest die Fehlerdetails einer Provider-Antwort — nur type/code/message, keine Secrets, gekürzt. */
  private async readProviderError(res: Response): Promise<string> {
    try {
      const body: any = await res.json();
      const e = body?.error ?? body;
      const parts = [e?.type, e?.code, e?.message].filter(Boolean).map((x) => String(x));
      return parts.join(': ').slice(0, 300);
    } catch {
      return '';
    }
  }

  private serialize(r: any) {
    return {
      id: r.id, scopeType: r.scopeType, productGroupId: r.productGroupId ?? null,
      productGroupName: r.productGroup?.name ?? null, adId: r.adId ?? null, adName: r.ad?.name ?? null,
      rangeLabel: r.rangeLabel ?? null, provider: r.provider ?? null, model: r.model ?? null,
      status: r.status, confidence: r.confidence ?? null, error: r.error ?? null,
      reasoningEffort: r.reasoningEffort ?? null, promptVersion: r.promptVersion ?? null, strategyVersion: r.strategyVersion ?? null,
      dataConfidence: r.dataConfidence ?? null, recommendationConfidence: r.recommendationConfidence ?? null,
      usage: { inputTokens: r.inputTokens ?? null, outputTokens: r.outputTokens ?? null, reasoningTokens: r.reasoningTokens ?? null, latencyMs: r.latencyMs ?? null, retryCount: r.retryCount ?? null },
      facts: r.facts ?? null, result: r.result ?? null, createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }
}

interface Scope { productGroupId: string | null; adId: string | null; periodFrom: string | null; periodTo: string | null }

interface StrategyContext {
  scope: Scope;
  periodLabel: string;
  health: CreativeHealth;
  adsCompared: AdComparison[];
  candidates: ProductionCandidate[];
  combination: CombinationBlock | null;
  attentionProblems: AttentionProblem[];
  promptArgs: Omit<Parameters<typeof buildStrategyUserPrompt>[0], 'candidates'>;
  snapshot: any;
}

/** Grobe Position des größten Drops anhand des Segment-Labels (für Produktions-Hinweise). */
function dropPosition(segment: string): DropPosition {
  const s = segment.toLowerCase();
  if (s.includes('0s') || s.startsWith('3s') || s.includes('→25') || s.includes('→3s')) return 'early';
  if (s.includes('25%') || s.includes('50%')) return 'mid';
  return 'late';
}

/** Deterministische Produktions-Empfehlung zu einem Attention-Drop (keine Kausalität). */
function attentionRecommendation(overlap: StrategyComponentRef | null, pos: DropPosition): string {
  if (overlap && (overlap.type === 'proof' || overlap.type === 'testimonial')) return `Alternative Proof-Section testen (Overlap ${overlap.code}) — Hook/Body davor behalten.`;
  if (overlap && (overlap.type === 'cta' || overlap.type === 'offer_section')) return `Abschluss/CTA an dieser Stelle straffen oder vorziehen (Overlap ${overlap.code}).`;
  if (overlap && ['body', 'problem_section', 'solution_section', 'product_demo'].includes(overlap.type)) return `Body/Mittelteil in diesem Abschnitt neu schneiden (Overlap ${overlap.code}).`;
  if (pos === 'early') return 'Starker früher Drop — neuen Hook/Opening testen.';
  if (pos === 'late') return 'Später Drop — Ende/CTA straffen.';
  return 'Diesen Abschnitt gezielt überarbeiten und als Variante testen.';
}

function pct(v: number | null | undefined): string { return v == null ? '—' : `${Math.round(v)}%`; }
function eur(v: number): string { return `${(v ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
function int(v: number): string { return (v ?? 0).toLocaleString('de-DE'); }
function confidenceOf(a: AggregatedMetrics): { level: 'low' | 'medium' | 'high'; reasons: string[] } {
  const reasons = [`${int(a.impressions)} Impressionen`, `${a.dataPoints} Tag${a.dataPoints === 1 ? '' : 'e'} mit Daten`];
  if (a.uniqueSales > 0) reasons.push(`${a.uniqueSales} Unique Sales`);
  let level: 'low' | 'medium' | 'high' = 'low';
  if (a.impressions >= 50000 && a.dataPoints >= 7) level = 'high';
  else if (a.impressions >= 10000 && a.dataPoints >= 3) level = 'medium';
  return { level, reasons };
}
