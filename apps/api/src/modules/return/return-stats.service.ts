import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReturnStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard-Stats fuer die Retouren-Uebersicht — pro Plattform, dazu
   * Top-Ablehnungsgruende und Erstattungssumme.
   */
  async dashboard(orgId: string) {
    const [byStatusAndPlatform, refundSum, rejectReasons] = await Promise.all([
      this.prisma.return.groupBy({
        by: ['platform', 'status'],
        where: { orgId },
        _count: { _all: true },
      }),
      this.prisma.return.aggregate({
        where: { orgId, refundAmount: { not: null } },
        _sum: { refundAmount: true },
        _count: { _all: true },
      }),
      this.prisma.return.groupBy({
        by: ['rejectionReason'],
        where: { orgId, status: 'rejected', rejectionReason: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { rejectionReason: 'desc' } },
        take: 5,
      }),
    ]);

    // KPIs pro Plattform
    const platforms = ['tiktok', 'shopify'] as const;
    const perPlatform = platforms.map((p) => {
      const rows = byStatusAndPlatform.filter((r) => r.platform === p);
      const find = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
      const total = rows.reduce((acc, r) => acc + r._count._all, 0);
      return {
        platform: p,
        open: find('open'),
        in_review: find('in_review'),
        accepted: find('accepted'),
        rejected: find('rejected'),
        refunded: find('refunded'),
        total,
      };
    });

    return {
      perPlatform,
      refunds: {
        total: refundSum._sum.refundAmount ? Number(refundSum._sum.refundAmount.toString()) : 0,
        count: refundSum._count._all,
      },
      topRejectReasons: rejectReasons.map((r) => ({
        reason: r.rejectionReason,
        count: r._count._all,
      })),
    };
  }
}
