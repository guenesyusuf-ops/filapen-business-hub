import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeInvoiceStatus } from './invoice-status.helper';

export interface InvoiceListQuery {
  search?: string;
  status?: string;          // open | due_soon | due_today | overdue | paid
  tab?: string;             // sidebar shortcut — alias für status
  supplier?: string;
  category?: string;
  from?: string;            // YYYY-MM-DD — invoiceDate >= from
  to?: string;              // YYYY-MM-DD — invoiceDate <= to
  amountMin?: string;
  amountMax?: string;
  paid?: string;            // 'true' | 'false'
  archived?: string;        // 'true' | 'false'
  sort?: string;            // field
  dir?: 'asc' | 'desc';
  limit?: string;
  offset?: string;
}

// Felder, die der User in der Detailansicht ändern darf
const EDITABLE_FIELDS = [
  'supplierName', 'supplierAddress', 'supplierEmail', 'supplierPhone',
  'supplierWebsite', 'supplierVatId',
  'invoiceNumber', 'invoiceDate', 'serviceDate', 'dueDate',
  'paymentTerms', 'currency',
  'netAmount', 'vatAmount', 'grossAmount', 'taxRate', 'discountAmount',
  'iban', 'bic', 'bankName', 'paymentReference',
  'category', 'notes', 'reviewed',
] as const;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // LIST + COUNTS
  // ---------------------------------------------------------------------

  async list(orgId: string, q: InvoiceListQuery) {
    const where = this.buildWhere(orgId, q);
    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10));

    const sortField = this.safeSortField(q.sort);
    const sortDir: 'asc' | 'desc' = q.dir === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        take: limit,
        skip: offset,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async statusCounts(orgId: string) {
    const baseWhere = { orgId, archived: false };
    const [open, dueSoon, dueToday, overdue, paid, archived, all] = await Promise.all([
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'open' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'due_soon' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'due_today' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'overdue' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'paid' } }),
      this.prisma.invoice.count({ where: { orgId, archived: true } }),
      this.prisma.invoice.count({ where: { orgId } }),
    ]);
    return { open, due_soon: dueSoon, due_today: dueToday, overdue, paid, archived, all };
  }

  // ---------------------------------------------------------------------
  // GET ONE
  // ---------------------------------------------------------------------

  async get(orgId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, orgId },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!inv) throw new NotFoundException('Rechnung nicht gefunden');
    return inv;
  }

  // ---------------------------------------------------------------------
  // UPDATE (Inline-Edit aus Detailansicht)
  // ---------------------------------------------------------------------

  async update(orgId: string, id: string, userId: string, body: Record<string, any>) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Rechnung nicht gefunden');

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

    if (Object.keys(updates).length === 0) {
      return this.get(orgId, id);
    }

    // Status neu berechnen wenn dueDate angefasst wurde
    const newDue = 'dueDate' in updates ? updates.dueDate : existing.dueDate;
    if ('dueDate' in updates) {
      updates.status = computeInvoiceStatus({ dueDate: newDue, paidAt: existing.paidAt });
    }

    // Auf reviewed=true setzen sobald der User editiert — verhindert dass
    // ein verzögert ankommender OCR-Run die Userdaten ueberschreibt.
    if (updates.reviewed === undefined) updates.reviewed = true;

    // updateMany mit (id, orgId) als sicherheitsorientierter Filter — kein
    // Update wenn die Rechnung einer anderen Org gehoert.
    const res = await this.prisma.invoice.updateMany({ where: { id, orgId }, data: updates });
    if (res.count === 0) throw new NotFoundException('Rechnung nicht gefunden');
    await this.recordEvent(orgId, id, userId, 'edited', `Bearbeitet: ${changed.join(', ')}`, { fields: changed });

    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------------
  // BEZAHLT / UNBEZAHLT
  // ---------------------------------------------------------------------

  async markPaid(orgId: string, id: string, userId: string, opts: { paidAt?: string; note?: string }) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Rechnung nicht gefunden');

    const paidAt = opts.paidAt ? new Date(opts.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Zahlungsdatum ungueltig');

    await this.prisma.invoice.updateMany({
      where: { id, orgId },
      data: {
        status: 'paid',
        paidAt,
        paidById: userId,
      },
    });
    await this.recordEvent(orgId, id, userId, 'marked_paid', opts.note ?? `Als bezahlt markiert am ${paidAt.toLocaleDateString('de-DE')}`, { paidAt });
    return this.get(orgId, id);
  }

  async markUnpaid(orgId: string, id: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Rechnung nicht gefunden');

    const status = computeInvoiceStatus({ dueDate: existing.dueDate, paidAt: null });
    await this.prisma.invoice.updateMany({
      where: { id, orgId },
      data: { status, paidAt: null, paidById: null, paymentProofPath: null },
    });
    await this.recordEvent(orgId, id, userId, 'marked_unpaid', 'Zahlung zurückgesetzt', null);
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------------
  // ARCHIV / DELETE
  // ---------------------------------------------------------------------

  async archive(orgId: string, id: string, userId: string) {
    const res = await this.prisma.invoice.updateMany({ where: { id, orgId }, data: { archived: true } });
    if (res.count === 0) throw new NotFoundException('Rechnung nicht gefunden');
    await this.recordEvent(orgId, id, userId, 'archived', 'Archiviert', null);
    return { archived: true };
  }

  async restore(orgId: string, id: string, userId: string) {
    const res = await this.prisma.invoice.updateMany({ where: { id, orgId }, data: { archived: false } });
    if (res.count === 0) throw new NotFoundException('Rechnung nicht gefunden');
    await this.recordEvent(orgId, id, userId, 'restored', 'Wiederhergestellt', null);
    return { archived: false };
  }

  async remove(orgId: string, id: string) {
    const res = await this.prisma.invoice.deleteMany({ where: { id, orgId } });
    if (res.count === 0) throw new NotFoundException('Rechnung nicht gefunden');
    return { deleted: true };
  }

  // ---------------------------------------------------------------------
  // EVENT-LOG
  // ---------------------------------------------------------------------

  async recordEvent(
    orgId: string,
    invoiceId: string,
    actorId: string | null,
    type: string,
    note: string | null,
    metadata: any,
  ) {
    return this.prisma.invoiceEvent.create({
      data: {
        orgId,
        invoiceId,
        actorId: actorId ?? undefined,
        type,
        note: note ?? undefined,
        metadata: metadata ?? undefined,
      },
    });
  }

  // ---------------------------------------------------------------------
  // SUPPLIER OVERVIEW (für P8) — schon hier, wird in P8 ausgebaut
  // ---------------------------------------------------------------------

  async suppliers(orgId: string) {
    const rows = await this.prisma.invoice.groupBy({
      by: ['supplierName'],
      where: { orgId, supplierName: { not: null } },
      _count: { _all: true },
      _sum: { grossAmount: true },
    });
    return rows
      .map((r) => ({
        supplierName: r.supplierName,
        invoiceCount: r._count._all,
        totalSpend: r._sum.grossAmount ? Number(r._sum.grossAmount) : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }

  /**
   * Detaillierte Lieferanten-Übersicht fuer die Lieferanten-Seite:
   * Anzahl, Gesamtausgaben, Offen/Bezahlt-Summen, letzte Rechnung, letzte Zahlung.
   */
  async suppliersDetailed(orgId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { orgId, supplierName: { not: null }, archived: false },
      select: {
        supplierName: true,
        grossAmount: true,
        status: true,
        invoiceDate: true,
        paidAt: true,
      },
    });

    const byName = new Map<string, {
      supplierName: string;
      invoiceCount: number;
      totalSpend: number;
      openSpend: number;
      paidSpend: number;
      lastInvoiceDate: Date | null;
      lastPaymentDate: Date | null;
    }>();

    for (const r of rows) {
      if (!r.supplierName) continue;
      const e = byName.get(r.supplierName) ?? {
        supplierName: r.supplierName,
        invoiceCount: 0,
        totalSpend: 0,
        openSpend: 0,
        paidSpend: 0,
        lastInvoiceDate: null as Date | null,
        lastPaymentDate: null as Date | null,
      };
      const gross = r.grossAmount ? Number(r.grossAmount) : 0;
      e.invoiceCount++;
      e.totalSpend += gross;
      if (r.status === 'paid') e.paidSpend += gross;
      else e.openSpend += gross;
      if (r.invoiceDate && (!e.lastInvoiceDate || r.invoiceDate > e.lastInvoiceDate)) {
        e.lastInvoiceDate = r.invoiceDate;
      }
      if (r.paidAt && (!e.lastPaymentDate || r.paidAt > e.lastPaymentDate)) {
        e.lastPaymentDate = r.paidAt;
      }
      byName.set(r.supplierName, e);
    }

    return Array.from(byName.values())
      .map((e) => ({
        ...e,
        avgInvoice: e.invoiceCount > 0 ? e.totalSpend / e.invoiceCount : 0,
        totalSpend: round2(e.totalSpend),
        openSpend: round2(e.openSpend),
        paidSpend: round2(e.paidSpend),
        lastInvoiceDate: e.lastInvoiceDate?.toISOString() ?? null,
        lastPaymentDate: e.lastPaymentDate?.toISOString() ?? null,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }

  // ---------------------------------------------------------------------
  // CRON-Hook: Status für alle offenen Rechnungen neu berechnen
  // ---------------------------------------------------------------------

  async refreshStatuses(orgId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { orgId, paidAt: null, archived: false, dueDate: { not: null } },
      select: { id: true, dueDate: true, status: true },
    });
    const now = new Date();
    let touched = 0;
    for (const r of rows) {
      const next = computeInvoiceStatus({ dueDate: r.dueDate, paidAt: null, now });
      if (next !== r.status) {
        await this.prisma.invoice.update({ where: { id: r.id }, data: { status: next } });
        touched++;
      }
    }
    if (touched > 0) {
      this.logger.log(`[orgId=${orgId}] refreshStatuses → ${touched} Rechnungen aktualisiert`);
    }
    return { touched };
  }

  // ---------------------------------------------------------------------
  // Privates
  // ---------------------------------------------------------------------

  private buildWhere(orgId: string, q: InvoiceListQuery): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = { orgId };
    const status = q.status || q.tab;

    if (q.archived === 'true') where.archived = true;
    else if (q.archived === 'false') where.archived = false;
    else where.archived = false; // Default: Archiv ausblenden

    if (status) {
      if (status === 'all') {
        // kein Filter
      } else if (status === 'unpaid') {
        where.status = { not: 'paid' };
      } else {
        where.status = status;
      }
    }

    if (q.paid === 'true') where.status = 'paid';
    if (q.paid === 'false') where.status = { not: 'paid' };

    if (q.supplier) where.supplierName = { contains: q.supplier, mode: 'insensitive' };
    if (q.category) where.category = q.category;

    if (q.from || q.to) {
      where.invoiceDate = {};
      if (q.from) (where.invoiceDate as any).gte = new Date(q.from);
      if (q.to) (where.invoiceDate as any).lte = new Date(q.to);
    }

    if (q.amountMin || q.amountMax) {
      where.grossAmount = {};
      if (q.amountMin) (where.grossAmount as any).gte = new Prisma.Decimal(q.amountMin);
      if (q.amountMax) (where.grossAmount as any).lte = new Prisma.Decimal(q.amountMax);
    }

    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { supplierName: { contains: s, mode: 'insensitive' } },
        { invoiceNumber: { contains: s, mode: 'insensitive' } },
        { paymentReference: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { fileName: { contains: s, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private safeSortField(field: string | undefined): string {
    const allowed = [
      'createdAt', 'updatedAt', 'invoiceDate', 'dueDate',
      'grossAmount', 'supplierName', 'invoiceNumber', 'status',
    ];
    return allowed.includes(field ?? '') ? (field as string) : 'createdAt';
  }

  private coerceField(field: string, raw: any): any {
    if (raw === '' || raw === undefined) return null;
    if (raw === null) return null;
    const dateFields = ['invoiceDate', 'serviceDate', 'dueDate'];
    const decimalFields = ['netAmount', 'vatAmount', 'grossAmount', 'taxRate', 'discountAmount'];
    if (dateFields.includes(field)) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    }
    if (decimalFields.includes(field)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return new Prisma.Decimal(n.toFixed(2));
    }
    if (field === 'reviewed') return Boolean(raw);
    if (typeof raw === 'string') return raw.trim() || null;
    return raw;
  }

  private isMeaningfulChange(prev: any, next: any): boolean {
    if (prev == null && next == null) return false;
    if (prev instanceof Date && next instanceof Date) return prev.getTime() !== next.getTime();
    if (prev?.toString && next?.toString) return prev.toString() !== next.toString();
    return prev !== next;
  }
}

function round2(n: number) { return Math.round(n * 100) / 100; }
