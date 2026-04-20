import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PurchaseAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    orgId: string,
    userId: string,
    entityType: string,
    entityId: string,
    action: string,
    changes?: any,
    purchaseOrderId?: string,
  ) {
    try {
      await this.prisma.purchaseAuditLog.create({
        data: {
          orgId,
          userId,
          entityType,
          entityId,
          action,
          changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
          purchaseOrderId: purchaseOrderId || (entityType === 'order' ? entityId : null),
        },
      });
    } catch {
      // audit must never break the operation
    }
  }

  async listForOrder(orgId: string, purchaseOrderId: string) {
    return this.prisma.purchaseAuditLog.findMany({
      where: { orgId, purchaseOrderId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
