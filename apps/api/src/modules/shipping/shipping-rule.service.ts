import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type RuleConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
export type RuleField = 'weightG' | 'totalPriceCents' | 'countryCode' | 'productVariantId' | 'tags' | 'lineCount';

export interface RuleCondition {
  field: RuleField;
  op: RuleConditionOp;
  value: any;
}

export interface RuleConditionTree {
  op: 'and' | 'or';
  rules: RuleCondition[];
}

export type RuleActionType = 'select_carrier' | 'select_method' | 'select_package' | 'block_shipment';

export interface RuleAction {
  type: RuleActionType;
  carrier?: string;
  method?: string;
  packageId?: string | null;
  reason?: string; // for block
}

export interface RuleInput {
  name: string;
  description?: string | null;
  priority?: number;
  conditions: RuleConditionTree;
  actionType: RuleActionType;
  actionValue: RuleAction;
  active?: boolean;
}

export interface OrderFacts {
  weightG: number;
  totalPriceCents: number;
  countryCode: string | null;
  productVariantIds: string[];
  tags: string[];
  lineCount: number;
}

@Injectable()
export class ShippingRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    return this.prisma.shippingRule.findMany({
      where: { orgId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async get(orgId: string, id: string) {
    const rule = await this.prisma.shippingRule.findFirst({ where: { id, orgId } });
    if (!rule) throw new NotFoundException('Regel nicht gefunden');
    return rule;
  }

  async create(orgId: string, userId: string, data: RuleInput) {
    this.validate(data);
    return this.prisma.shippingRule.create({
      data: {
        orgId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        priority: data.priority ?? 100,
        conditions: data.conditions as any,
        actionType: data.actionType,
        actionValue: data.actionValue as any,
        active: data.active ?? true,
        createdById: userId,
      },
    });
  }

  async update(orgId: string, id: string, data: Partial<RuleInput>) {
    const existing = await this.get(orgId, id);
    if (data.conditions) this.validate(data as RuleInput);
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.conditions !== undefined) patch.conditions = data.conditions as any;
    if (data.actionType !== undefined) patch.actionType = data.actionType;
    if (data.actionValue !== undefined) patch.actionValue = data.actionValue as any;
    if (data.active !== undefined) patch.active = data.active;
    return this.prisma.shippingRule.update({ where: { id: existing.id }, data: patch });
  }

  async remove(orgId: string, id: string) {
    const existing = await this.get(orgId, id);
    await this.prisma.shippingRule.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  /**
   * Evaluate all active rules against an order's facts in priority order.
   * Returns the first matching action (or null if no rules match).
   */
  async evaluate(orgId: string, facts: OrderFacts): Promise<RuleAction | null> {
    const rules = await this.prisma.shippingRule.findMany({
      where: { orgId, active: true },
      orderBy: { priority: 'asc' },
    });
    for (const rule of rules) {
      if (this.matches(rule.conditions as unknown as RuleConditionTree, facts)) {
        return rule.actionValue as unknown as RuleAction;
      }
    }
    return null;
  }

  matches(tree: RuleConditionTree, facts: OrderFacts): boolean {
    if (!tree || !Array.isArray(tree.rules) || tree.rules.length === 0) return false;
    const op = tree.op || 'and';
    if (op === 'and') {
      return tree.rules.every((r) => this.matchCondition(r, facts));
    }
    return tree.rules.some((r) => this.matchCondition(r, facts));
  }

  private matchCondition(c: RuleCondition, facts: OrderFacts): boolean {
    const actual = this.getField(c.field, facts);
    switch (c.op) {
      case 'eq': return Array.isArray(actual) ? actual.includes(c.value) : actual == c.value;
      case 'neq': return Array.isArray(actual) ? !actual.includes(c.value) : actual != c.value;
      case 'gt': return Number(actual) > Number(c.value);
      case 'gte': return Number(actual) >= Number(c.value);
      case 'lt': return Number(actual) < Number(c.value);
      case 'lte': return Number(actual) <= Number(c.value);
      case 'in': {
        const vals = Array.isArray(c.value) ? c.value : [c.value];
        if (Array.isArray(actual)) return actual.some((a) => vals.includes(a));
        return vals.includes(actual);
      }
      case 'nin': {
        const vals = Array.isArray(c.value) ? c.value : [c.value];
        if (Array.isArray(actual)) return !actual.some((a) => vals.includes(a));
        return !vals.includes(actual);
      }
      default: return false;
    }
  }

  private getField(field: RuleField, facts: OrderFacts): any {
    switch (field) {
      case 'weightG': return facts.weightG;
      case 'totalPriceCents': return facts.totalPriceCents;
      case 'countryCode': return facts.countryCode;
      case 'productVariantId': return facts.productVariantIds;
      case 'tags': return facts.tags;
      case 'lineCount': return facts.lineCount;
      default: return null;
    }
  }

  private validate(data: RuleInput) {
    if (!data.name?.trim()) throw new BadRequestException('Regel-Name fehlt');
    if (!data.conditions || !data.conditions.op || !Array.isArray(data.conditions.rules)) {
      throw new BadRequestException('Regel-Bedingungen ungültig');
    }
    if (!data.actionType || !data.actionValue) {
      throw new BadRequestException('Regel-Aktion fehlt');
    }
  }
}
