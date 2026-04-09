import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiGenerateParams {
  language: string;
  useEmojis: boolean;
  productName?: string;
  productDescription?: string;
  keyBenefits?: string;
  usps?: string;
  pricePoint?: string;
  targetPersona?: string;
  painPoints?: string;
  desires?: string;
  awarenessLevel?: string;
  funnelStage?: string;
  competitorNames?: string;
  keyDifferentiators?: string;
  marketInsights?: string;
  adAngle?: string;
  emotionalTrigger?: string;
  tone?: string;
  headlineRequirements?: string;
  primaryTextRequirements?: string;
  linkDescriptionRequirements?: string;
  ctaRequirements?: string;
  headlineCount?: number;
  primaryTextCount?: number;
  linkDescriptionCount?: number;
  ctaCount?: number;
  bestPerformingHook?: string;
  topCompetitorAdCopy?: string;
}

export interface AiGenerateResult {
  headlines: string[];
  primaryTexts: string[];
  linkDescriptions: string[];
  ctas: string[];
  hooks: string[];
  angles: { name: string; description: string; emotion: string; example: string }[];
  aiModel: string;
  aiGenerated: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AiGeneratorService {
  private readonly apiKey: string | null;
  private readonly logger = new Logger(AiGeneratorService.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || null;
    if (this.apiKey) {
      this.logger.log('Anthropic API key configured — AI generation enabled');
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI generation disabled, using template engine fallback',
      );
    }
  }

  async generate(params: AiGenerateParams): Promise<AiGenerateResult | null> {
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — falling back to template engine');
      return null;
    }

