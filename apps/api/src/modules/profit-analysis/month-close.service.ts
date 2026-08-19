import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationService } from './calculation.service';

@Injectable()
export class MonthCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: CalculationService,
  ) {}

  /** Monat abschliessen: Snapshot + Status setzen. */
  async close(orgId: string, userId: string, role: string, year: number, month: number, lock = false) {
    const monthRow = await this.getMonthOrThrow(orgId, year, month);
    if (monthRow.status === 'locked' && role !== 'owner') {
      throw new ForbiddenException('Nur Owner kann gesperrten Monat aendern');
    }

    // Berechnung einfrieren
    const computed = await this.calc.computeMonth(orgId, year, month);

    await this.prisma.$transaction([
      this.prisma.paMonthSnapshot.upsert({
        where: { monthId: monthRow.id },
        create: {
          monthId: monthRow.id,
          snapshotJson: computed as any,
          closedById: userId,
        },
        update: {
          snapshotJson: computed as any,
          closedById: userId,
          computedAt: new Date(),
        },
      }),
      this.prisma.paMonth.update({
        where: { id: monthRow.id },
        data: {
          status: lock ? 'locked' : 'closed',
          closedAt: new Date(),
          closedById: userId,
        },
      }),
    ]);

    return { ok: true, status: lock ? 'locked' : 'closed' };
  }

  /** Monat wieder oeffnen — nur Owner. */
  async reopen(orgId: string, userId: string, role: string, year: number, month: number) {
    if (role !== 'owner') throw new ForbiddenException('Nur Owner darf einen gesperrten Monat oeffnen');
    const monthRow = await this.getMonthOrThrow(orgId, year, month);
    await this.prisma.paMonth.update({
      where: { id: monthRow.id },
      data: { status: 'open', closedAt: null, closedById: null },
    });
    return { ok: true, status: 'open' };
  }

  async getSnapshot(orgId: string, year: number, month: number) {
    const monthRow = await this.prisma.paMonth.findUnique({
      where: { orgId_year_month: { orgId, year, month } },
      include: { snapshot: { include: { closedBy: { select: { name: true, firstName: true, lastName: true } } } } },
    });
    if (!monthRow?.snapshot) return null;
    const s = monthRow.snapshot;
    return {
      computedAt: s.computedAt.toISOString(),
      closedById: s.closedById,
      closedByName: s.closedBy
        ? s.closedBy.name || `${s.closedBy.firstName ?? ''} ${s.closedBy.lastName ?? ''}`.trim() || null
        : null,
      snapshot: s.snapshotJson as any,
    };
  }

  private async getMonthOrThrow(orgId: string, year: number, month: number) {
    const row = await this.prisma.paMonth.upsert({
      where: { orgId_year_month: { orgId, year, month } },
      create: { orgId, year, month },
      update: {},
    });
    return row;
  }
}
