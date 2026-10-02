import { describe, expect, it } from 'vitest';
import {
  buildIdeaTaskTitle, buildIdeaTaskDescription, buildRecipeTaskTitle, buildRecipeTaskDescription,
  iterationSeeds, IdeaTaskCtx, RecipeTaskCtx, SeedInputCard,
} from '../idea-bridge';

const comp = {
  code: 'HK-0003', type: 'hook', name: 'Problem-Hook', text: 'Kennst du das?',
  startTimeSeconds: 0, endTimeSeconds: 4, role: 'hook',
};

describe('idea task description', () => {
  const base: IdeaTaskCtx = {
    title: 'Hook-Variante A', ideaType: 'iteration', source: 'manual',
    productGroupName: 'Filapen Starter', angleName: 'Problem/Solution', awareness: 'problem_aware',
    offerName: '2+1', opportunityType: 'SALVAGE_HOOK', basedOnAdName: 'Ad 42', rationale: 'Body stark, Hook schwach.',
    body: 'Neuer Pattern-Interrupt in Sek. 0–3.', components: [comp],
  };

  it('title marks iteration vs new', () => {
    expect(buildIdeaTaskTitle(base)).toContain('Iteration');
    expect(buildIdeaTaskTitle({ ...base, ideaType: 'new' })).toContain('Neues Creative');
    expect(buildIdeaTaskTitle(base)).toContain('Hook-Variante A');
  });

  it('description carries full context (no product FK on task)', () => {
    const d = buildIdeaTaskDescription(base);
    expect(d).toContain('Produkt: Filapen Starter');
    expect(d).toContain('Angle: Problem/Solution');
    expect(d).toContain('Offer: 2+1');
    expect(d).toContain('Signal: Salvage: Hook'); // mapped label
    expect(d).toContain('Basierend auf Ad: Ad 42');
    expect(d).toContain('Begründung');
    expect(d).toContain('Body stark, Hook schwach.');
    expect(d).toContain('[HOOK] HK-0003');
    expect(d).toContain('(0–4s)');
    expect(d).toContain('Assoziation'); // never-causation reminder
  });

  it('handles missing optionals without crashing', () => {
    const d = buildIdeaTaskDescription({ title: 'X', ideaType: 'new', source: 'ai', components: [] });
    expect(d).toContain('Produkt: —');
    expect(d).toContain('keine Bausteine');
    expect(d).toContain('KI-Idee');
    expect(d).not.toContain('Basierend auf Ad');
  });
});

describe('recipe task description', () => {
  const ctx: RecipeTaskCtx = {
    name: 'Bundle A+B', productGroupName: 'Bundle', notes: 'Für Retargeting.',
    components: [comp, { code: 'BD-0007', type: 'body', name: 'Demo', text: null, startTimeSeconds: null, endTimeSeconds: null, role: null }],
  };
  it('builds title + lists components', () => {
    expect(buildRecipeTaskTitle(ctx)).toContain('Recipe: Bundle A+B');
    const d = buildRecipeTaskDescription(ctx);
    expect(d).toContain('Produkt: Bundle');
    expect(d).toContain('Für Retargeting.');
    expect(d).toContain('[HOOK] HK-0003');
    expect(d).toContain('[BODY] BD-0007');
  });
});

describe('deterministic iteration seeds', () => {
  const cards: SeedInputCard[] = [
    { id: 'a1', name: 'Ad Hook-schwach', primary: 'SALVAGE_HOOK', productGroupName: 'G1' },
    { id: 'a2', name: 'Ad Body-Drop', primary: 'MID_VIDEO_DROP', productGroupName: 'G1' },
    { id: 'a3', name: 'Ad Spät-Drop', primary: 'LATE_DROP', productGroupName: 'G2' },
    { id: 'a4', name: 'Ad Traffic', primary: 'TRAFFIC_PROBLEM', productGroupName: null },
    { id: 'a5', name: 'Ad Winner', primary: 'FULL_WINNER', productGroupName: 'G1' }, // should NOT produce a seed
    { id: 'a6', name: 'Ad ohne Signal', primary: null, productGroupName: 'G1' },
  ];

  it('produces one iteration seed per actionable signal and skips winners/none', () => {
    const seeds = iterationSeeds(cards);
    expect(seeds.map((s) => s.basedOnAdId).sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(seeds.every((s) => s.ideaType === 'iteration')).toBe(true);
  });

  it('maps signal to the right suggested role', () => {
    const seeds = iterationSeeds(cards);
    const byId = Object.fromEntries(seeds.map((s) => [s.basedOnAdId, s]));
    expect(byId['a1'].suggestedRole).toBe('hook');
    expect(byId['a2'].suggestedRole).toBe('body');
    expect(byId['a3'].suggestedRole).toBe('cta');
    expect(byId['a4'].suggestedRole).toBeNull(); // traffic problem = not a cut issue
    expect(byId['a1'].title).toContain('Neuer Hook');
    expect(byId['a1'].rationale.length).toBeGreaterThan(10);
  });
});
