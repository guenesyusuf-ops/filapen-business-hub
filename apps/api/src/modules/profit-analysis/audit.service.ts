import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Wrapper um das zentrale AuditLog-Model fuer alle Aenderungen im
 * profit-analysis-Modul. Fire-and-forget: Audit-Fehler duerfen NIE die
 * eigentliche Business-Logic blockieren (siehe NFC-Muster).
 *
 * entityType-Konvention: 'pa.<bereich>' (z.B. 'pa.channel_sales', 'pa.ads',
 * 'pa.wholesale_order', 'pa.overhead_entry', 'pa.month_close').
 */
@Injectable()
export class PaAuditService {
  private readonly logger = new Logger(PaAuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    orgId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    changes?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          orgId: input.orgId,
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          changes: (input.changes ?? null) as any,
        },
      });
    } catch (err) {
      // Audit darf niemals die Business-Logic blockieren
      this.logger.warn(`AuditLog-Write fehlgeschlagen fuer ${input.action}: ${err}`);
    }
  }

  /** Liest Audit-Eintraege fuer eine Entitaet oder ein Modul. */
  async list(orgId: string, filters: {
    entityType?: string;
    entityId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: any = { orgId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;

    // Wenn nur ein Modul-Prefix gefragt ist (pa.*), suche mit startsWith
    if (filters.entityType?.endsWith('.')) {
      delete where.entityType;
      where.entityType = { startsWith: filters.entityType };
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, filters.limit ?? 100),
      skip: filters.offset ?? 0,
      include: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
    });
    const total = await this.prisma.auditLog.count({ where });
    return {
      items: items.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        changes: r.changes,
        createdAt: r.createdAt.toISOString(),
        userId: r.userId,
        userName: r.user
          ? r.user.name || `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || r.user.email
          : null,
      })),
      total,
    };
  }
}
