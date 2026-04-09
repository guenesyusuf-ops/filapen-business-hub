// ---------------------------------------------------------------------------
// prompt-engine.ts — Sophisticated content generation engine
// Produces genuinely good copy using proven copywriting frameworks
// No external AI API — pure template-based generation with deep patterns
// ---------------------------------------------------------------------------

import {
  HOOK_PATTERNS,
  CTA_PATTERNS,
  TRANSITIONS,
  SOCIAL_PROOF_BLOCKS,
  OBJECTION_HANDLERS,
  POWER_WORDS,
  TONE_MODIFIERS,
  ANGLE_DESCRIPTIONS,
  CUSTOMER_NAMES,
} from './copy-patterns';
import type { GenerateContentDto } from './content.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentContext {
  product: {
    name: string;
    description: string;
    benefits: string[];
    price: string;
    usps: string[];
  };
  audience: {
    persona: string;
    painPoints: string[];
    desires: string[];
    awarenessLevel: string;
    funnelStage: string;
  };
  competition: {
    competitors: string[];
    differentiators: string[];
  };
  creative: {
    angle: string;
    emotion: string;
    tone: string;
    ctaType: string;
    platform: string;
  };
  performance: {
    bestHook: string;
    competitorCopy: string;
    marketInsights: string;
  };
  language: string;
}

export interface GeneratedPiece {
  type: string;
  title: string;
  body: string;
  framework: string;
  platform: string;
  tone: string;
  wordCount: number;
  charCount: number;
}

export interface AngleSuggestion {
  name: string;
  description: string;
  emotion: string;
  bestFor: string;
  example: string;
}