    try {
      const systemPrompt = this.buildSystemPrompt(params);
      const userPrompt = this.buildUserPrompt(params);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        this.logger.error(
          `Claude API error: ${response.status} ${response.statusText} — ${errorBody}`,
        );
        return null;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      if (!text) {
        this.logger.error('Claude API returned empty content');
        return null;
      }

      return this.parseResponse(text, params);
    } catch (error) {
      this.logger.error('Claude API call failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // System Prompt — Performance Copywriter
  // -------------------------------------------------------------------------

  private buildSystemPrompt(params: AiGenerateParams): string {
    const isGerman = params.language === 'Deutsch';

    return `Du bist ein mehrfach ausgezeichneter Performance Copywriter & Creative Strategist, spezialisiert auf Conversion-optimierte Meta Ads fuer anspruchsvolle Maerkte.

Du erhaeltst jetzt eine vollstaendige Marktanalyse zu einem Produkt. Nutze diese Analyse, um die Pain Points, Wuensche, Sprache, Kaufausloeser und psychologischen Hebel der Zielgruppe tief zu verstehen.

Beruecksichtige dabei die Market Awareness und Market Sophistication Stufe fuer die optimale Ansprache der Zielgruppe.

Dein Ziel:
- Hohe Aufmerksamkeit im Feed generieren (Hook-orientiert denken)
- Emotionale Verbindung aufbauen (Empathie, Kundenverstaendnis)
- Klarer USP des Produkts herausstellen (Nutzen vor Funktion)
- Den Leser zur Aktion fuehren (starker CTA, passend zur Funnel-Stufe)
- Den Kunden klar machen, dass wir das Original sind und die einzig funktionierende Loesung

WICHTIGE REGELN:
- Schreibe die Texte so, dass sie von Meta als hochperformante Ad erkannt werden
- Klar, emotional, authentisch, CTA-getrieben
- Achte auf Werberichtlinien-Konformitaet (kein zu harter Health/Wealth-Claim)
- Sprache: ${isGerman ? 'Deutsch' : 'English'}
${params.useEmojis ? '- Verwende passende Emojis um den Text lebendiger zu machen' : '- Verwende KEINE Emojis'}

OUTPUT FORMAT:
Gib die Ergebnisse in folgendem JSON-Format zurueck:
{
  "headlines": ["headline1", "headline2", ...],
  "primaryTexts": ["text1", "text2", ...],
  "linkDescriptions": ["desc1", "desc2", ...],
  "ctas": ["cta1", "cta2", ...],
  "hooks": ["hook1", "hook2", ...],
  "angles": [{"name": "...", "description": "...", "emotion": "...", "example": "..."}]
}`;
  }

  // -------------------------------------------------------------------------
  // User Prompt — Structured Product & Market Data
  // -------------------------------------------------------------------------

  private buildUserPrompt(params: AiGenerateParams): string {
    let prompt = `PRODUKT & MARKTANALYSE:\n\n`;

    if (params.productName) prompt += `Produktname: ${params.productName}\n`;
    if (params.productDescription) prompt += `Produktbeschreibung: ${params.productDescription}\n`;
    if (params.keyBenefits) prompt += `Key Benefits: ${params.keyBenefits}\n`;
    if (params.usps) prompt += `USPs: ${params.usps}\n`;
    if (params.pricePoint) prompt += `Preis: ${params.pricePoint}\n`;

    prompt += `\nZIELGRUPPE:\n`;
    if (params.targetPersona) prompt += `Persona: ${params.targetPersona}\n`;
    if (params.painPoints) prompt += `Pain Points: ${params.painPoints}\n`;
    if (params.desires) prompt += `Wuensche/Ziele: ${params.desires}\n`;

    prompt += `\nMARKT-KONTEXT:\n`;
    if (params.awarenessLevel) prompt += `Market Awareness: ${params.awarenessLevel}\n`;
    if (params.funnelStage) prompt += `Funnel-Stufe: ${params.funnelStage}\n`;
    if (params.competitorNames) prompt += `Wettbewerber: ${params.competitorNames}\n`;
    if (params.keyDifferentiators) prompt += `Differenzierung: ${params.keyDifferentiators}\n`;
    if (params.marketInsights) prompt += `Markt-Insights: ${params.marketInsights}\n`;

    prompt += `\nCREATIVE DIRECTION:\n`;
    if (params.adAngle) prompt += `Ad-Angle/Framework: ${params.adAngle}\n`;
    if (params.emotionalTrigger) prompt += `Emotionaler Trigger: ${params.emotionalTrigger}\n`;
    if (params.tone) prompt += `Tonalitaet: ${params.tone}\n`;

    prompt += `\nANFORDERUNGEN:\n`;
    if (params.headlineRequirements) {
      prompt += `Headline-Anforderungen: ${params.headlineRequirements}\n`;
    }
    if (params.primaryTextRequirements) {
      prompt += `Primaertext-Anforderungen: ${params.primaryTextRequirements}\n`;
    }
    if (params.linkDescriptionRequirements) {
      prompt += `Linkbeschreibung-Anforderungen: ${params.linkDescriptionRequirements}\n`;
    }
    if (params.ctaRequirements) {
      prompt += `CTA-Anforderungen: ${params.ctaRequirements} (KEIN generisches "Klick hier" — zielgerichtet!)\n`;
    }

    if (params.bestPerformingHook) {
      prompt += `\nTop-Performer Hook (Referenz): ${params.bestPerformingHook}\n`;
    }
    if (params.topCompetitorAdCopy) {
      prompt += `Wettbewerber Ad-Copy (Referenz): ${params.topCompetitorAdCopy}\n`;
    }

    const hCount = params.headlineCount || 5;
    const pCount = params.primaryTextCount || 3;
    const lCount = params.linkDescriptionCount || 3;
    const cCount = params.ctaCount || 5;

    prompt += `\nERSTELLE:\n`;
    prompt += `- ${hCount} Headlines (Hook-orientiert, Aufmerksamkeit im Feed)\n`;
    prompt += `- ${pCount} Primaertexte (emotional, USP-fokussiert, CTA-getrieben)\n`;
    prompt += `- ${lCount} Linkbeschreibungen (kurz, neugierig machend)\n`;
    prompt += `- ${cCount} CTAs (zielgerichtet, NICHT generisch)\n`;
    prompt += `- 5 Hook-Varianten fuer den Einstieg\n`;
    prompt += `- 3 strategische Angles mit Beschreibung\n`;
    prompt += `\nAntworte NUR mit dem JSON-Objekt, kein anderer Text.`;

    return prompt;
  }

  // -------------------------------------------------------------------------
  // Parse Claude Response
  // -------------------------------------------------------------------------

  private parseResponse(text: string, _params: AiGenerateParams): AiGenerateResult {
    try {
      // Extract JSON from response (might be wrapped in markdown code block)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        headlines: Array.isArray(parsed.headlines) ? parsed.headlines : [],
        primaryTexts: Array.isArray(parsed.primaryTexts) ? parsed.primaryTexts : [],
        linkDescriptions: Array.isArray(parsed.linkDescriptions) ? parsed.linkDescriptions : [],
        ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
        hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
        angles: Array.isArray(parsed.angles)
          ? parsed.angles.map((a: any) => ({
              name: a.name || '',
              description: a.description || '',
              emotion: a.emotion || '',
              example: a.example || '',
            }))
          : [],
        aiModel: 'claude-sonnet-4-20250514',
        aiGenerated: true,
      };
    } catch (e) {
      this.logger.error(
        `Failed to parse Claude response: ${e instanceof Error ? e.message : e}`,
      );
      // Return the raw text as a single primary text so the user sees something
      return {
        headlines: [],
        primaryTexts: [text.slice(0, 2000)],
        linkDescriptions: [],
        ctas: [],
        hooks: [],
        angles: [],
        aiModel: 'claude-sonnet-4-20250514',
        aiGenerated: true,
      };
    }
  }
}
