/**
 * Meta Ads — deterministische Helfer für Ideas/Iterations + Task-Bridge (Phase 5).
 * Rein funktional, keine IO/DB/KI — damit testbar. Die Task-Beschreibung trägt den
 * kompletten Produkt-/Angle-/Component-/Signal-Kontext, weil Wm-Aufgaben keinen
 * Produkt-FK haben (Kontext wandert in description).
 */

export type OpportunityType =
  | 'FULL_WINNER' | 'HOOK_WINNER' | 'BODY_WINNER' | 'STRONG_RETENTION'
  | 'WEAK_HOOK' | 'MID_VIDEO_DROP' | 'LATE_DROP' | 'TRAFFIC_PROBLEM'
  | 'SALVAGE_BODY' | 'SALVAGE_HOOK' | 'NEEDS_ITERATION' | 'PROMISING' | 'LOW_CONFIDENCE';

export const OPPORTUNITY_LABELS: Record<string, string> = {
  FULL_WINNER: 'Full Winner', HOOK_WINNER: 'Hook Winner', BODY_WINNER: 'Body Winner', STRONG_RETENTION: 'Strong Retention',
  WEAK_HOOK: 'Weak Hook', MID_VIDEO_DROP: 'Mid-Video Drop', LATE_DROP: 'Late Drop', TRAFFIC_PROBLEM: 'Traffic Problem',
  SALVAGE_BODY: 'Salvage: Body', SALVAGE_HOOK: 'Salvage: Hook', NEEDS_ITERATION: 'Needs Iteration', PROMISING: 'Promising', LOW_CONFIDENCE: 'Low Confidence',
};

export interface TaskComponentCtx {
  code: string;
  type: string;
  name: string;
  text?: string | null;
  startTimeSeconds?: number | null;
  endTimeSeconds?: number | null;
  role?: string | null;
}

export interface IdeaTaskCtx {
  title: string;
  ideaType: 'new' | 'iteration';
  source: 'manual' | 'ai';
  productGroupName?: string | null;
  angleName?: string | null;
  awareness?: string | null;
  offerName?: string | null;
  opportunityType?: string | null;
  basedOnAdName?: string | null;
  rationale?: string | null;
  body?: string | null;
  components: TaskComponentCtx[];
}

export interface RecipeTaskCtx {
  name: string;
  productGroupName?: string | null;
  angleName?: string | null;
  awareness?: string | null;
  offerName?: string | null;
  notes?: string | null;
  components: TaskComponentCtx[];
}

function timeRange(c: TaskComponentCtx): string {
  if (c.startTimeSeconds == null) return '';
  return ` (${c.startTimeSeconds}–${c.endTimeSeconds ?? '?'}s)`;
}

function componentLines(components: TaskComponentCtx[]): string {
  if (!components.length) return '_(keine Bausteine zugeordnet)_';
  return components
    .map((c) => {
      const role = c.role ? ` · ${c.role}` : '';
      const text = c.text ? ` — „${c.text}“` : '';
      return `- [${c.type.toUpperCase()}] ${c.code} ${c.name}${timeRange(c)}${role}${text}`;
    })
    .join('\n');
}

function metaLine(ctx: { productGroupName?: string | null; angleName?: string | null; awareness?: string | null; offerName?: string | null }): string {
  const parts: string[] = [];
  parts.push(`Produkt: ${ctx.productGroupName ?? '—'}`);
  if (ctx.angleName) parts.push(`Angle: ${ctx.angleName}`);
  if (ctx.awareness) parts.push(`Awareness: ${ctx.awareness}`);
  if (ctx.offerName) parts.push(`Offer: ${ctx.offerName}`);
  return parts.join(' · ');
}

export function buildIdeaTaskTitle(ctx: IdeaTaskCtx): string {
  const prefix = ctx.ideaType === 'iteration' ? '🔁 Iteration' : '🎬 Neues Creative';
  return `${prefix}: ${ctx.title}`;
}

