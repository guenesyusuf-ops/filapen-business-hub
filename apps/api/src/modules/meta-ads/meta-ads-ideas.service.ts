import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MaAwareness, MaIdeaType, MaIdeaSource, MaIdeaStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService, PeriodRange } from './meta-ads.service';
import { MetaAdsCreativeService } from './meta-ads-creative.service';
import {
  buildIdeaTaskTitle, buildIdeaTaskDescription, buildRecipeTaskTitle, buildRecipeTaskDescription,
  iterationSeeds, IdeaTaskCtx, RecipeTaskCtx, TaskComponentCtx, SeedInputCard,
} from './idea-bridge';

const CREATIVE_PROJECT_NAME = 'Meta Ads — Creative Production';
const DEFAULT_COLUMNS = ['To Do', 'In Arbeit', 'Erledigt'];

export interface IdeaInput {
  title?: string;
  body?: string | null;
  ideaType?: string;
  source?: string;
  status?: string;
  productGroupId?: string | null;
  angleId?: string | null;
  awareness?: string | null;
  offerId?: string | null;
  basedOnAdId?: string | null;
  recipeId?: string | null;
  opportunityType?: string | null;
  rationale?: string | null;
  componentIds?: string[];
}

export interface TaskBridgeInput {
  projectId?: string;
  columnId?: string;
}

