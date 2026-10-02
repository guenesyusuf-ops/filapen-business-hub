import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService, PeriodRange } from './meta-ads.service';
import { MetaAdsCreativeService } from './meta-ads-creative.service';
import { MetaAdsIdeasService } from './meta-ads-ideas.service';
import { AggregatedMetrics, round } from './meta-ads-calc';
import { classifyAdSignals, SignalProfile } from './creative-signals';
import {
  AiAnalysisContext, AiFact, AiAnalysisResult, buildAnalysisMessages, parseAnalysisResult, assertValidResult, resolveProvider,
} from './ai-analysis';
import { OPPORTUNITY_LABELS } from './idea-bridge';
import { AI_UI_TIMEOUT_MS, isTimeoutError } from '../../common/http/timeouts';

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
  private readonly anthropicKey: string | null;
  private readonly openaiModel: string;
  private readonly forced: string;
  private readonly isProd: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
    private readonly creative: MetaAdsCreativeService,
    private readonly ideas: MetaAdsIdeasService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || null;
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY') || null;
    this.openaiModel = remapOpenAiModel(this.config.get<string>('OPENAI_MODEL'));
    this.forced = (this.config.get<string>('CONTENT_AI_PROVIDER') || '').toLowerCase();
    this.isProd = (this.config.get<string>('NODE_ENV') || process.env.NODE_ENV || '') === 'production';
  }

  /**
   * Explizite Providerwahl — KEIN stiller Fallback. Im Produktivbetrieb MUSS
   * CONTENT_AI_PROVIDER explizit gesetzt sein; der zugehörige Key muss vorhanden sein.
   */
  private resolveProvider(): { provider: Provider | null; model: string | null; error: string | null } {
    return resolveProvider({
      forced: this.forced, isProd: this.isProd,
      hasOpenaiKey: !!this.openaiKey, hasAnthropicKey: !!this.anthropicKey,
      openaiModel: this.openaiModel, anthropicModel: ANTHROPIC_MODEL,
    });
  }

  // =========================================================================
  // Analyse starten (LLM auf deterministischem Facts-Snapshot)
  // =========================================================================

  async analyze(orgId: string, userId: string | null, input: AnalyzeInput) {
    if (input.scopeType !== 'ad' && input.scopeType !== 'product_group') throw new BadRequestException('Ungültiger Scope');
    if (input.scopeType === 'ad' && !input.adId) throw new BadRequestException('adId erforderlich');

    const built = input.scopeType === 'ad'
      ? await this.buildAdContext(orgId, input)
      : await this.buildGroupContext(orgId, input);
    const { context, scope } = built;

    const { system, user } = buildAnalysisMessages(context);
    const resolved = this.resolveProvider();

    let result: AiAnalysisResult | null = null;
    let status: 'ok' | 'error' = 'ok';
    let error: string | null = resolved.error;

    if (!resolved.error && resolved.provider && resolved.model) {
      try {
        const text = await this.callLlm(resolved.provider, resolved.model, system, user);
        result = parseAnalysisResult(text);
        assertValidResult(result); // fehlende Ebenen -> status=error, kein 500
      } catch (e) {
        status = 'error';
        result = null;
        error = e instanceof Error ? e.message : 'LLM-Analyse fehlgeschlagen';
        this.logger.warn(`AI analyze failed (provider=${resolved.provider}, model=${resolved.model}): ${error}`);
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
        rangeLabel: context.periodLabel, provider: resolved.provider, model: resolved.model,
        status, confidence: result?.overallConfidence ?? context.confidenceLevel,
        facts: context as any, result: (result as any) ?? undefined, error, createdById: userId,
      },
    });
    return this.serialize(row);
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
  async acceptRecommendation(orgId: string, userId: string | null, analysisId: string, index: number) {
    const row = await this.prisma.maAiAnalysis.findFirst({ where: { id: analysisId, orgId } });
    if (!row) throw new NotFoundException('Analyse nicht gefunden');
    const result = (row.result as any as AiAnalysisResult) ?? null;
    const rec = result?.recommendations?.[index];
    if (!rec) throw new BadRequestException('Empfehlung nicht gefunden');

    const ctx = row.facts as any as AiAnalysisContext;
    // componentHint -> componentId (nur wenn eindeutig in den Kontext-Components)
    const componentIds: string[] = [];
    if (rec.componentHint) {
      const match = await this.prisma.maCreativeComponent.findFirst({
        where: { orgId, code: rec.componentHint.trim() }, select: { id: true },
      });
      if (match) componentIds.push(match.id);
    }
    const rationale = [result?.summary, ...(result?.interpretations ?? []).map((i) => i.text), ...(result?.hypotheses ?? []).map((h) => h.text)]
      .filter(Boolean).join('\n');
    const body = [rec.action, rec.suggestedTest ? `Test: ${rec.suggestedTest}` : null].filter(Boolean).join('\n\n');

    const idea = await this.ideas.createIdea(orgId, userId, {
      title: rec.title || 'KI-Empfehlung',
      body,
      ideaType: row.scopeType === 'ad' ? 'iteration' : 'new',
      source: 'ai',
      status: 'draft',
      productGroupId: row.productGroupId ?? undefined,
      basedOnAdId: row.adId ?? undefined,
      opportunityType: ctx?.signals?.[0]?.opportunityType ?? null,
      rationale,
      componentIds,
    });
    // KI-Herkunft am Idea markieren (Audit): Modell + Analyse-Referenz
    await this.prisma.maIdea.update({
      where: { id: (idea as any).id },
      data: { aiModel: row.model, aiMeta: { analysisId: row.id, recommendationIndex: index, confidence: rec.confidence } as any },
    });
    return { ideaId: (idea as any).id, status: 'draft' };
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
        { label: 'Winning Creatives', value: String(lab.sections.winningCreatives.length) },
        { label: 'Salvage-Kandidaten', value: String(lab.sections.salvage.length) },
        { label: 'Needs Iteration', value: String(lab.sections.needsIteration.length) },
      ],
      baselines: [],
      signals,
      components: winComps.slice(0, 12).map((c) => ({ code: c.code, type: c.type, name: c.name, keyMetric: c.keyMetric != null ? `${c.keyMetric}%` : null, keyDelta: c.keyDelta != null ? `${c.keyDelta > 0 ? '+' : ''}${c.keyDelta}pp` : null })),
      dataVolumeLow: conf.level === 'low',
    };
    return { context, scope: { productGroupId: input.productGroupId ?? null, adId: null, periodFrom: period.from ?? null, periodTo: period.to ?? null } };
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

  /** LLM-Call mit begrenztem Retry: nur bei transienten Fehlern (429/5xx/Timeout), nie bei Auth/Schema. */
  private async callLlm(provider: Provider, model: string, system: string, user: string): Promise<string> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
      try {
        return await this.callOnce(provider, model, system, user);
      } catch (e) {
        lastErr = e;
        if (e instanceof NonRetryableLlmError) throw e;
        if (attempt < MAX_LLM_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, attempt * 600)); // 600ms, 1200ms Backoff
          this.logger.warn(`LLM transient error (attempt ${attempt}/${MAX_LLM_ATTEMPTS}, provider=${provider}): ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('LLM-Call fehlgeschlagen');
  }

  private async callOnce(provider: Provider, model: string, system: string, user: string): Promise<string> {
    let res: Response;
    try {
      if (provider === 'openai') {
        res = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.openaiKey}` },
          body: JSON.stringify({ model, max_tokens: 2000, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
          signal: AbortSignal.timeout(AI_UI_TIMEOUT_MS),
        });
      } else {
        res = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.anthropicKey!, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
          signal: AbortSignal.timeout(AI_UI_TIMEOUT_MS),
        });
      }
    } catch (e) {
      // Netzwerk-/Timeout-Fehler = transient (retrybar)
      if (isTimeoutError(e)) throw new Error(`${provider} Timeout`);
      throw new Error(`${provider} Netzwerkfehler`);
    }
    if (!res.ok) {
      const detail = await this.readProviderError(res); // sichere Fehlerdetails (kein Secret)
      const label = `${provider} ${res.status}${detail ? ` [${detail}]` : ''} (model=${model})`;
      this.logger.warn(`LLM provider error: ${label}`);
      // Auth/ungültige Anfrage/Not-Found/Schema = nicht wiederholen; 429/5xx = transient
      if (res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404 || res.status === 422) {
        throw new NonRetryableLlmError(label);
      }
      throw new Error(label);
    }
    const data: any = await res.json();
    return provider === 'openai' ? (data.choices?.[0]?.message?.content ?? '') : (data.content?.[0]?.text ?? '');
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
      facts: r.facts ?? null, result: r.result ?? null, createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }
}

interface Scope { productGroupId: string | null; adId: string | null; periodFrom: string | null; periodTo: string | null }

function pct(v: number | null | undefined): string { return v == null ? '—' : `${round(v, 1)}%`; }
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