export interface GenerationResult {
  items: GeneratedPiece[];
  angles: AngleSuggestion[];
  meta: {
    totalGenerated: number;
    frameworks: string[];
    language: string;
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

class Rand {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  pickN<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
  number(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// PromptEngine
// ---------------------------------------------------------------------------

export class PromptEngine {
  /**
   * Build a structured context from all user inputs.
   */
  static buildContext(input: GenerateContentDto): ContentContext {
    const splitClean = (v: string | undefined) =>
      (v || '').split(',').map(s => s.trim()).filter(Boolean);

    return {
      product: {
        name: input.product || 'Premium Product',
        description: input.productDescription || '',
        benefits: splitClean(input.keyBenefits),
        price: input.pricePoint || '',
        usps: splitClean(input.usps),
      },
      audience: {
        persona: input.audience || input.targetPersona || 'smart consumers',
        painPoints: splitClean(input.painPoints),
        desires: splitClean(input.desiresGoals),
        awarenessLevel: input.awarenessLevel || 'Problem Aware',
        funnelStage: input.funnelStage || 'TOFU',
      },
      competition: {
        competitors: splitClean(input.competitorNames),
        differentiators: splitClean(input.keyDifferentiators),
      },
      creative: {
        angle: input.angle || 'AIDA',
        emotion: input.emotionalTrigger || 'Desire',
        tone: input.tone || 'Professional',
        ctaType: input.ctaType || 'Learn More',
        platform: 'universal',
      },
      performance: {
        bestHook: input.bestPerformingHook || '',
        competitorCopy: input.topCompetitorAdCopy || '',
        marketInsights: input.marketInsights || '',
      },
      language: input.language || 'English',
    };
  }

  /**
   * Generate all content based on context and type.
   */
  static generateAll(ctx: ContentContext, type: string, count: number): GenerationResult {
    const rand = new Rand(Date.now());
    const isDE = ctx.language === 'Deutsch';
    const lang = isDE ? 'de' : 'en';

    let items: GeneratedPiece[];
    switch (type) {
      case 'headline':
        items = this.generateHeadlines(ctx, count, rand, lang);
        break;
      case 'primary_text':
        items = this.generatePrimaryTexts(ctx, count, rand, lang);
        break;
      case 'ugc_script':
        items = this.generateUGCScripts(ctx, count, rand, lang);
        break;
      case 'hook':
        items = this.generateHooks(ctx, count, rand, lang);
        break;
      case 'cta':
        items = this.generateCTAs(ctx, count, rand, lang);
        break;
      case 'video_concept':
        items = this.generateShortFormScripts(ctx, count, rand, lang);
        break;
      case 'social_caption':
        items = this.generateCaptions(ctx, count, rand, lang);
        break;
      default:
        items = this.generateHeadlines(ctx, count, rand, lang);
    }

    const angles = (isDE ? ANGLE_DESCRIPTIONS.de : ANGLE_DESCRIPTIONS.en).map(a => ({
      name: a.name,
      description: a.description,
      emotion: a.emotion,
      bestFor: a.bestFor,
      example: this.fillPlaceholders(a.example, ctx, rand, lang),
    }));

    const frameworks = [...new Set(items.map(i => i.framework))];

    return {
      items,
      angles,
      meta: {
        totalGenerated: items.length,
        frameworks,
        language: ctx.language,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Headlines
  // -------------------------------------------------------------------------

  private static generateHeadlines(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const hooks = HOOK_PATTERNS[lang as 'en' | 'de'];
    const categories = Object.keys(hooks) as (keyof typeof hooks)[];
    const results: GeneratedPiece[] = [];

    const frameworkLabels: Record<string, string> = {
      pattern_interrupt: 'Pattern Interrupt',
      question: 'Question Hook',
      statistic: 'Statistic Hook',
      curiosity_gap: 'Curiosity Gap',
      social_proof: 'Social Proof',
      urgency_scarcity: 'Urgency/Scarcity',
      benefit_led: 'Benefit-Led',
      pain_point: 'Pain Point',
      transformation: 'Transformation',
      authority: 'Authority',
    };

    for (let i = 0; i < Math.min(count, 10); i++) {
      const catKey = categories[i % categories.length];
      const templates = hooks[catKey] as string[];
      const template = rand.pick(templates);
      const filled = this.fillPlaceholders(template, ctx, rand, lang);

      results.push({
        type: 'headline',
        title: `${lang === 'de' ? 'Headline' : 'Headline'} ${i + 1} (${frameworkLabels[catKey] || catKey})`,
        body: filled,
        framework: catKey,
        platform: ctx.creative.platform,
        tone: ctx.creative.tone,
        wordCount: wordCount(filled),
        charCount: filled.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Primary Texts (AIDA, PAS, BAB, Story, 4P)
  // -------------------------------------------------------------------------

  private static generatePrimaryTexts(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const isDE = lang === 'de';
    const results: GeneratedPiece[] = [];
    const frameworks = ['AIDA', 'PAS', 'BAB', 'Story', '4P'];

    for (let i = 0; i < Math.min(count, 5); i++) {
      const fw = frameworks[i % frameworks.length];
      let body: string;

      switch (fw) {
        case 'AIDA':
          body = this.buildAIDA(ctx, rand, lang);
          break;
        case 'PAS':
          body = this.buildPAS(ctx, rand, lang);
          break;
        case 'BAB':
          body = this.buildBAB(ctx, rand, lang);
          break;
        case 'Story':
          body = this.buildStory(ctx, rand, lang);
          break;
        case '4P':
          body = this.build4P(ctx, rand, lang);
          break;
        default:
          body = this.buildAIDA(ctx, rand, lang);
      }

      const title = isDE
        ? `Primärtext ${i + 1} (${fw} Framework)`
        : `Primary Text ${i + 1} (${fw} Framework)`;

      results.push({
        type: 'primary_text',
        title,
        body,
        framework: fw,
        platform: ctx.creative.platform,
        tone: ctx.creative.tone,
        wordCount: wordCount(body),
        charCount: body.length,
      });
    }

    return results;
  }

  private static buildAIDA(ctx: ContentContext, rand: Rand, lang: string): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;
    const hook = this.getHook(ctx, rand, lang, 'benefit_led');
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'dein Leben einfacher macht' : 'makes your life easier');
    const benefit2 = p.benefits.length > 1 ? p.benefits.find(b => b !== benefit) || benefit : benefit;
    const desire = a.desires.length > 0 ? rand.pick(a.desires) : (isDE ? 'die besten Ergebnisse' : 'the best results');
    const proof = this.getSocialProof(ctx, rand, lang);
    const cta = this.getCTA(ctx, rand, lang, 'benefit');
    const intensifier = this.getIntensifier(ctx, rand, lang);

    if (isDE) {
      return [
        `${hook}`,
        ``,
        `Stell dir vor: ${desire}. Klingt zu gut, um wahr zu sein? Nicht mit ${p.name}. Unser Produkt ${benefit} — und das ist erst der Anfang.`,
        ``,
        `Was ${p.name} ${intensifier} besonders macht: Es ${benefit2}. ${p.usps.length > 0 ? p.usps[0] + '.' : ''} Das ist der Unterschied, den ${a.persona} sofort spüren.`,
        ``,
        `${proof}`,
        ``,
        `${cta}`,
      ].join('\n');
    }

    return [
      `${hook}`,
      ``,
      `Imagine this: ${desire}. Sounds too good to be true? Not with ${p.name}. It ${benefit} — and that's just the beginning.`,
      ``,
      `What makes ${p.name} ${intensifier} different: it ${benefit2}. ${p.usps.length > 0 ? p.usps[0] + '.' : ''} That's the difference ${a.persona} feel from day one.`,
      ``,
      `${proof}`,
      ``,
      `${cta}`,
    ].join('\n');
  }

  private static buildPAS(ctx: ContentContext, rand: Rand, lang: string): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;
    const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'frustrierende Ergebnisse' : 'frustrating results');
    const painPoint2 = a.painPoints.length > 1 ? a.painPoints.find(pp => pp !== painPoint) || painPoint : painPoint;
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'echte Ergebnisse liefert' : 'delivers real results');
    const transition = rand.pick(TRANSITIONS[isDE ? 'de' : 'en'].problem_to_solution);
    const proof = this.getSocialProof(ctx, rand, lang);
    const cta = this.getCTA(ctx, rand, lang, 'urgency');
    const objection = rand.pick(OBJECTION_HANDLERS[isDE ? 'de' : 'en'].skepticism);

    if (isDE) {
      return [
        `Genug von ${painPoint}?`,
        ``,
        `Wir verstehen das. Du hast alles versucht. Du hast Geld ausgegeben für Produkte, die Wunder versprochen, aber nichts geliefert haben. ${painPoint2} — das kennen wir nur zu gut. Und ehrlich gesagt? Es ist frustrierend. Du verdienst Besseres.`,
        ``,
        `${transition} ${p.name}.`,
        ``,
        `${p.name} ${benefit}. ${p.usps.length > 0 ? 'Warum? Weil ' + p.usps[0] + '.' : ''} ${p.description ? p.description : ''}`,
        ``,
        `${this.fillPlaceholders(objection, ctx, rand, lang)}`,
        ``,
        `${proof}`,
        ``,
        `${cta}`,
      ].join('\n');
    }

    return [
      `Tired of ${painPoint}?`,
      ``,
      `We get it. You've tried everything. You've spent money on products that promised the world and delivered nothing. ${painPoint2} — we've been there too. And honestly? It's exhausting. You deserve better.`,
      ``,
      `${transition} ${p.name}.`,
      ``,
      `${p.name} ${benefit}. ${p.usps.length > 0 ? 'Why? Because ' + p.usps[0] + '.' : ''} ${p.description ? p.description : ''}`,
      ``,
      `${this.fillPlaceholders(objection, ctx, rand, lang)}`,
      ``,
      `${proof}`,
      ``,
      `${cta}`,
    ].join('\n');
  }

  private static buildBAB(ctx: ContentContext, rand: Rand, lang: string): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;
    const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'unzufrieden mit den Ergebnissen' : 'unhappy with results');
    const desire = a.desires.length > 0 ? rand.pick(a.desires) : (isDE ? 'strahlende Ergebnisse' : 'amazing results');
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'den Unterschied macht' : 'makes the difference');
    const proof = this.getSocialProof(ctx, rand, lang);
    const cta = this.getCTA(ctx, rand, lang, 'benefit');

    if (isDE) {
      return [
        `VORHER: ${painPoint}. Jeder Tag fühlt sich gleich an. Du versuchst alles, aber nichts scheint wirklich zu funktionieren. Du fragst dich, ob es jemals besser wird.`,
        ``,
        `NACHHER: Stell dir vor, ${desire}. Du schaust in den Spiegel und siehst den Unterschied. Andere bemerken es auch. Du fühlst dich endlich so, wie du es verdienst.`,
        ``,
        `DIE BRÜCKE: ${p.name}. ${p.description ? p.description + ' ' : ''}Es ${benefit}. ${p.usps.length > 0 ? p.usps.join('. ') + '.' : ''}`,
        ``,
        `${proof}`,
        ``,
        `${cta}`,
      ].join('\n');
    }

    return [
      `BEFORE: ${painPoint}. Every day feels the same. You try everything, but nothing truly works. You wonder if it will ever get better.`,
      ``,
      `AFTER: Imagine ${desire}. You look in the mirror and see the difference. Others notice too. You finally feel the way you deserve.`,
      ``,
      `THE BRIDGE: ${p.name}. ${p.description ? p.description + ' ' : ''}It ${benefit}. ${p.usps.length > 0 ? p.usps.join('. ') + '.' : ''}`,
      ``,
      `${proof}`,
      ``,
      `${cta}`,
    ].join('\n');
  }

  private static buildStory(ctx: ContentContext, rand: Rand, lang: string): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;
    const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'nichts funktionierte' : 'nothing worked');
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'endlich Ergebnisse sah' : 'finally saw results');
    const connector = rand.pick(TRANSITIONS[isDE ? 'de' : 'en'].story_connectors);
    const name = rand.pick(CUSTOMER_NAMES[isDE ? 'de' : 'en']);
    const cta = this.getCTA(ctx, rand, lang, 'social_proof');
    const time = rand.pick(['2 weeks', '3 weeks', '30 days', '10 days']);
    const timeDe = rand.pick(['2 Wochen', '3 Wochen', '30 Tagen', '10 Tagen']);

    if (isDE) {
      return [
        `"Ich war so skeptisch. Wirklich."`,
        ``,
        `${name} hatte alles versucht. Jedes Produkt, jeder Trend, jede Empfehlung. ${painPoint} — das war ihre Realität. Jeden. Einzelnen. Tag.`,
        ``,
        `${connector}`,
        ``,
        `Eine Freundin erwähnte ${p.name} beiläufig beim Kaffee. Kein großes Versprechen, kein Hype — einfach nur: "Probier es."`,
        ``,
        `Tag 1: Skeptisch. Tag 7: Neugierig. Nach ${timeDe}? "${p.name} ${benefit}. Ich kann es selbst kaum glauben."`,
        ``,
        `Heute ist ${name} eine von tausenden, die ihre Routine mit ${p.name} verändert haben. ${p.usps.length > 0 ? p.usps[0] + '.' : ''}`,
        ``,
        `${cta}`,
      ].join('\n');
    }

    return [
      `"I was so skeptical. Like, really skeptical."`,
      ``,
      `${name} had tried everything. Every product, every trend, every recommendation. ${painPoint} — that was her reality. Every. Single. Day.`,
      ``,
      `${connector}`,
      ``,
      `A friend mentioned ${p.name} casually over coffee. No big pitch, no hype — just: "Try it."`,
      ``,
      `Day 1: Skeptical. Day 7: Curious. After ${time}? "${p.name} ${benefit}. I can barely believe it myself."`,
      ``,
      `Today, ${name} is one of thousands who have transformed their routine with ${p.name}. ${p.usps.length > 0 ? p.usps[0] + '.' : ''}`,
      ``,
      `${cta}`,
    ].join('\n');
  }

