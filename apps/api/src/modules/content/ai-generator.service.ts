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
  referenceTemplates?: Array<{ body: string; productName?: string }>;
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

type AiProvider = 'openai' | 'anthropic';

@Injectable()
export class AiGeneratorService {
  private readonly openaiKey: string | null;
  private readonly anthropicKey: string | null;
  private readonly provider: AiProvider;
  private readonly openaiModel: string;
  private readonly logger = new Logger(AiGeneratorService.name);

  constructor(private readonly config: ConfigService) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || null;
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY') || null;
    this.openaiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o';

    // Provider-Auswahl:
    //   1. CONTENT_AI_PROVIDER=openai|anthropic explizit → verwenden
    //   2. OpenAI-Key vorhanden → openai
    //   3. Anthropic-Key vorhanden → anthropic
    //   4. Nichts → null (Fallback auf Template Engine im Caller)
    const forced = (this.config.get<string>('CONTENT_AI_PROVIDER') || '').toLowerCase();
    if (forced === 'openai' || forced === 'anthropic') {
      this.provider = forced as AiProvider;
    } else if (this.openaiKey) {
      this.provider = 'openai';
    } else {
      this.provider = 'anthropic';
    }
    this.logger.log(`Content-AI provider: ${this.provider} (openai=${!!this.openaiKey}, anthropic=${!!this.anthropicKey}, model=${this.openaiModel})`);
  }

  async generate(params: AiGenerateParams): Promise<AiGenerateResult | null> {
    const systemPrompt = this.buildSystemPrompt(params);
    const userPrompt = this.buildUserPrompt(params);

    if (this.provider === 'openai') {
      if (!this.openaiKey) {
        this.logger.warn('OPENAI_API_KEY nicht gesetzt — Fallback auf Template Engine');
        return null;
      }
      return this.callOpenAI(systemPrompt, userPrompt, params);
    }
    if (!this.anthropicKey) {
      this.logger.warn('ANTHROPIC_API_KEY nicht gesetzt — Fallback auf Template Engine');
      return null;
    }
    return this.callAnthropic(systemPrompt, userPrompt, params);
  }

  /**
   * OpenAI Chat Completions API. JSON-Output erzwungen via response_format,
   * damit wir keinen Fenced-JSON-Parser brauchen. Fehler sauber abfangen und
   * null zurückgeben damit der Caller auf die Template Engine fallen kann.
   */
  private async callOpenAI(systemPrompt: string, userPrompt: string, params: AiGenerateParams): Promise<AiGenerateResult | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`,
        },
        body: JSON.stringify({
          model: this.openaiModel,
          max_tokens: 4000,
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        this.logger.error(`OpenAI ${response.status}: ${errorBody.slice(0, 400)}`);
        return null;
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) {
        this.logger.error('OpenAI returned empty content');
        return null;
      }
      return this.parseResponse(text, params);
    } catch (error) {
      this.logger.error('OpenAI call failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private async callAnthropic(systemPrompt: string, userPrompt: string, params: AiGenerateParams): Promise<AiGenerateResult | null> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicKey!,
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
        this.logger.error(`Claude API error: ${response.status} ${errorBody.slice(0, 400)}`);
        return null;
      }
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      if (!text) {
        this.logger.error('Claude returned empty content');
        return null;
      }
      return this.parseResponse(text, params);
    } catch (error) {
      this.logger.error('Claude call failed', error instanceof Error ? error.message : error);
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

    if (params.referenceTemplates && params.referenceTemplates.length > 0) {
      prompt += `\nERFOLGREICHE REFERENZ-TEXTE (analysiere WARUM diese funktionieren und leite Muster ab, NIEMALS 1:1 kopieren):\n`;
      params.referenceTemplates.forEach((t, i) => {
        prompt += `\nReferenz ${i + 1}: "${t.body}"\n`;
        if (t.productName) prompt += `Produkt: ${t.productName}\n`;
      });
      prompt += `\nAnalysiere die Referenzen: Was macht sie erfolgreich? Welche Hooks, Emotionen, Strukturen werden genutzt? Baue diese MUSTER (nicht die Worte) in deine neuen Texte ein.\n`;
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
        aiModel: this.provider === 'openai' ? this.openaiModel : 'claude-sonnet-4-20250514',
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
        aiModel: this.provider === 'openai' ? this.openaiModel : 'claude-sonnet-4-20250514',
        aiGenerated: true,
      };
    }
  }
}
