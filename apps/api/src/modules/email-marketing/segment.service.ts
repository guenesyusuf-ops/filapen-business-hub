import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ============================================================
// Segment Rule Schema (serialised as JSON in DB)
// ============================================================

export type BoolOp = 'and' | 'or';

export type PropertyOp =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'is_set' | 'is_not_set'
  | 'includes' | 'excludes'          // for string[] tags
  | 'within_days' | 'before_days' | 'after_days'; // for dates — "in last N days"

export type EventOp = 'at_least' | 'at_most' | 'exactly' | 'zero';

export interface PropertyRule {
  type: 'property';
  field: ContactField;
  op: PropertyOp;
  value?: any;
  negate?: boolean;
}

export interface EventRule {
  type: 'event';
  event: string;                    // e.g. 'order_placed', 'viewed_product'
  op: EventOp;
  count?: number;                   // required except 'zero'
  withinDays?: number;              // e.g. 30 → events in last 30 days (default: all time)
  /** Optional payload filter: e.g. { productId: 'gid://...' } */
  where?: Record<string, any>;
  negate?: boolean;
}

export interface GroupRule {
  type: 'group';
  op: BoolOp;
  rules: Rule[];
}

export type Rule = PropertyRule | EventRule | GroupRule;

export interface RuleTree {
  op: BoolOp;
  rules: Rule[];
}

export type ContactField =
  | 'email' | 'firstName' | 'lastName' | 'phone'
  | 'country' | 'city' | 'province' | 'zip' | 'locale'
  | 'tags'
  | 'marketingConsent'
  | 'totalSpent' | 'ordersCount' | 'avgOrderValue'
  | 'firstOrderAt' | 'lastOrderAt' | 'lastSeenAt' | 'createdAt'
  | 'consentedAt' | 'unsubscribedAt';

const NUMERIC_FIELDS: ContactField[] = ['totalSpent', 'ordersCount', 'avgOrderValue'];
const DATE_FIELDS: ContactField[] = ['firstOrderAt', 'lastOrderAt', 'lastSeenAt', 'createdAt', 'consentedAt', 'unsubscribedAt'];
const ARRAY_FIELDS: ContactField[] = ['tags'];

// ============================================================

export interface SegmentInput {
  name: string;
  description?: string | null;
  rules: RuleTree;
}