  private static build4P(ctx: ContentContext, rand: Rand, lang: string): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'sichtbare Ergebnisse' : 'visible results');
    const benefit2 = p.benefits.length > 1 ? p.benefits.find(b => b !== benefit) || benefit : benefit;
    const desire = a.desires.length > 0 ? rand.pick(a.desires) : (isDE ? 'sich großartig zu fühlen' : 'feeling amazing');
    const proof = this.getSocialProof(ctx, rand, lang);
    const cta = this.getCTA(ctx, rand, lang, 'urgency');
    const intensifier = this.getIntensifier(ctx, rand, lang);

    if (isDE) {
      return [
        `VERSPRECHEN: ${p.name} ${benefit}. Das ist kein leeres Marketing — das ist ein Versprechen, das wir jeden Tag einlösen.`,
        ``,
        `BILD: Stell dir das vor — ${desire}. Du greifst morgens zu ${p.name} und weißt: heute wird ein guter Tag. ${benefit2}. Und du merkst: das Warten hat sich gelohnt.`,
        ``,
        `BEWEIS: ${proof} ${p.usps.length > 0 ? 'Was uns ' + intensifier + ' unterscheidet: ' + p.usps.join(', ') + '.' : ''}`,
        ``,
        `PUSH: Du hast die Bewertungen gelesen. Du hast die Ergebnisse gesehen. Die einzige Frage ist: Wie lange willst du noch warten?`,
        ``,
        `${cta}`,
      ].join('\n');
    }

    return [
      `PROMISE: ${p.name} ${benefit}. This isn't empty marketing — it's a promise we deliver on every single day.`,
      ``,
      `PICTURE: Imagine this — ${desire}. You reach for ${p.name} every morning knowing today is going to be a good day. ${benefit2}. And you realize: the wait was worth it.`,
      ``,
      `PROOF: ${proof} ${p.usps.length > 0 ? 'What makes us ' + intensifier + ' different: ' + p.usps.join(', ') + '.' : ''}`,
      ``,
      `PUSH: You've read the reviews. You've seen the results. The only question is: how much longer are you going to wait?`,
      ``,
      `${cta}`,
    ].join('\n');
  }

  // -------------------------------------------------------------------------
  // UGC Scripts
  // -------------------------------------------------------------------------

  private static generateUGCScripts(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const isDE = lang === 'de';
    const results: GeneratedPiece[] = [];
    const p = ctx.product;
    const a = ctx.audience;

    const structures = isDE ? [
      { name: 'Skeptiker-zu-Gläubiger', framework: 'Story' },
      { name: 'Routine-Enthüllung', framework: 'AIDA' },
      { name: 'Ehrlicher Review', framework: 'PAS' },
    ] : [
      { name: 'Skeptic-to-Believer', framework: 'Story' },
      { name: 'Routine Reveal', framework: 'AIDA' },
      { name: 'Honest Review', framework: 'PAS' },
    ];

    for (let i = 0; i < Math.min(count, 3); i++) {
      const struct = structures[i % structures.length];
      const hook = this.getHook(ctx, rand, lang, 'pattern_interrupt');
      const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'nichts hat funktioniert' : 'nothing worked');
      const benefit1 = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'sofort Ergebnisse sehen' : 'see results instantly');
      const benefit2 = p.benefits.length > 1 ? p.benefits.find(b => b !== benefit1) || benefit1 : benefit1;
      const cta = this.getCTA(ctx, rand, lang, 'benefit');
      const proofName = rand.pick(CUSTOMER_NAMES[isDE ? 'de' : 'en']);

      let script: string;
      if (i === 0) {
        // Skeptic to Believer
        script = isDE ? [
          `[HOOK - 0-3s]`,
          `[TALKING HEAD, direkt in die Kamera]`,
          `"${hook}"`,
          ``,
          `[PROBLEM - 3-8s]`,
          `[B-ROLL: Frustriert auf alte Produkte schauen]`,
          `"Ich war SO skeptisch. Ich hatte alles probiert — buchstäblich alles. ${painPoint}. Ich war kurz davor aufzugeben."`,
          ``,
          `[PRODUKT-INTRO - 8-14s]`,
          `[VISUAL: Produkt auspacken, Nahaufnahme]`,
          `"Dann hat mir eine Freundin ${p.name} empfohlen und ich dachte... okay, ein letzter Versuch."`,
          ``,
          `[VORTEILE - 14-22s]`,
          `[B-ROLL: Produkt in Anwendung zeigen]`,
          `"Erstens: ${benefit1}. Zweitens: ${benefit2}. ${p.usps.length > 0 ? 'Und es ' + p.usps[0] + '.' : ''}"`,
          ``,
          `[SOCIAL PROOF - 22-26s]`,
          `[TALKING HEAD, ehrlich und begeistert]`,
          `"Meine beste Freundin hat es nach mir bestellt. Ihre Mutter danach. Kein Witz."`,
          ``,
          `[CTA - 26-30s]`,
          `[TEXT-OVERLAY mit Link]`,
          `"${cta}"`,
        ].join('\n') : [
          `[HOOK - 0-3s]`,
          `[TALKING HEAD, direct to camera]`,
          `"${hook}"`,
          ``,
          `[PROBLEM - 3-8s]`,
          `[B-ROLL: Looking frustrated at old products]`,
          `"I was SO skeptical. I'd tried everything — literally everything. ${painPoint}. I was this close to giving up."`,
          ``,
          `[PRODUCT INTRO - 8-14s]`,
          `[VISUAL: Unboxing product, close-up shots]`,
          `"Then a friend recommended ${p.name} and I thought... okay, one last try."`,
          ``,
          `[KEY BENEFITS - 14-22s]`,
          `[B-ROLL: Show product in use]`,
          `"First: ${benefit1}. Second: ${benefit2}. ${p.usps.length > 0 ? 'And it ' + p.usps[0] + '.' : ''}"`,
          ``,
          `[SOCIAL PROOF - 22-26s]`,
          `[TALKING HEAD, genuine excitement]`,
          `"My best friend ordered it after seeing mine. Her mom ordered it after that. Not kidding."`,
          ``,
          `[CTA - 26-30s]`,
          `[TEXT OVERLAY with link]`,
          `"${cta}"`,
        ].join('\n');
      } else if (i === 1) {
        // Routine Reveal
        script = isDE ? [
          `[HOOK - 0-3s]`,
          `[POV-Shot: Morgenroutine, natürliches Licht]`,
          `"Meine Morgenroutine hat sich komplett verändert, seit ich ${p.name} benutze."`,
          ``,
          `[AUFBAU - 3-10s]`,
          `[B-ROLL: Badezimmer-Routine, ästhetisch]`,
          `"Früher war meine Routine chaotisch — ${painPoint}. Jetzt? Simpel und effektiv."`,
          ``,
          `[PRODUKT-DEMO - 10-20s]`,
          `[VISUAL: Produktanwendung Schritt für Schritt]`,
          `"Schritt 1: [Anwendung zeigen]. Das Geheimnis? ${benefit1}."`,
          `"Schritt 2: [Nächsten Schritt zeigen]. Du merkst sofort, dass ${benefit2}."`,
          `${p.usps.length > 0 ? '"Und das Beste: ' + p.usps[0] + '."' : ''}`,
          ``,
          `[ERGEBNIS - 20-26s]`,
          `[TALKING HEAD, zufriedenes Lächeln]`,
          `"Es ist jetzt ${rand.pick(['4 Wochen', '2 Monate', '6 Wochen'])} her und ich werde nie wieder wechseln."`,
          ``,
          `[CTA - 26-30s]`,
          `[TEXT-OVERLAY mit Link]`,
          `"${cta}"`,
        ].join('\n') : [
          `[HOOK - 0-3s]`,
          `[POV shot: Morning routine, natural light]`,
          `"My morning routine completely changed since I started using ${p.name}."`,
          ``,
          `[BUILD-UP - 3-10s]`,
          `[B-ROLL: Bathroom routine, aesthetic shots]`,
          `"My routine used to be chaos — ${painPoint}. Now? Simple and effective."`,
          ``,
          `[PRODUCT DEMO - 10-20s]`,
          `[VISUAL: Step-by-step product application]`,
          `"Step 1: [show application]. The secret? ${benefit1}."`,
          `"Step 2: [show next step]. You'll notice right away that ${benefit2}."`,
          `${p.usps.length > 0 ? '"And the best part: ' + p.usps[0] + '."' : ''}`,
          ``,
          `[RESULT - 20-26s]`,
          `[TALKING HEAD, satisfied smile]`,
          `"It's been ${rand.pick(['4 weeks', '2 months', '6 weeks'])} and I'm never going back."`,
          ``,
          `[CTA - 26-30s]`,
          `[TEXT OVERLAY with link]`,
          `"${cta}"`,
        ].join('\n');
      } else {
        // Honest Review
        script = isDE ? [
          `[HOOK - 0-3s]`,
          `[TALKING HEAD, ernst und ehrlich]`,
          `"Okay, ehrlicher Review — ${p.name}. Kein Sponsoring, kein Filter."`,
          ``,
          `[KONTEXT - 3-10s]`,
          `[B-ROLL: Produkt auf dem Tisch, Verpackung]`,
          `"Ich habe dieses Produkt mit meinem eigenen Geld gekauft, weil ${painPoint} und ich verzweifelt war."`,
          ``,
          `[PROS - 10-18s]`,
          `[VISUAL: Produkt zeigen, Nahaufnahmen]`,
          `"Was ich LIEBE: ${benefit1}. Und ${benefit2}. ${p.usps.length > 0 ? 'Außerdem ' + p.usps[0] + '.' : ''}"`,
          ``,
          `[EHRLICHKEIT - 18-23s]`,
          `[TALKING HEAD]`,
          `"Was ich mir wünschen würde: ${rand.pick(isDE ? ['schnellere Lieferung', 'größere Packung', 'mehr Farbauswahl'] : ['faster shipping', 'bigger size option', 'more shade range'])}. Aber das sind Kleinigkeiten."`,
          ``,
          `[URTEIL - 23-28s]`,
          `[Daumen hoch, überzeugt]`,
          `"Gesamturteil: ${rand.pick(['9/10', '8.5/10', '10/10'])}. Werde auf jeden Fall nachbestellen."`,
          ``,
          `[CTA - 28-30s]`,
          `[TEXT-OVERLAY]`,
          `"${cta}"`,
        ].join('\n') : [
          `[HOOK - 0-3s]`,
          `[TALKING HEAD, serious and honest]`,
          `"Okay, honest review time — ${p.name}. No sponsorship, no filter."`,
          ``,
          `[CONTEXT - 3-10s]`,
          `[B-ROLL: Product on table, packaging]`,
          `"I bought this with my own money because ${painPoint} and I was desperate."`,
          ``,
          `[PROS - 10-18s]`,
          `[VISUAL: Show product, close-ups]`,
          `"What I LOVE: ${benefit1}. And ${benefit2}. ${p.usps.length > 0 ? 'Plus, ' + p.usps[0] + '.' : ''}"`,
          ``,
          `[HONESTY - 18-23s]`,
          `[TALKING HEAD]`,
          `"What I wish was better: ${rand.pick(['faster shipping', 'bigger size option', 'more shade range'])}. But these are minor."`,
          ``,
          `[VERDICT - 23-28s]`,
          `[Thumbs up, convinced]`,
          `"Overall verdict: ${rand.pick(['9/10', '8.5/10', '10/10'])}. Will definitely repurchase."`,
          ``,
          `[CTA - 28-30s]`,
          `[TEXT OVERLAY]`,
          `"${cta}"`,
        ].join('\n');
      }

      results.push({
        type: 'ugc_script',
        title: isDE ? `UGC-Skript ${i + 1} (${struct.name})` : `UGC Script ${i + 1} (${struct.name})`,
        body: script,
        framework: struct.framework,
        platform: 'tiktok',
        tone: ctx.creative.tone,
        wordCount: wordCount(script),
        charCount: script.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  private static generateHooks(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const hooks = HOOK_PATTERNS[lang as 'en' | 'de'];
    const categories = Object.keys(hooks) as (keyof typeof hooks)[];
    const results: GeneratedPiece[] = [];
    const isDE = lang === 'de';

    for (let i = 0; i < Math.min(count, 10); i++) {
      const catKey = categories[i % categories.length];
      const templates = hooks[catKey] as string[];
      const template = rand.pick(templates);
      const filled = this.fillPlaceholders(template, ctx, rand, lang);

      results.push({
        type: 'hook',
        title: isDE ? `Hook ${i + 1} (${catKey.replace(/_/g, ' ')})` : `Hook ${i + 1} (${catKey.replace(/_/g, ' ')})`,
        body: filled,
        framework: catKey,
        platform: ctx.creative.platform,
        tone: ctx.creative.tone,
        wordCount: wordCount(filled),
        charCount: filled.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // CTAs
  // -------------------------------------------------------------------------

  private static generateCTAs(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const ctas = CTA_PATTERNS[lang as 'en' | 'de'];
    const categories = Object.keys(ctas) as (keyof typeof ctas)[];
    const results: GeneratedPiece[] = [];
    const isDE = lang === 'de';

    for (let i = 0; i < Math.min(count, 8); i++) {
      const catKey = categories[i % categories.length];
      const templates = ctas[catKey] as string[];
      const template = rand.pick(templates);
      const filled = this.fillPlaceholders(template, ctx, rand, lang);

      results.push({
        type: 'cta',
        title: isDE ? `CTA ${i + 1} (${catKey.replace(/_/g, ' ')})` : `CTA ${i + 1} (${catKey.replace(/_/g, ' ')})`,
        body: filled,
        framework: catKey,
        platform: ctx.creative.platform,
        tone: ctx.creative.tone,
        wordCount: wordCount(filled),
        charCount: filled.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Short-form (TikTok/Reels) Scripts
  // -------------------------------------------------------------------------

  private static generateShortFormScripts(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const isDE = lang === 'de';
    const results: GeneratedPiece[] = [];
    const p = ctx.product;
    const a = ctx.audience;

    const durations = isDE
      ? [
          { label: '15-Sekunden-Script', seconds: 15 },
          { label: '30-Sekunden-Script', seconds: 30 },
          { label: '60-Sekunden-Script', seconds: 60 },
          { label: 'Trend-basierter Hook', seconds: 15 },
          { label: 'Pattern-Interrupt', seconds: 30 },
        ]
      : [
          { label: '15-Second Script', seconds: 15 },
          { label: '30-Second Script', seconds: 30 },
          { label: '60-Second Script', seconds: 60 },
          { label: 'Trend-Based Hook', seconds: 15 },
          { label: 'Pattern Interrupt', seconds: 30 },
        ];

    const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'das gleiche alte Problem' : 'the same old problem');
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'dein Leben verändert' : 'changes your life');
    const benefit2 = p.benefits.length > 1 ? p.benefits.find(b => b !== benefit) || benefit : benefit;
    const cta = this.getCTA(ctx, rand, lang, 'command');

    for (let i = 0; i < Math.min(count, 5); i++) {
      const dur = durations[i % durations.length];
      let script: string;

      if (dur.seconds === 15) {
        script = isDE ? [
          `[0-2s] HOOK: "Das Produkt, über das gerade ALLE reden."`,
          `[2-5s] [VISUAL: Produkt-Reveal, dramatisch]`,
          `[5-10s] "${p.name} ${benefit}."`,
          `[10-13s] [B-ROLL: Schnelle Ergebnis-Montage]`,
          `[13-15s] TEXT-OVERLAY: "${cta}"`,
        ].join('\n') : [
          `[0-2s] HOOK: "The product EVERYONE is talking about right now."`,
          `[2-5s] [VISUAL: Dramatic product reveal]`,
          `[5-10s] "${p.name} ${benefit}."`,
          `[10-13s] [B-ROLL: Quick results montage]`,
          `[13-15s] TEXT OVERLAY: "${cta}"`,
        ].join('\n');
      } else if (dur.seconds === 30 && i !== 4) {
        script = isDE ? [
          `[0-3s] HOOK: "Hört auf zu scrollen — das müsst ihr sehen."`,
          `[3-8s] PROBLEM: "${painPoint}? Das war mein Leben. Jeden Tag."`,
          `[8-15s] LÖSUNG: "Dann habe ich ${p.name} entdeckt. [Zeig das Produkt]"`,
          `[15-22s] BEWEIS: "Es ${benefit}. UND ${benefit2}."`,
          `[22-27s] [B-ROLL: Vorher/Nachher oder Anwendung]`,
          `[27-30s] CTA: "${cta}"`,
        ].join('\n') : [
          `[0-3s] HOOK: "Stop scrolling — you need to see this."`,
          `[3-8s] PROBLEM: "${painPoint}? That was my life. Every single day."`,
          `[8-15s] SOLUTION: "Then I found ${p.name}. [Show product]"`,
          `[15-22s] PROOF: "It ${benefit}. AND ${benefit2}."`,
          `[22-27s] [B-ROLL: Before/after or application]`,
          `[27-30s] CTA: "${cta}"`,
        ].join('\n');
      } else if (dur.seconds === 60) {
        script = isDE ? [
          `[0-3s] HOOK: "POV: Du hast endlich DAS Produkt gefunden."`,
          `[3-10s] STORY: "Vor 3 Monaten war ich am Punkt, dass ${painPoint}. Ich hatte buchstäblich alles probiert."`,
          `[10-15s] WENDEPUNKT: "Dann hat mir jemand ${p.name} empfohlen. Keine große Sache — einfach probieren."`,
          `[15-25s] DEMO: [Produkt in Anwendung zeigen]`,
          `"Was mich überzeugt hat: ${benefit}."`,
          `"Außerdem ${benefit2}."`,
          `${p.usps.length > 0 ? '"Und: ' + p.usps[0] + '."' : ''}`,
          `[25-35s] ERGEBNISSE: "Nach einer Woche — Unterschied. Nach einem Monat — Game Over für alles andere."`,
          `[B-ROLL: Ergebnisse zeigen, Nahaufnahmen]`,
          `[35-45s] SOCIAL PROOF: "Meine Schwester hat es bestellt. Meine Kollegin. Sogar meine Mutter."`,
          `[45-55s] EHRLICHER MOMENT: "Das Einzige, was ich bereue? Dass ich es nicht früher gefunden habe."`,
          `[55-60s] CTA: [Zum Kamera lächeln] "${cta}"`,
          `[TEXT-OVERLAY mit Link]`,
        ].join('\n') : [
          `[0-3s] HOOK: "POV: You finally found THAT product."`,
          `[3-10s] STORY: "3 months ago, I was at the point where ${painPoint}. I'd literally tried everything."`,
          `[10-15s] TURNING POINT: "Then someone recommended ${p.name}. No big deal — just try it."`,
          `[15-25s] DEMO: [Show product in use]`,
          `"What convinced me: ${benefit}."`,
          `"Plus, ${benefit2}."`,
          `${p.usps.length > 0 ? '"And: ' + p.usps[0] + '."' : ''}`,
          `[25-35s] RESULTS: "After one week — noticeable. After one month — game over for everything else."`,
          `[B-ROLL: Show results, close-ups]`,
          `[35-45s] SOCIAL PROOF: "My sister ordered it. My coworker. Even my mom."`,
          `[45-55s] HONEST MOMENT: "The only thing I regret? Not finding it sooner."`,
          `[55-60s] CTA: [Smile to camera] "${cta}"`,
          `[TEXT OVERLAY with link]`,
        ].join('\n');
      } else {
        // Pattern Interrupt (i === 4)
        script = isDE ? [
          `[0-2s] [SCHNELLER TEXT-OVERLAY] "WARTE."`,
          `[2-5s] "Wenn du immer noch ${painPoint}..."`,
          `[5-8s] "...musst du dir das hier anschauen."`,
          `[8-12s] [DRAMATISCHER PRODUKT-REVEAL]`,
          `"${p.name}."`,
          `[12-20s] [SCHNELLE SCHNITTE: Anwendung + Ergebnisse]`,
          `"${benefit}."`,
          `"${benefit2}."`,
          `[20-27s] "Ich sage nicht, dass es perfekt ist. Ich sage, es ist das Beste, was ich je probiert habe."`,
          `[27-30s] CTA: "${cta}"`,
        ].join('\n') : [
          `[0-2s] [QUICK TEXT OVERLAY] "WAIT."`,
          `[2-5s] "If you're still dealing with ${painPoint}..."`,
          `[5-8s] "...you need to watch this."`,
          `[8-12s] [DRAMATIC PRODUCT REVEAL]`,
          `"${p.name}."`,
          `[12-20s] [QUICK CUTS: Application + results]`,
          `"${benefit}."`,
          `"${benefit2}."`,
          `[20-27s] "I'm not saying it's perfect. I'm saying it's the best thing I've ever tried."`,
          `[27-30s] CTA: "${cta}"`,
        ].join('\n');
      }

      results.push({
        type: 'video_concept',
        title: `${dur.label}`,
        body: script,
        framework: i < 3 ? ['AIDA', 'PAS', 'Story'][i] : (i === 3 ? 'trend' : 'pattern_interrupt'),
        platform: 'tiktok',
        tone: ctx.creative.tone,
        wordCount: wordCount(script),
        charCount: script.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Social Captions
  // -------------------------------------------------------------------------

  private static generateCaptions(
    ctx: ContentContext, count: number, rand: Rand, lang: string,
  ): GeneratedPiece[] {
    const isDE = lang === 'de';
    const results: GeneratedPiece[] = [];
    const p = ctx.product;
    const a = ctx.audience;
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'alles verändert' : 'changes everything');
    const hook = this.getHook(ctx, rand, lang, 'curiosity_gap');
    const cta = this.getCTA(ctx, rand, lang, 'social_proof');
    const hashtag = p.name.replace(/\s+/g, '');

    const templates = isDE ? [
      `${hook}\n\n${p.name} ${benefit} und ehrlich, ${a.persona} — ihr werdet es lieben.\n\n${p.price ? 'Jetzt für nur ' + p.price + '. ' : ''}${cta}\n\n#ad #${hashtag} #musthave #beauty #skincare`,
      `Wir behalten gute Dinge nicht für uns.\n\n${p.name} ist *das* Produkt — es ${benefit}.\n\nEntwickelt für ${a.persona}.\n\n${cta}\n\n#${hashtag} #gamechanger #selfcare`,
      `Klartext: ${p.name} ${benefit}.\n\nKeine Filter. Kein BS. Nur Ergebnisse.\n\n${cta}\n\n#ehrlich #review #${hashtag}`,
      `POV: Du entdeckst endlich ein Produkt, das hält, was es verspricht.\n\n${p.name} ${benefit}. ${p.usps.length > 0 ? p.usps[0] + '.' : ''}\n\n${cta}\n\n#${hashtag} #beautytipp #entdeckung`,
      `Das Internet hat gesprochen: ${p.name} ist der neue Favorit.\n\nWarum? ${benefit}.\n\n${cta}\n\n#trending #viral #${hashtag}`,
    ] : [
      `${hook}\n\n${p.name} ${benefit} and honestly, ${a.persona} — you're going to love it.\n\n${p.price ? 'Now just ' + p.price + '. ' : ''}${cta}\n\n#ad #${hashtag} #musthave #beauty #skincare`,
      `We don't gatekeep good things around here.\n\n${p.name} is *that* product — it ${benefit}.\n\nDesigned with ${a.persona} in mind.\n\n${cta}\n\n#${hashtag} #gamechanger #selfcare`,
      `Real talk: ${p.name} ${benefit}.\n\nNo filters. No BS. Just results.\n\n${cta}\n\n#honest #review #${hashtag}`,
      `POV: You finally find a product that actually delivers on its promises.\n\n${p.name} ${benefit}. ${p.usps.length > 0 ? p.usps[0] + '.' : ''}\n\n${cta}\n\n#${hashtag} #beautytip #discovery`,
      `The internet has spoken: ${p.name} is the new favorite.\n\nWhy? ${benefit}.\n\n${cta}\n\n#trending #viral #${hashtag}`,
    ];

    for (let i = 0; i < Math.min(count, 5); i++) {
      const body = templates[i % templates.length];
      results.push({
        type: 'social_caption',
        title: isDE ? `Social Caption ${i + 1}` : `Social Caption ${i + 1}`,
        body,
        framework: ['curiosity', 'social_proof', 'direct', 'pov', 'trend'][i % 5],
        platform: 'meta',
        tone: ctx.creative.tone,
        wordCount: wordCount(body),
        charCount: body.length,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Helper: Fill placeholders in hook/CTA templates
  // -------------------------------------------------------------------------

  private static fillPlaceholders(
    template: string, ctx: ContentContext, rand: Rand, lang: string,
  ): string {
    const isDE = lang === 'de';
    const p = ctx.product;
    const a = ctx.audience;

    const painPoint = a.painPoints.length > 0 ? rand.pick(a.painPoints) : (isDE ? 'frustrierende Ergebnisse' : 'frustrating results');
    const benefit = p.benefits.length > 0 ? rand.pick(p.benefits) : (isDE ? 'echte Ergebnisse liefert' : 'delivers real results');
    const desire = a.desires.length > 0 ? rand.pick(a.desires) : (isDE ? 'sich großartig fühlen' : 'feeling amazing');
    const competitor = ctx.competition.competitors.length > 0 ? rand.pick(ctx.competition.competitors) : (isDE ? 'die anderen Marken' : 'other brands');
    const diff = ctx.competition.differentiators.length > 0 ? rand.pick(ctx.competition.differentiators) : '';
    const name = rand.pick(CUSTOMER_NAMES[isDE ? 'de' : 'en']);

    const replacements: Record<string, string> = {
      '{product}': p.name,
      '{audience}': a.persona,
      '{benefit}': benefit,
      '{biggerBenefit}': p.benefits.length > 1 ? p.benefits[1] : benefit,
      '{problem}': painPoint,
      '{painPoint}': painPoint,
      '{desire}': desire,
      '{competitor}': competitor,
      '{competitors}': competitor,
      '{differentiator}': diff,
      '{action}': isDE ? 'etwas anderes kaufst' : 'buy anything else',
      '{topic}': p.description || p.name,
      '{boldClaim}': `${p.name} ${benefit}`,
      '{observation}': `${p.name} ${isDE ? 'gerade überall ist' : 'is everywhere right now'}`,
      '{phenomenon}': `${a.persona} ${isDE ? 'davon besessen sind' : 'are obsessed with this'}`,
      '{oldSolution}': competitor,
      '{experts}': isDE ? 'Experten' : 'experts',
      '{secret}': `${p.name}`,
      '{percentage}': String(rand.number(72, 97)),
      '{number}': String(rand.number(1000, 50000)),
      '{total}': String(rand.number(4, 10)),
      '{rank}': String(rand.number(1, 3)),
      '{authority}': isDE ? 'unabhängigen Testern' : 'independent testers',
      '{time}': isDE ? rand.pick(['7 Tagen', '2 Wochen', '30 Tagen', '14 Tagen']) : rand.pick(['7 days', '2 weeks', '30 days', '14 days']),
      '{timeAgo}': isDE ? rand.pick(['6 Monaten', '1 Jahr', '3 Monaten']) : rand.pick(['6 months ago', '1 year ago', '3 months ago']),
      '{rating}': String(rand.pick([4.7, 4.8, 4.9])),
      '{influencer}': name,
      '{name}': name,
      '{person}': isDE ? rand.pick(['Freundin', 'Mutter', 'Schwester', 'Kollegin']) : rand.pick(['friend', 'mom', 'sister', 'coworker']),
      '{category}': isDE ? 'Beauty' : 'beauty',
      '{industry}': isDE ? 'Beauty-Branche' : 'beauty industry',
      '{publication}': rand.pick(['Vogue', 'Elle', 'GQ', 'Forbes', 'Cosmopolitan']),
      '{metric}': isDE ? 'Zufriedenheit' : 'satisfaction',
      '{statistic}': `${rand.number(80, 98)}% ${isDE ? 'sehen Ergebnisse in 14 Tagen' : 'see results within 14 days'}`,
      '{rate}': String(rand.number(2, 5)),
      '{event}': isDE ? rand.pick(['Frühlings', 'Sommer', 'Black Friday', 'Geburtstags']) : rand.pick(['Spring', 'Summer', 'Black Friday', 'Anniversary']),
      '{discount}': String(rand.number(15, 40)),
      '{days}': String(rand.number(30, 90)),
      '{sacrifice}': isDE ? 'Kompromisse' : 'compromise',
      '{hassle}': isDE ? 'den Aufwand' : 'the hassle',
      '{area}': isDE ? rand.pick(['Alltag', 'Routine', 'Wohlbefinden']) : rand.pick(['daily life', 'routine', 'wellbeing']),
      '{amount}': String(rand.number(100, 500)),
      '{routine}': isDE ? 'Routine' : 'routine',
      '{before}': painPoint,
      '{after}': desire || benefit,
      '{year}': '2026',
      '{award}': isDE ? 'Beauty Award' : 'Beauty Award',
      '{platform}': rand.pick(['Amazon', 'TikTok Shop', 'Trustpilot']),
      '{use}': isDE ? 'tägliche Pflege' : 'daily care',
      '{field}': isDE ? 'Forschung' : 'research',
      '{celebrity/expert}': isDE ? 'Fachleute' : 'top professionals',
      '{expert}': isDE ? 'Dr. Mueller' : 'Dr. Smith',
      '{code}': rand.pick(['GLOW20', 'SAVE15', 'VIP25', 'FIRST30']),
      '{bonus}': isDE ? 'Geschenk' : 'gift',
      '{alternatives}': isDE ? 'Alternativen' : 'alternatives',
      '{dailyCost}': isDE ? '1,50EUR' : '$1.50',
      '{savings}': isDE ? '200EUR pro Jahr' : '$200 per year',
      '{relatable_struggle}': painPoint,
      '{transformed}': isDE ? 'transformiert' : 'transformed',
      '{badHabit}': isDE ? `${painPoint} zu ignorieren` : `ignoring ${painPoint}`,
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result.replace(/\s{2,}/g, ' ').trim();
  }

  // -------------------------------------------------------------------------
  // Helper: Get a filled hook
  // -------------------------------------------------------------------------

  private static getHook(
    ctx: ContentContext, rand: Rand, lang: string,
    category: string,
  ): string {
    if (ctx.performance.bestHook) return ctx.performance.bestHook;
    const hooks = HOOK_PATTERNS[lang as 'en' | 'de'];
    const templates = (hooks as any)[category] || hooks.curiosity_gap;
    const template = rand.pick(templates) as string;
    return this.fillPlaceholders(template, ctx, rand, lang);
  }

  // -------------------------------------------------------------------------
  // Helper: Get a filled CTA
  // -------------------------------------------------------------------------

  private static getCTA(
    ctx: ContentContext, rand: Rand, lang: string,
    category: string,
  ): string {
    const ctas = CTA_PATTERNS[lang as 'en' | 'de'];
    const templates = (ctas as any)[category] || ctas.benefit;
    const template = rand.pick(templates) as string;
    return this.fillPlaceholders(template, ctx, rand, lang);
  }

  // -------------------------------------------------------------------------
  // Helper: Get social proof block
  // -------------------------------------------------------------------------

  private static getSocialProof(ctx: ContentContext, rand: Rand, lang: string): string {
    const blocks = SOCIAL_PROOF_BLOCKS[lang as 'en' | 'de'];
    const template = rand.pick(blocks);
    return this.fillPlaceholders(template, ctx, rand, lang);
  }

  // -------------------------------------------------------------------------
  // Helper: Get intensifier based on tone
  // -------------------------------------------------------------------------

  private static getIntensifier(ctx: ContentContext, rand: Rand, lang: string): string {
    const toneConfig = TONE_MODIFIERS[lang as 'en' | 'de'][ctx.creative.tone as keyof typeof TONE_MODIFIERS.en];
    if (toneConfig && 'intensifiers' in toneConfig) {
      return rand.pick(toneConfig.intensifiers as string[]);
    }
    return lang === 'de' ? 'wirklich' : 'truly';
  }
}