export function buildIdeaTaskDescription(ctx: IdeaTaskCtx): string {
  const lines: string[] = [];
  lines.push(metaLine(ctx));
  const signal = ctx.opportunityType ? (OPPORTUNITY_LABELS[ctx.opportunityType] ?? ctx.opportunityType) : null;
  if (signal) lines.push(`Signal: ${signal}`);
  if (ctx.ideaType === 'iteration' && ctx.basedOnAdName) lines.push(`Basierend auf Ad: ${ctx.basedOnAdName}`);
  lines.push('');
  if (ctx.body) { lines.push('**Beschreibung**', ctx.body, ''); }
  if (ctx.rationale) { lines.push('**Begründung**', ctx.rationale, ''); }
  lines.push('**Bausteine wiederverwenden**', componentLines(ctx.components), '');
  lines.push(`_Automatisch erzeugt aus Meta Ads · ${ctx.source === 'ai' ? 'KI-Idee' : 'manuelle Idee'}. Hinweis: Baustein-Performance ist eine Assoziation, keine Kausalität._`);
  return lines.join('\n');
}

export function buildRecipeTaskTitle(ctx: RecipeTaskCtx): string {
  return `🧪 Recipe: ${ctx.name}`;
}

export function buildRecipeTaskDescription(ctx: RecipeTaskCtx): string {
  const lines: string[] = [];
  lines.push(metaLine(ctx));
  lines.push('');
  if (ctx.notes) { lines.push('**Notizen**', ctx.notes, ''); }
  lines.push('**Bausteine kombinieren**', componentLines(ctx.components), '');
  lines.push('_Automatisch erzeugt aus Meta Ads · Creative Recipe. Hinweis: Baustein-Performance ist eine Assoziation, keine Kausalität._');
  return lines.join('\n');
}

// --- Deterministische Iterations-Seeds aus Creative-Lab-Signalen (keine KI) ---

export interface SeedInputCard {
  id: string;
  name: string;
  primary: string | null;
  productGroupName: string | null;
}

export interface IdeaSeed {
  basedOnAdId: string;
  basedOnAdName: string;
  productGroupName: string | null;
  ideaType: 'iteration';
  opportunityType: string;
  title: string;
  rationale: string;
  /** Welcher Baustein-Typ sollte neu gebaut werden (Rest behalten)? */
  suggestedRole: 'hook' | 'body' | 'cta' | null;
}

/**
 * Leitet aus Salvage-/Needs-Iteration-Karten konkrete, deterministische
 * Iterationsvorschläge ab. Jede Karte ergibt höchstens einen Seed.
 */
export function iterationSeeds(cards: SeedInputCard[]): IdeaSeed[] {
  const seeds: IdeaSeed[] = [];
  for (const card of cards) {
    const rec = seedRecipeFor(card.primary);
    if (!rec) continue;
    seeds.push({
      basedOnAdId: card.id,
      basedOnAdName: card.name,
      productGroupName: card.productGroupName,
      ideaType: 'iteration',
      opportunityType: card.primary as string,
      title: `${rec.titlePrefix}: ${card.name}`,
      rationale: rec.rationale,
      suggestedRole: rec.suggestedRole,
    });
  }
  return seeds;
}

function seedRecipeFor(primary: string | null): { titlePrefix: string; rationale: string; suggestedRole: 'hook' | 'body' | 'cta' | null } | null {
  switch (primary) {
    case 'SALVAGE_HOOK':
    case 'WEAK_HOOK':
      return {
        titlePrefix: 'Neuer Hook',
        suggestedRole: 'hook',
        rationale: 'Der Body hält relativ zur Produkt-Baseline gut, der Hook liegt darunter. Neuen Hook testen, Body (und CTA) beibehalten.',
      };
    case 'SALVAGE_BODY':
    case 'MID_VIDEO_DROP':
      return {
        titlePrefix: 'Body überarbeiten',
        suggestedRole: 'body',
        rationale: 'Der Hook zieht, aber in der Mitte bricht die Retention relativ zur Baseline ein. Mittelteil/Body neu schneiden, starken Hook behalten.',
      };
    case 'LATE_DROP':
      return {
        titlePrefix: 'Ende & CTA stärken',
        suggestedRole: 'cta',
        rationale: 'Retention bricht spät ein — Abschluss/CTA straffen oder vorziehen, Hook und Body behalten.',
      };
    case 'NEEDS_ITERATION':
      return {
        titlePrefix: 'Iteration',
        suggestedRole: 'body',
        rationale: 'Mehrere Kennzahlen liegen unter der Produkt-Baseline. Schwächsten Abschnitt gezielt iterieren.',
      };
    case 'TRAFFIC_PROBLEM':
      return {
        titlePrefix: 'Angle/Zielgruppe prüfen',
        suggestedRole: null,
        rationale: 'Retention ok, aber der ausgehende Traffic/Klick liegt unter der Baseline. Angle, Offer oder Zielgruppe prüfen statt den Schnitt.',
      };
    default:
      return null;
  }
}