@Injectable()
export class SegmentService {
  private readonly logger = new Logger(SegmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------- CRUD ----------------

  async list(orgId: string) {
    return this.prisma.segment.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(orgId: string, id: string) {
    const seg = await this.prisma.segment.findFirst({ where: { id, orgId } });
    if (!seg) throw new NotFoundException('Segment nicht gefunden');
    return seg;
  }

  async create(orgId: string, userId: string, data: SegmentInput) {
    this.validate(data);
    const seg = await this.prisma.segment.create({
      data: {
        orgId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        rules: data.rules as any,
        createdById: userId,
      },
    });
    // Compute initial member count (best-effort)
    this.refreshMemberCount(orgId, seg.id).catch(() => {});
    return seg;
  }

  async update(orgId: string, id: string, data: Partial<SegmentInput>) {
    if (data.rules) this.validate({ name: 'x', rules: data.rules });
    const existing = await this.get(orgId, id);
    const updated = await this.prisma.segment.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.rules !== undefined && { rules: data.rules as any }),
      },
    });
    this.refreshMemberCount(orgId, id).catch(() => {});
    return updated;
  }

  async delete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.segment.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------- Evaluation ----------------

  /**
   * Live-preview: counts + sample contacts (first 10).
   */
  async preview(orgId: string, rules: RuleTree) {
    this.validate({ name: 'preview', rules });
    const where = await this.buildWhere(orgId, rules);
    const [count, sample] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, marketingConsent: true, totalSpent: true, ordersCount: true, lastOrderAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return { count, sample };
  }

  async refreshMemberCount(orgId: string, segmentId: string): Promise<number> {
    const seg = await this.prisma.segment.findFirst({ where: { id: segmentId, orgId } });
    if (!seg) return 0;
    const rules = seg.rules as unknown as RuleTree;
    if (!rules || !Array.isArray(rules.rules)) return 0;
    try {
      const where = await this.buildWhere(orgId, rules);
      const count = await this.prisma.contact.count({ where });
      await this.prisma.segment.update({
        where: { id: segmentId },
        data: { memberCount: count, lastRefreshedAt: new Date() },
      });
      return count;
    } catch (err: any) {
      this.logger.warn(`refreshMemberCount failed for ${segmentId}: ${err?.message}`);
      return seg.memberCount;
    }
  }

  /**
   * Iterate all member contact IDs (used by campaign sender).
   * Batches via DB cursor so we don't load millions of rows.
   */
  async *iterateMembers(orgId: string, segmentId: string, batchSize = 500): AsyncGenerator<string[]> {
    const seg = await this.get(orgId, segmentId);
    const where = await this.buildWhere(orgId, seg.rules as unknown as RuleTree);
    let cursor: string | undefined = undefined;
    while (true) {
      const batch: { id: string }[] = await this.prisma.contact.findMany({
        where,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      yield batch.map((b) => b.id);
      cursor = batch[batch.length - 1].id;
      if (batch.length < batchSize) break;
    }
  }

  // ---------------- Rule → Prisma where ----------------

  async buildWhere(orgId: string, tree: RuleTree): Promise<Prisma.ContactWhereInput> {
    const base: Prisma.ContactWhereInput = { orgId };
    const compiled = await this.compileGroup(orgId, tree);
    if (tree.op === 'and') {
      return { AND: [base, compiled] };
    }
    // Even with OR at top-level, orgId must be enforced: AND(orgId, OR(...))
    return { AND: [base, compiled] };
  }

  private async compileGroup(orgId: string, group: { op: BoolOp; rules: Rule[] }): Promise<Prisma.ContactWhereInput> {
    const compiled: Prisma.ContactWhereInput[] = [];
    for (const rule of group.rules || []) {
      const part = await this.compileRule(orgId, rule);
      if (part) compiled.push(part);
    }
    if (compiled.length === 0) return {};
    if (group.op === 'or') return { OR: compiled };
    return { AND: compiled };
  }

  private async compileRule(orgId: string, rule: Rule): Promise<Prisma.ContactWhereInput | null> {
    if (rule.type === 'group') return this.compileGroup(orgId, rule);
    if (rule.type === 'property') return this.compilePropertyRule(rule);
    if (rule.type === 'event') return this.compileEventRule(orgId, rule);
    return null;
  }

  private compilePropertyRule(rule: PropertyRule): Prisma.ContactWhereInput | null {
    const { field, op, value } = rule;
    const isNumeric = NUMERIC_FIELDS.includes(field);
    const isDate = DATE_FIELDS.includes(field);
    const isArray = ARRAY_FIELDS.includes(field);

    let filter: any;
    switch (op) {
      case 'eq': filter = { equals: value }; break;
      case 'neq': filter = { not: value }; break;
      case 'gt': filter = { gt: this.coerce(value, isNumeric, isDate) }; break;
      case 'gte': filter = { gte: this.coerce(value, isNumeric, isDate) }; break;
      case 'lt': filter = { lt: this.coerce(value, isNumeric, isDate) }; break;
      case 'lte': filter = { lte: this.coerce(value, isNumeric, isDate) }; break;
      case 'in': filter = { in: Array.isArray(value) ? value : [value] }; break;
      case 'nin': filter = { notIn: Array.isArray(value) ? value : [value] }; break;
      case 'contains': filter = { contains: String(value), mode: 'insensitive' }; break;
      case 'not_contains': return { [field]: { not: { contains: String(value), mode: 'insensitive' } } };
      case 'starts_with': filter = { startsWith: String(value), mode: 'insensitive' }; break;
      case 'ends_with': filter = { endsWith: String(value), mode: 'insensitive' }; break;
      case 'is_set': return { [field]: { not: null } };
      case 'is_not_set': return { [field]: null };
      case 'includes':
        if (!isArray) throw new BadRequestException(`Feld ${field} ist kein Array`);
        return { tags: { has: String(value) } };
      case 'excludes':
        if (!isArray) throw new BadRequestException(`Feld ${field} ist kein Array`);
        return { NOT: { tags: { has: String(value) } } };
      case 'within_days': {
        if (!isDate) throw new BadRequestException(`Feld ${field} ist kein Datum`);
        const days = Number(value) || 0;
        const cutoff = new Date(Date.now() - days * 86400000);
        return { [field]: { gte: cutoff } };
      }
      case 'before_days': {
        if (!isDate) throw new BadRequestException(`Feld ${field} ist kein Datum`);
        const days = Number(value) || 0;
        const cutoff = new Date(Date.now() - days * 86400000);
        return { [field]: { lt: cutoff } };
      }
      case 'after_days': {
        if (!isDate) throw new BadRequestException(`Feld ${field} ist kein Datum`);
        const days = Number(value) || 0;
        const cutoff = new Date(Date.now() + days * 86400000);
        return { [field]: { gt: cutoff } };
      }
      default:
        throw new BadRequestException(`Unbekannter Property-Operator: ${op}`);
    }

    if (rule.negate) {
      return { NOT: { [field]: filter } };
    }
    return { [field]: filter };
  }

  private async compileEventRule(orgId: string, rule: EventRule): Promise<Prisma.ContactWhereInput> {
    // Evaluate event-count per contact and return contactIds that match
    const since = rule.withinDays ? new Date(Date.now() - rule.withinDays * 86400000) : null;

    // Use groupBy on marketing_events to count per contact
    const eventWhere: Prisma.MarketingEventWhereInput = {
      orgId,
      type: rule.event,
      ...(since ? { occurredAt: { gte: since } } : {}),
      contactId: { not: null },
    };

    // Optional payload filter — translated to JSON path queries if provided
    if (rule.where) {
      // Prisma JSON filtering: we use `payload.path.equals`
      const pathFilters: Prisma.MarketingEventWhereInput[] = [];
      for (const [k, v] of Object.entries(rule.where)) {
        pathFilters.push({ payload: { path: [k], equals: v as any } });
      }
      if (pathFilters.length > 0) eventWhere.AND = pathFilters;
    }

    const grouped = await this.prisma.marketingEvent.groupBy({
      by: ['contactId'],
      where: eventWhere,
      _count: { _all: true },
    });

    const threshold = rule.count ?? 1;
    const matchingIds = grouped
      .filter((g) => {
        const c = g._count._all;
        if (rule.op === 'at_least') return c >= threshold;
        if (rule.op === 'at_most') return c <= threshold;
        if (rule.op === 'exactly') return c === threshold;
        if (rule.op === 'zero') return false; // handled below
        return false;
      })
      .map((g) => g.contactId!)
      .filter(Boolean);

    if (rule.op === 'zero') {
      // "Never did X" — easiest: select contacts WHERE NOT IN (contacts who did X at least once)
      const didAnyIds = grouped.map((g) => g.contactId!).filter(Boolean);
      return rule.negate
        ? { id: { in: didAnyIds } }
        : { id: { notIn: didAnyIds.length > 0 ? didAnyIds : ['__empty__'] } };
    }

    if (rule.negate) {
      return { id: { notIn: matchingIds.length > 0 ? matchingIds : ['__empty__'] } };
    }
    return { id: { in: matchingIds.length > 0 ? matchingIds : ['__empty__'] } };
  }

  private coerce(v: any, numeric: boolean, date: boolean) {
    if (numeric) return new Prisma.Decimal(String(v));
    if (date) return new Date(v);
    return v;
  }

  private validate(data: { name: string; rules: RuleTree }) {
    if (!data.name?.trim()) throw new BadRequestException('Segment-Name fehlt');
    if (!data.rules || !data.rules.op || !Array.isArray(data.rules.rules)) {
      throw new BadRequestException('Regel-Baum ungültig');
    }
    if (data.rules.op !== 'and' && data.rules.op !== 'or') {
      throw new BadRequestException('Top-level op muss and/or sein');
    }
  }
}
