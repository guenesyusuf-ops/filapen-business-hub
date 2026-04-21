import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSenderService } from './email-sender.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

export type FlowStepTypeStr = 'delay' | 'condition' | 'send_email' | 'end';
export type FlowTriggerTypeStr =
  | 'customer_created' | 'order_placed' | 'checkout_started'
  | 'viewed_product' | 'added_to_cart' | 'segment_entered' | 'custom_event';

export interface FlowStepInput {
  id?: string;
  type: FlowStepTypeStr;
  delayHours?: number | null;
  condition?: any;
  templateId?: string | null;
  nextStepId?: string | null;
  nextIfTrueId?: string | null;
  nextIfFalseId?: string | null;
}

export interface FlowInput {
  name: string;
  description?: string | null;
  triggerType: FlowTriggerTypeStr;
  triggerConfig?: any;
  segmentId?: string | null;
  reentryDays?: number;
  consentMode?: string;
  steps: FlowStepInput[];
}

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: EmailSenderService,
  ) {}

  // ---------------- CRUD ----------------

  async list(orgId: string) {
    return this.prisma.flow.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { steps: true, enrollments: true } } },
    });
  }

  async get(orgId: string, id: string) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, orgId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        segment: { select: { id: true, name: true, memberCount: true } },
      },
    });
    if (!flow) throw new NotFoundException('Flow nicht gefunden');
    return flow;
  }

  async create(orgId: string, userId: string, data: FlowInput) {
    this.validate(data);
    const flow = await this.prisma.flow.create({
      data: {
        orgId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig ?? null,
        segmentId: data.segmentId || null,
        reentryDays: data.reentryDays ?? 30,
        consentMode: data.consentMode || 'subscribed',
        createdById: userId,
      },
    });
    if (data.steps && data.steps.length > 0) {
      await this.replaceSteps(flow.id, data.steps);
    }
    return this.get(orgId, flow.id);
  }

  async update(orgId: string, id: string, data: Partial<FlowInput>) {
    const existing = await this.get(orgId, id);
    if (data.triggerType !== undefined || data.steps !== undefined) {
      if (existing.status === 'active') {
        throw new BadRequestException('Aktiver Flow kann nicht strukturell geändert werden — erst pausieren');
      }
    }
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.triggerType !== undefined) updates.triggerType = data.triggerType;
    if (data.triggerConfig !== undefined) updates.triggerConfig = data.triggerConfig;
    if (data.segmentId !== undefined) updates.segmentId = data.segmentId || null;
    if (data.reentryDays !== undefined) updates.reentryDays = data.reentryDays;
    if (data.consentMode !== undefined) updates.consentMode = data.consentMode;

    await this.prisma.flow.update({ where: { id }, data: updates });
    if (data.steps) {
      await this.replaceSteps(id, data.steps);
    }
    return this.get(orgId, id);
  }

  async setStatus(orgId: string, id: string, status: 'draft' | 'active' | 'paused' | 'archived') {
    const flow = await this.get(orgId, id);
    const updates: any = { status };
    if (status === 'active' && !flow.activatedAt) updates.activatedAt = new Date();
    await this.prisma.flow.update({ where: { id }, data: updates });
    return this.get(orgId, id);
  }

  async delete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.flow.delete({ where: { id } });
    return { deleted: true };
  }

  private async replaceSteps(flowId: string, steps: FlowStepInput[]) {
    this.validateSteps(steps);
    await this.prisma.flowStep.deleteMany({ where: { flowId } });
    // Insert in order, then update next-pointers
    const inserted: { id: string; originalId?: string }[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const created = await this.prisma.flowStep.create({
        data: {
          flowId,
          type: step.type,
          position: i,
          delayHours: step.delayHours ?? null,
          condition: step.condition ?? null,
          templateId: step.templateId || null,
        },
      });
      inserted.push({ id: created.id, originalId: step.id });
    }
    // For MVP: linear chaining — each step's nextStepId = the next in order
    for (let i = 0; i < inserted.length - 1; i++) {
      await this.prisma.flowStep.update({
        where: { id: inserted[i].id },
        data: { nextStepId: inserted[i + 1].id },
      });
    }
  }

  private validate(data: FlowInput) {
    if (!data.name?.trim()) throw new BadRequestException('Flow-Name fehlt');
    if (!data.triggerType) throw new BadRequestException('Trigger-Typ fehlt');
  }

  private validateSteps(steps: FlowStepInput[]) {
    for (const s of steps) {
      if (s.type === 'delay' && (!s.delayHours || s.delayHours <= 0)) {
        throw new BadRequestException('Delay-Step braucht delayHours > 0');
      }
      if (s.type === 'send_email' && !s.templateId) {
        throw new BadRequestException('send_email Step braucht templateId');
      }
    }
  }

  // ---------------- Trigger + Enrollment ----------------

  /**
   * Called from event sources (webhook processor, tracking) whenever a
   * trigger-eligible event occurs. Enrolls contact into any active flow
   * matching the trigger + consent + segment + reentry rules.
   */
  async triggerFlowsForEvent(params: {
    orgId: string;
    triggerType: FlowTriggerTypeStr;
    contactId: string;
    context?: any;
  }): Promise<number> {
    const flows = await this.prisma.flow.findMany({
      where: {
        orgId: params.orgId,
        status: 'active',
        triggerType: params.triggerType,
      },
      include: { steps: { orderBy: { position: 'asc' }, take: 1 } },
    });
    let enrolled = 0;
    for (const flow of flows) {
      if (flow.steps.length === 0) continue;

      // Reentry check
      if (flow.reentryDays > 0) {
        const recent = await this.prisma.flowEnrollment.findFirst({
          where: {
            orgId: params.orgId,
            flowId: flow.id,
            contactId: params.contactId,
            enrolledAt: { gte: new Date(Date.now() - flow.reentryDays * 86400000) },
          },
        });
        if (recent) continue;
      }

      // Contact-level pre-checks (consent, suppression)
      const contact = await this.prisma.contact.findUnique({ where: { id: params.contactId } });
      if (!contact) continue;
      if (contact.marketingConsent === 'unsubscribed') continue;

      const firstStep = flow.steps[0];
      const nextRunAt = firstStep.type === 'delay' && firstStep.delayHours
        ? new Date(Date.now() + firstStep.delayHours * 3600000)
        : new Date();

      await this.prisma.flowEnrollment.create({
        data: {
          orgId: params.orgId,
          flowId: flow.id,
          contactId: params.contactId,
          currentStepId: firstStep.id,
          nextRunAt,
          context: params.context ?? null,
          status: 'active',
        },
      });
      await this.prisma.flow.update({
        where: { id: flow.id },
        data: { enrolledCount: { increment: 1 } },
      });
      enrolled++;
    }
    return enrolled;
  }

  // ---------------- Executor (Cron) ----------------

  /**
   * Runs every minute. Picks up enrollments whose next step is due,
   * executes it, and sets the next runtime. Idempotent per enrollment.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'flow-executor' })
  async runDueSteps() {
    try {
      const due = await this.prisma.flowEnrollment.findMany({
        where: {
          status: 'active',
          nextRunAt: { lte: new Date() },
        },
        orderBy: { nextRunAt: 'asc' },
        take: 100, // batch limit per minute
        include: { currentStep: true, flow: true },
      });
      for (const e of due) {
        try {
          await this.executeStep(e);
        } catch (err: any) {
          this.logger.error(`Step execution failed for enrollment ${e.id}: ${err?.message}`, err?.stack);
          // Mark failed but don't exit — continue with next
          await this.prisma.flowEnrollment.update({
            where: { id: e.id },
            data: { status: 'exited', exitedAt: new Date(), exitReason: `error:${err?.message?.slice(0, 80)}` },
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      this.logger.error(`Flow executor loop failed: ${err?.message}`, err?.stack);
    }
  }

  private async executeStep(enrollment: any): Promise<void> {
    const step = enrollment.currentStep;
    if (!step) {
      await this.completeEnrollment(enrollment.id, 'no_step');
      return;
    }

    const contact = await this.prisma.contact.findUnique({ where: { id: enrollment.contactId } });
    if (!contact || contact.marketingConsent === 'unsubscribed') {
      await this.completeEnrollment(enrollment.id, 'contact_unsubscribed');
      return;
    }

    let nextStepId: string | null = null;

    switch (step.type) {
      case 'send_email':
        if (step.templateId) {
          const res = await this.sender.send({
            orgId: enrollment.orgId,
            contactId: enrollment.contactId,
            templateId: step.templateId,
            flowId: enrollment.flowId,
            flowStepId: step.id,
            consentMode: enrollment.flow?.consentMode || 'subscribed',
          });
          this.logger.log(`Flow ${enrollment.flowId} step ${step.id} sent: ${res.status}`);
        }
        nextStepId = step.nextStepId;
        break;

      case 'delay':
        // Delay already reflected in nextRunAt (from enroll/previous step), just advance
        nextStepId = step.nextStepId;
        break;

      case 'condition': {
        // Simple condition eval for MVP: just check contact property
        // e.g. { field: 'ordersCount', op: 'gte', value: 1 }
        const cond = step.condition as any;
        let passes = true;
        if (cond && cond.field && cond.op) {
          const val = (contact as any)[cond.field];
          passes = this.evalSimpleCondition(val, cond.op, cond.value);
        }
        nextStepId = passes ? step.nextIfTrueId : step.nextIfFalseId;
        break;
      }

      case 'end':
        await this.completeEnrollment(enrollment.id, 'end_step');
        return;

      default:
        nextStepId = step.nextStepId;
        break;
    }

    if (!nextStepId) {
      await this.completeEnrollment(enrollment.id, 'no_next_step');
      return;
    }

    const next = await this.prisma.flowStep.findUnique({ where: { id: nextStepId } });
    if (!next) {
      await this.completeEnrollment(enrollment.id, 'next_step_missing');
      return;
    }

    // Compute next runtime: if next is delay, schedule after delay; else run immediately
    const nextRunAt = next.type === 'delay' && next.delayHours
      ? new Date(Date.now() + next.delayHours * 3600000)
      : new Date(Date.now() + 1000); // slight lag to let DB settle

    await this.prisma.flowEnrollment.update({
      where: { id: enrollment.id },
      data: { currentStepId: next.id, nextRunAt },
    });
  }

  private evalSimpleCondition(val: any, op: string, target: any): boolean {
    if (val === null || val === undefined) return op === 'neq' || op === 'is_not_set';
    switch (op) {
      case 'eq': return val == target;
      case 'neq': return val != target;
      case 'gt': return Number(val) > Number(target);
      case 'gte': return Number(val) >= Number(target);
      case 'lt': return Number(val) < Number(target);
      case 'lte': return Number(val) <= Number(target);
      case 'contains': return String(val).toLowerCase().includes(String(target).toLowerCase());
      case 'is_set': return val !== null && val !== undefined && val !== '';
      default: return false;
    }
  }

  private async completeEnrollment(id: string, reason: string) {
    const e = await this.prisma.flowEnrollment.findUnique({ where: { id }, select: { flowId: true } });
    await this.prisma.flowEnrollment.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        exitReason: reason,
      },
    });
    if (e?.flowId) {
      this.prisma.flow.update({
        where: { id: e.flowId },
        data: { completedCount: { increment: 1 } },
      }).catch(() => {});
    }
  }

  // ---------------- Pre-built Flow Templates ----------------

  /**
   * Installs one of the pre-built flows into the org. Creates a template
   * if none exists, then a flow with wired-up steps.
   */
  async installPreBuilt(orgId: string, userId: string, kind: PreBuiltFlowKind) {
    const spec = PRE_BUILT_FLOWS[kind];
    if (!spec) throw new BadRequestException(`Unbekannter Flow-Typ: ${kind}`);

    // Create templates first
    const templateIds: string[] = [];
    for (const t of spec.templates) {
      const template = await this.prisma.emailTemplate.create({
        data: {
          orgId,
          name: t.name,
          description: `Auto-installiert: ${spec.name}`,
          subject: t.subject,
          previewText: t.preview || null,
          blocks: t.blocks as any,
          createdById: userId,
        },
      });
      templateIds.push(template.id);
    }

    // Map step templateIds
    const steps: FlowStepInput[] = spec.steps.map((s) => ({
      type: s.type,
      delayHours: s.delayHours,
      templateId: s.templateIdx != null ? templateIds[s.templateIdx] : null,
      condition: s.condition,
    }));

    return this.create(orgId, userId, {
      name: spec.name,
      description: spec.description,
      triggerType: spec.triggerType as FlowTriggerTypeStr,
      reentryDays: spec.reentryDays,
      steps,
    });
  }
}