@Injectable()
export class MetaAdsIdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
    private readonly creative: MetaAdsCreativeService,
  ) {}

  // =========================================================================
  // Ideas — CRUD
  // =========================================================================

  async listIdeas(orgId: string, opts: { status?: string; source?: string; type?: string; productGroupId?: string; search?: string }) {
    const where: any = { orgId };
    if (opts.status) where.status = this.parseStatus(opts.status);
    if (opts.source) where.source = this.parseSource(opts.source);
    if (opts.type) where.ideaType = this.parseType(opts.type);
    if (opts.productGroupId) where.productGroupId = opts.productGroupId;
    if (opts.search) where.OR = [{ title: { contains: opts.search, mode: 'insensitive' } }, { body: { contains: opts.search, mode: 'insensitive' } }];
    const rows = await this.prisma.maIdea.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        productGroup: { select: { name: true } }, basedOnAd: { select: { name: true } },
        _count: { select: { components: true, taskLinks: true } },
      },
    });
    return { items: rows.map((r) => this.serializeRow(r)) };
  }

  async getIdea(orgId: string, id: string) {
    const idea = await this.prisma.maIdea.findFirst({
      where: { id, orgId },
      include: {
        productGroup: { select: { name: true } }, angle: { select: { name: true } }, offer: { select: { name: true } },
        basedOnAd: { select: { id: true, name: true } }, recipe: { select: { id: true, name: true } },
        components: { orderBy: { position: 'asc' }, include: { component: { select: { id: true, code: true, name: true, type: true, text: true, startTimeSeconds: true, endTimeSeconds: true } } } },
        taskLinks: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!idea) throw new NotFoundException('Idee nicht gefunden');
    return this.serializeIdea(idea);
  }

  async createIdea(orgId: string, userId: string | null, input: IdeaInput) {
    const title = (input.title ?? '').trim();
    if (!title) throw new BadRequestException('Titel erforderlich');
    if (input.productGroupId) await this.mustOwn('maProductGroup', orgId, input.productGroupId, 'Produktgruppe');
    if (input.angleId) await this.mustOwn('maAngle', orgId, input.angleId, 'Angle');
    if (input.offerId) await this.mustOwn('maOffer', orgId, input.offerId, 'Offer');
    if (input.basedOnAdId) await this.mustOwn('maAd', orgId, input.basedOnAdId, 'Ad');
    if (input.recipeId) await this.mustOwn('maCreativeRecipe', orgId, input.recipeId, 'Recipe');
    const componentIds = await this.validComponentIds(orgId, input.componentIds);

    const idea = await this.prisma.maIdea.create({
      data: {
        orgId, title,
        body: input.body?.trim() || null,
        ideaType: input.ideaType ? this.parseType(input.ideaType) : MaIdeaType.new,
        source: input.source ? this.parseSource(input.source) : MaIdeaSource.manual,
        status: input.status ? this.parseStatus(input.status) : MaIdeaStatus.draft,
        productGroupId: input.productGroupId ?? null,
        angleId: input.angleId ?? null,
        awareness: input.awareness ? this.parseAwareness(input.awareness) : null,
        offerId: input.offerId ?? null,
        basedOnAdId: input.basedOnAdId ?? null,
        recipeId: input.recipeId ?? null,
        opportunityType: input.opportunityType ?? null,
        rationale: input.rationale?.trim() || null,
        createdById: userId,
        components: componentIds.length
          ? { create: componentIds.map((componentId, i) => ({ orgId, componentId, position: i })) }
          : undefined,
      },
      select: { id: true },
    });
    return this.getIdea(orgId, idea.id);
  }

  async updateIdea(orgId: string, id: string, input: IdeaInput) {
    await this.mustOwn('maIdea', orgId, id, 'Idee');
    const data: any = {};
    if (input.title !== undefined) { const t = (input.title ?? '').trim(); if (!t) throw new BadRequestException('Titel erforderlich'); data.title = t; }
    if (input.body !== undefined) data.body = input.body?.trim() || null;
    if (input.status !== undefined) data.status = this.parseStatus(input.status!);
    if (input.ideaType !== undefined) data.ideaType = this.parseType(input.ideaType!);
    if (input.rationale !== undefined) data.rationale = input.rationale?.trim() || null;
    if (input.awareness !== undefined) data.awareness = input.awareness ? this.parseAwareness(input.awareness) : null;
    if (input.angleId !== undefined) { if (input.angleId) await this.mustOwn('maAngle', orgId, input.angleId, 'Angle'); data.angleId = input.angleId ?? null; }
    if (input.offerId !== undefined) { if (input.offerId) await this.mustOwn('maOffer', orgId, input.offerId, 'Offer'); data.offerId = input.offerId ?? null; }
    if (input.productGroupId !== undefined) { if (input.productGroupId) await this.mustOwn('maProductGroup', orgId, input.productGroupId, 'Produktgruppe'); data.productGroupId = input.productGroupId ?? null; }

    if (input.componentIds !== undefined) {
      const componentIds = await this.validComponentIds(orgId, input.componentIds);
      await this.prisma.maIdeaComponent.deleteMany({ where: { ideaId: id } });
      if (componentIds.length) await this.prisma.maIdeaComponent.createMany({ data: componentIds.map((componentId, i) => ({ orgId, ideaId: id, componentId, position: i })) });
    }
    await this.prisma.maIdea.update({ where: { id }, data });
    return this.getIdea(orgId, id);
  }

  async deleteIdea(orgId: string, id: string) {
    await this.mustOwn('maIdea', orgId, id, 'Idee');
    await this.prisma.maIdea.delete({ where: { id } });
    return { ok: true };
  }

  // =========================================================================
  // Deterministische Iterations-Vorschläge (keine KI)
  // =========================================================================

  async suggestions(orgId: string, opts: { productGroupId?: string; range?: PeriodRange; start?: string; end?: string }) {
    const lab = await this.creative.creativeLab(orgId, opts);
    const cards: SeedInputCard[] = [...lab.sections.salvage, ...lab.sections.needsIteration].map((c: any) => ({
      id: c.id, name: c.name, primary: c.primary, productGroupName: c.productGroupName ?? null,
    }));
    const seeds = iterationSeeds(cards);
    // Welche Ads haben bereits eine Iterations-Idee? (nicht ausblenden, nur markieren)
    const existing = await this.prisma.maIdea.findMany({
      where: { orgId, basedOnAdId: { in: seeds.map((s) => s.basedOnAdId) } },
      select: { basedOnAdId: true },
    });
    const existingSet = new Set(existing.map((e) => e.basedOnAdId));
    return { items: seeds.map((s) => ({ ...s, alreadyHasIdea: existingSet.has(s.basedOnAdId) })) };
  }

  // =========================================================================
  // Task-Bridge: Idee / Recipe -> bestehende Wm-Aufgabe
  // =========================================================================

  async createTaskFromIdea(orgId: string, userId: string | null, id: string, input: TaskBridgeInput) {
    const idea = await this.prisma.maIdea.findFirst({
      where: { id, orgId },
      include: {
        productGroup: { select: { name: true } }, angle: { select: { name: true } }, offer: { select: { name: true } },
        basedOnAd: { select: { name: true } }, taskLinks: true,
        components: { orderBy: { position: 'asc' }, include: { component: true } },
      },
    });
    if (!idea) throw new NotFoundException('Idee nicht gefunden');
    if (idea.taskLinks.length) {
      const l = idea.taskLinks[0];
      return { alreadyLinked: true, taskId: l.wmTaskId, taskLinkId: l.id };
    }
    const ctx: IdeaTaskCtx = {
      title: idea.title, ideaType: idea.ideaType, source: idea.source,
      productGroupName: idea.productGroup?.name ?? null, angleName: idea.angle?.name ?? null,
      awareness: idea.awareness ?? null, offerName: idea.offer?.name ?? null,
      opportunityType: idea.opportunityType, basedOnAdName: idea.basedOnAd?.name ?? null,
      rationale: idea.rationale, body: idea.body,
      components: idea.components.map((ic) => this.componentCtx(ic.component, ic.role)),
    };
    const task = await this.createWmTask(orgId, userId, buildIdeaTaskTitle(ctx), buildIdeaTaskDescription(ctx), input);
    const link = await this.prisma.maTaskLink.create({ data: { orgId, ideaId: id, wmTaskId: task.id, title: task.title, createdById: userId } });
    await this.prisma.maIdea.update({ where: { id }, data: { status: MaIdeaStatus.in_production } });
    return { taskId: task.id, taskLinkId: link.id, projectId: task.projectId };
  }

  async createTaskFromRecipe(orgId: string, userId: string | null, recipeId: string, input: TaskBridgeInput) {
    const recipe = await this.prisma.maCreativeRecipe.findFirst({
      where: { id: recipeId, orgId },
      include: {
        productGroup: { select: { name: true } }, angle: { select: { name: true } }, offer: { select: { name: true } },
        taskLinks: true,
        components: { orderBy: { position: 'asc' }, include: { component: true } },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe nicht gefunden');
    if (recipe.taskLinks.length) {
      const l = recipe.taskLinks[0];
      return { alreadyLinked: true, taskId: l.wmTaskId, taskLinkId: l.id };
    }
    const ctx: RecipeTaskCtx = {
      name: recipe.name, productGroupName: recipe.productGroup?.name ?? null, angleName: recipe.angle?.name ?? null,
      awareness: recipe.awareness ?? null, offerName: recipe.offer?.name ?? null, notes: recipe.notes,
      components: recipe.components.map((rc) => this.componentCtx(rc.component, rc.role)),
    };
    const task = await this.createWmTask(orgId, userId, buildRecipeTaskTitle(ctx), buildRecipeTaskDescription(ctx), input);
    const link = await this.prisma.maTaskLink.create({ data: { orgId, recipeId, wmTaskId: task.id, title: task.title, createdById: userId } });
    await this.prisma.maCreativeRecipe.update({ where: { id: recipeId }, data: { status: 'in_production' } });
    return { taskId: task.id, taskLinkId: link.id, projectId: task.projectId };
  }

  /** Erzeugt eine echte Wm-Aufgabe (Muster wie ai/creator): Projekt sicherstellen -> erste Spalte -> Task. */
  private async createWmTask(orgId: string, userId: string | null, title: string, description: string, input: TaskBridgeInput) {
    let projectId = input.projectId;
    let columnId = input.columnId;
    if (projectId) {
      const project = await this.prisma.wmProject.findFirst({ where: { id: projectId, orgId }, include: { columns: { orderBy: { position: 'asc' }, take: 1 } } });
      if (!project) throw new BadRequestException('Projekt gehört nicht zu dieser Organisation');
      if (!columnId) columnId = project.columns[0]?.id;
      if (!columnId) throw new BadRequestException('Projekt hat keine Spalte');
    } else {
      const ensured = await this.ensureCreativeProject(orgId, userId);
      projectId = ensured.projectId;
      columnId = ensured.columnId;
    }
    const last = await this.prisma.wmTask.aggregate({ where: { columnId, parentTaskId: null }, _max: { position: true } });
    const position = (last._max.position ?? -1) + 1;
    const task = await this.prisma.wmTask.create({
      data: { orgId, projectId, columnId, title, description, createdById: userId ?? orgId, priority: 'medium', position },
      select: { id: true, projectId: true, title: true },
    });
    return task;
  }

  /** Dediziertes Kanban-Projekt für Creative-Produktion; wird bei Bedarf angelegt. */
  private async ensureCreativeProject(orgId: string, userId: string | null): Promise<{ projectId: string; columnId: string }> {
    let project = await this.prisma.wmProject.findFirst({
      where: { orgId, name: CREATIVE_PROJECT_NAME },
      include: { columns: { orderBy: { position: 'asc' }, take: 1 } },
    });
    if (!project) {
      project = await this.prisma.wmProject.create({
        data: {
          orgId, name: CREATIVE_PROJECT_NAME, projectType: 'kanban', category: 'meta-ads',
          color: '#6366f1', createdBy: userId ?? orgId,
          columns: { create: DEFAULT_COLUMNS.map((name, i) => ({ name, position: i })) },
        },
        include: { columns: { orderBy: { position: 'asc' }, take: 1 } },
      });
    }
    const columnId = project.columns[0]?.id;
    if (!columnId) throw new BadRequestException('Creative-Projekt hat keine Spalte');
    return { projectId: project.id, columnId };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private componentCtx(c: any, role: string | null): TaskComponentCtx {
    return { code: c.code, type: c.type, name: c.name, text: c.text ?? null, startTimeSeconds: c.startTimeSeconds ?? null, endTimeSeconds: c.endTimeSeconds ?? null, role };
  }

  private async validComponentIds(orgId: string, ids?: string[]): Promise<string[]> {
    if (!ids || !ids.length) return [];
    const unique = [...new Set(ids)];
    const found = await this.prisma.maCreativeComponent.findMany({ where: { id: { in: unique }, orgId }, select: { id: true } });
    if (found.length !== unique.length) throw new BadRequestException('Mindestens eine Component gehört nicht zu dieser Organisation');
    return unique;
  }

  private serializeRow(r: any) {
    return {
      id: r.id, title: r.title, ideaType: r.ideaType, source: r.source, status: r.status,
      productGroupId: r.productGroupId ?? null, productGroupName: r.productGroup?.name ?? null,
      basedOnAdId: r.basedOnAdId ?? null, basedOnAdName: r.basedOnAd?.name ?? null,
      opportunityType: r.opportunityType ?? null,
      componentCount: r._count?.components ?? 0, taskCount: r._count?.taskLinks ?? 0,
      createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }

  private serializeIdea(i: any) {
    return {
      id: i.id, title: i.title, body: i.body ?? null, ideaType: i.ideaType, source: i.source, status: i.status,
      productGroupId: i.productGroupId ?? null, productGroupName: i.productGroup?.name ?? null,
      angleId: i.angleId ?? null, angleName: i.angle?.name ?? null, awareness: i.awareness ?? null,
      offerId: i.offerId ?? null, offerName: i.offer?.name ?? null,
      basedOnAdId: i.basedOnAdId ?? null, basedOnAdName: i.basedOnAd?.name ?? null,
      recipeId: i.recipeId ?? null, recipeName: i.recipe?.name ?? null,
      opportunityType: i.opportunityType ?? null, rationale: i.rationale ?? null,
      aiModel: i.aiModel ?? null,
      components: (i.components ?? []).map((ic: any) => ({
        id: ic.id, componentId: ic.componentId, role: ic.role, position: ic.position,
        code: ic.component?.code ?? null, name: ic.component?.name ?? null, type: ic.component?.type ?? null,
        startTimeSeconds: ic.component?.startTimeSeconds ?? null, endTimeSeconds: ic.component?.endTimeSeconds ?? null,
      })),
      tasks: (i.taskLinks ?? []).map((l: any) => ({ id: l.id, wmTaskId: l.wmTaskId, title: l.title, createdAt: l.createdAt?.toISOString?.() ?? null })),
      createdAt: i.createdAt?.toISOString?.() ?? null,
    };
  }

  private parseType(v: string): MaIdeaType {
    if (!(v in MaIdeaType)) throw new BadRequestException(`Ungültiger Idee-Typ: ${v}`);
    return MaIdeaType[v as keyof typeof MaIdeaType];
  }
  private parseSource(v: string): MaIdeaSource {
    if (!(v in MaIdeaSource)) throw new BadRequestException(`Ungültige Quelle: ${v}`);
    return MaIdeaSource[v as keyof typeof MaIdeaSource];
  }
  private parseStatus(v: string): MaIdeaStatus {
    if (!(v in MaIdeaStatus)) throw new BadRequestException(`Ungültiger Status: ${v}`);
    return MaIdeaStatus[v as keyof typeof MaIdeaStatus];
  }
  private parseAwareness(v: string): MaAwareness {
    if (!(v in MaAwareness)) throw new BadRequestException(`Ungültiges Awareness-Level: ${v}`);
    return MaAwareness[v as keyof typeof MaAwareness];
  }
  private async mustOwn(model: 'maProductGroup' | 'maAd' | 'maAngle' | 'maOffer' | 'maCreativeComponent' | 'maCreativeRecipe' | 'maIdea', orgId: string, id: string, label: string) {
    const found = await (this.prisma[model] as any).findFirst({ where: { id, orgId }, select: { id: true } });
    if (!found) throw new BadRequestException(`${label} gehört nicht zu dieser Organisation`);
  }
}
