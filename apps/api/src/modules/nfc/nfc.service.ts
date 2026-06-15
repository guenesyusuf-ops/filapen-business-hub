import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { generateUniqueCodes, isValidCodeFormat, MAX_BATCH_SIZE } from './nfc-code.helper';

export interface CreateBatchInput {
  count: number;
  name?: string | null;
  notes?: string | null;
}

export interface BandListQuery {
  batchId?: string;
  status?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

@Injectable()
export class NfcService {
  private readonly logger = new Logger(NfcService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl = (this.config.get<string>('NFC_PUBLIC_URL') ?? 'https://nfc4you.de').replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------
  // BATCHES
  // ---------------------------------------------------------------------

  async createBatch(orgId: string, userId: string, data: CreateBatchInput) {
    const count = Math.floor(Number(data.count));
    if (!Number.isFinite(count) || count <= 0) {
      throw new BadRequestException('Anzahl muss > 0 sein');
    }
    if (count > MAX_BATCH_SIZE) {
      throw new BadRequestException(`Maximale Batch-Groesse: ${MAX_BATCH_SIZE}`);
    }

    // Codes generieren
    let codes = generateUniqueCodes(count);

    // Kollisions-Check gegen DB
    const existing = await this.prisma.nfcBand.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    if (existing.length > 0) {
      const used = new Set(existing.map((b) => b.code));
      // Re-generate die kollidierenden Codes
      const fresh: string[] = [];
      const allUsed = new Set([...used, ...codes]);
      while (fresh.length < existing.length) {
        const c = generateUniqueCodes(1)[0];
        if (!allUsed.has(c)) {
          fresh.push(c);
          allUsed.add(c);
        }
      }
      codes = codes.filter((c) => !used.has(c)).concat(fresh);
    }

    // Batch + Bands transactional
    const batch = await this.prisma.$transaction(async (tx) => {
      const b = await tx.nfcBatch.create({
        data: {
          orgId,
          createdById: userId,
          name: data.name?.trim() || null,
          notes: data.notes?.trim() || null,
          count,
        },
      });
      await tx.nfcBand.createMany({
        data: codes.map((code) => ({
          orgId,
          batchId: b.id,
          code,
          status: 'inactive',
        })),
      });
      return b;
    });

    await this.audit(orgId, null, userId, 'batch_created', {
      batchId: batch.id, count, name: data.name,
    });

    this.logger.log(`Batch ${batch.id} (${count} Codes) erstellt von ${userId}`);
    return this.getBatch(orgId, batch.id);
  }

  async listBatches(orgId: string) {
    const batches = await this.prisma.nfcBatch.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { bands: true } },
      },
    });
    // Aktive-Count pro Batch zusaetzlich
    const activeCounts = await this.prisma.nfcBand.groupBy({
      by: ['batchId'],
      where: { orgId, status: 'active' },
      _count: { _all: true },
    });
    const activeMap = new Map(activeCounts.map((a) => [a.batchId, a._count._all]));

    return batches.map((b) => ({
      id: b.id,
      name: b.name,
      notes: b.notes,
      count: b.count,
      createdAt: b.createdAt,
      createdById: b.createdById,
      bandCount: b._count.bands,
      activeCount: activeMap.get(b.id) ?? 0,
    }));
  }

  async getBatch(orgId: string, batchId: string) {
    const batch = await this.prisma.nfcBatch.findFirst({ where: { id: batchId, orgId } });
    if (!batch) throw new NotFoundException('Batch nicht gefunden');
    const [bandCount, activeCount] = await Promise.all([
      this.prisma.nfcBand.count({ where: { batchId } }),
      this.prisma.nfcBand.count({ where: { batchId, status: 'active' } }),
    ]);
    return { ...batch, bandCount, activeCount };
  }

  // ---------------------------------------------------------------------
  // BANDS
  // ---------------------------------------------------------------------

  async listBands(orgId: string, q: BandListQuery) {
    const where: any = { orgId };
    if (q.batchId) where.batchId = q.batchId;
    if (q.status && q.status !== 'all') where.status = q.status;
    if (q.search) {
      where.code = { contains: q.search.trim().toLowerCase(), mode: 'insensitive' };
    }
    const limit = Math.min(500, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10));

    const [items, total] = await Promise.all([
      this.prisma.nfcBand.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          batch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.nfcBand.count({ where }),
    ]);

    return {
      items: items.map((b) => ({
        ...b,
        url: this.bandUrl(b.code),
      })),
      total,
      limit,
      offset,
    };
  }

  /** CSV-Export aller Bands oder eines Batches */
  async exportCsv(orgId: string, batchId?: string): Promise<string> {
    const where: any = { orgId };
    if (batchId) where.batchId = batchId;
    const bands = await this.prisma.nfcBand.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
      include: { batch: { select: { name: true } } },
    });

    const rows = [
      ['code', 'url', 'status', 'batch', 'created_at', 'activated_at', 'scan_count'].join(';'),
      ...bands.map((b) => [
        b.code,
        this.bandUrl(b.code),
        b.status,
        (b.batch.name ?? '').replace(/;/g, ','),
        b.createdAt.toISOString(),
        b.activatedAt?.toISOString() ?? '',
        String(b.scanCount),
      ].join(';')),
    ];
    return rows.join('\n');
  }

  // ---------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------

  async dashboard(orgId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 7);
    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 30);

    const [totalBands, active, inactive, activatedToday, activatedLast7, totalScansLast30] = await Promise.all([
      this.prisma.nfcBand.count({ where: { orgId } }),
      this.prisma.nfcBand.count({ where: { orgId, status: 'active' } }),
      this.prisma.nfcBand.count({ where: { orgId, status: 'inactive' } }),
      this.prisma.nfcBand.count({ where: { orgId, activatedAt: { gte: today } } }),
      this.prisma.nfcBand.count({ where: { orgId, activatedAt: { gte: last7 } } }),
      this.prisma.nfcAuditLog.count({ where: { orgId, type: 'public_scan', createdAt: { gte: last30 } } }),
    ]);

    return {
      totalBands,
      active,
      inactive,
      activatedToday,
      activatedLast7,
      totalScansLast30,
    };
  }

  // ---------------------------------------------------------------------
  // AUDIT-LOG
  // ---------------------------------------------------------------------

  async audit(
    orgId: string,
    bandId: string | null,
    actorId: string | null,
    type: string,
    metadata?: any,
    ip?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.nfcAuditLog.create({
        data: {
          orgId,
          bandId: bandId ?? undefined,
          actorId: actorId ?? undefined,
          type,
          ipAddress: ip ?? undefined,
          userAgent: userAgent ?? undefined,
          metadata: metadata ?? undefined,
        },
      });
    } catch (err) {
      // Audit-Failures duerfen Business-Logic nicht blocken
      this.logger.error(`Audit-Log failed: ${(err as any)?.message}`);
    }
  }

  async listAuditLog(orgId: string, limit = 100) {
    return this.prisma.nfcAuditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, limit),
    });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  bandUrl(code: string): string {
    return `${this.publicBaseUrl}/${code}`;
  }

  async findBandByCode(code: string) {
    if (!isValidCodeFormat(code)) return null;
    return this.prisma.nfcBand.findUnique({
      where: { code },
      include: { activation: true },
    });
  }
}