// ============================================================
// Pre-built Flow Specs
// ============================================================

type PreBuiltFlowKind = 'welcome' | 'abandoned_cart' | 'post_purchase';

interface PreBuiltSpec {
  name: string;
  description: string;
  triggerType: FlowTriggerTypeStr;
  reentryDays: number;
  templates: Array<{
    name: string;
    subject: string;
    preview?: string;
    blocks: any;
  }>;
  steps: Array<{
    type: FlowStepTypeStr;
    delayHours?: number;
    templateIdx?: number;
    condition?: any;
  }>;
}

const PRE_BUILT_FLOWS: Record<PreBuiltFlowKind, PreBuiltSpec> = {
  welcome: {
    name: 'Welcome-Serie',
    description: 'Begrüßt neue Abonnenten mit zwei Emails',
    triggerType: 'customer_created',
    reentryDays: 365,
    templates: [
      {
        name: 'Welcome Email 1',
        subject: 'Willkommen bei {{shop_name}}!',
        preview: 'Schön, dass du dabei bist.',
        blocks: [
          { type: 'heading', level: 1, content: 'Willkommen, {{first_name}}!', align: 'center' },
          { type: 'text', content: 'Danke, dass du Teil unserer Community bist. Wir freuen uns, dich an Bord zu haben.' },
          { type: 'button', label: 'Shop entdecken', href: 'https://{{shop.domain}}', align: 'center' },
          { type: 'spacer', height: 24 },
          { type: 'text', content: 'Bei Fragen einfach auf diese Mail antworten.', align: 'center', fontSize: 13, color: '#6b7280' },
        ],
      },
      {
        name: 'Welcome Email 2 — Rabatt',
        subject: '10% auf deinen ersten Einkauf, {{first_name}}',
        preview: 'Ein kleines Geschenk zum Start.',
        blocks: [
          { type: 'heading', level: 1, content: 'Ein kleines Willkommensgeschenk', align: 'center' },
          { type: 'text', content: 'Für deinen ersten Einkauf schenken wir dir 10% Rabatt. Einfach den Code unten verwenden.' },
          { type: 'heading', level: 2, content: 'WILLKOMMEN10', align: 'center' },
          { type: 'button', label: 'Jetzt einkaufen', href: 'https://{{shop.domain}}', align: 'center' },
        ],
      },
    ],
    steps: [
      { type: 'send_email', templateIdx: 0 },
      { type: 'delay', delayHours: 72 },
      { type: 'send_email', templateIdx: 1 },
      { type: 'end' },
    ],
  },

  abandoned_cart: {
    name: 'Abandoned Cart',
    description: 'Erinnert Kunden, die einen Checkout gestartet, aber nicht bestellt haben',
    triggerType: 'checkout_started',
    reentryDays: 7,
    templates: [
      {
        name: 'Cart Reminder 1h',
        subject: 'Du hast etwas vergessen, {{first_name}}',
        preview: 'Dein Warenkorb wartet.',
        blocks: [
          { type: 'heading', level: 1, content: 'Dein Warenkorb wartet' },
          { type: 'text', content: 'Du hast deinen Einkauf nicht abgeschlossen. Die Produkte sind für dich reserviert.' },
          { type: 'button', label: 'Zum Warenkorb', href: 'https://{{shop.domain}}/cart', align: 'center' },
        ],
      },
      {
        name: 'Cart Reminder 24h',
        subject: 'Noch Interesse? +10% Rabatt für dich',
        preview: 'Wir haben ein Angebot für dich.',
        blocks: [
          { type: 'heading', level: 1, content: 'Letzte Chance, {{first_name}}!' },
          { type: 'text', content: 'Damit du nichts verpasst, schenken wir dir 10% Rabatt. Code: COMEBACK10' },
          { type: 'button', label: 'Jetzt einlösen', href: 'https://{{shop.domain}}/cart', align: 'center' },
        ],
      },
    ],
    steps: [
      { type: 'delay', delayHours: 1 },
      { type: 'send_email', templateIdx: 0 },
      { type: 'delay', delayHours: 23 },
      { type: 'send_email', templateIdx: 1 },
      { type: 'end' },
    ],
  },

  post_purchase: {
    name: 'Post-Purchase',
    description: 'Thank-you-Mail + Review-Request nach dem Kauf',
    triggerType: 'order_placed',
    reentryDays: 0, // every order gets the flow
    templates: [
      {
        name: 'Order Thank You',
        subject: 'Danke für deine Bestellung!',
        preview: 'Wir freuen uns, dass du bei uns bestellt hast.',
        blocks: [
          { type: 'heading', level: 1, content: 'Danke, {{first_name}}!', align: 'center' },
          { type: 'text', content: 'Wir haben deine Bestellung erhalten und kümmern uns darum. Du bekommst eine Versand-Bestätigung, sobald sie unterwegs ist.' },
        ],
      },
      {
        name: 'Review Request',
        subject: 'Wie war dein Einkauf?',
        preview: 'Deine Bewertung hilft anderen Kunden.',
        blocks: [
          { type: 'heading', level: 1, content: 'Wie zufrieden bist du?' },
          { type: 'text', content: 'Hilf anderen Kunden bei ihrer Kaufentscheidung und bewerte dein Produkt in 30 Sekunden.' },
          { type: 'button', label: 'Jetzt bewerten', href: 'https://{{shop.domain}}/account', align: 'center' },
        ],
      },
    ],
    steps: [
      { type: 'send_email', templateIdx: 0 },
      { type: 'delay', delayHours: 336 }, // 14 days
      { type: 'send_email', templateIdx: 1 },
      { type: 'end' },
    ],
  },
};

export const PRE_BUILT_FLOW_CATALOG = Object.entries(PRE_BUILT_FLOWS).map(([kind, spec]) => ({
  kind,
  name: spec.name,
  description: spec.description,
  triggerType: spec.triggerType,
  emailCount: spec.templates.length,
}));
