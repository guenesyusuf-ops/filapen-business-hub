import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ReturnStatus = 'open' | 'in_review' | 'accepted' | 'rejected' | 'refunded';
export type ReturnPlatform = 'tiktok' | 'shopify';
export type RejectionReason = 'used' | 'customer_damaged' | 'incomplete' | 'wrong_product' | 'other';

export interface ReturnListQuery {
  platform?: string;     // tiktok | shopify
  status?: string;       // open | in_review | accepted | rejected | refunded | unresolved
  tab?: string;          // alias für status
  search?: string;
  productId?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  limit?: string;
  offset?: string;
}

export interface ReturnInput {
  platform: string;
  orderNumber: string;
  requestDate: string;
  customerName?: string | null;
  customerEmail?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  items: Array<{
    productId?: string | null;
    productFreetext?: string | null;
    quantity?: number;
    notes?: string | null;
  }>;
}

const EDITABLE_FIELDS = [
  'platform', 'orderNumber', 'requestDate',
  'customerName', 'customerEmail', 'trackingNumber',
  'notes', 'damaged',
] as const;

@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------

  async list(orgId: string, q: ReturnListQuery) {
    const where = this.buildWhere(orgId, q);
    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10));
    const sortField = this.safeSortField(q.sort);
    const sortDir: 'asc' | 'desc' = q.dir === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        take: limit,
        skip: offset,
        include: {
          items: true,
          images: { orderBy: { createdAt: 'asc' }, take: 6 },
          _count: { select: { images: true } },
        },
      }),
      this.prisma.return.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async statusCounts(orgId: string, platform?: string) {
    const base: any = { orgId };
    if (platform) base.platform = platform;
    const [open, inReview, accepted, rejected, refunded, all] = await Promise.all([
      this.prisma.return.count({ where: { ...base, status: 'open' } }),
      this.prisma.return.count({ where: { ...base, status: 'in_review' } }),
      this.prisma.return.count({ where: { ...base, status: 'accepted' } }),
      this.prisma.return.count({ where: { ...base, status: 'rejected' } }),
      this.prisma.return.count({ where: { ...base, status: 'refunded' } }),
      this.prisma.return.count({ where: base }),
    ]);
    return { open, in_review: inReview, accepted, rejected, refunded, all };
  }

  // ---------------------------------------------------------------------
  // GET ONE — mit Items, Bildern, Audit-Log + Bearbeiter-Namen
  // ---------------------------------------------------------------------

  async get(orgId: string, id: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, orgId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        images: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!ret) throw new NotFoundException('Retoure nicht gefunden');

    // Produkte fuer items resolven
    const productIds = ret.items.map((i) => i.productId).filter((p): p is string => !!p);
    const products = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Users für Audit resolven
    const userIds = new Set<string>();
    if (ret.createdById) userIds.add(ret.createdById);
    if (ret.decidedById) userIds.add(ret.decidedById);
    for (const ev of ret.events) if (ev.actorId) userIds.add(ev.actorId);
    for (const img of ret.images) if (img.uploadedById) userIds.add(img.uploadedById);

    const users = userIds.size > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const display = (uid: string | null | undefined) => {
      if (!uid) return null;
      const u = userMap.get(uid);
      if (!u) return null;
      const name = u.name
        || [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
        || u.email;
      return { id: u.id, name, email: u.email };
    };

    return {
      ...ret,
      createdBy: display(ret.createdById),
      decidedBy: display(ret.decidedById),
      items: ret.items.map((i) => ({
        ...i,
        product: i.productId ? (productMap.get(i.productId) ?? null) : null,
      })),
      images: ret.images.map((img) => ({
        ...img,
        uploadedBy: display(img.uploadedById),
      })),
      events: ret.events.map((ev) => ({
        ...ev,
        actor: display(ev.actorId),
      })),
    };
  }

  // ---------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------

  async create(orgId: string, userId: string, data: ReturnInput) {
    if (!data.platform || !['tiktok', 'shopify'].includes(data.platform)) {
      throw new BadRequestException('Plattform muss tiktok oder shopify sein');
    }
    if (!data.orderNumber?.trim()) throw new BadRequestException('Bestellnummer ist erforderlich');
    if (!data.requestDate) throw new BadRequestException('Datum der Retourenanfrage ist erforderlich');

    const reqDate = new Date(data.requestDate);
    if (Number.isNaN(reqDate.getTime())) throw new BadRequestException('Datum ungueltig');

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new BadRequestException('Mindestens eine Position ist erforderlich');

    const ret = await this.prisma.return.create({
      data: {
        orgId,
        createdById: userId,
        platform: data.platform,
        orderNumber: data.orderNumber.trim(),
        requestDate: reqDate,
        customerName: data.customerName?.trim() || null,
        customerEmail: data.customerEmail?.trim() || null,
        trackingNumber: data.trackingNumber?.trim() || null,
        notes: data.notes?.trim() || null,
        status: 'open',
        items: {
          create: items.map((it) => ({
            productId: it.productId || null,
            productFreetext: it.productFreetext?.trim() || null,
            quantity: Math.max(1, Math.floor(Number(it.quantity ?? 1))),
            notes: it.notes?.trim() || null,
          })),
        },
      },
    });

    await this.recordEvent(orgId, ret.id, userId, 'created', `Retoure angelegt (${items.length} Position${items.length === 1 ? '' : 'en'})`, null);

    return this.get(orgId, ret.id);
  }

  // ---------------------------------------------------------------------
  // UPDATE — Header-Felder
  // ---------------------------------------------------------------------

  async update(orgId: string, id: string, userId: string, body: Record<string, any>) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');

    const updates: any = {};
    const changed: string[] = [];
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const raw = body[field];
      const next = this.coerceField(field, raw);
      if (this.isMeaningfulChange((existing as any)[field], next)) {
        updates[field] = next;
        changed.push(field);
      }
    }
    if (Object.keys(updates).length === 0) return this.get(orgId, id);

    const res = await this.prisma.return.updateMany({ where: { id, orgId }, data: updates });
    if (res.count === 0) throw new NotFoundException('Retoure nicht gefunden');
    await this.recordEvent(orgId, id, userId, 'edited', `Bearbeitet: ${changed.join(', ')}`, { fields: changed });
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------------
  // STATUS-WORKFLOW
  // ---------------------------------------------------------------------

  /** Lager: Bilder fertig, weiter an Backoffice */
  async submitForReview(orgId: string, id: string, userId: string) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');
    if (existing.status !== 'open') {
      throw new BadRequestException(`Status ist bereits '${existing.status}', kann nicht zur Prüfung weitergeschoben werden`);
    }
    await this.prisma.return.updateMany({
      where: { id, orgId },
      data: { status: 'in_review' },
    });
    await this.recordEvent(orgId, id, userId, 'status_changed', 'Zur Prüfung weitergegeben', { from: 'open', to: 'in_review' });
    return this.get(orgId, id);
  }

  async accept(orgId: string, id: string, userId: string, opts: { refundAmount?: number; refundDate?: string; damaged?: boolean; note?: string }) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');

    const data: any = {
      status: 'accepted',
      decidedById: userId,
      decidedAt: new Date(),
      rejectionReason: null,
      rejectionNote: null,
    };
    if (opts.refundAmount != null && Number.isFinite(Number(opts.refundAmount))) {
      data.refundAmount = new Prisma.Decimal(Number(opts.refundAmount).toFixed(2));
    }
    if (opts.refundDate) {
      const d = new Date(opts.refundDate);
      if (!Number.isNaN(d.getTime())) {
        data.refundDate = d;
        // Wenn Erstattungsdatum gesetzt → direkt status=refunded
        data.status = 'refunded';
      }
    }
    if (opts.damaged === true || opts.damaged === false) data.damaged = opts.damaged;

    await this.prisma.return.updateMany({ where: { id, orgId }, data });
    await this.recordEvent(
      orgId, id, userId,
      data.status === 'refunded' ? 'refunded' : 'accepted',
      opts.note ?? (data.status === 'refunded' ? 'Akzeptiert und erstattet' : 'Akzeptiert'),
      { refundAmount: opts.refundAmount, refundDate: opts.refundDate, damaged: opts.damaged },
    );
    return this.get(orgId, id);
  }

  async reject(orgId: string, id: string, userId: string, opts: { reason: string; note?: string }) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');

    const allowed: RejectionReason[] = ['used', 'customer_damaged', 'incomplete', 'wrong_product', 'other'];
    if (!opts.reason || !allowed.includes(opts.reason as RejectionReason)) {
      throw new BadRequestException('Ungueltiger Ablehnungsgrund');
    }
    if (opts.reason === 'other' && !opts.note?.trim()) {
      throw new BadRequestException('Bei "Anderer Grund" ist eine Notiz erforderlich');
    }

    await this.prisma.return.updateMany({
      where: { id, orgId },
      data: {
        status: 'rejected',
        rejectionReason: opts.reason,
        rejectionNote: opts.note?.trim() || null,
        decidedById: userId,
        decidedAt: new Date(),
        refundAmount: null,
        refundDate: null,
      },
    });
    await this.recordEvent(orgId, id, userId, 'rejected', `Abgelehnt: ${this.reasonLabel(opts.reason)}${opts.note ? ` — ${opts.note}` : ''}`, { reason: opts.reason });
    return this.get(orgId, id);
  }

  /** Endgueltige Erstattung markieren (nach accepted) */
  async markRefunded(orgId: string, id: string, userId: string, opts: { refundAmount?: number; refundDate?: string }) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');
    if (existing.status !== 'accepted' && existing.status !== 'refunded') {
      throw new BadRequestException('Nur akzeptierte Retouren koennen als erstattet markiert werden');
    }
    const data: any = { status: 'refunded' };
    if (opts.refundAmount != null && Number.isFinite(Number(opts.refundAmount))) {
      data.refundAmount = new Prisma.Decimal(Number(opts.refundAmount).toFixed(2));
    }
    if (opts.refundDate) {
      const d = new Date(opts.refundDate);
      if (!Number.isNaN(d.getTime())) data.refundDate = d;
    } else if (!existing.refundDate) {
      data.refundDate = new Date();
    }
    await this.prisma.return.updateMany({ where: { id, orgId }, data });
    await this.recordEvent(orgId, id, userId, 'refunded', `Erstattung markiert${data.refundAmount ? ` (${data.refundAmount} EUR)` : ''}`, null);
    return this.get(orgId, id);
  }

  /** Status zurueckdrehen — z.B. fuer Reklamation */
  async revert(orgId: string, id: string, userId: string, targetStatus: ReturnStatus) {
    const existing = await this.prisma.return.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Retoure nicht gefunden');

    const allowed: ReturnStatus[] = ['open', 'in_review', 'accepted', 'rejected', 'refunded'];
    if (!allowed.includes(targetStatus)) throw new BadRequestException('Ungueltiger Status');

    const data: any = { status: targetStatus };
    // Wenn zurueck auf open/in_review → Entscheidungs-Felder leeren
    if (targetStatus === 'open' || targetStatus === 'in_review') {
      data.rejectionReason = null;
      data.rejectionNote = null;
      data.decidedById = null;
      data.decidedAt = null;
      data.refundAmount = null;
      data.refundDate = null;
    }
    await this.prisma.return.updateMany({ where: { id, orgId }, data });
    await this.recordEvent(orgId, id, userId, 'status_changed', `Status zurueckgesetzt auf ${targetStatus}`, { from: existing.status, to: targetStatus });
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------------
  // POSITIONEN (Items)
  // ---------------------------------------------------------------------

  async addItem(orgId: string, id: string, userId: string, item: { productId?: string | null; productFreetext?: string | null; quantity?: number; notes?: string | null }) {
    const ret = await this.prisma.return.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!ret) throw new NotFoundException('Retoure nicht gefunden');
    await this.prisma.returnItem.create({
      data: {
        returnId: id,
        productId: item.productId || null,
        productFreetext: item.productFreetext?.trim() || null,
        quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
        notes: item.notes?.trim() || null,
      },
    });
    await this.recordEvent(orgId, id, userId, 'item_added', 'Position hinzugefügt', null);
    return this.get(orgId, id);
  }

  async removeItem(orgId: string, id: string, userId: string, itemId: string) {
    const ret = await this.prisma.return.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!ret) throw new NotFoundException('Retoure nicht gefunden');
    await this.prisma.returnItem.deleteMany({ where: { id: itemId, returnId: id } });
    await this.recordEvent(orgId, id, userId, 'item_removed', 'Position entfernt', null);
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------

  async remove(orgId: string, id: string) {
    const res = await this.prisma.return.deleteMany({ where: { id, orgId } });
    if (res.count === 0) throw new NotFoundException('Retoure nicht gefunden');
    return { deleted: true };
  }

  // ---------------------------------------------------------------------
  // PRODUKT-SUCHE für das Anlege-Modal (autocomplete)
  // ---------------------------------------------------------------------

  async searchProducts(orgId: string, q: string | undefined, limit = 20) {
    const where: any = { orgId };
    if (q && q.trim()) {
      where.title = { contains: q.trim(), mode: 'insensitive' };
    }
    return this.prisma.product.findMany({
      where,
      select: { id: true, title: true, status: true },
      orderBy: { title: 'asc' },
      take: Math.min(50, Math.max(1, limit)),
    });
  }

  // ---------------------------------------------------------------------
  // EVENT-LOG
  // ---------------------------------------------------------------------

  async recordEvent(
    orgId: string,
    returnId: string,
    actorId: string | null,
    type: string,
    note: string | null,
    metadata: any,
  ) {
    return this.prisma.returnEvent.create({
      data: {
        orgId,
        returnId,
        actorId: actorId ?? undefined,
        type,
        note: note ?? undefined,
        metadata: metadata ?? undefined,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Privates
  // ---------------------------------------------------------------------

  private buildWhere(orgId: string, q: ReturnListQuery): Prisma.ReturnWhereInput {
    const where: Prisma.ReturnWhereInput = { orgId };
    if (q.platform === 'tiktok' || q.platform === 'shopify') {
      where.platform = q.platform;
    }
    const status = q.status || q.tab;
    if (status) {
      if (status === 'all') {
        // kein Filter
      } else if (status === 'unresolved') {
        where.status = { in: ['open', 'in_review'] };
      } else {
        where.status = status;
      }
    }
    if (q.from || q.to) {
      where.requestDate = {};
      if (q.from) (where.requestDate as any).gte = new Date(q.from);
      if (q.to) (where.requestDate as any).lte = new Date(q.to);
    }
    if (q.productId) {
      where.items = { some: { productId: q.productId } };
    }
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerEmail: { contains: s, mode: 'insensitive' } },
        { trackingNumber: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { items: { some: { productFreetext: { contains: s, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private safeSortField(field: string | undefined): string {
    const allowed = ['createdAt', 'updatedAt', 'requestDate', 'status', 'orderNumber', 'customerName', 'refundAmount'];
    return allowed.includes(field ?? '') ? (field as string) : 'createdAt';
  }

  private coerceField(field: string, raw: any): any {
    if (raw === '' || raw === undefined) return null;
    if (raw === null) return null;
    if (field === 'requestDate') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (field === 'damaged') return Boolean(raw);
    if (typeof raw === 'string') return raw.trim() || null;
    return raw;
  }

  private isMeaningfulChange(prev: any, next: any): boolean {
    if (prev == null && next == null) return false;
    if (prev instanceof Date && next instanceof Date) return prev.getTime() !== next.getTime();
    if (prev?.toString && next?.toString) return prev.toString() !== next.toString();
    return prev !== next;
  }

  private reasonLabel(r: string): string {
    const m: Record<string, string> = {
      used: 'Produkt benutzt',
      customer_damaged: 'Produkt vom Kunden beschädigt',
      incomplete: 'Nicht vollständig',
      wrong_product: 'Falsches Produkt',
      other: 'Anderer Grund',
    };
    return m[r] ?? r;
  }
}
