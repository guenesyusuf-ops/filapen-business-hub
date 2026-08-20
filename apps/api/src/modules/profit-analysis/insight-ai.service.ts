import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ebene C — AI Summary Layer (§34/§35).
 *
 * WICHTIG:
 *   - Formuliert bereits berechnete + validierte Insights sprachlich um
 *   - Berechnet NIEMALS neue Finanzwerte
 *   - Erfindet keine Zahlen (streng gepruefte Ausgabe)
 *   - Faellt still zurueck auf deterministische Titel/Messages wenn Anthropic
 *     nicht verfuegbar ist ODER wenn Zahlen im Output nicht validiert werden
 *
 * Nutzt den bereits vorhandenen Anthropic-Client aus apps/api/src/modules/ai
 * (ANTHROPIC_API_KEY env — kein neuer Provider).
 */

const SYSTEM_PROMPT = `Du bist ein Business-Intelligence-Assistent fuer den Filapen Business Hub.

Du erhaeltst ausschliesslich bereits berechnete und validierte Finanzkennzahlen.

Regeln:

1. Berechne keine neuen Finanzwerte, sofern diese nicht explizit im Input enthalten sind.
2. Erfinde keine Daten.
3. Veraendere keine Zahlen.
4. Priorisiere die wichtigsten wirtschaftlichen Erkenntnisse.
5. Formuliere kurz und verstaendlich auf Deutsch.
6. Maximal 1-2 Saetze pro Insight.
7. Unterscheide positive Entwicklung, Hinweis, Warnung und kritische Entwicklung.
8. Vermeide generische Aussagen.
9. Nenne konkrete Werte und Vergleichszeitraeume.
10. Gib keine Steuer- oder Anlageberatung.
11. Verwende keine dramatische Sprache.
12. Wenn die Daten fuer eine Aussage nicht ausreichen, gib sie nicht aus.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt der Form:
{
  "insights": [
    { "candidateId": "<id aus dem Input>", "title": "<neue Formulierung>", "message": "<neue Formulierung>" }
  ]
}

Verwende exakt die candidateId aus dem Input, erfinde keine neuen IDs.
Wenn du fuer einen Insight keine bessere Formulierung findest, lass ihn weg —
das System nutzt dann die deterministische Fallback-Version.`;

interface AiInputInsight {
  candidateId: string;
  type: string;
  severity: string;
  channel: string | null;
  metric: string | null;
  currentValue: number | null;
  comparisonValue: number | null;
  percentageChange: number | null;
  unit: string | null;
  deterministicTitle: string;
  deterministicMessage: string;
}

@Injectable()
export class PaInsightAiService {
  private readonly logger = new Logger(PaInsightAiService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — Insight AI Layer deaktiviert, deterministische Fallback-Texte werden verwendet.');
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Reformuliert die Top-N aktiven Insights einer Org.
   * Aufruf: nach jedem Insight-Refresh (Cron), aber nur alle N Stunden
   * pro Insight (via ai_generated_at cache).
   */
  async enhanceForOrg(orgId: string, maxInsights = 8): Promise<{ enhanced: number; skipped: number }> {
    if (!this.client) return { enhanced: 0, skipped: 0 };

    // Nur Insights die noch keinen AI-Text haben oder deren AI-Text alt ist (>6h)
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const insights = await this.prisma.paInsight.findMany({
      where: {
        orgId,
        status: { in: ['new', 'active'] },
        OR: [
          { aiGeneratedAt: null },
          { aiGeneratedAt: { lt: cutoff } },
        ],
      },
      orderBy: [{ priorityScore: 'desc' }, { detectedAt: 'desc' }],
      take: maxInsights,
    });
    if (insights.length === 0) return { enhanced: 0, skipped: 0 };

    // Streng gefilterten Input bauen (§10 nur aggregierte Finanz-Daten,
    // KEINE PII wie Kunden/Emails/Adressen)
    const input: AiInputInsight[] = insights.map((i) => ({
      candidateId: i.id,
      type: i.insightType,
      severity: i.severity,
      channel: i.channel,
      metric: i.metric,
      currentValue: i.currentValue !== null ? Number(i.currentValue) : null,
      comparisonValue: i.comparisonValue !== null ? Number(i.comparisonValue) : null,
      percentageChange: i.percentageChange !== null ? Number(i.percentageChange) : null,
      unit: i.unit,
      deterministicTitle: i.title,
      deterministicMessage: i.message,
    }));

    // Whitelist erlaubter Zahlen fuer den Halluzinations-Check
    const allowedNumbers = new Set<string>();
    for (const i of input) {
      for (const v of [i.currentValue, i.comparisonValue, i.percentageChange]) {
        if (v !== null && Number.isFinite(v)) {
          allowedNumbers.add(String(Math.round(Math.abs(v) * 100) / 100));
          allowedNumbers.add(String(Math.round(Math.abs(v))));
        }
      }
    }

    let response: any;
    try {
      response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ insights: input }, null, 2) }],
      });
    } catch (err: any) {
      this.logger.warn(`AI-Enhance fehlgeschlagen fuer Org ${orgId}: ${err?.message}`);
      return { enhanced: 0, skipped: insights.length };
    }

    const textBlocks = response.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n') ?? '';
    const parsed = this.extractJson(textBlocks);
    if (!parsed || !Array.isArray(parsed.insights)) {
      this.logger.warn('AI-Antwort nicht parsebar — behalte deterministische Texte.');
      return { enhanced: 0, skipped: insights.length };
    }

    let enhanced = 0, skipped = 0;
    for (const item of parsed.insights) {
      if (!item?.candidateId || typeof item.title !== 'string' || typeof item.message !== 'string') { skipped++; continue; }
      const insight = insights.find((i) => i.id === item.candidateId);
      if (!insight) { skipped++; continue; }

      // §35 Halluzinations-Check: neue Zahlen im Text muessen im Input existieren
      const combined = `${item.title} ${item.message}`;
      const numbers = combined.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
      const invalid = numbers.filter((num) => {
        const norm = num.replace('.', '').replace(',', '.');
        const asNum = Number(norm);
        if (!Number.isFinite(asNum)) return false;
        const key1 = String(Math.round(Math.abs(asNum) * 100) / 100);
        const key2 = String(Math.round(Math.abs(asNum)));
        return !allowedNumbers.has(key1) && !allowedNumbers.has(key2);
      });
      if (invalid.length > 0) {
        this.logger.warn(`AI erfand Zahlen (${invalid.join(', ')}) fuer Insight ${insight.id} — verwerfe.`);
        skipped++;
        continue;
      }

      await this.prisma.paInsight.update({
        where: { id: insight.id },
        data: {
          aiTitle: item.title.slice(0, 200),
          aiMessage: item.message.slice(0, 500),
          aiGeneratedAt: new Date(),
        },
      });
      enhanced++;
    }

    this.logger.log(`AI-Enhance Org ${orgId}: enhanced=${enhanced} skipped=${skipped}`);
    return { enhanced, skipped };
  }

  /** Findet ein JSON-Objekt in einem Text-Block (auch wenn Markdown drum ist). */
  private extractJson(text: string): any {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  }
}
